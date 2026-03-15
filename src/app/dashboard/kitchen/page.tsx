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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 print:hidden">
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
                    <p className="text-sm font-semibold opacity-90">🍖 Suất mặn</p>
                    <p className="text-3xl font-bold mt-1">{totalSalty}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white shadow-md">
                    <p className="text-sm font-semibold opacity-90">🥬 Suất chay</p>
                    <p className="text-3xl font-bold mt-1">{totalVegetarian}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-4 text-white shadow-md">
                    <p className="text-sm font-semibold opacity-90">🥣 Suất cháo</p>
                    <p className="text-3xl font-bold mt-1">{totalPorridge}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-4 text-white shadow-md">
                    <p className="text-sm font-semibold opacity-90">📊 Tổng suất</p>
                    <p className="text-3xl font-bold mt-1">{totalMeals}</p>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-4 text-white shadow-md">
                    <p className="text-sm font-semibold opacity-90">⚙️ Số Công</p>
                    <p className="text-3xl font-bold mt-1">{totalCong}</p>
                    <p className="text-xs opacity-70 mt-0.5">= ⌈{totalMeals}/20⌉</p>
                </div>
            </div>

            {/* Group Breakdown */}
            <div className="space-y-4">
                {groupSummaries.map((gs) => (
                    <div key={gs.group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        {/* Group Header */}
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between print:hidden">
                            <h3 className="font-bold text-gray-700 text-lg">{gs.group.name}</h3>
                            <div className="flex gap-4 text-xs text-gray-500">
                                <span>Báo: <b className="text-blue-600">{gs.reportedCount}/{gs.totalRooms}</b></span>
                            </div>
                        </div>

                        {/* Large Group Overview Cards (for easy reading & printing) */}
                        <div className="grid grid-cols-2 gap-4 p-4 border-b border-gray-200">
                            <div className="col-span-2 sm:col-span-1 border border-gray-200 outline outline-1 outline-gray-300 rounded-xl p-4 text-center bg-blue-50/30">
                                <h3 className="text-lg font-bold text-gray-800 mb-1">{gs.group.name}</h3>
                                <p className="text-sm font-semibold text-gray-600">📊 TỔNG SUẤT</p>
                                <p className="text-4xl font-extrabold text-blue-700 mt-2">{gs.totalMeals}</p>
                            </div>
                            <div className="col-span-2 sm:col-span-1 border border-gray-200 outline outline-1 outline-gray-300 rounded-xl p-4 text-center bg-rose-50/30 flex flex-col items-center justify-center">
                                <p className="text-lg font-bold text-transparent mb-1 select-none hidden sm:block">.</p>
                                <p className="text-sm font-semibold text-gray-600">⚙️ TỔNG SỐ CÔNG</p>
                                <p className="text-5xl font-extrabold text-rose-600 mt-2 mb-3">{gs.cong}</p>
                                {/* Detailed Công Breakdowns */}
                                <div className="flex gap-3 justify-center text-sm mt-auto">
                                    {gs.totalSalty > 0 && <div className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 font-bold shadow-sm whitespace-nowrap">Mặn: {Math.ceil(gs.totalSalty / 20)}</div>}
                                    {gs.totalPorridge > 0 && <div className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg border border-amber-200 font-bold shadow-sm whitespace-nowrap">Cháo: {Math.ceil(gs.totalPorridge / 20)}</div>}
                                    {gs.totalVegetarian > 0 && <div className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 font-bold shadow-sm whitespace-nowrap">Chay: {Math.ceil(gs.totalVegetarian / 20)}</div>}
                                </div>
                            </div>
                        </div>

                        {/* Rooms Table */}
                        <div className="hidden sm:block overflow-x-auto max-h-[60vh] print:overflow-visible print:max-h-none print:block" data-print-show>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 text-gray-600 font-medium sticky top-0 z-10 shadow-sm border-b border-gray-200">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-semibold">Phòng</th>
                                        <th className="text-center px-2 py-3 font-semibold">Sĩ số</th>
                                        <th className="text-center px-2 py-3 font-semibold">Nghỉ</th>
                                        <th className="text-center px-2 py-3 font-semibold">🍖 Mặn</th>
                                        <th className="text-center px-2 py-3 font-semibold">🥣 Cháo</th>
                                        <th className="text-center px-2 py-3 font-semibold">🥬 Chay</th>
                                        <th className="text-center px-2 py-3 font-semibold bg-gray-200/50">M1 Mặn</th>
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
                                                    <td className="text-center px-2 py-2 bg-gray-50 text-gray-600 text-xs font-semibold">
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
                                        <td className="px-4 py-3 text-gray-700">Tổng suất:</td>
                                        <td className="text-center px-2 py-3">—</td>
                                        <td className="text-center px-2 py-3">—</td>
                                        <td className="text-center px-2 py-3 text-blue-700">{gs.totalSalty}</td>
                                        <td className="text-center px-2 py-3 text-amber-600">{gs.totalPorridge}</td>
                                        <td className="text-center px-2 py-3 text-emerald-600">{gs.totalVegetarian}</td>
                                        <td className="text-center px-2 py-3 bg-gray-100">—</td>
                                        <td className="text-center px-2 py-3">—</td>
                                    </tr>
                                    {/* Subtotal Công */}
                                    <tr className="border-b-2 border-gray-200 bg-rose-50 font-semibold text-sm">
                                        <td className="px-4 py-2 text-rose-700 flex items-center justify-between">
                                            <span>Tổng số công: <b className="text-rose-600 text-base">{gs.cong}</b></span>
                                        </td>
                                        <td className="text-center px-2 py-2">—</td>
                                        <td className="text-center px-2 py-2">—</td>
                                        <td className="text-center px-2 py-2 whitespace-nowrap">
                                            {gs.totalSalty > 0 && <div className="inline-block bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 text-base font-bold shadow-sm" title="Số công mặn">Mặn: {Math.ceil(gs.totalSalty / 20)}</div>}
                                        </td>
                                        <td className="text-center px-2 py-2 whitespace-nowrap">
                                            {gs.totalPorridge > 0 && <div className="inline-block bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg border border-amber-200 text-base font-bold shadow-sm" title="Số công cháo">Cháo: {Math.ceil(gs.totalPorridge / 20)}</div>}
                                        </td>
                                        <td className="text-center px-2 py-2 whitespace-nowrap">
                                            {gs.totalVegetarian > 0 && <div className="inline-block bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 text-base font-bold shadow-sm" title="Số công chay">Chay: {Math.ceil(gs.totalVegetarian / 20)}</div>}
                                        </td>
                                        <td className="text-center px-2 py-2 bg-rose-100/50">—</td>
                                        <td className="text-center px-2 py-2">—</td>
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
                                        <div className="flex justify-between mt-1 text-sm">
                                            <span>SN: <b className="text-gray-800">{room.report.capacity}</b></span>
                                            <span className="text-blue-700 font-bold">Mặn: {room.report.salty_count}</span>
                                            <span className="text-amber-600 font-bold">Cháo: {room.report.porridge_count}</span>
                                            <span className="text-emerald-600 font-bold">Chay: {room.report.vegetarian_count}</span>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic mt-1">Chưa báo</p>
                                    )}
                                </div>
                            ))}
                            
                            {/* Mobile Subtotal and Công */}
                            <div className="p-4 bg-gray-50 border-t-2 border-gray-200 space-y-3">
                                <div className="flex justify-between text-sm font-semibold">
                                    <span className="text-gray-700">Tổng suất:</span>
                                    <span className="text-blue-700">M: {gs.totalSalty}</span>
                                    <span className="text-amber-600">C: {gs.totalPorridge}</span>
                                    <span className="text-emerald-600">V: {gs.totalVegetarian}</span>
                                </div>
                                <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-sm text-rose-700 font-semibold shadow-sm">
                                    <div className="flex justify-between mb-1.5 border-b border-rose-100/50 pb-1.5">
                                        <span>Tổng số công:</span>
                                        <b className="text-rose-600 text-base">{gs.cong}</b>
                                    </div>
                                    <div className="flex justify-between text-xs opacity-90 mt-2">
                                        {gs.totalSalty > 0 && <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded border border-blue-200 font-bold">Mặn: {Math.ceil(gs.totalSalty / 20)}</div>}
                                        {gs.totalPorridge > 0 && <div className="bg-amber-100 text-amber-800 px-2 py-1 rounded border border-amber-200 font-bold">Cháo: {Math.ceil(gs.totalPorridge / 20)}</div>}
                                        {gs.totalVegetarian > 0 && <div className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded border border-emerald-200 font-bold">Chay: {Math.ceil(gs.totalVegetarian / 20)}</div>}
                                    </div>
                                </div>
                            </div>
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
