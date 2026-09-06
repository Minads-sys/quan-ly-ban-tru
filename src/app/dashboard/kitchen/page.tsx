'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getKitchenSummary } from './actions'
import { getTeacherMealReport, upsertTeacherMealReport } from './teacher-actions'
import { formatToViewDate, getVietnamHours, getVietnamDateString, getDayOfWeek, getVietnamNow, getVietnamMinutesToday } from '@/utils/dateUtils'
import * as XLSX from 'xlsx'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'

interface GroupSummary {
// ... (trimmed for context but keeping imports safe)
    group: { id: string; name: string }
    rooms: {
        id: string
        name: string
        default_capacity: number
        report: {
            capacity: number
            absent_count: number
            salty_count: number
            porridge_count: number
            vegetarian_count: number
            status: string
            moc1_snapshot: {
                salty_count: number
                porridge_count: number
                vegetarian_count: number
            } | null
        } | null
    }[]
    totalSalty: number
    totalVegetarian: number
    totalPorridge: number
    totalMeals: number
    cong: number
    reportedCount: number
    totalRooms: number
}

export default function KitchenPage() {
    const [date, setDate] = useState('')
    const [pendingDate, setPendingDate] = useState('')
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'kitchen' | 'distributor' | 'teacher'>('kitchen')
    const [totalSalty, setTotalSalty] = useState(0)
    const [totalVegetarian, setTotalVegetarian] = useState(0)
    const [totalPorridge, setTotalPorridge] = useState(0)
    const [totalMeals, setTotalMeals] = useState(0)
    const [totalCong, setTotalCong] = useState(0)
    const [groupSummaries, setGroupSummaries] = useState<GroupSummary[]>([])
    const [userRole, setUserRole] = useState('')
    const [isAfter14h, setIsAfter14h] = useState(false)
    const [showSummaryOnly, setShowSummaryOnly] = useState(false)
    const [schoolInfo, setSchoolInfo] = useState({ name: '', address: '' })
    const [moc1Close, setMoc1Close] = useState('16:00')
    const [isLocked, setIsLocked] = useState(false)
    const [isMoc1Closed, setIsMoc1Closed] = useState(false)
    const [isMoc2Closed, setIsMoc2Closed] = useState(false)
    const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
    const [offDays, setOffDays] = useState<string[]>([])
    const [dayOffMessage, setDayOffMessage] = useState<string | null>(null)

    // Teacher meal states
    const [teacherSalty, setTeacherSalty] = useState(0)
    const [teacherPorridge, setTeacherPorridge] = useState(0)
    const [teacherVegetarian, setTeacherVegetarian] = useState(0)
    const [teacherNote, setTeacherNote] = useState('')
    const [teacherTotal, setTeacherTotal] = useState(0)
    const [teacherReportExists, setTeacherReportExists] = useState(false)
    const [teacherSaving, setTeacherSaving] = useState(false)
    const [teacherMsg, setTeacherMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    // Editable form values (separate from display)
    const [teacherFormSalty, setTeacherFormSalty] = useState(0)
    const [teacherFormPorridge, setTeacherFormPorridge] = useState(0)
    const [teacherFormVegetarian, setTeacherFormVegetarian] = useState(0)
    const [teacherFormNote, setTeacherFormNote] = useState('')

    const dateRef = useRef('')

    // Helper: cập nhật state suất ăn giáo viên
    const applyTeacherMeal = useCallback((teacherMeal: {
        salty_count?: number
        porridge_count?: number
        vegetarian_count?: number
        note?: string | null
    } | null | undefined) => {
        if (teacherMeal) {
            const s = teacherMeal.salty_count || 0
            const p = teacherMeal.porridge_count || 0
            const v = teacherMeal.vegetarian_count || 0
            setTeacherSalty(s)
            setTeacherPorridge(p)
            setTeacherVegetarian(v)
            setTeacherNote(teacherMeal.note || '')
            setTeacherTotal(s + p + v)
            setTeacherReportExists(true)
            setTeacherFormSalty(s)
            setTeacherFormPorridge(p)
            setTeacherFormVegetarian(v)
            setTeacherFormNote(teacherMeal.note || '')
        } else {
            setTeacherSalty(0)
            setTeacherPorridge(0)
            setTeacherVegetarian(0)
            setTeacherNote('')
            setTeacherTotal(0)
            setTeacherReportExists(false)
            setTeacherFormSalty(0)
            setTeacherFormPorridge(0)
            setTeacherFormVegetarian(0)
            setTeacherFormNote('')
        }
    }, [])

    // Helper: kiểm tra ngày có phải ngày làm việc không
    const isWorkingDayCheck = useCallback((dateStr: string, wDays: number[], oDays: string[]) => {
        if (!dateStr || !dateStr.includes('-')) return true
        const [y, m, d] = dateStr.split('-').map(Number)
        const dateObj = new Date(y, m - 1, d)
        return wDays.includes(dateObj.getDay()) && !oDays.includes(dateStr)
    }, [])

    // Helper: tìm ngày làm việc gần nhất KẾ TIẾP (hôm nay hoặc tương lai)
    // Sau giờ chốt mốc 1 → mặc định xem ngày làm việc tiếp theo
    const findNearestWorkingDay = useCallback((wDays: number[], oDays: string[], moc1CloseTime?: string) => {
        const now = getVietnamNow()
        // Kiểm tra đã qua giờ chốt mốc 1 chưa
        let startOffset = 0
        if (moc1CloseTime) {
            const [mH, mM] = moc1CloseTime.split(':').map(Number)
            const moc1Minutes = mH * 60 + mM
            const currentMinutes = getVietnamMinutesToday()
            if (currentMinutes >= moc1Minutes) {
                startOffset = 1 // Bắt đầu từ ngày mai
            }
        }
        // Thử từ startOffset, rồi tiến tới tối đa 30 ngày
        for (let i = startOffset; i < 30; i++) {
            const candidate = new Date(now)
            candidate.setDate(candidate.getDate() + i)
            const yyyy = candidate.getFullYear()
            const mm = String(candidate.getMonth() + 1).padStart(2, '0')
            const dd = String(candidate.getDate()).padStart(2, '0')
            const dateStr = `${yyyy}-${mm}-${dd}`
            if (wDays.includes(candidate.getDay()) && !oDays.includes(dateStr)) {
                return dateStr
            }
        }
        return getVietnamDateString()
    }, [])

    // ⚡ 1 lần gọi duy nhất — getKitchenSummary tự tính ngày nếu chưa có
    const loadData = useCallback(async (selectedDate?: string) => {
        setLoading(true)
        setDayOffMessage(null)

        const queryDate = selectedDate || dateRef.current || undefined
        const data = await getKitchenSummary(queryDate, true)
        
        if ('error' in data) {
            setLoading(false)
            return
        }

        // Lưu cấu hình ngày nghỉ từ server
        const serverWorkingDays = (data.workingDays as number[]) || [1, 2, 3, 4, 5]
        const serverOffDays = (data.offDays as string[]) || []
        setWorkingDays(serverWorkingDays)
        setOffDays(serverOffDays)

        const role = data.userRole as string
        setUserRole(role)
        setShowSummaryOnly(role === 'kitchen' || role === 'meal_distributor')
        if (data.moc1Close) setMoc1Close(data.moc1Close as string)
        
        // Default tab based on role
        if (role === 'meal_distributor') {
            setActiveTab('distributor')
        }

        const effectiveDate = (data.date || selectedDate) as string
        setDate(effectiveDate)
        setPendingDate(effectiveDate)
        dateRef.current = effectiveDate

        // Kiểm tra 14h lock cho Bếp & Chia suất
        const nowHours = getVietnamHours()
        if (nowHours >= 14) setIsAfter14h(true)

        const isRestricted = ['kitchen', 'meal_distributor'].includes(role)
        const todayStr = getVietnamDateString()
        const isToday = effectiveDate === todayStr

        // Kiểm tra điều kiện khóa: 14h hôm nay → mốc 1 ngày mai
        if (isRestricted && isToday && nowHours >= 14) {
             setIsLocked(true)
             setTotalSalty(0)
             setTotalVegetarian(0)
             setTotalPorridge(0)
             setTotalMeals(0)
             setTotalCong(0)
             setGroupSummaries([])
             applyTeacherMeal(null)
             setLoading(false)
             return
        }

        setIsLocked(false)
        setTotalSalty(data.totalSalty as number)
        setTotalVegetarian(data.totalVegetarian as number)
        setTotalPorridge(data.totalPorridge as number)
        setTotalMeals(data.totalMeals as number)
        setTotalCong(data.totalCong as number)
        setGroupSummaries(data.groupSummaries as GroupSummary[])
        if (data.schoolInfo) setSchoolInfo(data.schoolInfo)
        if (typeof data.isMoc1Closed === 'boolean') setIsMoc1Closed(data.isMoc1Closed)
        if (typeof data.isMoc2Closed === 'boolean') setIsMoc2Closed(data.isMoc2Closed)

        // Load teacher meal data từ server action trả về hoặc fallback
        if ('teacherMeal' in data) {
            applyTeacherMeal((data as any).teacherMeal)
        } else if (effectiveDate) {
            const teacherResult = await getTeacherMealReport(effectiveDate)
            applyTeacherMeal(teacherResult.report)
        }

        setLoading(false)
    }, [applyTeacherMeal])

    // Load lần đầu (không truyền date → server tự tính)
    useEffect(() => { loadData() }, [loadData])

    // ⚡ Realtime: tự động làm mới khi có thay đổi daily_reports hoặc teacher_meal_reports
    useRealtimeRefresh(['daily_reports', 'teacher_meal_reports'], loadData)

    // Khi user đổi date thủ công (bị khóa cho kitchen/meal_distributor)
    const isRestrictedRole = ['kitchen', 'meal_distributor'].includes(userRole)
    
    // Chỉ cập nhật pendingDate khi user thay đổi input (không load data)
    const handleDateInputChange = (newDate: string) => {
        if (isRestrictedRole) return
        setPendingDate(newDate)
    }

    // Xác nhận ngày đã chọn — load data
    const handleDateConfirm = () => {
        if (isRestrictedRole || !pendingDate) return
        setDate(pendingDate)
        dateRef.current = pendingDate
        
        // Kiểm tra ngày nghỉ
        if (!isWorkingDayCheck(pendingDate, workingDays, offDays)) {
            const formattedDate = formatToViewDate(pendingDate)
            setDayOffMessage(`Ngày ${formattedDate} học sinh nghỉ học`)
            setTotalSalty(0)
            setTotalVegetarian(0)
            setTotalPorridge(0)
            setTotalMeals(0)
            setTotalCong(0)
            setGroupSummaries([])
            applyTeacherMeal(null)
            return
        }
        
        setDayOffMessage(null)
        loadData(pendingDate)
    }

    function exportToExcel() {
        // Sheet 1: Tổng hợp
        const summaryData = [
            ['BÁO CÁO SUẤT ĂN BÁN TRÚ'],
            [`Ngày: ${date} (${getDayOfWeek(date)})`],
            [],
            ['HỌC SINH', ''],
            ['Loại suất', 'Số lượng'],
            ['🍖 Suất mặn HS', totalSalty],
            ['🥬 Suất chay HS', totalVegetarian],
            ['🥣 Suất cháo HS', totalPorridge],
            ['TỔNG SUẤT HS', totalMeals],
            ['SỐ CÔNG HS', totalCong],
            [],
            ['GIÁO VIÊN', ''],
            ['Loại suất', 'Số lượng'],
            ['🍖 Suất mặn GV', teacherSalty],
            ['🥬 Suất chay GV', teacherVegetarian],
            ['🥣 Suất cháo GV', teacherPorridge],
            ['TỔNG SUẤT GV', teacherTotal],
            ['Ghi chú GV', teacherNote || 'Không'],
        ]

        // Sheet 2: Chi tiết theo nhóm
        const detailData: (string | number)[][] = [
            ['BÁO CÁO CHI TIẾT THEO NHÓM/LỚP'],
            [`Ngày: ${date} (${getDayOfWeek(date)})`],
            [],
            ['Nhóm', 'Phòng', 'Sĩ số', 'Nghỉ', 'Mặn', 'Cháo', 'Chay', 'Trạng thái'],
        ]

        groupSummaries.forEach(gs => {
            gs.rooms.forEach(room => {
                detailData.push([
                    gs.group.name,
                    room.name,
                    room.report?.capacity || 0,
                    room.report?.absent_count || 0,
                    room.report?.salty_count || 0,
                    room.report?.porridge_count || 0,
                    room.report?.vegetarian_count || 0,
                    room.report ? (room.report.status === 'approved' ? 'Đã duyệt' : room.report.status) : 'Chưa báo',
                ])
            })
            detailData.push([
                `TỔNG ${gs.group.name}`,
                '',
                '',
                '',
                gs.totalSalty,
                gs.totalPorridge,
                gs.totalVegetarian,
                `${gs.cong} công`,
            ])
            detailData.push([])
        })

        const wb = XLSX.utils.book_new()
        const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
        const ws2 = XLSX.utils.aoa_to_sheet(detailData)

        ws1['!cols'] = [{ wch: 20 }, { wch: 15 }]
        ws2['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }]

        XLSX.utils.book_append_sheet(wb, ws1, 'Tổng hợp')
        XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết')

        XLSX.writeFile(wb, `bao-cao-suat-an-${date}.xlsx`)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-40">
                <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    // Kiểm tra render logic cho Bếp/Chia suất sau 14h hôm nay
    const isViewingTodayAfter14h = isLocked

    return (
        <div className={showSummaryOnly ? 'max-w-4xl mx-auto' : ''}>
            {/* Print Header */}
            <div className="hidden print:block text-center mb-6">
                <h1 className="text-2xl font-bold uppercase">{schoolInfo.name || 'Suất ăn Bán trú'}</h1>
                <p className="text-sm">{schoolInfo.address}</p>
                <div className="h-px bg-gray-300 w-full my-4" />
                <h2 className="text-xl font-bold">BÁO CÁO SUẤT ĂN</h2>
                <p className="text-sm">Ngày: {formatToViewDate(date)}</p>
            </div>

            {/* Header & Main Controls */}
            <div className={`flex flex-col gap-6 mb-8 print:hidden ${showSummaryOnly ? 'bg-white p-6 rounded-2xl shadow-sm border border-gray-100' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className={`${showSummaryOnly ? 'text-3xl' : 'text-xl'} font-bold text-gray-800 flex items-center gap-3`}>
                            {showSummaryOnly ? '👨‍🍳 THỐNG KÊ SUẤT ĂN' : '🍳 Quản lý Bếp & Chia suất'}
                            {schoolInfo.name && <span className="text-blue-600 font-bold">| {schoolInfo.name}</span>}
                        </h2>
                        {showSummaryOnly && <p className="text-gray-600 mt-1 text-lg">Chào bạn, đây là số liệu đã được duyệt.</p>}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm sm:text-base font-bold uppercase border shadow-sm ${
                                isMoc1Closed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                            }`}>
                                ⏱️ {isMoc1Closed ? 'Đã chốt Mốc 1 đi chợ' : 'Chưa chốt Mốc 1 đi chợ'}
                            </span>
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm sm:text-base font-bold uppercase border shadow-sm ${
                                isMoc2Closed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
                            }`}>
                                ⏱️ {isMoc2Closed ? 'Đã chốt Mốc 2 chia suất' : 'Chưa chốt Mốc 2 chia suất'}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={pendingDate}
                                onChange={e => handleDateInputChange(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleDateConfirm() }}
                                disabled={isRestrictedRole}
                                className={`${showSummaryOnly ? 'px-6 py-3 text-xl' : 'px-4 py-2 text-sm'} rounded-xl border border-gray-200 
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-bold
                    ${isRestrictedRole ? 'opacity-60 cursor-not-allowed bg-gray-100' : ''}`}
                            />
                            {!isRestrictedRole && pendingDate !== date && (
                                <button
                                    onClick={handleDateConfirm}
                                    className={`${showSummaryOnly ? 'px-5 py-3 text-lg' : 'px-4 py-2 text-sm'} bg-blue-500 text-white rounded-xl font-bold
                        hover:bg-blue-600 shadow-md transition-all active:scale-[0.98]`}
                                >
                                    🔍 Xem
                                </button>
                            )}
                            {date && (
                                <span className={`${showSummaryOnly ? 'text-lg px-4 py-2.5' : 'text-sm px-3 py-1.5'} font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl whitespace-nowrap`}>
                                    📅 {getDayOfWeek(date)}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={exportToExcel}
                            className={`${showSummaryOnly ? 'px-6 py-3 text-lg' : 'px-4 py-2 text-sm'} bg-emerald-500 text-white rounded-xl font-bold
                hover:bg-emerald-600 shadow-md transition-all active:scale-[0.98] flex items-center gap-2`}
                        >
                            📥 <span className={showSummaryOnly ? '' : 'hidden sm:inline'}>Xuất Excel</span>
                        </button>
                        <button
                            onClick={() => window.print()}
                            className={`${showSummaryOnly ? 'px-6 py-3 text-lg' : 'px-4 py-2 text-sm'} bg-gray-600 text-white rounded-xl font-bold
                hover:bg-gray-700 shadow-md transition-all active:scale-[0.98] flex items-center gap-2`}
                        >
                            🖨️ <span className={showSummaryOnly ? '' : 'hidden sm:inline'}>In</span>
                        </button>
                    </div>
                </div>

                {/* Tab Switcher - Cho admin, kitchen, approver... (chỉ ẩn cho meal_distributor) */}
                {userRole !== 'meal_distributor' && (
                    <div className="flex flex-col gap-2">
                        <div className="flex p-1 bg-gray-100 rounded-xl max-w-fit border border-gray-200">
                            <button
                                onClick={() => setActiveTab('kitchen')}
                                className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${
                                    activeTab === 'kitchen' 
                                    ? 'bg-white text-blue-700 shadow-sm border border-gray-200' 
                                    : 'text-gray-600 hover:text-gray-700'
                                }`}
                            >
                                🍳 Chế độ Bếp
                            </button>
                            {!showSummaryOnly && (
                                <button
                                    onClick={() => setActiveTab('distributor')}
                                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${
                                        activeTab === 'distributor' 
                                        ? 'bg-white text-teal-700 shadow-sm border border-gray-200' 
                                        : 'text-gray-600 hover:text-gray-700'
                                    }`}
                                >
                                    🍽️ Chia suất
                                </button>
                            )}
                            <button
                                onClick={() => setActiveTab('teacher')}
                                className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-1.5 ${
                                    activeTab === 'teacher' 
                                    ? 'bg-white text-rose-700 shadow-sm border border-gray-200' 
                                    : 'text-gray-600 hover:text-gray-700'
                                }`}
                            >
                                <span>👩‍🏫 Suất GV</span>
                                {teacherTotal > 0 && (
                                    <span className="px-2 py-0.5 text-xs bg-rose-100 text-rose-700 rounded-full font-bold">
                                        {teacherTotal}
                                    </span>
                                )}
                            </button>
                        </div>
                        {/* Ghi chú mốc tương ứng tab */}
                        <p className="text-xs font-semibold text-gray-500">
                            {activeTab === 'kitchen'
                                ? '🛒 Mốc 1 — Đi chợ'
                                : activeTab === 'distributor'
                                ? '🍽️ Mốc 2 — Chia suất ra công'
                                : '👩‍🏫 Suất ăn giáo viên — Riêng biệt'}
                        </p>
                    </div>
                )}
            </div>

            {/* Content for Kitchen View After 14h today */}
            {/* Thông báo ngày nghỉ */}
            {dayOffMessage ? (
                <div className="bg-orange-50 border-2 border-orange-300 rounded-3xl p-12 text-center shadow-lg">
                    <p className="text-6xl mb-6">🏖️</p>
                    <p className="text-3xl font-bold text-orange-700">{dayOffMessage}</p>
                    <p className="text-lg text-orange-600 mt-4">Vui lòng chọn ngày học để xem số liệu suất ăn.</p>
                </div>
            ) : isViewingTodayAfter14h ? (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-12 text-center shadow-lg">
                     <p className="text-6xl mb-6">⏰</p>
                     <p className="text-3xl font-bold text-amber-800">Đã hết thời gian xem số liệu ngày hôm nay.</p>
                     <p className="text-xl text-amber-700 mt-4">Số liệu của ngày mai sẽ được tự động hiển thị vào lúc {moc1Close} hôm nay.</p>
                </div>
            ) : groupSummaries.length === 0 && !loading ? (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-20 text-center shadow-sm">
                    <p className="text-6xl mb-6">📊</p>
                    <p className="text-3xl font-bold text-gray-600">Chưa có số liệu cho ngày {date}</p>
                    <p className="text-lg text-gray-500 mt-2">(Chỉ hiển thị số liệu đã được duyệt)</p>
                </div>
            ) : (
                <>
                    {/* View based on activeTab */}
                    {activeTab === 'kitchen' ? (
                        <>
                            {/* Summary Cards - Kitchen (Học sinh) */}
                            <div className={`grid ${showSummaryOnly ? 'grid-cols-1 sm:grid-cols-2 gap-8' : 'grid-cols-2 sm:grid-cols-4 gap-3'} mb-8`}>
                                <div className={`bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl transform transition-hover hover:scale-[1.02] ${showSummaryOnly ? 'order-first' : ''}`}>
                                    <p className={`${showSummaryOnly ? 'text-2xl' : 'text-sm'} font-bold opacity-90`}>📊 Tổng suất</p>
                                    <p className={`${showSummaryOnly ? 'text-7xl' : 'text-3xl'} font-bold mt-2`}>{totalMeals}</p>
                                </div>
                                <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
                                    <p className={`${showSummaryOnly ? 'text-2xl' : 'text-sm'} font-bold opacity-90`}>🍖 Tổng suất mặn</p>
                                    <p className={`${showSummaryOnly ? 'text-6xl' : 'text-3xl'} font-bold mt-2`}>{totalSalty}</p>
                                </div>
                                <div className="bg-gradient-to-br from-green-500 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
                                    <p className={`${showSummaryOnly ? 'text-2xl' : 'text-sm'} font-bold opacity-90`}>🥬 Tổng Suất chay</p>
                                    <p className={`${showSummaryOnly ? 'text-6xl' : 'text-3xl'} font-bold mt-2`}>{totalVegetarian}</p>
                                </div>
                                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
                                    <p className={`${showSummaryOnly ? 'text-2xl' : 'text-sm'} font-bold opacity-90`}>🥣 Tổng suất Cháo</p>
                                    <p className={`${showSummaryOnly ? 'text-6xl' : 'text-3xl'} font-bold mt-2`}>{totalPorridge}</p>
                                </div>
                            </div>

                            {/* Group Breakdown - ONLY for non-kitchen roles */}
                            {!showSummaryOnly && (
                                <div className="space-y-4">
                                    {groupSummaries.filter(gs => gs.group.name.toLowerCase() !== 'hệ thống').map((gs) => (
                                        <div key={gs.group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between print:hidden">
                                                <h3 className="font-bold text-gray-700 text-lg">{gs.group.name}</h3>
                                                <div className="flex gap-4 text-xs text-gray-600">
                                                    <span>Báo: <b className="text-blue-600">{gs.reportedCount}/{gs.totalRooms}</b></span>
                                                </div>
                                            </div>

                                            <div className="p-4 border-b border-gray-200">
                                                <div className="border border-gray-200 outline outline-1 outline-gray-300 rounded-xl p-4 text-center bg-blue-50/30">
                                                    <h3 className="text-lg font-bold text-gray-800 mb-1">{gs.group.name}</h3>
                                                    <p className="text-sm font-semibold text-gray-600">📊 TỔNG SUẤT</p>
                                                    <p className="text-4xl font-bold text-blue-700 mt-2">{gs.totalMeals}</p>
                                                </div>
                                            </div>

                                            <div className="hidden sm:block overflow-x-auto max-h-[60vh] print:max-h-none print:overflow-visible print:block">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-100 text-gray-600 font-medium sticky top-0 z-10 shadow-sm border-b border-gray-200">
                                                        <tr>
                                                            <th className="text-left px-4 py-3 font-semibold">Phòng</th>
                                                            <th className="text-center px-2 py-3 font-semibold">Sĩ số</th>
                                                            <th className="text-center px-2 py-3 font-semibold">Nghỉ</th>
                                                            <th className="text-center px-2 py-3 font-semibold">🍖 Mặn</th>
                                                            <th className="text-center px-2 py-3 font-semibold">🥣 Cháo</th>
                                                            <th className="text-center px-2 py-3 font-semibold">🥬 Chay</th>
                                                            <th className="text-center px-2 py-3 font-semibold">TT</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {gs.rooms.map(room => (
                                                            <tr key={room.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                                                                <td className="px-4 py-2 font-medium text-gray-700">{room.name}</td>
                                                                {room.report ? (
                                                                    <>
                                                                        <td className="text-center px-2 py-2 font-bold text-gray-800">{room.report.capacity}</td>
                                                                        <td className="text-center px-2 py-2 text-red-500">{room.report.absent_count}</td>
                                                                        <td className="text-center px-2 py-2 font-bold text-blue-700">{room.report.salty_count}</td>
                                                                        <td className="text-center px-2 py-2 font-bold text-amber-600">{room.report.porridge_count}</td>
                                                                        <td className="text-center px-2 py-2 font-bold text-emerald-600">{room.report.vegetarian_count}</td>
                                                                        <td className="text-center px-2 py-2">
                                                                            {room.report.status === 'school_approved' ? '✅' : '⏳'}
                                                                        </td>
                                                                    </>
                                                                ) : (
                                                                    <td colSpan={7} className="text-center px-2 py-2 text-gray-500 italic text-xs">Chưa báo</td>
                                                                )}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : activeTab === 'distributor' ? (
                        /* Distributor View (Merged from distributor/page.tsx) */
                        <div className="space-y-8 print:space-y-6">
                            {/* System Overall Block */}
                            <div className="print:break-inside-avoid">
                                {/* Khối 1: Tổng suất Hệ thống */}
                                <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-md p-6 sm:p-8 mb-4">
                                    <h3 className="text-3xl sm:text-4xl font-bold text-gray-800 text-center mb-1 uppercase tracking-tight">
                                        HỆ THỐNG
                                    </h3>
                                    <p className="text-center text-xl font-bold text-purple-700 mb-5">
                                        Tổng suất: <span className="text-4xl sm:text-5xl">{totalMeals}</span> suất
                                    </p>
                                    <div className="grid grid-cols-3 gap-3 sm:gap-5">
                                        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 sm:p-5 text-center">
                                            <p className="text-lg sm:text-xl font-bold text-blue-800">🍖 Mặn</p>
                                            <p className="text-4xl sm:text-5xl font-bold text-blue-700 mt-2">{totalSalty}</p>
                                        </div>
                                        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 sm:p-5 text-center">
                                            <p className="text-lg sm:text-xl font-bold text-emerald-800">🥬 Chay</p>
                                            <p className="text-4xl sm:text-5xl font-bold text-emerald-700 mt-2">{totalVegetarian}</p>
                                        </div>
                                        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 sm:p-5 text-center">
                                            <p className="text-lg sm:text-xl font-bold text-amber-800">🥣 Cháo</p>
                                            <p className="text-4xl sm:text-5xl font-bold text-amber-700 mt-2">{totalPorridge}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Khối 2: Công Hệ thống */}
                                {(() => {
                                    const sys_cs = Math.floor(totalSalty / 20)
                                    const sys_ls = totalSalty % 20
                                    const sys_cv = Math.floor(totalVegetarian / 20)
                                    const sys_lv = totalVegetarian % 20
                                    const sys_cp = Math.floor(totalPorridge / 20)
                                    const sys_lp = totalPorridge % 20
                                    const sys_totalC = sys_cs + sys_cv + sys_cp

                                    return (
                                        <div className="bg-gray-50 rounded-2xl border-2 border-gray-300 shadow-md p-6 sm:p-8 mb-8">
                                            <h3 className="text-2xl sm:text-3xl font-bold text-gray-700 text-center mb-1">
                                                Công Hệ thống
                                            </h3>
                                            <p className="text-center mb-2">
                                                <span className="text-5xl sm:text-7xl font-bold text-gray-900">{sys_totalC}</span>
                                                <span className="text-2xl sm:text-3xl font-bold text-gray-600 ml-2">công</span>
                                            </p>
                                            
                                            <div className="text-center mb-5 text-lg sm:text-xl text-gray-600 font-semibold leading-relaxed">
                                                {sys_ls > 0 && <span className="text-blue-700">{sys_ls} suất lẻ mặn</span>}
                                                {sys_ls > 0 && (sys_lv > 0 || sys_lp > 0) && <span>, </span>}
                                                {sys_lv > 0 && <span className="text-emerald-700">{sys_lv} suất lẻ chay</span>}
                                                {sys_lv > 0 && sys_lp > 0 && <span>, </span>}
                                                {sys_lp > 0 && <span className="text-amber-700">{sys_lp} suất lẻ cháo</span>}
                                                {sys_ls === 0 && sys_lv === 0 && sys_lp === 0 && (
                                                    <span className="text-gray-500">Không có suất lẻ</span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-3 gap-3 sm:gap-5">
                                                <div className="bg-blue-100 border-2 border-blue-400 rounded-xl p-4 sm:p-5 text-center">
                                                    <p className="text-lg sm:text-xl font-bold text-blue-900">Mặn</p>
                                                    <p className="text-3xl sm:text-5xl font-bold text-blue-800 mt-1">{sys_cs} <span className="text-lg sm:text-2xl">công</span></p>
                                                    <p className="text-base sm:text-lg font-semibold text-blue-600 mt-1">{sys_ls} suất lẻ</p>
                                                </div>
                                                <div className="bg-emerald-100 border-2 border-emerald-400 rounded-xl p-4 sm:p-5 text-center">
                                                    <p className="text-lg sm:text-xl font-bold text-emerald-900">Chay</p>
                                                    <p className="text-3xl sm:text-5xl font-bold text-emerald-800 mt-1">{sys_cv} <span className="text-lg sm:text-2xl">công</span></p>
                                                    <p className="text-base sm:text-lg font-semibold text-emerald-600 mt-1">{sys_lv} suất lẻ</p>
                                                </div>
                                                <div className="bg-amber-100 border-2 border-amber-400 rounded-xl p-4 sm:p-5 text-center">
                                                    <p className="text-lg sm:text-xl font-bold text-amber-900">Cháo</p>
                                                    <p className="text-3xl sm:text-5xl font-bold text-amber-800 mt-1">{sys_cp} <span className="text-lg sm:text-2xl">công</span></p>
                                                    <p className="text-base sm:text-lg font-semibold text-amber-600 mt-1">{sys_lp} suất lẻ</p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>

                            {groupSummaries.filter(gs => gs.group.name.toLowerCase() !== 'hệ thống').map((gs) => {
                                const cs = Math.floor(gs.totalSalty / 20)
                                const ls = gs.totalSalty % 20
                                const cv = Math.floor(gs.totalVegetarian / 20)
                                const lv = gs.totalVegetarian % 20
                                const cp = Math.floor(gs.totalPorridge / 20)
                                const lp = gs.totalPorridge % 20
                                const totalC = cs + cv + cp

                                return (
                                    <div key={gs.group.id} className="print:break-inside-avoid">
                                        {/* Khối 1: Tổng suất */}
                                        <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-md p-6 sm:p-8 mb-4">
                                            <h3 className="text-3xl sm:text-4xl font-bold text-gray-800 text-center mb-1 uppercase tracking-tight">
                                                {gs.group.name}
                                            </h3>
                                            <p className="text-center text-xl font-bold text-purple-700 mb-5">
                                                Tổng suất: <span className="text-4xl sm:text-5xl">{gs.totalMeals}</span> suất
                                            </p>
                                            <div className="grid grid-cols-3 gap-3 sm:gap-5">
                                                <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 sm:p-5 text-center">
                                                    <p className="text-lg sm:text-xl font-bold text-blue-800">🍖 Mặn</p>
                                                    <p className="text-4xl sm:text-5xl font-bold text-blue-700 mt-2">{gs.totalSalty}</p>
                                                </div>
                                                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 sm:p-5 text-center">
                                                    <p className="text-lg sm:text-xl font-bold text-emerald-800">🥬 Chay</p>
                                                    <p className="text-4xl sm:text-5xl font-bold text-emerald-700 mt-2">{gs.totalVegetarian}</p>
                                                </div>
                                                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 sm:p-5 text-center">
                                                    <p className="text-lg sm:text-xl font-bold text-amber-800">🥣 Cháo</p>
                                                    <p className="text-4xl sm:text-5xl font-bold text-amber-700 mt-2">{gs.totalPorridge}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Khối 2: Công Breakdown */}
                                        <div className="bg-gray-50 rounded-2xl border-2 border-gray-300 shadow-md p-6 sm:p-8">
                                            <h3 className="text-2xl sm:text-3xl font-bold text-gray-700 text-center mb-1">
                                                Công {gs.group.name}
                                            </h3>
                                            <p className="text-center mb-2">
                                                <span className="text-5xl sm:text-7xl font-bold text-gray-900">{totalC}</span>
                                                <span className="text-2xl sm:text-3xl font-bold text-gray-600 ml-2">công</span>
                                            </p>
                                            
                                            <div className="text-center mb-5 text-lg sm:text-xl text-gray-600 font-semibold leading-relaxed">
                                                {ls > 0 && <span className="text-blue-700">{ls} suất lẻ mặn</span>}
                                                {ls > 0 && (lv > 0 || lp > 0) && <span>, </span>}
                                                {lv > 0 && <span className="text-emerald-700">{lv} suất lẻ chay</span>}
                                                {lv > 0 && lp > 0 && <span>, </span>}
                                                {lp > 0 && <span className="text-amber-700">{lp} suất lẻ cháo</span>}
                                                {ls === 0 && lv === 0 && lp === 0 && (
                                                    <span className="text-gray-500">Không có suất lẻ</span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-3 gap-3 sm:gap-5">
                                                <div className="bg-blue-100 border-2 border-blue-400 rounded-xl p-4 sm:p-5 text-center">
                                                    <p className="text-lg sm:text-xl font-bold text-blue-900">Mặn</p>
                                                    <p className="text-3xl sm:text-5xl font-bold text-blue-800 mt-1">{cs} <span className="text-lg sm:text-2xl">công</span></p>
                                                    <p className="text-base sm:text-lg font-semibold text-blue-600 mt-1">{ls} suất lẻ</p>
                                                </div>
                                                <div className="bg-emerald-100 border-2 border-emerald-400 rounded-xl p-4 sm:p-5 text-center">
                                                    <p className="text-lg sm:text-xl font-bold text-emerald-900">Chay</p>
                                                    <p className="text-3xl sm:text-5xl font-bold text-emerald-800 mt-1">{cv} <span className="text-lg sm:text-2xl">công</span></p>
                                                    <p className="text-base sm:text-lg font-semibold text-emerald-600 mt-1">{lv} suất lẻ</p>
                                                </div>
                                                <div className="bg-amber-100 border-2 border-amber-400 rounded-xl p-4 sm:p-5 text-center">
                                                    <p className="text-lg sm:text-xl font-bold text-amber-900">Cháo</p>
                                                    <p className="text-3xl sm:text-5xl font-bold text-amber-800 mt-1">{cp} <span className="text-lg sm:text-2xl">công</span></p>
                                                    <p className="text-base sm:text-lg font-semibold text-amber-600 mt-1">{lp} suất lẻ</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        /* Teacher Meals Tab */
                        <div className="space-y-8 print:space-y-6">
                            {/* Summary Cards */}
                            <div className={`grid ${showSummaryOnly ? 'grid-cols-1 sm:grid-cols-2 gap-8' : 'grid-cols-2 sm:grid-cols-4 gap-3'} mb-2`}>
                                <div className={`bg-gradient-to-br from-rose-600 to-pink-700 rounded-2xl p-6 text-white shadow-xl transform transition-hover hover:scale-[1.02] ${showSummaryOnly ? 'order-first' : ''}`}>
                                    <p className={`${showSummaryOnly ? 'text-2xl' : 'text-sm'} font-bold opacity-90`}>📊 Tổng suất GV</p>
                                    <p className={`${showSummaryOnly ? 'text-7xl' : 'text-3xl'} font-bold mt-2`}>{teacherTotal}</p>
                                </div>
                                <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
                                    <p className={`${showSummaryOnly ? 'text-2xl' : 'text-sm'} font-bold opacity-90`}>🍖 Mặn GV</p>
                                    <p className={`${showSummaryOnly ? 'text-6xl' : 'text-3xl'} font-bold mt-2`}>{teacherSalty}</p>
                                </div>
                                <div className="bg-gradient-to-br from-green-500 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
                                    <p className={`${showSummaryOnly ? 'text-2xl' : 'text-sm'} font-bold opacity-90`}>🥬 Chay GV</p>
                                    <p className={`${showSummaryOnly ? 'text-6xl' : 'text-3xl'} font-bold mt-2`}>{teacherVegetarian}</p>
                                </div>
                                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
                                    <p className={`${showSummaryOnly ? 'text-2xl' : 'text-sm'} font-bold opacity-90`}>🥣 Cháo GV</p>
                                    <p className={`${showSummaryOnly ? 'text-6xl' : 'text-3xl'} font-bold mt-2`}>{teacherPorridge}</p>
                                </div>
                            </div>

                            {/* Chia Công GV */}
                            {(() => {
                                const tcs = Math.floor(teacherSalty / 20)
                                const tls = teacherSalty % 20
                                const tcv = Math.floor(teacherVegetarian / 20)
                                const tlv = teacherVegetarian % 20
                                const tcp = Math.floor(teacherPorridge / 20)
                                const tlp = teacherPorridge % 20
                                const tTotalC = tcs + tcv + tcp

                                return (
                                    <div className="bg-rose-50 rounded-2xl border-2 border-rose-300 shadow-md p-6 sm:p-8">
                                        <h3 className="text-2xl sm:text-3xl font-bold text-rose-800 text-center mb-1">
                                            Công Suất GV
                                        </h3>
                                        <p className="text-center mb-2">
                                            <span className="text-5xl sm:text-7xl font-bold text-rose-900">{tTotalC}</span>
                                            <span className="text-2xl sm:text-3xl font-bold text-rose-600 ml-2">công</span>
                                        </p>
                                        
                                        <div className="text-center mb-5 text-lg sm:text-xl text-rose-600 font-semibold leading-relaxed">
                                            {tls > 0 && <span className="text-blue-700">{tls} suất lẻ mặn</span>}
                                            {tls > 0 && (tlv > 0 || tlp > 0) && <span>, </span>}
                                            {tlv > 0 && <span className="text-emerald-700">{tlv} suất lẻ chay</span>}
                                            {tlv > 0 && tlp > 0 && <span>, </span>}
                                            {tlp > 0 && <span className="text-amber-700">{tlp} suất lẻ cháo</span>}
                                            {tls === 0 && tlv === 0 && tlp === 0 && (
                                                <span className="text-gray-500">Không có suất lẻ</span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 sm:gap-5">
                                            <div className="bg-blue-100 border-2 border-blue-400 rounded-xl p-4 sm:p-5 text-center">
                                                <p className="text-lg sm:text-xl font-bold text-blue-900">Mặn</p>
                                                <p className="text-3xl sm:text-5xl font-bold text-blue-800 mt-1">{tcs} <span className="text-lg sm:text-2xl">công</span></p>
                                                <p className="text-base sm:text-lg font-semibold text-blue-600 mt-1">{tls} suất lẻ</p>
                                            </div>
                                            <div className="bg-emerald-100 border-2 border-emerald-400 rounded-xl p-4 sm:p-5 text-center">
                                                <p className="text-lg sm:text-xl font-bold text-emerald-900">Chay</p>
                                                <p className="text-3xl sm:text-5xl font-bold text-emerald-800 mt-1">{tcv} <span className="text-lg sm:text-2xl">công</span></p>
                                                <p className="text-base sm:text-lg font-semibold text-emerald-600 mt-1">{tlv} suất lẻ</p>
                                            </div>
                                            <div className="bg-amber-100 border-2 border-amber-400 rounded-xl p-4 sm:p-5 text-center">
                                                <p className="text-lg sm:text-xl font-bold text-amber-900">Cháo</p>
                                                <p className="text-3xl sm:text-5xl font-bold text-amber-800 mt-1">{tcp} <span className="text-lg sm:text-2xl">công</span></p>
                                                <p className="text-base sm:text-lg font-semibold text-amber-600 mt-1">{tlp} suất lẻ</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* Ghi chú */}
                            {teacherNote && (
                                <div className="bg-white rounded-xl border border-gray-200 p-4">
                                    <p className="text-sm font-medium text-gray-600">💬 Ghi chú: <span className="text-gray-800">{teacherNote}</span></p>
                                </div>
                            )}


                        </div>
                    )}
                </>
            )}

            {/* Signature Block (Only Visible on Print) */}
            <div className="hidden print:flex justify-between items-start mt-12 text-center text-sm font-bold w-full break-inside-avoid px-8">
                <div className="flex flex-col items-center">
                    <p>ĐẠI DIỆN TRƯỜNG</p>
                    <p className="invisible h-24">Signature</p>
                </div>
                <div className="flex flex-col items-center">
                    <p>QUẢN LÝ BẾP</p>
                    <p className="invisible h-24">Signature</p>
                </div>
                <div className="flex flex-col items-center">
                    <p>NGƯỜI LẬP (Kế toán)</p>
                    <p className="invisible h-24">Signature</p>
                    <p className="font-normal border-t border-dashed w-32 pt-1 uppercase">ký, ghi rõ họ tên</p>
                </div>
            </div>
        </div>
    )
}
