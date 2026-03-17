'use client'

import { useState, useEffect } from 'react'
import { searchReports } from './actions'

interface Report {
    id: string
    room_id: string
    capacity: number
    absent_count: number
    porridge_count: number
    vegetarian_count: number
    salty_count: number
    status: string
    note: string | null
    absent_list: { name: string; reason?: string }[]
    rooms: { name: string; groups: { name: string } | null } | null
}

interface Room {
    id: string
    name: string
    default_capacity: number
    groups: { name: string } | null
}

export default function AdminPage() {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [reports, setReports] = useState<Report[]>([])
    const [mealPrice, setMealPrice] = useState(25000)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    async function handleSearch() {
        setLoading(true)
        setMessage(null)
        const data = await searchReports(date)
        if ('error' in data && data.error) {
            setMessage({ type: 'error', text: data.error as string })
        } else {
            setReports((data.reports || []) as Report[])
            if (data.mealPrice) setMealPrice(data.mealPrice)
        }
        setLoading(false)
    }

    useEffect(() => {
        handleSearch()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Aggregate by Group
    const groupMap = new Map<string, {
        name: string,
        rooms: number,
        totalMeals: number,
        salty: number,
        porridge: number,
        vegetarian: number,
    }>()

    reports.forEach(r => {
        const groupName = r.rooms?.groups?.name || 'Khác'
        const existing = groupMap.get(groupName) || { name: groupName, rooms: 0, totalMeals: 0, salty: 0, porridge: 0, vegetarian: 0 }
        
        existing.rooms += 1
        existing.totalMeals += (r.salty_count + r.porridge_count + r.vegetarian_count)
        existing.salty += r.salty_count
        existing.porridge += r.porridge_count
        existing.vegetarian += r.vegetarian_count
        
        groupMap.set(groupName, existing)
    })

    const groupSummaries = Array.from(groupMap.values()).sort((a, b) => a.name.localeCompare(b.name))

    const totalSalty = reports.reduce((s, r) => s + r.salty_count, 0)
    const totalPorridge = reports.reduce((s, r) => s + r.porridge_count, 0)
    const totalVegetarian = reports.reduce((s, r) => s + r.vegetarian_count, 0)
    const totalMeals = totalSalty + totalPorridge + totalVegetarian
    const totalMoney = totalMeals * mealPrice

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-black text-gray-800 flex items-center gap-3">
                        📊 QUẢN TRỊ DỮ LIỆU
                    </h2>
                    <p className="text-gray-500 mt-1 text-lg">Tổng hợp số liệu & Thống kê doanh thu</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="px-5 py-3 text-xl rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-bold shadow-sm"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {loading ? '...' : '🔍 Tìm kiếm'}
                    </button>
                </div>
            </div>

            {/* General Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
                    <p className="text-sm font-bold opacity-80 uppercase tracking-wider">💰 Tổng tiền bán trú</p>
                    <p className="text-3xl font-black mt-2">{totalMoney.toLocaleString()} <span className="text-lg">đ</span></p>
                    <p className="text-xs mt-2 opacity-70 italic">(Đơn giá: {mealPrice.toLocaleString()} đ/suất)</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">📦 Tổng số suất</p>
                    <p className="text-4xl font-black text-gray-800 mt-1">{totalMeals}</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <p className="text-sm font-bold text-blue-600 uppercase tracking-wider">🍖 Suất Mặn</p>
                    <p className="text-4xl font-black text-blue-700 mt-1">{totalSalty}</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <p className="text-sm font-bold text-amber-600 uppercase tracking-wider">🥣 Suất Cháo / Chay</p>
                    <p className="text-4xl font-black text-amber-700 mt-1">{totalPorridge + totalVegetarian}</p>
                </div>
            </div>

            {/* visual Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Meal Distribution Chart */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                    <h3 className="text-xl font-extrabold text-gray-800 mb-8 flex items-center gap-2">
                        📈 Tỷ lệ phân bổ suất ăn
                    </h3>
                    
                    {totalMeals > 0 ? (
                        <div className="space-y-8">
                            {[
                                { label: 'Mặn', count: totalSalty, color: 'bg-blue-500', icon: '🍖' },
                                { label: 'Cháo', count: totalPorridge, color: 'bg-amber-500', icon: '🥣' },
                                { label: 'Chay', count: totalVegetarian, color: 'bg-emerald-500', icon: '🥬' },
                            ].map(item => {
                                const percent = totalMeals > 0 ? (item.count / totalMeals) * 100 : 0
                                return (
                                    <div key={item.label}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-gray-700 flex items-center gap-2">
                                                {item.icon} {item.label}
                                            </span>
                                            <span className="font-black text-gray-900">{item.count} <span className="text-gray-400 font-normal text-sm ml-1">({percent.toFixed(1)}%)</span></span>
                                        </div>
                                        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full ${item.color} transition-all duration-1000`} 
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-gray-400 italic">
                            Không có dữ liệu biểu đồ
                        </div>
                    )}
                </div>

                {/* Info Card */}
                <div className="bg-amber-50 rounded-3xl p-8 border border-amber-100">
                    <h3 className="text-xl font-bold text-amber-800 mb-4">💡 Ghi chú</h3>
                    <ul className="space-y-3 text-amber-900/80 text-sm leading-relaxed">
                        <li>• Số liệu dựa trên các báo cáo đã được trường phê duyệt.</li>
                        <li>• Đơn giá suất ăn có thể thay đổi trong phần <b>Cài đặt</b>.</li>
                        <li>• Tổng tiền được tính bằng công thức: <br/> <code className="bg-amber-100 px-1 rounded font-bold">Tổng suất x Đơn giá</code></li>
                    </ul>
                    <div className="mt-8 pt-8 border-t border-amber-200">
                        <p className="text-xs text-amber-700 font-medium uppercase tracking-widest mb-2">Trạng thái hệ thống</p>
                        <div className="flex items-center gap-2 text-emerald-600 font-bold">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            Dữ liệu trực tuyến
                        </div>
                    </div>
                </div>
            </div>

            {/* Aggregated Table */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-8">
                <div className="px-8 py-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-black text-gray-800 text-xl flex items-center gap-2">
                        📋 Tổng hợp theo Nhóm / Khối
                    </h3>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-widest font-black">
                                <th className="px-8 py-4">Nhóm / Khối</th>
                                <th className="px-4 py-4 text-center">Số phòng</th>
                                <th className="px-4 py-4 text-center text-gray-800">Tổng suất</th>
                                <th className="px-4 py-4 text-center text-blue-600">Mặn</th>
                                <th className="px-4 py-4 text-center text-amber-600">Cháo</th>
                                <th className="px-4 py-4 text-center text-emerald-600">Chay</th>
                                <th className="px-8 py-4 text-right">Tổng tiền (VNĐ)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {groupSummaries.map(gs => (
                                <tr key={gs.name} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-8 py-5 font-extrabold text-gray-800">{gs.name}</td>
                                    <td className="px-4 py-5 text-center text-gray-500">{gs.rooms}</td>
                                    <td className="px-4 py-5 text-center font-black text-lg text-gray-900">{gs.totalMeals}</td>
                                    <td className="px-4 py-5 text-center font-bold text-blue-600">{gs.salty}</td>
                                    <td className="px-4 py-5 text-center font-bold text-amber-600">{gs.porridge}</td>
                                    <td className="px-4 py-5 text-center font-bold text-emerald-600">{gs.vegetarian}</td>
                                    <td className="px-8 py-5 text-right font-black text-indigo-600">
                                        {(gs.totalMeals * mealPrice).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {groupSummaries.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-8 py-20 text-center text-gray-400 italic">
                                        Không có dữ liệu cho ngày đã chọn
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {groupSummaries.length > 0 && (
                            <tfoot className="bg-gray-50/50 border-t border-gray-100">
                                <tr className="font-black text-gray-900">
                                    <td className="px-8 py-5">TỔNG CỘNG</td>
                                    <td className="px-4 py-5 text-center text-gray-400">—</td>
                                    <td className="px-4 py-5 text-center text-xl underline decoration-indigo-500 decoration-4">{totalMeals}</td>
                                    <td className="px-4 py-5 text-center text-blue-600">{totalSalty}</td>
                                    <td className="px-4 py-5 text-center text-amber-600">{totalPorridge}</td>
                                    <td className="px-4 py-5 text-center text-emerald-600">{totalVegetarian}</td>
                                    <td className="px-8 py-5 text-right text-2xl text-indigo-700">
                                        {totalMoney.toLocaleString()} <span className="text-sm">đ</span>
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    )
}
