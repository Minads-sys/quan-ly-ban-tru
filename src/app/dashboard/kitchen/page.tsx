'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKitchenSummary } from './actions'
import { formatToViewDate, getVietnamHours, getVietnamDateString } from '@/utils/dateUtils'
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
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'kitchen' | 'distributor'>('kitchen')
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

    // ⚡ 1 lần gọi duy nhất — getKitchenSummary tự tính ngày nếu chưa có
    const loadData = useCallback(async (selectedDate?: string) => {
        setLoading(true)

        const data = await getKitchenSummary(selectedDate || undefined, true)
        
        if ('error' in data) {
            setLoading(false)
            return
        }

        // Cập nhật date từ server (lần đầu)
        if (!selectedDate && data.date) {
            setDate(data.date as string)
        }

        const role = data.userRole as string
        setUserRole(role)
        setShowSummaryOnly(role === 'kitchen' || role === 'meal_distributor')
        if (data.moc1Close) setMoc1Close(data.moc1Close as string)
        
        // Default tab based on role
        if (role === 'meal_distributor') {
            setActiveTab('distributor')
        }

        // Kiểm tra 14h lock cho Bếp & Chia suất
        const isRestricted = ['kitchen', 'meal_distributor'].includes(role)
        const nowHours = getVietnamHours()
        if (nowHours >= 14) setIsAfter14h(true)

        const todayStr = getVietnamDateString()
        const isToday = (selectedDate || data.date) === todayStr

        // Kiểm tra điều kiện khóa: 14h hôm nay → mốc 1 ngày mai
        if (isRestricted && isToday && nowHours >= 14) {
             setIsLocked(true)
             setTotalSalty(0)
             setTotalVegetarian(0)
             setTotalPorridge(0)
             setTotalMeals(0)
             setTotalCong(0)
             setGroupSummaries([])
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
        setLoading(false)
    }, [])

    // Load lần đầu (không truyền date → server tự tính)
    useEffect(() => { loadData() }, [loadData])

    // ⚡ Realtime: tự động làm mới khi có thay đổi daily_reports
    useRealtimeRefresh(['daily_reports'], loadData)

    // Khi user đổi date thủ công (bị khóa cho kitchen/meal_distributor)
    const isRestrictedRole = ['kitchen', 'meal_distributor'].includes(userRole)
    const handleDateChange = (newDate: string) => {
        if (isRestrictedRole) return // Không cho đổi ngày
        setDate(newDate)
        loadData(newDate)
    }

    function exportToExcel() {
        // Sheet 1: Tổng hợp
        const summaryData = [
            ['BÁO CÁO SUẤT ĂN BÁN TRÚ'],
            [`Ngày: ${date}`],
            [],
            ['Loại suất', 'Số lượng'],
            ['🍖 Suất mặn', totalSalty],
            ['🥬 Suất chay', totalVegetarian],
            ['🥣 Suất cháo', totalPorridge],
            ['TỔNG', totalMeals],
            ['SỐ CÔNG', totalCong],
        ]

        // Sheet 2: Chi tiết theo nhóm
        const detailData: (string | number)[][] = [
            ['BÁO CÁO CHI TIẾT THEO NHÓM/LỚP'],
            [`Ngày: ${date}`],
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
                    
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={date}
                            onChange={e => handleDateChange(e.target.value)}
                            disabled={isRestrictedRole}
                            className={`${showSummaryOnly ? 'px-6 py-3 text-xl' : 'px-4 py-2 text-sm'} rounded-xl border border-gray-200 
                focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-bold
                ${isRestrictedRole ? 'opacity-60 cursor-not-allowed bg-gray-100' : ''}`}
                        />
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

                {/* Tab Switcher - Only for admin (không hiện cho kitchen, meal_distributor) */}
                {!showSummaryOnly && userRole !== 'meal_distributor' && (
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
                        </div>
                        {/* Ghi chú mốc tương ứng tab */}
                        <p className="text-xs font-semibold text-gray-500">
                            {activeTab === 'kitchen'
                                ? '🛒 Mốc 1 — Đi chợ'
                                : '🍽️ Mốc 2 — Chia suất ra công'}
                        </p>
                    </div>
                )}
            </div>

            {/* Content for Kitchen View After 14h today */}
            {isViewingTodayAfter14h ? (
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
                            {/* Summary Cards - Kitchen */}
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
                    ) : (
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
