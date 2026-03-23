'use client'

import { useState, useEffect, useCallback } from 'react'
import { getReportsData, ReportFilter, ReportSummary } from './actions'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar
} from 'recharts'
import { Calendar as CalendarIcon, Filter, TrendingUp, Users, Utensils, Beaker } from 'lucide-react'

// Utilities
const formatToViewDate = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
}

const formatNumber = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num)
}

export default function ReportsPage() {
    const [filter, setFilter] = useState<ReportFilter>({ period: 'this_month' })
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    
    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState('')
    const [summary, setSummary] = useState<ReportSummary | null>(null)
    const [chartType, setChartType] = useState<'line' | 'bar'>('line')

    const loadData = useCallback(async () => {
        setLoading(true)
        setErrorMsg('')
        
        let currentFilter = { ...filter }
        if (filter.period === 'custom') {
            if (!customStart || !customEnd) {
                // Wait for user to pick dates
                setLoading(false)
                return
            }
            currentFilter.startDate = customStart
            currentFilter.endDate = customEnd
        }

        const data = await getReportsData(currentFilter)

        if ('error' in data) {
            setErrorMsg(data.error as string)
        } else {
            setSummary(data as ReportSummary)
        }
        setLoading(false)
    }, [filter, customStart, customEnd])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleFilterChange = (period: ReportFilter['period']) => {
        setFilter({ period })
    }

    if (errorMsg === 'Unauthorized') {
         return (
             <div className="flex items-center justify-center py-40">
                 <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-red-100">
                      <p className="text-5xl mb-4">🚫</p>
                      <h2 className="text-2xl font-bold text-gray-800">Không có quyền truy cập</h2>
                      <p className="text-gray-600 mt-2">Bạn không có quyền xem báo cáo hệ thống.</p>
                 </div>
             </div>
         )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-blue-600" />
                        Báo cáo & Thống kê
                    </h1>
                    <p className="text-gray-600 mt-1">Tổng hợp số liệu suất ăn khu trú</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="p-1 bg-gray-100 rounded-xl flex gap-1 border border-gray-200">
                        <button
                            onClick={() => handleFilterChange('today')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${filter.period === 'today' ? 'bg-white text-blue-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Hôm nay
                        </button>
                        <button
                            onClick={() => handleFilterChange('yesterday')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${filter.period === 'yesterday' ? 'bg-white text-blue-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Hôm qua
                        </button>
                        <button
                            onClick={() => handleFilterChange('this_month')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${filter.period === 'this_month' ? 'bg-white text-blue-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Tháng này
                        </button>
                        <button
                            onClick={() => handleFilterChange('last_month')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${filter.period === 'last_month' ? 'bg-white text-blue-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Tháng trước
                        </button>
                        <button
                            onClick={() => handleFilterChange('custom')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${filter.period === 'custom' ? 'bg-white text-blue-700 shadow-sm border border-gray-200 flex items-center gap-1' : 'text-gray-600 hover:text-gray-900 flex items-center gap-1'}`}
                        >
                            <Filter className="w-4 h-4" /> Tùy chọn
                        </button>
                    </div>

                    {filter.period === 'custom' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                            <input
                                type="date"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <span className="text-gray-500">-</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block text-center mb-6">
                <h1 className="text-2xl font-bold uppercase">BÁO CÁO TỔNG HỢP SUẤT ĂN</h1>
                <p className="text-sm mt-1">Từ ngày: {filter.period === 'today' ? formatToViewDate(new Date().toISOString().split('T')[0]) : customStart ? formatToViewDate(customStart) : '...'} - Đến ngày: {filter.period === 'today' ? formatToViewDate(new Date().toISOString().split('T')[0]) : customEnd ? formatToViewDate(customEnd) : '...'}</p>
                <div className="h-px bg-gray-300 w-full my-4" />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-40 print:hidden">
                    <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            ) : errorMsg ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-center">
                    {errorMsg}
                </div>
            ) : summary ? (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden group">
                            <div className="relative z-10">
                                <p className="text-indigo-100 text-sm font-medium mb-1 flex items-center gap-2"><Utensils className="w-4 h-4" /> TỔNG SUẤT</p>
                                <p className="text-3xl font-bold">{formatNumber(summary.totalMeals)}</p>
                            </div>
                            <Utensils className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-10 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                            <div className="relative z-10">
                                <p className="text-gray-600 text-sm font-medium mb-1">🍖 Suất Mặn</p>
                                <p className="text-3xl font-bold text-gray-800">{formatNumber(summary.totalSalty)}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                            <div className="relative z-10">
                                <p className="text-gray-600 text-sm font-medium mb-1">🥣 Suất Cháo</p>
                                <p className="text-3xl font-bold text-amber-600">{formatNumber(summary.totalPorridge)}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                            <div className="relative z-10">
                                <p className="text-gray-600 text-sm font-medium mb-1">🥬 Suất Chay</p>
                                <p className="text-3xl font-bold text-emerald-600">{formatNumber(summary.totalVegetarian)}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                            <div className="relative z-10">
                                <p className="text-gray-600 text-sm font-medium mb-1">👥 Tổng Sĩ số</p>
                                <p className="text-3xl font-bold text-blue-600">{formatNumber(summary.totalCapacity)}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                            <div className="relative z-10">
                                <p className="text-gray-600 text-sm font-medium mb-1">❌ Tổng Nghỉ</p>
                                <p className="text-3xl font-bold text-red-500">{formatNumber(summary.totalAbsent)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Chart Area */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Beaker className="w-5 h-5 text-gray-500" /> Biểu đồ Xu hướng
                            </h3>
                            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                                <button
                                    onClick={() => setChartType('line')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${chartType === 'line' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-700'}`}
                                >
                                    Đường
                                </button>
                                <button
                                    onClick={() => setChartType('bar')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${chartType === 'bar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-700'}`}
                                >
                                    Cột
                                </button>
                            </div>
                        </div>

                        {summary.dailyData.length > 0 ? (
                            <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    {chartType === 'line' ? (
                                        <LineChart data={summary.dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis 
                                                dataKey="date" 
                                                tickFormatter={formatToViewDate} 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#6B7280', fontSize: 12 }} 
                                                dy={10}
                                            />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#6B7280', fontSize: 12 }} 
                                                dx={-10}
                                            />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}
                                                labelFormatter={(label) => formatToViewDate(label as string)}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Line type="monotone" name="Tổng suất" dataKey="meals" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4, fill: '#4F46E5', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                                            <Line type="monotone" name="Mặn" dataKey="salty" stroke="#1f2937" strokeWidth={2} dot={{ r: 3 }} />
                                            <Line type="monotone" name="Cháo" dataKey="porridge" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
                                            <Line type="monotone" name="Chay" dataKey="vegetarian" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                                        </LineChart>
                                    ) : (
                                        <BarChart data={summary.dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis 
                                                dataKey="date" 
                                                tickFormatter={formatToViewDate} 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#6B7280', fontSize: 12 }} 
                                                dy={10}
                                            />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#6B7280', fontSize: 12 }} 
                                                dx={-10}
                                            />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                labelFormatter={(label) => formatToViewDate(label as string)}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar name="Mặn" dataKey="salty" stackId="a" fill="#3b82f6" radius={[0,0,4,4]} />
                                            <Bar name="Cháo" dataKey="porridge" stackId="a" fill="#fbbf24" />
                                            <Bar name="Chay" dataKey="vegetarian" stackId="a" fill="#10b981" radius={[4,4,0,0]} />
                                        </BarChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[400px] flex flex-col items-center justify-center text-gray-500">
                                <CalendarIcon className="w-16 h-16 mb-4 opacity-50" />
                                <p>Không có dữ liệu trong khoảng thời gian này</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Detail Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="font-bold text-gray-800">Chi tiết theo ngày</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Ngày</th>
                                        <th className="px-6 py-4 font-semibold text-center">Sĩ số</th>
                                        <th className="px-6 py-4 font-semibold text-center">Nghỉ</th>
                                        <th className="px-6 py-4 font-semibold text-center">Tổng Suất</th>
                                        <th className="px-6 py-4 font-semibold text-center">Mặn</th>
                                        <th className="px-6 py-4 font-semibold text-center">Cháo</th>
                                        <th className="px-6 py-4 font-semibold text-center">Chay</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.dailyData.length > 0 ? summary.dailyData.map((row, idx) => (
                                        <tr key={idx} className="bg-white border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{formatToViewDate(row.date)}</td>
                                            <td className="px-6 py-4 text-center">{formatNumber(row.capacity)}</td>
                                            <td className="px-6 py-4 text-center text-red-500 font-medium">{formatNumber(row.absent)}</td>
                                            <td className="px-6 py-4 text-center font-bold text-blue-700">{formatNumber(row.meals)}</td>
                                            <td className="px-6 py-4 text-center font-semibold text-gray-700">{formatNumber(row.salty)}</td>
                                            <td className="px-6 py-4 text-center font-semibold text-amber-600">{formatNumber(row.porridge)}</td>
                                            <td className="px-6 py-4 text-center font-semibold text-emerald-600">{formatNumber(row.vegetarian)}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-8 text-center text-gray-500 italic">Trống</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

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
                            <p>NGƯỜI LẬP BÁO CÁO</p>
                            <p className="invisible h-24">Signature</p>
                            <p className="font-normal border-t border-dashed w-32 pt-1 uppercase">ký, ghi rõ họ tên</p>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    )
}
