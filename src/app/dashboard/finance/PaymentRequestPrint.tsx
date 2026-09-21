'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { CompanyPaymentSettings } from './actions'
import { formatVND } from '@/utils/formatNumber'
import { numberToVietnameseWords } from '@/utils/numberToWords'
import { exportElementToPdf } from '@/utils/exportPdf'
import { Printer, Download, X, Calendar, Settings as SettingsIcon, AlertCircle, Loader2 } from 'lucide-react'

interface PaymentRequestPrintProps {
    settings: CompanyPaymentSettings
    startDate: string
    endDate: string
    studentMealMoney: number
    teacherMealMoney: number
    totalAllMoney: number
    initialAmount?: number
    onClose: () => void
}

export function PaymentRequestPrint({
    settings,
    startDate: initialStartDate,
    endDate: initialEndDate,
    studentMealMoney,
    teacherMealMoney,
    totalAllMoney,
    initialAmount,
    onClose,
}: PaymentRequestPrintProps) {
    // Ngày lập giấy (mặc định hôm nay)
    const todayStr = useMemo(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }, [])

    const [requestDate, setRequestDate] = useState<string>(todayStr)
    const [startDate, setStartDate] = useState<string>(initialStartDate)
    const [endDate, setEndDate] = useState<string>(initialEndDate)
    const [mealType, setMealType] = useState<'student' | 'teacher' | 'all' | 'custom'>(
        typeof initialAmount === 'number' && initialAmount > 0 ? 'custom' : 'all'
    )
    const [customAmount, setCustomAmount] = useState<number>(
        typeof initialAmount === 'number' && initialAmount > 0 ? initialAmount : totalAllMoney
    )
    const [isExporting, setIsExporting] = useState<boolean>(false)

    // Xác định số tiền theo lựa chọn
    const amount = useMemo(() => {
        if (mealType === 'student') return studentMealMoney
        if (mealType === 'teacher') return teacherMealMoney
        if (mealType === 'all') return totalAllMoney
        return customAmount
    }, [mealType, studentMealMoney, teacherMealMoney, totalAllMoney, customAmount])

    // Format ngày hiển thị d/m/yyyy (không có số 0 đệm theo đúng ảnh mẫu: 16/5/2026)
    const formatShortDate = useCallback((dateStr: string) => {
        if (!dateStr) return ''
        const [y, m, d] = dateStr.split('-')
        return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`
    }, [])

    // Tách ngày tháng năm của Ngày lập giấy
    const parsedReqDate = useMemo(() => {
        if (!requestDate) return { day: '', month: '', year: '' }
        const [y, m, d] = requestDate.split('-')
        return {
            day: parseInt(d, 10),
            month: parseInt(m, 10),
            year: y,
        }
    }, [requestDate])

    // Lọc bỏ danh xưng "Bà", "Ông" ở chữ ký cuối nếu có
    const representativeSignatureName = useMemo(() => {
        return settings.companyRepresentative.replace(/^(Bà|Ông)\s+/i, '').trim().toUpperCase()
    }, [settings.companyRepresentative])

    // Tách 2 dòng tên công ty chuẩn xác:
    // Dòng 1: CÔNG TY TNHH CĂN TIN
    // Dòng 2: CHÂU PHƯƠNG THẢO
    const companyFormattedLines = useMemo(() => {
        const raw = (settings.companyName || '').trim()
        const upper = raw.toUpperCase()
        
        // Ưu tiên tách chuẩn: CÔNG TY TNHH CĂN TIN / CHÂU PHƯƠNG THẢO
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
        if (words.length > 4) {
            const mid = Math.ceil(words.length / 2)
            return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
        }
        return [upper, '']
    }, [settings.companyName])

    const handlePrint = useCallback(() => {
        if (!settings.canPrint) {
            alert('Bạn không có quyền in Giấy đề nghị thanh toán này.')
            return
        }

        const printHtml = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Giấy Đề Nghị Thanh Toán - ${settings.schoolName}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 12mm 15mm 12mm 20mm;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 13pt;
            line-height: 1.45;
            color: #000000;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .container {
            width: 100%;
            margin: 0 auto;
        }
        .header-company {
            width: 50%;
            text-align: center;
            margin-bottom: 16px;
        }
        .header-company .line {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12pt;
            line-height: 1.3;
        }
        .title-block {
            text-align: center;
            margin-top: 6px;
            margin-bottom: 14px;
        }
        .title-block h1 {
            font-size: 16.5pt;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 2px;
        }
        .title-block p {
            font-size: 12pt;
            font-style: italic;
        }
        .salutation {
            text-align: center;
            font-size: 13pt;
            font-weight: bold;
            margin-bottom: 14px;
        }
        .info-list {
            margin-bottom: 12px;
            line-height: 1.45;
        }
        .info-list div {
            margin-bottom: 2px;
        }
        .body-text {
            text-align: justify;
            line-height: 1.45;
            margin-bottom: 12px;
        }
        .body-text p {
            margin-bottom: 6px;
            text-indent: 0.8cm;
        }
        .account-block {
            padding-left: 0.8cm;
            margin-bottom: 18px;
            line-height: 1.45;
        }
        .amount-row {
            display: flex;
            align-items: baseline;
            gap: 28px;
            padding-top: 2px;
        }
        .amount-num {
            font-weight: bold;
            font-size: 14pt;
        }
        .signatures {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .signatures td {
            width: 50%;
            vertical-align: top;
            text-align: center;
            border: none;
            padding: 0 8px;
        }
        .sig-title {
            font-weight: bold;
            line-height: 1.3;
            font-size: 13pt;
        }
        .sig-space {
            height: 95px;
        }
        .sig-name {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 13pt;
            letter-spacing: 0.5px;
        }
        .bold { font-weight: bold; }
        .italic { font-style: italic; }
        .uppercase { text-transform: uppercase; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header bên trái: Tên công ty -->
        <div class="header-company">
            <div class="line">${companyFormattedLines[0]}</div>
            ${companyFormattedLines[1] ? `<div class="line">${companyFormattedLines[1]}</div>` : ''}
        </div>

        <!-- Tiêu đề chính & Ngày tháng -->
        <div class="title-block">
            <h1>GIẤY ĐỀ NGHỊ THANH TOÁN</h1>
            <p>${settings.city || 'Tp.HCM'}, ngày ${parsedReqDate.day} tháng ${parsedReqDate.month} năm ${parsedReqDate.year}</p>
        </div>

        <!-- Kính gửi -->
        <div class="salutation">
            Kính gửi: Hiệu trưởng ${settings.schoolName}
        </div>

        <!-- Thông tin công ty & Đại diện -->
        <div class="info-list">
            <div>- Tên công ty: <span class="bold">${settings.companyName}</span></div>
            <div>- Địa chỉ: <span>${settings.companyAddress}</span></div>
            <div>- Mã số thuế: <span class="bold">${settings.companyTaxCode}</span></div>
            <div>- Đại diện: <span class="bold">${settings.companyRepresentative}</span> - Chức vụ: <span>${settings.companyPosition}</span></div>
        </div>

        <!-- Nội dung đề nghị thanh toán -->
        <div class="body-text">
            <p>Căn cứ vào hợp đồng cung cấp suất ăn công nghiệp giữa ${settings.companyName} và ${settings.schoolName};</p>
            <p>Nay ${settings.companyName} đề nghị ${settings.schoolName} tiền suất ăn trưa thường xuyên từ ngày <span class="bold">${formatShortDate(startDate)}</span> đến ngày <span class="bold">${formatShortDate(endDate)}</span> vào tài khoản dưới đây:</p>
        </div>

        <!-- Thông tin tài khoản & Số tiền -->
        <div class="account-block">
            <div>Tên người nhận tiền: <span class="bold">${settings.bankAccountHolder}</span></div>
            <div>Số tài khoản ngân hàng : <span class="bold">${settings.bankAccountNumber}</span></div>
            <div class="bold">${settings.bankName}</div>
            <div class="amount-row">
                <div>Tiền suất ăn từ ngày <span class="bold">${formatShortDate(startDate)}</span> đến ngày <span class="bold">${formatShortDate(endDate)}</span>:</div>
                <div class="amount-num">${formatVND(amount)}</div>
            </div>
            <div class="italic" style="padding-top: 4px;">
                Viết bằng chữ: <span>${numberToVietnameseWords(amount)}</span>
            </div>
        </div>

        <!-- Chữ ký hai bên -->
        <table class="signatures">
            <tr>
                <td style="vertical-align: top;">
                    <div class="sig-title">Duyệt của Hiệu trưởng</div>
                    <div class="sig-title">${settings.schoolName}</div>
                </td>
                <td style="vertical-align: top;">
                    <div class="sig-title">${settings.companyPosition}</div>
                    <div class="sig-title" style="white-space: nowrap;">${settings.companyName || 'CÔNG TY TNHH CHÂU PHƯƠNG THẢO'}</div>
                </td>
            </tr>
            <tr>
                <td style="vertical-align: bottom;">
                    <div class="sig-space"></div>
                    <div class="sig-name">${settings.principalName || 'TRẦN KHẮC HUY'}</div>
                </td>
                <td style="vertical-align: bottom;">
                    <div class="sig-space"></div>
                    <div class="sig-name">${representativeSignatureName}</div>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
        `

        let iframe = document.getElementById('payment-print-frame') as HTMLIFrameElement
        if (!iframe) {
            iframe = document.createElement('iframe')
            iframe.id = 'payment-print-frame'
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
        settings,
        companyFormattedLines,
        parsedReqDate,
        startDate,
        endDate,
        amount,
        formatShortDate,
        representativeSignatureName,
    ])

    // Tải trực tiếp file PDF về máy tính (không qua hộp thoại in)
    const handleExportPdf = async () => {
        if (!settings.canPrint) {
            alert('Bạn không có quyền xuất Giấy đề nghị thanh toán này.')
            return
        }
        setIsExporting(true)
        try {
            const fileName = `Giay_de_nghi_thanh_toan_${startDate}_${endDate}.pdf`
            await exportElementToPdf('payment-request-document', fileName)
        } catch (err) {
            console.error('Lỗi xuất PDF:', err)
            alert('Có lỗi khi tạo file PDF, vui lòng thử lại hoặc sử dụng nút In trực tiếp.')
        } finally {
            setIsExporting(false)
        }
    }

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

    return (
        <div className="fixed inset-0 bg-black/60 z-[200] overflow-y-auto backdrop-blur-sm print:p-0 print:bg-white print:static print:overflow-visible">
            {/* Thanh công cụ điều khiển (Ẩn hoàn toàn khi in) */}
            <div className="sticky top-0 z-10 bg-gray-900 text-white shadow-xl px-4 py-3 print:hidden border-b border-gray-800">
                <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">📄</span>
                        <div>
                            <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                                Giấy Đề Nghị Thanh Toán
                                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md font-mono">
                                    Khổ A4 Chuẩn
                                </span>
                            </h2>
                            <p className="text-xs text-gray-400">Kiểm tra thông tin và xuất PDF hoặc in trực tiếp</p>
                        </div>
                    </div>

                    {/* Bộ lọc & chỉnh nhanh */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="flex items-center gap-1.5 bg-gray-800 px-2.5 py-1.5 rounded-lg border border-gray-700">
                            <span className="text-gray-400">Ngày lập:</span>
                            <input
                                type="date"
                                value={requestDate}
                                onChange={e => setRequestDate(e.target.value)}
                                className="bg-transparent text-white font-medium outline-none cursor-pointer [color-scheme:dark]"
                                style={{ color: '#ffffff' }}
                            />
                        </div>

                        <div className="flex items-center gap-1.5 bg-gray-800 px-2.5 py-1.5 rounded-lg border border-gray-700">
                            <span className="text-gray-400">Từ:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="bg-transparent text-white font-medium outline-none cursor-pointer [color-scheme:dark]"
                                style={{ color: '#ffffff' }}
                            />
                            <span className="text-gray-400">Đến:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="bg-transparent text-white font-medium outline-none cursor-pointer [color-scheme:dark]"
                                style={{ color: '#ffffff' }}
                            />
                        </div>

                        <div className="flex items-center gap-1.5 bg-gray-800 px-2.5 py-1.5 rounded-lg border border-gray-700">
                            <span className="text-gray-400">Nguồn tiền:</span>
                            <select
                                value={mealType}
                                onChange={e => setMealType(e.target.value as any)}
                                className="bg-transparent text-teal-300 font-bold outline-none cursor-pointer [color-scheme:dark]"
                                style={{ color: '#5eead4' }}
                            >
                                <option value="all" className="bg-gray-800 text-white">Tổng HS + GV ({formatVND(totalAllMoney)}đ)</option>
                                <option value="student" className="bg-gray-800 text-white">Chỉ HS ({formatVND(studentMealMoney)}đ)</option>
                                <option value="teacher" className="bg-gray-800 text-white">Chỉ GV ({formatVND(teacherMealMoney)}đ)</option>
                                <option value="custom" className="bg-gray-800 text-white">Số tiền tùy chỉnh...</option>
                            </select>
                        </div>

                        {mealType === 'custom' && (
                            <div className="flex items-center gap-1.5 bg-gray-800 px-2.5 py-1.5 rounded-lg border border-gray-700">
                                <span className="text-gray-400">Số tiền:</span>
                                <input
                                    type="number"
                                    value={customAmount}
                                    onChange={e => setCustomAmount(Number(e.target.value) || 0)}
                                    className="bg-transparent text-amber-300 font-bold outline-none w-28 text-right [color-scheme:dark]"
                                    style={{ color: '#fcd34d' }}
                                />
                                <span className="text-gray-400">đ</span>
                            </div>
                        )}
                    </div>

                    {/* Nút hành động */}
                    <div className="flex items-center gap-2">
                        {settings.canPrint ? (
                            <>
                                <button
                                    onClick={handlePrint}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer"
                                >
                                    <Printer className="w-4 h-4" /> In trực tiếp
                                </button>
                                <button
                                    onClick={handleExportPdf}
                                    disabled={isExporting}
                                    title="Tải trực tiếp file PDF về máy tính (không cần mở hộp thoại in)"
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer"
                                >
                                    {isExporting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Đang tạo PDF...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4" />
                                            <span>Xuất file PDF</span>
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center gap-1.5 text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg">
                                <AlertCircle className="w-4 h-4 text-red-400" />
                                <span>Chỉ Admin & User được cấp quyền mới được in</span>
                            </div>
                        )}

                        <button
                            onClick={onClose}
                            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Đóng xem trước"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Khung tài liệu A4 Preview */}
            <div className="py-8 px-4 flex justify-center print:p-0 print:m-0">
                <div
                    id="payment-request-document"
                    className="w-[210mm] min-h-[297mm] bg-white text-black p-[12mm_15mm_12mm_20mm] shadow-2xl print:shadow-none print:w-full print:min-h-0 print:p-0"
                    style={{
                        fontFamily: "'Times New Roman', Times, serif",
                        color: '#000000',
                        fontSize: '13pt',
                        lineHeight: '1.45',
                    }}
                >
                    {/* Header bên trái: Tên công ty */}
                    <div className="w-[50%] text-center inline-block align-top mb-4">
                        <div className="font-bold uppercase text-[12pt] leading-snug">
                            {companyFormattedLines[0]}
                        </div>
                        {companyFormattedLines[1] && (
                            <div className="font-bold uppercase text-[12pt] leading-snug">
                                {companyFormattedLines[1]}
                            </div>
                        )}
                    </div>

                    {/* Tiêu đề chính & Ngày tháng */}
                    <div className="text-center mt-2 mb-4">
                        <h1 className="text-[16.5pt] font-bold uppercase tracking-normal mb-0.5">
                            GIẤY ĐỀ NGHỊ THANH TOÁN
                        </h1>
                        <p className="text-[12pt] italic">
                            {settings.city || 'Tp.HCM'}, ngày {parsedReqDate.day} tháng {parsedReqDate.month} năm {parsedReqDate.year}
                        </p>
                    </div>

                    {/* Dòng Kính gửi */}
                    <div className="text-center mb-4 font-bold text-[13pt]">
                        Kính gửi: Hiệu trưởng {settings.schoolName}
                    </div>

                    {/* Thông tin công ty & Đại diện */}
                    <div className="space-y-0.5 mb-3 text-[13pt]">
                        <div>
                            <span>- Tên công ty: </span>
                            <span className="font-bold">{settings.companyName}</span>
                        </div>
                        <div>
                            <span>- Địa chỉ: </span>
                            <span>{settings.companyAddress}</span>
                        </div>
                        <div>
                            <span>- Mã số thuế: </span>
                            <span className="font-bold">{settings.companyTaxCode}</span>
                        </div>
                        <div>
                            <span>- Đại diện: </span>
                            <span className="font-bold">{settings.companyRepresentative}</span>
                            <span> - Chức vụ: </span>
                            <span>{settings.companyPosition}</span>
                        </div>
                    </div>

                    {/* Nội dung đề nghị thanh toán */}
                    <div className="text-justify leading-relaxed mb-3 text-[13pt] space-y-2">
                        <p className="indent-8">
                            Căn cứ vào hợp đồng cung cấp suất ăn công nghiệp giữa {settings.companyName} và {settings.schoolName};
                        </p>
                        <p className="indent-8">
                            Nay {settings.companyName} đề nghị {settings.schoolName} tiền suất ăn trưa thường xuyên từ ngày{' '}
                            <span className="font-bold">{formatShortDate(startDate)}</span> đến ngày{' '}
                            <span className="font-bold">{formatShortDate(endDate)}</span> vào tài khoản dưới đây:
                        </p>
                    </div>

                    {/* Thông tin tài khoản & Số tiền */}
                    <div className="space-y-0.5 mb-5 pl-6 text-[13pt]">
                        <div>
                            <span>Tên người nhận tiền: </span>
                            <span className="font-bold">{settings.bankAccountHolder}</span>
                        </div>
                        <div>
                            <span>Số tài khoản ngân hàng : </span>
                            <span className="font-bold">{settings.bankAccountNumber}</span>
                        </div>
                        <div className="font-bold">
                            {settings.bankName}
                        </div>
                        <div className="flex items-baseline gap-7 pt-0.5">
                            <div>
                                <span>Tiền suất ăn từ ngày </span>
                                <span className="font-bold">{formatShortDate(startDate)}</span>
                                <span> đến ngày </span>
                                <span className="font-bold">{formatShortDate(endDate)}</span>:
                            </div>
                            <div className="font-bold text-[14pt]">
                                {formatVND(amount)}
                            </div>
                        </div>
                        <div className="italic pt-0.5">
                            <span>Viết bằng chữ: </span>
                            <span>{numberToVietnameseWords(amount)}</span>
                        </div>
                    </div>

                    {/* Chữ ký hai bên */}
                    <div className="grid grid-cols-2 gap-6 text-center mt-6 text-[13pt]">
                        {/* Cột bên trái: Nhà trường */}
                        <div className="flex flex-col items-center justify-between">
                            <div>
                                <div className="font-bold">Duyệt của Hiệu trưởng</div>
                                <div className="font-bold">{settings.schoolName}</div>
                            </div>
                            <div>
                                <div className="h-[95px]"></div>
                                <div className="font-bold uppercase tracking-wide">
                                    {settings.principalName || 'TRẦN KHẮC HUY'}
                                </div>
                            </div>
                        </div>

                        {/* Cột bên phải: Doanh nghiệp */}
                        <div className="flex flex-col items-center justify-between">
                            <div>
                                <div className="font-bold">{settings.companyPosition}</div>
                                <div className="font-bold uppercase leading-snug whitespace-nowrap">
                                    {settings.companyName || 'CÔNG TY TNHH CHÂU PHƯƠNG THẢO'}
                                </div>
                            </div>

                            <div>
                                {/* Khoảng trống ký tên & đóng dấu: rộng rãi thoải mái (95px) */}
                                <div className="h-[95px]"></div>

                                {/* Tên người ký ở chân trang */}
                                <div className="font-bold uppercase tracking-wide">
                                    {representativeSignatureName}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
