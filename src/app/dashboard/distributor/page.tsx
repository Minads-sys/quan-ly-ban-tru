'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDistributorSummary } from './actions'

interface GroupSummary {
    group: { id: string; name: string }
    totalSalty: number
    totalVegetarian: number
    totalPorridge: number
    totalMeals: number
    congSalty: number; leSalty: number
    congVegetarian: number; leVegetarian: number
    congPorridge: number; lePorridge: number
    totalCong: number
    reportedCount: number
}

export default function DistributorPage() {
    const [date, setDate] = useState('')
    const [loading, setLoading] = useState(true)
    const [groupSummaries, setGroupSummaries] = useState<GroupSummary[]>([])
    const [schoolInfo, setSchoolInfo] = useState({ name: '', address: '' })

    const loadData = useCallback(async () => {
        setLoading(true)
        const data = await getDistributorSummary(date || undefined)
        if ('error' in data) {
            setLoading(false)
            return
        }
        setGroupSummaries(data.groupSummaries as GroupSummary[])
        if (!date && data.date) setDate(data.date as string)
        if (data.schoolInfo) setSchoolInfo(data.schoolInfo)
        setLoading(false)
    }, [date])

    useEffect(() => { loadData() }, [loadData])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-40">
                <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 print:hidden">
                <div>
                    <h2 className="text-3xl font-extrabold text-gray-800 flex items-center gap-3">
                        🍽️ CHIA SUẤT {schoolInfo.name && <span className="text-blue-600 font-bold">| {schoolInfo.name}</span>}
                    </h2>
                    <p className="text-gray-600 mt-1 text-lg">Số liệu đã duyệt — sẵn sàng chia</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="px-5 py-3 text-xl rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-bold"
                    />
                    <button
                        onClick={() => window.print()}
                        className="px-6 py-3 text-lg bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-800 shadow-md transition-all active:scale-[0.98] flex items-center gap-2"
                    >
                        🖨️ In
                    </button>
                </div>
            </div>

            {/* Print header (only visible when printing) */}
            <div className="hidden print:block mb-6 text-center">
                <h1 className="text-2xl font-bold uppercase">{schoolInfo.name || 'Suất ăn Bán trú'}</h1>
                <p className="text-sm">{schoolInfo.address}</p>
                <div className="h-px bg-gray-300 w-full my-4" />
                <h2 className="text-xl font-bold">BẢNG CHIA SUẤT</h2>
                <p className="text-lg mt-1">Ngày: {date}</p>
            </div>

            {groupSummaries.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-20 text-center shadow-sm">
                    <p className="text-6xl mb-6">📊</p>
                    <p className="text-3xl font-bold text-gray-600">Chưa có số liệu cho ngày {date}</p>
                    <p className="text-lg text-gray-500 mt-2">(Chỉ hiển thị số liệu đã được duyệt)</p>
                </div>
            ) : (
                <div className="space-y-8 print:space-y-6">
                    {groupSummaries.map((gs) => (
                        <div key={gs.group.id} className="print:break-inside-avoid">
                            {/* Khối 1: Tổng suất */}
                            <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-md p-6 sm:p-8 mb-4 print:shadow-none print:mb-2">
                                <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-800 text-center mb-1">
                                    {gs.group.name}
                                </h3>
                                <p className="text-center text-xl font-bold text-purple-700 mb-5">
                                    Tổng suất: <span className="text-4xl sm:text-5xl">{gs.totalMeals}</span> suất
                                </p>
                                <div className="grid grid-cols-3 gap-3 sm:gap-5">
                                    {/* Mặn - Xanh dương */}
                                    <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 sm:p-5 text-center">
                                        <p className="text-lg sm:text-xl font-bold text-blue-800">🍖 Mặn</p>
                                        <p className="text-4xl sm:text-5xl font-black text-blue-700 mt-2">{gs.totalSalty}</p>
                                    </div>
                                    {/* Chay - Xanh lá */}
                                    <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 sm:p-5 text-center">
                                        <p className="text-lg sm:text-xl font-bold text-green-800">🥬 Chay</p>
                                        <p className="text-4xl sm:text-5xl font-black text-green-700 mt-2">{gs.totalVegetarian}</p>
                                    </div>
                                    {/* Cháo - Cam */}
                                    <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 sm:p-5 text-center">
                                        <p className="text-lg sm:text-xl font-bold text-orange-800">🥣 Cháo</p>
                                        <p className="text-4xl sm:text-5xl font-black text-orange-700 mt-2">{gs.totalPorridge}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Khối 2: Công */}
                            <div className="bg-gray-50 rounded-2xl border-2 border-gray-300 shadow-md p-6 sm:p-8 print:shadow-none">
                                <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-700 text-center mb-1">
                                    Công {gs.group.name}
                                </h3>
                                <p className="text-center mb-2">
                                    <span className="text-5xl sm:text-7xl font-black text-gray-900">{gs.totalCong}</span>
                                    <span className="text-2xl sm:text-3xl font-bold text-gray-600 ml-2">công</span>
                                </p>
                                {/* Suất lẻ tổng hợp */}
                                <div className="text-center mb-5 text-lg sm:text-xl text-gray-600 font-semibold leading-relaxed">
                                    {gs.leSalty > 0 && <span className="text-blue-700">{gs.leSalty} suất lẻ mặn</span>}
                                    {gs.leSalty > 0 && (gs.leVegetarian > 0 || gs.lePorridge > 0) && <span>, </span>}
                                    {gs.leVegetarian > 0 && <span className="text-green-700">{gs.leVegetarian} suất lẻ chay</span>}
                                    {gs.leVegetarian > 0 && gs.lePorridge > 0 && <span>, </span>}
                                    {gs.lePorridge > 0 && <span className="text-orange-700">{gs.lePorridge} suất lẻ cháo</span>}
                                    {gs.leSalty === 0 && gs.leVegetarian === 0 && gs.lePorridge === 0 && (
                                        <span className="text-gray-500">Không có suất lẻ</span>
                                    )}
                                </div>
                                {/* Chi tiết công từng loại */}
                                <div className="grid grid-cols-3 gap-3 sm:gap-5">
                                    {/* Mặn */}
                                    <div className="bg-blue-100 border-2 border-blue-400 rounded-xl p-4 sm:p-5 text-center">
                                        <p className="text-lg sm:text-xl font-bold text-blue-900">Mặn</p>
                                        <p className="text-3xl sm:text-5xl font-black text-blue-800 mt-1">{gs.congSalty} <span className="text-lg sm:text-2xl">công</span></p>
                                        <p className="text-base sm:text-lg font-semibold text-blue-600 mt-1">{gs.leSalty} suất lẻ</p>
                                    </div>
                                    {/* Chay */}
                                    <div className="bg-green-100 border-2 border-green-400 rounded-xl p-4 sm:p-5 text-center">
                                        <p className="text-lg sm:text-xl font-bold text-green-900">Chay</p>
                                        <p className="text-3xl sm:text-5xl font-black text-green-800 mt-1">{gs.congVegetarian} <span className="text-lg sm:text-2xl">công</span></p>
                                        <p className="text-base sm:text-lg font-semibold text-green-600 mt-1">{gs.leVegetarian} suất lẻ</p>
                                    </div>
                                    {/* Cháo */}
                                    <div className="bg-orange-100 border-2 border-orange-400 rounded-xl p-4 sm:p-5 text-center">
                                        <p className="text-lg sm:text-xl font-bold text-orange-900">Cháo</p>
                                        <p className="text-3xl sm:text-5xl font-black text-orange-800 mt-1">{gs.congPorridge} <span className="text-lg sm:text-2xl">công</span></p>
                                        <p className="text-base sm:text-lg font-semibold text-orange-600 mt-1">{gs.lePorridge} suất lẻ</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
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
                    <p>NGƯỜI LẬP</p>
                    <p className="invisible h-24">Signature</p>
                    <p className="font-normal border-t border-dashed w-32 pt-1 uppercase">ký, ghi rõ họ tên</p>
                </div>
            </div>
        </div>
    )
}
