'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKitchenSummary } from './actions'
import * as XLSX from 'xlsx'

interface GroupSummary {
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
    const [totalSalty, setTotalSalty] = useState(0)
    const [totalVegetarian, setTotalVegetarian] = useState(0)
    const [totalPorridge, setTotalPorridge] = useState(0)
    const [totalMeals, setTotalMeals] = useState(0)
    const [totalCong, setTotalCong] = useState(0)
    const [groupSummaries, setGroupSummaries] = useState<GroupSummary[]>([])
    const [userRole, setUserRole] = useState('')
    const [isAfter14h, setIsAfter14h] = useState(false)
    const [showSummaryOnly, setShowSummaryOnly] = useState(false)

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

        setUserRole(data.userRole as string)
        setShowSummaryOnly(data.userRole === 'kitchen')

        // Kiểm tra 14h
        const now = new Date()
        if (now.getHours() >= 14) setIsAfter14h(true)

        const todayStr = now.toISOString().split('T')[0]
        const isToday = (selectedDate || data.date) === todayStr

        // Kiểm tra điều kiện 14h cho Bếp
        if (data.userRole === 'kitchen' && isToday && now.getHours() >= 14) {
             setTotalSalty(0)
             setTotalVegetarian(0)
             setTotalPorridge(0)
             setTotalMeals(0)
             setTotalCong(0)
             setGroupSummaries([])
             setLoading(false)
             return
        }

