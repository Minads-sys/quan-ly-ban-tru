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
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [loading, setLoading] = useState(true)
    const [totalSalty, setTotalSalty] = useState(0)
    const [totalVegetarian, setTotalVegetarian] = useState(0)
    const [totalPorridge, setTotalPorridge] = useState(0)
    const [totalMeals, setTotalMeals] = useState(0)
    const [totalCong, setTotalCong] = useState(0)
    const [groupSummaries, setGroupSummaries] = useState<GroupSummary[]>([])

    const loadData = useCallback(async (selectedDate: string) => {
        setLoading(true)
        const data = await getKitchenSummary(selectedDate)
        if ('error' in data) return

        setTotalSalty(data.totalSalty as number)
        setTotalVegetarian(data.totalVegetarian as number)
        setTotalPorridge(data.totalPorridge as number)
        setTotalMeals(data.totalMeals as number)
        setTotalCong(data.totalCong as number)
        setGroupSummaries(data.groupSummaries as GroupSummary[])
        setLoading(false)
    }, [])

    useEffect(() => {
        loadData(date)
    }, [date, loadData])

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
            // Subtotal cho nhóm
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

        // Style columns width
        ws1['!cols'] = [{ wch: 20 }, { wch: 15 }]
        ws2['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }]

        XLSX.utils.book_append_sheet(wb, ws1, 'Tổng hợp')
        XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết')

        XLSX.writeFile(wb, `bao-cao-suat-an-${date}.xlsx`)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        🍳 Báo cáo Bếp / Kế toán
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-sm
              focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                    <button
                        onClick={exportToExcel}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold
              hover:bg-emerald-600 shadow-md transition-all active:scale-[0.98]"
                    >
                        📥 Xuất Excel
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-gray-600 text-white rounded-xl text-sm font-semibold
              hover:bg-gray-700 shadow-md transition-all active:scale-[0.98]"
                    >
                        🖨️ In
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-md">
                    <p className="text-xs font-medium opacity-80">🍖 Suất mặn</p>
                    <p className="text-3xl font-bold mt-1">{totalSalty}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white shadow-md">
                    <p className="text-xs font-medium opacity-80">🥬 Suất chay</p>
                    <p className="text-3xl font-bold mt-1">{totalVegetarian}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-4 text-white shadow-md">
                    <p className="text-xs font-medium opacity-80">🥣 Suất cháo</p>
                    <p className="text-3xl font-bold mt-1">{totalPorridge}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-4 text-white shadow-md">
                    <p className="text-xs font-medium opacity-80">📊 Tổng suất</p>
                    <p className="text-3xl font-bold mt-1">{totalMeals}</p>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-4 text-white shadow-md">
                    <p className="text-xs font-medium opacity-80">⚙️ Số Công</p>
                    <p className="text-3xl font-bold mt-1">{totalCong}</p>
                    <p className="text-xs opacity-70 mt-0.5">= ⌈{totalMeals}/20⌉</p>
                </div>
            </div>

            {/* Group Breakdown */}
            <div className="space-y-4">
                {groupSummaries.map((gs) => (
                    <div key={gs.group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        {/* Group Header */}
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="font-bold text-gray-700">{gs.group.name}</h3>
                            <div className="flex gap-4 text-xs text-gray-500">
                                <span>Báo: <b className="text-blue-600">{gs.reportedCount}/{gs.totalRooms}</b></span>
                                <span>Tổng: <b className="text-purple-600">{gs.totalMeals}</b></span>
                                <span>Công: <b className="text-rose-600">{gs.cong}</b></span>
                            </div>
                        </div>

                        {/* Rooms Table */}
                        <div className="hidden sm:block" data-print-show>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-500 text-xs">
                                        <th className="text-left px-4 py-2 font-medium">Phòng</th>
                                        <th className="text-center px-2 py-2 font-medium">Sĩ số</th>
                                        <th className="text-center px-2 py-2 font-medium">Nghỉ</th>
                                        <th className="text-center px-2 py-2 font-medium">🍖 Mặn</th>
                                        <th className="text-center px-2 py-2 font-medium">🥣 Cháo</th>
                                        <th className="text-center px-2 py-2 font-medium">🥬 Chay</th>
                                        <th className="text-center px-2 py-2 font-medium bg-blue-50">M1 Mặn</th>
                                        <th className="text-center px-2 py-2 font-medium">TT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gs.rooms.map(room => (
                                        <tr key={room.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                                            <td className="px-4 py-2 font-medium text-gray-700">{room.name}</td>
                                            {room.report ? (
                                                <>
                                                    <td className="text-center px-2 py-2">{room.report.capacity}</td>
                                                    <td className="text-center px-2 py-2 text-red-500">{room.report.absent_count}</td>
                                                    <td className="text-center px-2 py-2 font-semibold text-blue-700">{room.report.salty_count}</td>
                                                    <td className="text-center px-2 py-2">{room.report.porridge_count}</td>
                                                    <td className="text-center px-2 py-2">{room.report.vegetarian_count}</td>
                                                    <td className="text-center px-2 py-2 bg-blue-50 text-blue-600 text-xs">
                                                        {room.report.moc1_snapshot ? room.report.moc1_snapshot.salty_count : '—'}
                                                    </td>
                                                    <td className="text-center px-2 py-2">
                                                        {room.report.status === 'approved' ? '✅' : room.report.status === 'submitted' ? '⏳' : '⚪'}
                                                    </td>
                                                </>
                                            ) : (
                                                <td colSpan={8} className="text-center px-2 py-2 text-gray-400 italic text-xs">Chưa báo</td>
                                            )}
                                        </tr>
                                    ))}
                                    {/* Subtotal */}
                                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-sm">
                                        <td className="px-4 py-2 text-gray-600">Tổng</td>
                                        <td className="text-center px-2 py-2">—</td>
                                        <td className="text-center px-2 py-2">—</td>
                                        <td className="text-center px-2 py-2 text-blue-700">{gs.totalSalty}</td>
                                        <td className="text-center px-2 py-2">{gs.totalPorridge}</td>
                                        <td className="text-center px-2 py-2">{gs.totalVegetarian}</td>
                                        <td className="text-center px-2 py-2 bg-blue-50">—</td>
                                        <td className="text-center px-2 py-2 text-rose-600">{gs.cong}C</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="sm:hidden divide-y divide-gray-100" data-print-hide>
                            {gs.rooms.map(room => (
                                <div key={room.id} className="px-4 py-3">
                                    <p className="font-medium text-gray-700 text-sm">{room.name}</p>
                                    {room.report ? (
                                        <div className="flex gap-4 mt-1 text-xs text-gray-500">
                                            <span>SN:{room.report.capacity}</span>
                                            <span className="text-blue-600 font-semibold">Mặn:{room.report.salty_count}</span>
                                            <span>Cháo:{room.report.porridge_count}</span>
                                            <span>Chay:{room.report.vegetarian_count}</span>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic mt-1">Chưa báo</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {groupSummaries.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                    <p className="text-4xl mb-3">📊</p>
                    <p>Chưa có dữ liệu cho ngày này</p>
                </div>
            )}
        </div>
    )
}
