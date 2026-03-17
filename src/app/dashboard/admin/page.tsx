'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { searchReportsRange, importHistoricalReports } from './actions'
import { getVietnamDateString, getVietnamNow, formatToViewDate } from '@/utils/dateUtils'
import * as XLSX from 'xlsx'

interface Report {
    id: string
    room_id: string
    report_date: string
    capacity: number
    absent_count: number
    porridge_count: number
    vegetarian_count: number
    salty_count: number
    status: string
    rooms: { name: string; groups: { name: string } | null } | null
}

interface Room {
    id: string
    name: string
    default_capacity: number
    groups: { name: string } | null
}

export default function AdminPage() {
    const todayStr = getVietnamDateString()
    const [startDate, setStartDate] = useState(todayStr)
    const [endDate, setEndDate] = useState(todayStr)
    
    const [reports, setReports] = useState<Report[]>([])
    const [mealPrice, setMealPrice] = useState(25000)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleSearch = useCallback(async (s: string, e: string) => {
        setLoading(true)
        setMessage(null)
        const data = await searchReportsRange(s, e)
        if ('error' in data && data.error) {
            setMessage({ type: 'error', text: data.error as string })
        } else {
            setReports((data.reports || []) as Report[])
            if (data.mealPrice) setMealPrice(data.mealPrice)
        }
        setLoading(false)
    }, [])

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setLoading(true)
        setMessage(null)

        try {
            const reader = new FileReader()
            reader.onload = async (evt) => {
                const bstr = evt.target?.result
                const wb = XLSX.read(bstr, { type: 'binary' })
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]
                const rawData = XLSX.utils.sheet_to_json(ws) as any[]

                // Filter & Map data: Kỳ vọng các cột: "Ngày" (YYYY-MM-DD hoặc DD/MM/YYYY), "Mặn", "Cháo", "Chay", "Ghi chú"
                const formattedRows = rawData.map(row => {
                    let dateStr = String(row['Ngày'] || row['date'] || '')
                    // Xử lý nếu là số (Excel date serial)
                    if (!isNaN(Number(dateStr)) && Number(dateStr) > 40000) {
                        const dateObj = XLSX.utils.format_cell({ v: Number(dateStr), t: 'd' })
                        dateStr = dateObj // Trình bày dạng YYYY-MM-DD
                    } else if (dateStr.includes('/')) {
                        // Chuyển DD/MM/YYYY sang YYYY-MM-DD
                        const [d, m, y] = dateStr.split('/')
                        dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
                    }

                    return {
                        report_date: dateStr,
                        salty_count: Number(row['Mặn'] || row['mặn'] || row['salty'] || 0),
                        porridge_count: Number(row['Cháo'] || row['cháo'] || row['porridge'] || 0),
                        vegetarian_count: Number(row['Chay'] || row['chay'] || row['vegetarian'] || 0),
                        note: row['Ghi chú'] || row['note'] || 'Import từ Excel'
                    }
                }).filter(r => r.report_date && r.report_date.length >= 10)

                if (formattedRows.length === 0) {
                    setMessage({ type: 'error', text: 'Không tìm thấy dữ liệu hợp lệ trong file Excel' })
                    setLoading(false)
                    return
                }

                const res = await importHistoricalReports(formattedRows)
                if (res.error) {
                    setMessage({ type: 'error', text: res.error })
                } else {
                    setMessage({ type: 'success', text: `Đã nhập thành công ${res.count} ngày dữ liệu!` })
                    handleSearch(startDate, endDate)
                }
                setLoading(false)
            }
            reader.readAsBinaryString(file)
        } catch (err) {
            setMessage({ type: 'error', text: 'Lỗi parse file: ' + String(err) })
            setLoading(false)
        }
    }

    useEffect(() => {
        handleSearch(startDate, endDate)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const setFilter = (type: 'today' | 'yesterday' | 'thisMonth' | 'lastMonth') => {
        const now = getVietnamNow()
        let s = '', e = ''

        if (type === 'today') {
            s = e = getVietnamDateString(now)
        } else if (type === 'yesterday') {
            const yesterday = new Date(now)
            yesterday.setDate(now.getDate() - 1)
            s = e = getVietnamDateString(yesterday)
        } else if (type === 'thisMonth') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
            s = getVietnamDateString(firstDay)
            e = getVietnamDateString(lastDay)
        } else if (type === 'lastMonth') {
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
            s = getVietnamDateString(firstDay)
            e = getVietnamDateString(lastDay)
        }

        setStartDate(s)
        setEndDate(e)
        handleSearch(s, e)
    }

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

    // Aggregate by Date for Trend Chart
    const dateMap = new Map<string, number>()
    reports.forEach(r => {
        const d = r.report_date
        dateMap.set(d, (dateMap.get(d) || 0) + (r.salty_count + r.porridge_count + r.vegetarian_count))
    })
    const trendData = Array.from(dateMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))

    const maxTrendCount = Math.max(...trendData.map(d => d.count), 1)

    return (
        <div className="max-w-6xl mx-auto pb-20">
            {/* Header */}
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    📊 QUẢN TRỊ DỮ LIỆU
                </h2>
                <p className="text-gray-500 mt-1 text-lg">Tổng hợp số liệu & Thống kê doanh thu</p>
            </div>

            {/* Filters Container */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Quick Filters */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: 'Hôm nay', val: 'today' },
                            { label: 'Hôm qua', val: 'yesterday' },
                            { label: 'Tháng này', val: 'thisMonth' },
                            { label: 'Tháng trước', val: 'lastMonth' },
                        ].map(f => (
                            <button
                                key={f.val}
                                onClick={() => setFilter(f.val as any)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100"
                            >
                                {f.label}
                            </button>
                        ))}
                        
                        <div className="mx-2 w-px h-6 bg-gray-200 hidden lg:block" />
                        
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImportExcel}
                            accept=".xlsx, .xls"
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all border border-emerald-100 flex items-center gap-2"
                        >
                            📥 Nhập Excel lịch sử
                        </button>
                    </div>

                    {/* Custom Range */}
                    <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-xs font-bold text-gray-400 uppercase">Từ</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="bg-transparent font-bold text-gray-700 outline-none"
                            />
                        </div>
                        <div className="w-px h-4 bg-gray-200" />
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-xs font-bold text-gray-400 uppercase">Đến</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="bg-transparent font-bold text-gray-700 outline-none"
                            />
                        </div>
                        <button
                            onClick={() => handleSearch(startDate, endDate)}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-md transition-all disabled:opacity-50 flex items-center gap-2 ml-2"
                        >
                            {loading ? '...' : <><span className="hidden sm:inline">Lọc dữ liệu</span>🔍</>}
                        </button>
                    </div>
                </div>

                {message && (
                    <div className={`mt-6 p-4 rounded-2xl border text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300 ${
                        message.type === 'success' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : 'bg-red-50 text-red-700 border-red-100'
                    }`}>
                        {message.type === 'success' ? '✅' : '❌'} {message.text}
                    </div>
                )}
            </div>

            {/* General Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
                    <p className="text-sm font-semibold opacity-80 uppercase tracking-wider">💰 Tổng tiền bán trú</p>
                    <p className="text-3xl font-bold mt-2">{totalMoney.toLocaleString()} <span className="text-lg">đ</span></p>
                    <p className="text-xs mt-2 opacity-70 italic">(Đơn giá: {mealPrice.toLocaleString()} đ/suất)</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">📦 Tổng số suất</p>
                    <p className="text-4xl font-bold text-gray-800 mt-1">{totalMeals}</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">🍖 Suất Mặn</p>
                    <p className="text-4xl font-bold text-blue-700 mt-1">{totalSalty}</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <p className="text-sm font-semibold text-amber-600 uppercase tracking-wider">🥣 Suất Cháo / Chay</p>
                    <p className="text-4xl font-bold text-amber-700 mt-1">{totalPorridge + totalVegetarian}</p>
                </div>
            </div>

            {/* visual Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Meal Distribution Chart */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-8 flex items-center gap-2">
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
                                            <span className="font-semibold text-gray-700 flex items-center gap-2">
                                                {item.icon} {item.label}
                                            </span>
                                            <span className="font-bold text-gray-900">{item.count} <span className="text-gray-400 font-normal text-sm ml-1">({percent.toFixed(1)}%)</span></span>
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
                            Không có dữ liệu cho khoảng thời gian này
                        </div>
                    )}
                </div>
            </div>

            {/* trend Chart */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 mb-8">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        📅 Xu hướng tổng số suất theo ngày
                    </h3>
                    <div className="flex items-center gap-4 text-xs font-semibold text-gray-400">
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-blue-500" /> Tổng số suất
                        </div>
                    </div>
                </div>

                {trendData.length > 0 ? (
                    <div className="relative pt-10 pb-5">
                        {/* Y-Axis lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-50 px-2 py-5">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className="border-t border-dashed border-gray-200 w-full" />
                            ))}
                        </div>

                        <div className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                            <div className="flex items-end gap-3 sm:gap-6 min-h-[250px] px-2" style={{ width: trendData.length > 10 ? 'max-content' : '100%', justifyContent: trendData.length > 10 ? 'flex-start' : 'space-between' }}>
                                {trendData.map(item => {
                                    const height = (item.count / maxTrendCount) * 100
                                    return (
                                        <div key={item.date} className="group relative flex flex-col items-center flex-1 min-w-[50px] sm:min-w-[70px]">
                                            {/* Tooltip */}
                                            <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform bg-gray-800 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-xl z-10 whitespace-nowrap after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-800">
                                                {item.count} suất
                                            </div>

                                            {/* Bar */}
                                            <div 
                                                className="w-full bg-gradient-to-t from-blue-600 to-indigo-400 rounded-t-xl transition-all duration-500 hover:from-blue-500 hover:to-indigo-300 cursor-pointer shadow-sm group-hover:shadow-md"
                                                style={{ height: `${Math.max(height, 5)}%` }}
                                            />

                                            {/* Date Label */}
                                            <div className="mt-3 text-[10px] sm:text-xs font-bold text-gray-500 group-hover:text-blue-600 transition-colors">
                                                {formatToViewDate(item.date).split('/')[0]}/{formatToViewDate(item.date).split('/')[1]}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-40 flex items-center justify-center text-gray-400 italic">
                        Không có dữ liệu xu hướng cho khoảng thời gian này
                    </div>
                )}
            </div>

            {/* Aggregated Table */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                        📋 Tổng cộng theo Nhóm / Khối
                    </h3>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-widest font-bold">
                                <th className="px-8 py-4">Nhóm / Khối</th>
                                <th className="px-4 py-4 text-center">Báo cáo</th>
                                <th className="px-4 py-4 text-center text-gray-800">Tổng suất</th>
                                <th className="px-4 py-4 text-center text-blue-600">Mặn</th>
                                <th className="px-4 py-4 text-center text-amber-600">Cháo</th>
                                <th className="px-4 py-4 text-center text-emerald-600">Chay</th>
                                <th className="px-8 py-4 text-right">Thành tiền (VNĐ)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {groupSummaries.map(gs => (
                                <tr key={gs.name} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-8 py-5 font-bold text-gray-800">{gs.name}</td>
                                    <td className="px-4 py-5 text-center text-gray-500">{gs.rooms}</td>
                                    <td className="px-4 py-5 text-center font-bold text-lg text-gray-900">{gs.totalMeals}</td>
                                    <td className="px-4 py-5 text-center font-bold text-blue-600">{gs.salty}</td>
                                    <td className="px-4 py-5 text-center font-bold text-amber-600">{gs.porridge}</td>
                                    <td className="px-4 py-5 text-center font-bold text-emerald-600">{gs.vegetarian}</td>
                                    <td className="px-8 py-5 text-right font-bold text-indigo-600">
                                        {(gs.totalMeals * mealPrice).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {groupSummaries.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-8 py-20 text-center text-gray-400 italic font-medium">
                                        Rất tiếc! Không tìm thấy dữ liệu báo cáo nào trong khoảng thời gian này.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {groupSummaries.length > 0 && (
                            <tfoot className="bg-gray-50/50 border-t border-gray-100">
                                <tr className="font-bold text-gray-900 border-t-2 border-gray-100">
                                    <td className="px-8 py-6 uppercase tracking-wider text-xs">Tổng hợp toàn trường</td>
                                    <td className="px-4 py-6 text-center text-gray-400">—</td>
                                    <td className="px-4 py-6 text-center text-2xl underline decoration-indigo-500 decoration-2">{totalMeals}</td>
                                    <td className="px-4 py-6 text-center text-blue-600">{totalSalty}</td>
                                    <td className="px-4 py-6 text-center text-amber-600">{totalPorridge}</td>
                                    <td className="px-4 py-6 text-center text-emerald-600">{totalVegetarian}</td>
                                    <td className="px-8 py-6 text-right text-3xl text-indigo-700">
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
