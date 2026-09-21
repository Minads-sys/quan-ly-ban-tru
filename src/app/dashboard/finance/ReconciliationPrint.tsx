'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { getReconciliationData, ReconciliationDayRow, ReconciliationResult } from './actions'
import { formatVND } from '@/utils/formatNumber'
import { exportElementToPdf } from '@/utils/exportPdf'
import { Printer, Download, X, FileSpreadsheet, RefreshCw, Eye, EyeOff, Loader2 } from 'lucide-react'

interface ReconciliationPrintProps {
    type: 'student' | 'teacher'
    startDate: string
    endDate: string
    onClose: () => void
}

export function ReconciliationPrint({
    type: initialType,
    startDate: initialStartDate,
    endDate: initialEndDate,
    onClose,
}: ReconciliationPrintProps) {
    // 1. Bộ lọc & Tùy chọn
    const [mealType, setMealType] = useState<'student' | 'teacher'>(initialType)
    const [startDate, setStartDate] = useState<string>(initialStartDate)
    const [endDate, setEndDate] = useState<string>(initialEndDate)
    const [signDate, setSignDate] = useState<string>(initialEndDate)
    const [titleStyle, setTitleStyle] = useState<'parentheses' | 'inline'>('parentheses')
    const [companyLineStyle, setCompanyLineStyle] = useState<'two-lines' | 'one-line'>('two-lines')
    const [hideZeroMeals, setHideZeroMeals] = useState<boolean>(true)
    const [isExporting, setIsExporting] = useState<boolean>(false)

    // 2. Dữ liệu tải từ server
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<ReconciliationResult | null>(null)

    // 3. Cho phép ghi đè thông tin hiển thị nếu cần thiết
    const [customUnitPrice, setCustomUnitPrice] = useState<number | ''>('')
    const [schoolName, setSchoolName] = useState<string>('Trường THPT Thanh Đa')
    const [schoolRepresentative, setSchoolRepresentative] = useState<string>('LÊ THỊ HÀ GIANG')
    const [companyName, setCompanyName] = useState<string>('CÔNG TY TNHH CHÂU PHƯƠNG THẢO')
    const [companyRepresentative, setCompanyRepresentative] = useState<string>('NGUYỄN THỊ THU TRANG')
    const [supplierSignTitle, setSupplierSignTitle] = useState<string>('ĐẠI DIỆN CÔNG TY TNHH CHÂU PHƯƠNG THẢO')
    const [city, setCity] = useState<string>('Tp Hồ Chí Minh')

    // Tải dữ liệu từ server
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await getReconciliationData(
                mealType, 
                startDate, 
                endDate
            )
            if ('data' in res) {
                setData(res.data)
                setSchoolName(res.data.schoolName)
                setSchoolRepresentative(res.data.schoolRepresentative)
                setCompanyName(res.data.companyName)
                setCompanyRepresentative(res.data.companyRepresentative)
                setCity(res.data.companyCity)
                setCustomUnitPrice(res.data.unitPrice)

                // Tự động suy ra chức danh ký bên cung cấp
                if (res.data.companyName.toUpperCase().includes('CHÂU PHƯƠNG THẢO')) {
                    setSupplierSignTitle('ĐẠI DIỆN CÔNG TY TNHH CHÂU PHƯƠNG THẢO')
                } else {
                    setSupplierSignTitle(`ĐẠI DIỆN ${res.data.companyName.toUpperCase()}`)
                }
            } else {
                alert(res.error)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [mealType, startDate, endDate])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Đơn giá đang áp dụng
    const activeUnitPrice = useMemo(() => {
        if (typeof customUnitPrice === 'number' && customUnitPrice > 0) return customUnitPrice
        return data?.unitPrice || (mealType === 'student' ? 38000 : 17000)
    }, [customUnitPrice, data?.unitPrice, mealType])

    // Lọc danh sách ngày hiển thị
    const displayedRows: ReconciliationDayRow[] = useMemo(() => {
        if (!data?.rows) return []
        const list = hideZeroMeals ? data.rows.filter(r => r.totalMeals > 0) : data.rows
        // Tính lại đơn giá và thành tiền theo activeUnitPrice
        return list.map(r => ({
            ...r,
            unitPrice: activeUnitPrice,
            totalAmount: r.totalMeals * activeUnitPrice,
        }))
    }, [data?.rows, hideZeroMeals, activeUnitPrice])

    // Tổng số suất và tổng tiền
    const grandTotalMeals = useMemo(() => {
        return displayedRows.reduce((sum, r) => sum + r.totalMeals, 0)
    }, [displayedRows])

    const grandTotalAmount = useMemo(() => {
        return displayedRows.reduce((sum, r) => sum + r.totalAmount, 0)
    }, [displayedRows])

    // Format ngày hiển thị dạng dd/mm/yyyy
    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr) return ''
        const [y, m, d] = dateStr.split('-')
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
    }

    // Ngày ký biên bản: "Tp Hồ Chí Minh, ngày 15 tháng 5 năm 2026"
    const formattedSignDateText = useMemo(() => {
        if (!signDate) return ''
        const [y, m, d] = signDate.split('-')
        return `${city}, ngày ${parseInt(d, 10)} tháng ${parseInt(m, 10)} năm ${y}`
    }, [signDate, city])

    // Tự động định dạng tên công ty thành 1 dòng hoặc 2 dòng cân đối
    // Tránh tình trạng rớt 1 chữ đơn độc như "Thảo" xuống dòng tiếp theo
    const companyFormattedLines = useMemo(() => {
        const raw = (companyName || '').trim()
        const upper = raw.toUpperCase()

        // 1. Nếu người dùng chọn hiển thị 1 dòng
        if (companyLineStyle === 'one-line') {
            return [upper]
        }

        // Tôn trọng ngắt dòng thủ công nếu có
        if (raw.includes('\n')) {
            return raw.split('\n').map(s => s.trim().toUpperCase()).filter(Boolean)
        }

        // 2. Mặc định 2 dòng: Tách chuẩn theo CHÂU PHƯƠNG THẢO hoặc CĂN TIN
        if (upper.includes('CHÂU PHƯƠNG THẢO')) {
            const idx = upper.indexOf('CHÂU PHƯƠNG THẢO')
            const part1 = upper.substring(0, idx).trim()
            const part2 = upper.substring(idx).trim()
            if (part1 && part2) {
                return [part1, part2]
            }
        }

        if (upper.includes('CĂN TIN')) {
            const idx = upper.indexOf('CĂN TIN') + 'CĂN TIN'.length
            const part1 = upper.substring(0, idx).trim()
            const part2 = upper.substring(idx).trim()
            if (part1 && part2) {
                return [part1, part2]
            }
        }

        const words = upper.split(/\s+/)
        if (words.length > 3) {
            const mid = Math.ceil(words.length / 2)
            return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
        }

        return [upper]
    }, [companyName, companyLineStyle])

    // In trực tiếp & Lưu PDF qua Isolated Iframe (Khổ A4 Dọc chuẩn, chống xung đột CSS)
    const handlePrint = useCallback(() => {
        const typeText = mealType === 'student' ? 'HỌC SINH' : 'GIÁO VIÊN'
        const mainTitleHtml = titleStyle === 'inline' 
            ? `BIÊN BẢN ĐỐI CHIẾU CUNG CẤP SUẤT ĂN<div style="font-size: 13.5pt; font-weight: bold; text-transform: uppercase; margin-top: 3px;">${typeText}</div>`
            : `BIÊN BẢN ĐỐI CHIẾU CUNG CẤP SUẤT ĂN<div style="font-size: 13.5pt; font-weight: bold; text-transform: uppercase; margin-top: 3px;">(${typeText})</div>`

        const rowsHtml = displayedRows.map(row => `
            <tr>
                <td style="border: 1px solid #000000; padding: 7px 8px; vertical-align: middle; text-align: left;">${row.formattedDate}</td>
                <td style="border: 1px solid #000000; padding: 7px 8px; vertical-align: middle; text-align: left;">${row.dayOfWeek}</td>
                <td style="border: 1px solid #000000; padding: 7px 8px; vertical-align: middle; text-align: right;">${formatVND(row.totalMeals)}</td>
                <td style="border: 1px solid #000000; padding: 7px 8px; vertical-align: middle; text-align: right;">${formatVND(row.unitPrice)}</td>
                <td style="border: 1px solid #000000; padding: 7px 8px; vertical-align: middle; text-align: right;">${formatVND(row.totalAmount)}</td>
                <td style="border: 1px solid #000000; border-right: 1.5px solid #000000; padding: 7px 8px; vertical-align: middle; text-align: left;">${row.note || ''}</td>
            </tr>
        `).join('')

        const printHtml = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Biên Bản Đối Chiếu Suất Ăn - ${schoolName}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 20mm;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.35;
            color: #000000;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .container {
            width: 100%;
            margin: 0 auto;
        }
        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .header-table td.school-cell {
            width: 42%;
            text-align: center;
            vertical-align: top;
            font-weight: bold;
            font-size: 13pt;
            border: none;
            padding: 0 4px;
            line-height: 1.35;
        }
        .header-table td.company-cell {
            width: 58%;
            text-align: center;
            vertical-align: top;
            font-weight: bold;
            font-size: 12.5pt;
            border: none;
            padding: 0 4px;
            line-height: 1.35;
        }
        .header-company-line {
            white-space: nowrap;
        }
        .title-block {
            text-align: center;
            margin-top: 6px;
            margin-bottom: 18px;
        }
        .title-block h1 {
            font-size: 15.5pt;
            font-weight: bold;
            text-transform: uppercase;
        }
        .title-block p {
            font-size: 12pt;
            font-style: italic;
            margin-top: 4px;
        }
        table.data-table {
            width: calc(100% - 2px);
            margin: 0 auto 20px auto;
            border-collapse: collapse;
            border: 1px solid #000000;
            border-right: 1.5px solid #000000;
        }
        table.data-table th, table.data-table td {
            border: 1px solid #000000;
            padding: 7px 8px;
            font-size: 11pt;
            vertical-align: middle;
            line-height: 1.35;
        }
        table.data-table th:last-child, table.data-table td:last-child {
            border-right: 1.5px solid #000000;
        }
        table.data-table th {
            font-weight: bold;
            background-color: transparent;
            vertical-align: middle;
            padding: 8px 8px;
        }
        .sign-date {
            text-align: right;
            font-size: 12pt;
            margin-bottom: 16px;
            padding-right: 4px;
        }
        .signatures-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .signatures-table td {
            vertical-align: top;
            text-align: center;
            border: none;
            padding: 0 4px;
            font-size: 12pt;
        }
        .signatures-table td.school-col {
            width: 44%;
        }
        .signatures-table td.supplier-col {
            width: 56%;
        }
        .sig-title {
            font-weight: bold;
            text-transform: uppercase;
            line-height: 1.35;
            white-space: nowrap;
        }
        .sig-space {
            height: 70px;
        }
        .sig-name {
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            white-space: nowrap;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <table class="header-table">
            <tr>
                <td class="school-cell">${schoolName}</td>
                <td class="company-cell">
                    ${companyFormattedLines.map(line => `<div class="header-company-line">${line}</div>`).join('')}
                </td>
            </tr>
        </table>

        <!-- Tiêu đề chính -->
        <div class="title-block">
            <h1>${mainTitleHtml}</h1>
            <p>Từ ngày ${formatDisplayDate(startDate)} đến ngày ${formatDisplayDate(endDate)}</p>
        </div>

        <!-- Bảng số liệu -->
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 16%; text-align: left; vertical-align: middle; padding: 8px 8px;">Ngày</th>
                    <th style="width: 14%; text-align: left; vertical-align: middle; padding: 8px 8px;">Thứ</th>
                    <th style="width: 16%; text-align: right; vertical-align: middle; padding: 8px 8px;">Tổng Suất</th>
                    <th style="width: 16%; text-align: right; vertical-align: middle; padding: 8px 8px;">Đơn giá</th>
                    <th style="width: 22%; text-align: right; vertical-align: middle; padding: 8px 8px;">Thành tiền</th>
                    <th style="width: 16%; text-align: left; vertical-align: middle; padding: 8px 8px; border-right: 1.5px solid #000000;">Ghi chú</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
                ${displayedRows.length === 0 ? `
                    <tr>
                        <td colspan="6" style="text-align: center; vertical-align: middle; padding: 14px; font-style: italic; border: 1px solid #000000; border-right: 1.5px solid #000000;">
                            Không có dữ liệu suất ăn trong khoảng thời gian này.
                        </td>
                    </tr>
                ` : ''}
                <tr style="font-weight: bold;">
                    <td style="border: 1px solid #000000; padding: 8px 8px; vertical-align: middle; text-align: left;">TỔNG CỘNG</td>
                    <td style="border: 1px solid #000000; padding: 8px 8px; vertical-align: middle;"></td>
                    <td style="border: 1px solid #000000; padding: 8px 8px; vertical-align: middle; text-align: right;">${formatVND(grandTotalMeals)}</td>
                    <td style="border: 1px solid #000000; padding: 8px 8px; vertical-align: middle;"></td>
                    <td style="border: 1px solid #000000; padding: 8px 8px; vertical-align: middle; text-align: right;">${formatVND(grandTotalAmount)}</td>
                    <td style="border: 1px solid #000000; border-right: 1.5px solid #000000; padding: 8px 8px; vertical-align: middle;"></td>
                </tr>
            </tbody>
        </table>

        <!-- Ngày ký -->
        <div class="sign-date">
            ${formattedSignDateText}
        </div>

        <!-- Chữ ký -->
        <table class="signatures-table">
            <tr>
                <td class="school-col">
                    <div class="sig-title">BÊN ĐẶT HÀNG</div>
                    <div class="sig-title">ĐẠI DIỆN NHÀ TRƯỜNG</div>
                    <div class="sig-space"></div>
                    <div class="sig-name">${schoolRepresentative}</div>
                </td>
                <td class="supplier-col">
                    <div class="sig-title">BÊN CUNG CẤP</div>
                    <div class="sig-title">${supplierSignTitle}</div>
                    <div class="sig-space"></div>
                    <div class="sig-name">${companyRepresentative}</div>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
        `

        let iframe = document.getElementById('reconciliation-print-frame') as HTMLIFrameElement
        if (!iframe) {
            iframe = document.createElement('iframe')
            iframe.id = 'reconciliation-print-frame'
            iframe.style.position = 'fixed'
            iframe.style.top = '-10000px'
            iframe.style.left = '-10000px'
            iframe.style.width = '210mm'
            iframe.style.height = '297mm'
            iframe.style.border = 'none'
            document.body.appendChild(iframe)
        }

        const frameDoc = iframe.contentWindow?.document
        if (!frameDoc) return

        frameDoc.open()
        frameDoc.write(printHtml)
        frameDoc.close()

        setTimeout(() => {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
        }, 300)
    }, [
        schoolName,
        companyName,
        companyFormattedLines,
        titleStyle,
        mealType,
        startDate,
        endDate,
        displayedRows,
        grandTotalMeals,
        grandTotalAmount,
        formattedSignDateText,
        schoolRepresentative,
        supplierSignTitle,
        companyRepresentative,
    ])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
                e.preventDefault()
                handlePrint()
            }
            if (e.key === 'Escape') {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handlePrint, onClose])

    // Tải trực tiếp file PDF về máy tính (không qua hộp thoại in)
    const handleExportPdf = async () => {
        setIsExporting(true)
        try {
            const typeSlug = mealType === 'student' ? 'Hoc_sinh' : 'Giao_vien'
            const fileName = `Bien_ban_doi_chieu_${typeSlug}_${startDate}_${endDate}.pdf`
            await exportElementToPdf('reconciliation-document', fileName)
        } catch (err) {
            console.error('Lỗi xuất PDF:', err)
            alert('Có lỗi khi tạo file PDF, vui lòng thử lại hoặc sử dụng nút In trực tiếp.')
        } finally {
            setIsExporting(false)
        }
    }

    // Xuất file Excel chuẩn cấu trúc biên bản
    const handleExportExcel = async () => {
        const XLSX = await import('xlsx')
        const typeText = mealType === 'student' ? 'HỌC SINH' : 'GIÁO VIÊN'
        const mainTitle = `BIÊN BẢN ĐỐI CHIẾU CUNG CẤP SUẤT ĂN (${typeText})`

        const dateSubTitle = `Từ ngày ${formatDisplayDate(startDate)} đến ngày ${formatDisplayDate(endDate)}`

        const headers = ['Ngày', 'Thứ', 'Tổng Suất', 'Đơn giá', 'Thành tiền', 'Ghi chú']
        const dataRows = displayedRows.map(r => [
            r.formattedDate,
            r.dayOfWeek,
            r.totalMeals,
            r.unitPrice,
            r.totalAmount,
            r.note,
        ])

        const totalRow = [
            'TỔNG CỘNG',
            '',
            grandTotalMeals,
            '',
            grandTotalAmount,
            '',
        ]

        const wsData = [
            [schoolName, '', '', '', companyName, ''],
            [],
            ['', '', mainTitle, '', '', ''],
            ['', '', dateSubTitle, '', '', ''],
            [],
            headers,
            ...dataRows,
            totalRow,
            [],
            ['', '', '', '', formattedSignDateText, ''],
            ['BÊN ĐẶT HÀNG', '', '', '', 'BÊN CUNG CẤP', ''],
            ['ĐẠI DIỆN NHÀ TRƯỜNG', '', '', '', supplierSignTitle, ''],
            [],
            [],
            [schoolRepresentative, '', '', '', companyRepresentative, ''],
        ]

        const ws = XLSX.utils.aoa_to_sheet(wsData)
        ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 18 }]

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'BienBanDoiChieu')
        XLSX.writeFile(wb, `Bien_ban_doi_chieu_${mealType === 'student' ? 'Hoc_sinh' : 'Giao_vien'}_${startDate}_${endDate}.xlsx`)
    }

    return (
        <div className="fixed inset-0 bg-black/65 z-[200] overflow-y-auto backdrop-blur-sm print:p-0 print:bg-white print:static print:overflow-visible">
            {/* Thanh công cụ điều khiển (ẨN KHI IN) */}
            <div className="sticky top-0 z-10 bg-gray-900 text-white shadow-xl px-4 py-3 print:hidden border-b border-gray-800">
                <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    {/* Tiêu đề thanh công cụ */}
                    <div className="flex items-center gap-2.5">
                        <span className="text-xl">📑</span>
                        <div>
                            <h2 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                                Biên Bản Đối Chiếu Suất Ăn
                                <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                                    Khổ A4 Dọc
                                </span>
                            </h2>
                            <p className="text-[11px] text-gray-400">Kiểm tra thông tin trước khi in hoặc lưu PDF</p>
                        </div>
                    </div>

                    {/* Bộ lọc tùy chọn */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {/* Chọn Học sinh / Giáo viên */}
                        <div className="flex bg-gray-800 p-0.5 rounded-lg border border-gray-700">
                            <button
                                onClick={() => {
                                    if (mealType !== 'student') {
                                        setCustomUnitPrice('')
                                        setMealType('student')
                                    }
                                }}
                                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                                    mealType === 'student' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-300 hover:text-white'
                                }`}
                            >
                                🎓 Học sinh
                            </button>
                            <button
                                onClick={() => {
                                    if (mealType !== 'teacher') {
                                        setCustomUnitPrice('')
                                        setMealType('teacher')
                                    }
                                }}
                                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                                    mealType === 'teacher' ? 'bg-rose-600 text-white shadow-sm' : 'text-gray-300 hover:text-white'
                                }`}
                            >
                                👩‍🏫 Giáo viên
                            </button>
                        </div>

                        {/* Chọn khoảng ngày */}
                        <div className="flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded-lg border border-gray-700">
                            <span className="text-gray-400 text-[11px]">Từ:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="bg-transparent text-white font-medium outline-none cursor-pointer text-xs [color-scheme:dark]"
                                style={{ color: '#ffffff' }}
                            />
                            <span className="text-gray-400 text-[11px]">Đến:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => {
                                    setEndDate(e.target.value)
                                    setSignDate(e.target.value)
                                }}
                                className="bg-transparent text-white font-medium outline-none cursor-pointer text-xs [color-scheme:dark]"
                                style={{ color: '#ffffff' }}
                            />
                        </div>

                        {/* Ngày ký */}
                        <div className="flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded-lg border border-gray-700">
                            <span className="text-gray-400 text-[11px]">Ngày ký:</span>
                            <input
                                type="date"
                                value={signDate}
                                onChange={e => setSignDate(e.target.value)}
                                className="bg-transparent text-teal-300 font-medium outline-none cursor-pointer text-xs [color-scheme:dark]"
                                style={{ color: '#5eead4' }}
                            />
                        </div>

                        {/* Đơn giá */}
                        <div className="flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded-lg border border-gray-700">
                            <span className="text-gray-400 text-[11px]">Đơn giá:</span>
                            <input
                                type="number"
                                step="1000"
                                value={customUnitPrice}
                                onChange={e => setCustomUnitPrice(Number(e.target.value) || '')}
                                className="bg-transparent text-amber-300 font-bold outline-none w-20 text-right text-xs [color-scheme:dark]"
                                style={{ color: '#fcd34d' }}
                                placeholder={mealType === 'student' ? '38000' : '17000'}
                            />
                            <span className="text-gray-400 text-[10px]">đ</span>
                        </div>

                        {/* Lọc ẩn ngày 0 suất */}
                        <button
                            type="button"
                            onClick={() => setHideZeroMeals(!hideZeroMeals)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] transition-all ${
                                hideZeroMeals
                                    ? 'bg-gray-800 border-gray-600 text-teal-300'
                                    : 'bg-gray-800/50 border-gray-700 text-gray-400'
                            }`}
                            title="Ẩn những ngày không phát sinh suất ăn (cuối tuần, ngày nghỉ)"
                        >
                            {hideZeroMeals ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{hideZeroMeals ? 'Ẩn ngày 0 suất' : 'Hiện đủ các ngày'}</span>
                        </button>
                    </div>

                    {/* Nhóm nút hành động */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadData}
                            disabled={loading}
                            className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-all"
                            title="Tải lại dữ liệu"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>

                        <button
                            onClick={handleExportExcel}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-md transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Xuất Excel
                        </button>

                        <button
                            onClick={handlePrint}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer"
                            title="Hộp thoại in sẽ tự động cài đặt Khổ A4 Dọc (Portrait)"
                        >
                            <Printer className="w-3.5 h-3.5" /> In trực tiếp
                        </button>

                        <button
                            onClick={handleExportPdf}
                            disabled={isExporting}
                            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer"
                            title="Tải trực tiếp file PDF về máy tính (không cần mở hộp thoại in)"
                        >
                            {isExporting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Đang tạo PDF...</span>
                                </>
                            ) : (
                                <>
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Xuất file PDF</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer ml-1"
                            title="Đóng xem trước"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Thanh điều chỉnh thông tin người ký & tiêu đề (gấp mở đơn giản) */}
                <div className="max-w-6xl mx-auto mt-2 pt-2 border-t border-gray-800 flex flex-wrap items-center justify-between text-xs text-gray-400 gap-2">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Tùy chọn tiêu đề */}
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-gray-300">Tiêu đề:</span>
                            <label className="flex items-center gap-1 cursor-pointer text-gray-200">
                                <input
                                    type="radio"
                                    name="titleStyle"
                                    checked={titleStyle === 'parentheses'}
                                    onChange={() => setTitleStyle('parentheses')}
                                    className="accent-teal-500"
                                />
                                <span>Có ngoặc: ({mealType === 'student' ? 'HỌC SINH' : 'GIÁO VIÊN'})</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer text-gray-200">
                                <input
                                    type="radio"
                                    name="titleStyle"
                                    checked={titleStyle === 'inline'}
                                    onChange={() => setTitleStyle('inline')}
                                    className="accent-teal-500"
                                />
                                <span>Không ngoặc: {mealType === 'student' ? 'HỌC SINH' : 'GIÁO VIÊN'}</span>
                            </label>
                        </div>

                        {/* Tùy chọn định dạng tên công ty ở đầu trang */}
                        <div className="flex items-center gap-2 border-l border-gray-700 pl-3">
                            <span className="text-[11px] font-semibold text-gray-300">Tên công ty:</span>
                            <label className="flex items-center gap-1 cursor-pointer text-gray-200">
                                <input
                                    type="radio"
                                    name="companyLineStyle"
                                    checked={companyLineStyle === 'two-lines'}
                                    onChange={() => setCompanyLineStyle('two-lines')}
                                    className="accent-teal-500"
                                />
                                <span>2 dòng (Chuẩn)</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer text-gray-200">
                                <input
                                    type="radio"
                                    name="companyLineStyle"
                                    checked={companyLineStyle === 'one-line'}
                                    onChange={() => setCompanyLineStyle('one-line')}
                                    className="accent-teal-500"
                                />
                                <span>1 dòng</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                            <span className="text-[10px] text-gray-400">Đại diện trường:</span>
                            <input
                                type="text"
                                value={schoolRepresentative}
                                onChange={e => setSchoolRepresentative(e.target.value)}
                                className="bg-transparent text-white text-xs outline-none w-36 font-semibold [color-scheme:dark]"
                                style={{ color: '#ffffff' }}
                            />
                        </div>
                        <div className="flex items-center gap-1 bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                            <span className="text-[10px] text-gray-400">Đại diện công ty:</span>
                            <input
                                type="text"
                                value={companyRepresentative}
                                onChange={e => setCompanyRepresentative(e.target.value)}
                                className="bg-transparent text-white text-xs outline-none w-40 font-semibold [color-scheme:dark]"
                                style={{ color: '#ffffff' }}
                            />
                        </div>
                        <div className="flex items-center gap-1 bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                            <span className="text-[10px] text-gray-400">Chức danh ký:</span>
                            <input
                                type="text"
                                value={supplierSignTitle}
                                onChange={e => setSupplierSignTitle(e.target.value)}
                                className="bg-transparent text-white text-xs outline-none w-48 font-semibold [color-scheme:dark]"
                                style={{ color: '#ffffff' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Khung tài liệu A4 Dọc Xem trước & In */}
            <div className="py-8 px-4 flex justify-center print:p-0 print:m-0">
                <div
                    id="reconciliation-document"
                    className="w-[210mm] min-h-[297mm] bg-white text-black p-[15mm_15mm_15mm_20mm] shadow-2xl print:shadow-none print:w-full print:min-h-0 print:p-0"
                    style={{
                        fontFamily: "'Times New Roman', Times, serif",
                        color: '#000000',
                        fontSize: '13pt',
                        lineHeight: '1.35',
                    }}
                >
                    {/* Header: Trường bên trái, Công ty bên phải */}
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-[42%] text-center">
                            <div className="font-bold text-[13pt] leading-snug">
                                {schoolName}
                            </div>
                        </div>
                        <div className="w-[58%] text-center">
                            {companyFormattedLines.map((line, idx) => (
                                <div key={idx} className="font-bold text-[12.5pt] leading-snug whitespace-nowrap">
                                    {line}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tiêu đề chính */}
                    <div className="text-center mt-3 mb-5">
                        <h1 className="text-[16pt] font-bold uppercase tracking-normal">
                            BIÊN BẢN ĐỐI CHIẾU CUNG CẤP SUẤT ĂN
                        </h1>
                        <div className="text-[13.5pt] font-bold uppercase mt-1">
                            {titleStyle === 'inline' 
                                ? (mealType === 'student' ? 'HỌC SINH' : 'GIÁO VIÊN')
                                : `(${mealType === 'student' ? 'HỌC SINH' : 'GIÁO VIÊN'})`}
                        </div>
                        <p className="text-[13pt] mt-1 italic">
                            Từ ngày {formatDisplayDate(startDate)} đến ngày {formatDisplayDate(endDate)}
                        </p>
                    </div>

                    {/* Bảng đối chiếu số liệu theo ngày */}
                    <div className="mb-6 pr-[2px]">
                        <table 
                            className="border-collapse"
                            style={{
                                border: '1px solid #000000',
                                borderRight: '1.5px solid #000000',
                                borderCollapse: 'collapse',
                                width: 'calc(100% - 2px)',
                                margin: '0 auto',
                            }}
                        >
                            <thead>
                                <tr style={{ backgroundColor: '#ffffff' }}>
                                    <th style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'middle', textAlign: 'left', width: '16%', fontWeight: 'bold' }}>
                                        Ngày
                                    </th>
                                    <th style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'middle', textAlign: 'left', width: '14%', fontWeight: 'bold' }}>
                                        Thứ
                                    </th>
                                    <th style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'middle', textAlign: 'right', width: '16%', fontWeight: 'bold' }}>
                                        Tổng Suất
                                    </th>
                                    <th style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'middle', textAlign: 'right', width: '16%', fontWeight: 'bold' }}>
                                        Đơn giá
                                    </th>
                                    <th style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'middle', textAlign: 'right', width: '22%', fontWeight: 'bold' }}>
                                        Thành tiền
                                    </th>
                                    <th style={{ border: '1px solid #000000', borderRight: '1.5px solid #000000', padding: '8px 8px', verticalAlign: 'middle', textAlign: 'left', width: '16%', fontWeight: 'bold' }}>
                                        Ghi chú
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedRows.map((row) => (
                                    <tr key={row.date}>
                                        <td style={{ border: '1px solid #000000', padding: '7px 8px', verticalAlign: 'middle', textAlign: 'left' }}>
                                            {row.formattedDate}
                                        </td>
                                        <td style={{ border: '1px solid #000000', padding: '7px 8px', verticalAlign: 'middle', textAlign: 'left' }}>
                                            {row.dayOfWeek}
                                        </td>
                                        <td style={{ border: '1px solid #000000', padding: '7px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
                                            {formatVND(row.totalMeals)}
                                        </td>
                                        <td style={{ border: '1px solid #000000', padding: '7px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
                                            {formatVND(row.unitPrice)}
                                        </td>
                                        <td style={{ border: '1px solid #000000', padding: '7px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
                                            {formatVND(row.totalAmount)}
                                        </td>
                                        <td style={{ border: '1px solid #000000', borderRight: '1.5px solid #000000', padding: '7px 8px', verticalAlign: 'middle', textAlign: 'left' }}>
                                            {row.note}
                                        </td>
                                    </tr>
                                ))}

                                {displayedRows.length === 0 && (
                                    <tr>
                                        <td colSpan={6} style={{ border: '1px solid #000000', borderRight: '1.5px solid #000000', padding: '16px', verticalAlign: 'middle', textAlign: 'center', fontStyle: 'italic' }}>
                                            {loading ? 'Đang tải dữ liệu...' : 'Không có dữ liệu suất ăn trong khoảng thời gian này.'}
                                        </td>
                                    </tr>
                                )}

                                {/* Hàng TỔNG CỘNG */}
                                <tr style={{ fontWeight: 'bold' }}>
                                    <td style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'middle', textAlign: 'left' }}>
                                        TỔNG CỘNG
                                    </td>
                                    <td style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'middle' }}>
                                        {/* Ô Thứ để trống theo đúng ảnh mẫu */}
                                    </td>
                                    <td style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
                                        {formatVND(grandTotalMeals)}
                                    </td>
                                    <td style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'middle' }}>
                                        {/* Ô Đơn giá để trống theo đúng ảnh mẫu */}
                                    </td>
                                    <td style={{ border: '1px solid #000000', padding: '8px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
                                        {formatVND(grandTotalAmount)}
                                    </td>
                                    <td style={{ border: '1px solid #000000', borderRight: '1.5px solid #000000', padding: '8px 8px', verticalAlign: 'middle' }}>
                                        {/* Ô Ghi chú để trống */}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Dòng ngày tháng địa điểm (căn phải) */}
                    <div className="text-right mb-6 text-[13pt] pr-2">
                        <span>{formattedSignDateText}</span>
                    </div>

                    {/* Khối chữ ký hai bên */}
                    <div className="flex justify-between items-start text-center text-[12pt] mt-4">
                        {/* Cột Bên đặt hàng (Nhà trường) */}
                        <div className="w-[44%] flex flex-col items-center justify-between min-h-[140px]">
                            <div>
                                <div className="font-bold uppercase whitespace-nowrap">BÊN ĐẶT HÀNG</div>
                                <div className="font-bold uppercase whitespace-nowrap">ĐẠI DIỆN NHÀ TRƯỜNG</div>
                            </div>
                            <div className="font-bold uppercase tracking-wide whitespace-nowrap">
                                {schoolRepresentative}
                            </div>
                        </div>

                        {/* Cột Bên cung cấp (Doanh nghiệp căn tin) */}
                        <div className="w-[56%] flex flex-col items-center justify-between min-h-[140px]">
                            <div>
                                <div className="font-bold uppercase whitespace-nowrap">BÊN CUNG CẤP</div>
                                <div className="font-bold uppercase whitespace-nowrap">{supplierSignTitle}</div>
                            </div>
                            <div className="font-bold uppercase tracking-wide whitespace-nowrap">
                                {companyRepresentative}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
