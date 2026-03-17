'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAdvancePayments, AdvancePayment, deleteAdvancePayment, getDebtSummary } from './actions'
import { VoucherForm } from './VoucherForm'
import { VoucherPrint } from './VoucherPrint'
import { formatToViewDate, getVietnamNow, getVietnamDateString } from '@/utils/dateUtils'

export default function FinancePage() {
    const [payments, setPayments] = useState<AdvancePayment[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [selectedPayment, setSelectedPayment] = useState<AdvancePayment | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Bộ lọc dải ngày
    const now = getVietnamNow()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const [startDate, setStartDate] = useState(getVietnamDateString(firstDay))
    const [endDate, setEndDate] = useState(getVietnamDateString(now))

    const [debtSummary, setDebtSummary] = useState({
        totalMeals: 0,
        totalMealMoney: 0,
        totalAdvance: 0,
        debt: 0,
        mealPrice: 0
    })

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [paymentsResult, debtResult] = await Promise.all([
                getAdvancePayments(startDate, endDate),
                getDebtSummary(startDate, endDate)
            ])

            if (paymentsResult.error) {
                setMessage({ type: 'error', text: paymentsResult.error })
            } else {
                setPayments(paymentsResult.data || [])
            }

            if ('error' in debtResult) {
                console.error(debtResult.error)
            } else {
                setDebtSummary(debtResult as any)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [startDate, endDate])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa phiếu thu này?')) return
        const result = await deleteAdvancePayment(id)
        if (result.error) {
            alert(result.error)
        } else {
            loadData()
        }
    }

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        💰 Quản lý Tài chính
                    </h1>
                    <p className="text-gray-500 text-sm">Quản lý phiếu thu và đối soát công nợ nhà trường</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Từ:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent outline-none text-sm font-bold text-teal-700 cursor-pointer"
                        />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Đến:</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent outline-none text-sm font-bold text-teal-700 cursor-pointer"
                        />
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="px-5 py-2 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-md flex items-center gap-2 active:scale-95 text-sm"
                    >
                        <span>➕</span> Thu tiền
                    </button>
                </div>
            </div>

            {/* Stats - Công nợ */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-blue-100 shadow-sm transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-2">
                        <div className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Tổng tiền cơm</div>
                        <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{debtSummary.totalMeals} SUẤT</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                        {debtSummary.totalMealMoney.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 italic font-medium">Đơn giá: {debtSummary.mealPrice.toLocaleString('vi-VN')}đ</div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-2">
                        <div className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Đã thu tạm ứng</div>
                        <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{payments.length} PHIẾU</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">
                        {debtSummary.totalAdvance.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 italic font-medium">Bao gồm các khoản thu trong kỳ</div>
                </div>
                <div className="bg-orange-50/50 rounded-2xl p-5 border border-orange-200 shadow-sm transition-all hover:shadow-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-orange-200/20 rounded-full -mr-8 -mt-8"></div>
                    <div className="text-orange-700 text-[10px] font-bold mb-2 uppercase tracking-wider relative">Công nợ trường nợ</div>
                    <div className="text-2xl font-bold text-orange-600 relative">
                        {debtSummary.debt.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
                    </div>
                    <div className="text-[10px] text-orange-400 mt-1 font-bold italic relative">Cần thu hồi</div>
                </div>
                <div className={`rounded-2xl p-5 shadow-lg text-white transition-all hover:scale-[1.02] flex flex-col justify-center ${
                    debtSummary.debt <= 0 ? 'bg-emerald-600' : 'bg-red-500'
                }`}>
                    <div className="text-white/70 text-[10px] font-bold mb-1 uppercase tracking-wider">Trạng thái kỳ này</div>
                    <div className="text-xl font-bold flex items-center gap-2">
                        {debtSummary.debt <= 0 ? (
                            <><span>✅</span> ĐÃ TẤT TOÁN</>
                        ) : (
                            <><span>⚠️</span> CÒN NỢ</>
                        )}
                    </div>
                    <div className="text-[10px] text-white/50 mt-1 font-medium">Cập nhật lúc: {getVietnamNow().toLocaleTimeString('vi-VN')}</div>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
                    <div>
                        <h2 className="font-bold text-gray-800 tracking-tight text-lg">Lịch sử phiếu thu</h2>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Thời gian: {formatToViewDate(startDate)} → {formatToViewDate(endDate)}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-teal-50 px-3 py-1.5 rounded-full border border-teal-100">
                        <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></span>
                        <span className="text-[10px] text-teal-700 font-bold uppercase">Dữ liệu thời gian thực</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-400 font-bold border-b border-gray-100">
                            <tr>
                                <th className="px-8 py-5 text-[10px] uppercase tracking-widest">NGÀY THU</th>
                                <th className="px-8 py-5 text-[10px] uppercase tracking-widest">NGƯỜI NỘP TIỀN</th>
                                <th className="px-8 py-5 text-[10px] uppercase tracking-widest">LÝ DO THU</th>
                                <th className="px-8 py-5 text-[10px] uppercase tracking-widest text-right">SỐ TIỀN</th>
                                <th className="px-8 py-5 text-[10px] uppercase tracking-widest text-right">THÀNH PHẦN</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {payments.map((p: AdvancePayment) => (
                                <tr key={p.id} className="hover:bg-teal-50/20 transition-all group">
                                    <td className="px-8 py-5 font-semibold text-gray-500">{formatToViewDate(p.payment_date)}</td>
                                    <td className="px-8 py-5">
                                        <div className="font-bold text-gray-900">{p.payer_name}</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{p.bank || 'Tiền mặt'}</div>
                                    </td>
                                    <td className="px-8 py-5 text-gray-600 max-w-[250px] truncate leading-relaxed">{p.reason}</td>
                                    <td className="px-8 py-5 text-right">
                                        <span className="font-bold text-teal-700 text-lg">{p.amount.toLocaleString('vi-VN')}</span>
                                        <span className="text-[10px] ml-1 text-gray-400 font-bold">đ</span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <button
                                                onClick={() => setSelectedPayment(p)}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 transition-all font-bold text-[10px] uppercase active:scale-95"
                                            >
                                                In phiếu
                                            </button>
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="p-2 text-red-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title="Xóa"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {payments.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-4xl grayscale opacity-50">📂</div>
                                            <div className="space-y-1">
                                                <p className="font-bold text-gray-400 uppercase text-xs tracking-widest">Không có dữ liệu</p>
                                                <p className="text-gray-300 text-[10px] font-bold">Vui lòng điều chỉnh lại thời gian lọc</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {showForm && (
                <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="px-8 py-6 border-b border-gray-50 bg-teal-50/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-extrabold text-teal-900 tracking-tight">Lập phiếu thu mới</h2>
                                <p className="text-[10px] text-teal-600 font-bold uppercase mt-0.5 tracking-wider">Ghi nhận tiền tạm ứng từ nhà trường</p>
                            </div>
                            <button onClick={() => setShowForm(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-400 hover:text-gray-600 transition-all">✕</button>
                        </div>
                        <div className="p-8">
                            <VoucherForm
                                onSuccess={() => {
                                    setShowForm(false)
                                    loadData()
                                    setMessage({ type: 'success', text: 'Đã tạo phiếu thu và cập nhật công nợ!' })
                                    setTimeout(() => setMessage(null), 3000)
                                }}
                                onCancel={() => setShowForm(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {selectedPayment && (
                <VoucherPrint
                    payment={selectedPayment}
                    onClose={() => setSelectedPayment(null)}
                />
            )}

            {message && (
                <div className={`fixed bottom-10 right-10 px-8 py-4 rounded-2xl shadow-2xl text-white font-bold animate-in slide-in-from-right duration-300 z-[160] flex items-center gap-3 ${
                    message.type === 'success' ? 'bg-teal-600 shadow-teal-200' : 'bg-red-600 shadow-red-200'
                }`}>
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-lg">
                        {message.type === 'success' ? '✅' : '❌'}
                    </div>
                    <div className="uppercase tracking-wide text-xs">{message.text}</div>
                </div>
            )}
        </div>
    )
}