        setTotalSalty(data.totalSalty as number)
        setTotalVegetarian(data.totalVegetarian as number)
        setTotalPorridge(data.totalPorridge as number)
        setTotalMeals(data.totalMeals as number)
        setTotalCong(data.totalCong as number)
        setGroupSummaries(data.groupSummaries as GroupSummary[])
        setLoading(false)
    }, [])

    // Load lần đầu (không truyền date → server tự tính)
    useEffect(() => { loadData() }, [loadData])

    // Khi user đổi date thủ công
    const handleDateChange = (newDate: string) => {
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

    // Kiểm tra render logic cho Bếp sau 14h hôm nay
    const todayStr = new Date().toISOString().split('T')[0]
    const isViewingTodayAfter14h = userRole === 'kitchen' && date === todayStr && new Date().getHours() >= 14

    return (
        <div className={showSummaryOnly ? 'max-w-4xl mx-auto' : ''}>
            {/* Header */}
            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 print:hidden ${showSummaryOnly ? 'bg-white p-6 rounded-2xl shadow-sm border border-gray-100' : ''}`}>
                <div>
                    <h2 className={`${showSummaryOnly ? 'text-3xl' : 'text-xl'} font-bold text-gray-800 flex items-center gap-3`}>
                        {showSummaryOnly ? '👨‍🍳 THỐNG KÊ SUẤT ĂN' : '🍳 Báo cáo Bếp / Kế toán'}
                    </h2>
                    {showSummaryOnly && <p className="text-gray-500 mt-1 text-lg">Chào bạn, đây là số liệu đã được duyệt.</p>}
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={date}
                        onChange={e => handleDateChange(e.target.value)}
                        className={`${showSummaryOnly ? 'px-6 py-3 text-xl' : 'px-4 py-2 text-sm'} rounded-xl border border-gray-200 
              focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-bold`}
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

            {/* Content for Kitchen View After 14h today */}
            {isViewingTodayAfter14h ? (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-12 text-center shadow-lg">
                     <p className="text-6xl mb-6">⏰</p>
                     <p className="text-3xl font-extrabold text-amber-800">Đã hết thời gian xem số liệu ngày hôm nay.</p>
                     <p className="text-xl text-amber-700 mt-4">Vui lòng chọn ngày khác hoặc xem số liệu ngày mai.</p>
                </div>
            ) : groupSummaries.length === 0 && !loading ? (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-20 text-center shadow-sm">
                    <p className="text-6xl mb-6">📊</p>
                    <p className="text-3xl font-bold text-gray-500">Chưa có số liệu cho ngày {date}</p>
                    <p className="text-lg text-gray-400 mt-2">(Chỉ hiển thị số liệu đã được duyệt)</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards - Enhanced for Kitchen */}
                    <div className={`grid ${showSummaryOnly ? 'grid-cols-1 sm:grid-cols-2 gap-8' : 'grid-cols-2 sm:grid-cols-5 gap-3'} mb-8`}>
                        <div className={`bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl transform transition-hover hover:scale-[1.02] ${showSummaryOnly ? 'order-first' : ''}`}>
                            <p className={`${showSummaryOnly ? 'text-2xl' : 'text-sm'} font-bold opacity-90`}>📊 Tổng suất</p>
                            <p className={`${showSummaryOnly ? 'text-7xl' : 'text-3xl'} font-black mt-2`}>{totalMeals}</p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
                            <p className={`${showSummaryOnly ? 'text-2xl' : 'text-sm'} font-bold opacity-90`}>🍖 Tổng suất mặn</p>
                            <p className={`${showSummaryOnly ? 'text-6xl' : 'text-3xl'} font-black mt-2`}>{totalSalty}</p>
                        </div>
                        <div className="bg-gradient-to-br from-green-500 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
                            <p className={`${showSummaryOnly ? 'text-2xl' : 'text-sm'} font-bold opacity-90`}>🥬 Tổng Suất chay</p>
                            <p className={`${showSummaryOnly ? 'text-6xl' : 'text-3xl'} font-black mt-2`}>{totalVegetarian}</p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
                            <p className={`${showSummaryOnly ? 'text-2xl' : 'text-sm'} font-bold opacity-90`}>🥣 Tổng suất Cháo</p>
                            <p className={`${showSummaryOnly ? 'text-6xl' : 'text-3xl'} font-black mt-2`}>{totalPorridge}</p>
                        </div>
                        {!showSummaryOnly && (
                            <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-4 text-white shadow-md">
                                <p className="text-sm font-semibold opacity-90">⚙️ Số Công</p>
                                <p className="text-3xl font-bold mt-1">{totalCong}</p>
                                <p className="text-xs opacity-70 mt-0.5">= Σ công các nhóm</p>
                            </div>
                        )}
                    </div>

                    {/* Group Breakdown - ONLY for non-kitchen roles */}
                    {!showSummaryOnly && (
                        <div className="space-y-4">
                            {groupSummaries.map((gs) => (
                                <div key={gs.group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between print:hidden">
                                        <h3 className="font-bold text-gray-700 text-lg">{gs.group.name}</h3>
                                        <div className="flex gap-4 text-xs text-gray-500">
                                            <span>Báo: <b className="text-blue-600">{gs.reportedCount}/{gs.totalRooms}</b></span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 p-4 border-b border-gray-200">
                                        <div className="col-span-2 sm:col-span-1 border border-gray-200 outline outline-1 outline-gray-300 rounded-xl p-4 text-center bg-blue-50/30">
                                            <h3 className="text-lg font-bold text-gray-800 mb-1">{gs.group.name}</h3>
                                            <p className="text-sm font-semibold text-gray-600">📊 TỔNG SUẤT</p>
                                            <p className="text-4xl font-extrabold text-blue-700 mt-2">{gs.totalMeals}</p>
                                        </div>
                                        <div className="col-span-2 sm:col-span-1 border border-gray-200 outline outline-1 outline-gray-300 rounded-xl p-4 text-center bg-rose-50/30 flex flex-col items-center justify-center">
                                            <p className="text-sm font-semibold text-gray-600">⚙️ TỔNG SỐ CÔNG</p>
                                            <p className="text-5xl font-extrabold text-rose-600 mt-2 mb-3">{gs.cong}</p>
                                            <div className="flex gap-3 justify-center text-sm mt-auto">
                                                {gs.totalSalty > 0 && <div className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 font-bold shadow-sm whitespace-nowrap">Mặn: {Math.ceil(gs.totalSalty / 20)}</div>}
                                                {gs.totalPorridge > 0 && <div className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg border border-amber-200 font-bold shadow-sm whitespace-nowrap">Cháo: {Math.ceil(gs.totalPorridge / 20)}</div>}
                                                {gs.totalVegetarian > 0 && <div className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 font-bold shadow-sm whitespace-nowrap">Chay: {Math.ceil(gs.totalVegetarian / 20)}</div>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="hidden sm:block overflow-x-auto max-h-[60vh] print:overflow-visible print:max-h-none print:block">
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
                                                            <td colSpan={7} className="text-center px-2 py-2 text-gray-400 italic text-xs">Chưa báo</td>
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
            )}
        </div>
    )
}
