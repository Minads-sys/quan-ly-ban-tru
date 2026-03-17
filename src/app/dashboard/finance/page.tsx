'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAdvancePayments, AdvancePayment, deleteAdvancePayment, getDebtSummary } from './actions'
import { VoucherForm } from './VoucherForm'
import { VoucherPrint } from './VoucherPrint'
import { formatToViewDate, getVietnamNow } from '@/utils/dateUtils'

export default function FinancePage() {
    const [payments, setPayments] = useState<AdvancePayment[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [selectedPayment, setSelectedPayment] = useState<AdvancePayment | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Bộ lọc tháng
    const now = getVietnamNow()
    const [filterMonth, setFilterMonth] = useState(`${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`)
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
                getAdvancePayments(filterMonth),
                getDebtSummary(filterMonth)
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
    }, [filterMonth])

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
                    <p className="text-gray-500">Tóm tắt công nợ và phiếu thu tạm ứng</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
                        <span className="text-sm font-bold text-gray-500">Tháng:</span>
                        <input
                            type="text"
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            placeholder="MM/YYYY"
                            className="w-24 outline-none text-sm font-bold text-teal-700"
                        />
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-md flex items-center gap-2 active:scale-95 text-sm"
                    >
                        <span>➕</span> Tạo phiếu thu
                    </button>
                </div>
            </div>

            {/* Stats - Công nợ */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-blue-100 shadow-sm transition-all hover:shadow-md">
                    <div className="text-gray-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Tổng tiền cơm ({debtSummary.totalMeals} suất)</div>
                    <div className="text-xl font-black text-blue-600">
                        {debtSummary.totalMealMoney.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 italic">Đơn giá: {debtSummary.mealPrice.toLocaleString('vi-VN')}đ</div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-teal-100 shadow-sm transition-all hover:shadow-md">
                    <div className="text-gray-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Đã thu tạm ứng</div>
                    <div className="text-xl font-black text-teal-600">
                        {debtSummary.totalAdvance.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 italic">{payments.length} phiếu thu</div>
                </div>
                <div className="bg-orange-50/50 rounded-2xl p-5 border border-orange-200 shadow-sm transition-all hover:shadow-md">
                    <div className="text-orange-700 text-[10px] font-bold mb-1 uppercase tracking-wider">Công nợ trường nợ</div>
                    <div className="text-xl font-black text-orange-600">
                        {debtSummary.debt.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
                    </div>
                    <div className="text-[10px] text-orange-400 mt-1 font-medium italic">Tính đến {filterMonth}</div>
                </div>
                <div className="bg-teal-600 rounded-2xl p-5 shadow-lg text-white transition-all hover:scale-[1.02]">
                    <div className="text-teal-100 text-[10px] font-bold mb-1 uppercase tracking-wider">Trạng thái tháng</div>
                    <div className="text-lg font-bold mt-2">
                        {debtSummary.debt <= 0 ? '✅ Đã tất toán' : '⏳ Còn nợ'}
                    </div>
                    <div className="text-[10px] text-teal-100 mt-1 italic">Hệ thống đồng bộ: {getVietnamNow().toLocaleTimeString('vi-VN')}</div>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h2 className="font-bold text-gray-700 tracking-tight">Lịch sử phiếu thu tạm ứng tháng {filterMonth}</h2>
                    <span className="text-[10px] text-gray-400 font-medium">CẬP NHẬT TỨC THÌ</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold">NGÀY THU</th>
                                <th className="px-6 py-4 text-xs font-bold">NGƯỜI NỘP</th>
                                <th className="px-6 py-4 text-xs font-bold">LÝ DO</th>
                                <th className="px-6 py-4 text-xs font-bold text-right">SỐ TIỀN</th>
                                <th className="px-6 py-4 text-right text-xs font-bold">THAO TÁC</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {payments.map(p => (
                                <tr key={p.id} className="hover:bg-teal-50/30 transition-all group">
                                    <td className="px-6 py-4 font-medium text-gray-600">{formatToViewDate(p.payment_date)}</td>
                                    <td className="px-6 py-4 font-bold text-gray-800">{p.payer_name}</td>
                                    <td className="px-6 py-4 text-gray-500 max-w-[200px] truncate">{p.reason}</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-black text-teal-700">{p.amount.toLocaleString('vi-VN')}</span>
                                        <span className="text-[10px] ml-1 text-gray-400">đ</span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => setSelectedPayment(p)}
                                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all font-bold text-[10px] uppercase"
                                        >
                                            In phiếu thu
                                        </button>
                                        <button
                                            onClick={() => handleDelete(p.id)}
                                            className="p-1.5 text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                            title="Xóa"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {payments.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-gray-400 italic">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-3xl">📭</div>
                                            <p className="font-medium text-gray-400">Chưa có dữ liệu phiếu thu nào cho tháng {filterMonth}.</p>
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
                <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 bg-teal-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-teal-800">Tạo phiếu thu mới</h2>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
                        </div>
                        <div className="p-6">
                            <VoucherForm
                                onSuccess={() => {
                                    setShowForm(false)
                                    loadData()
                                    setMessage({ type: 'success', text: 'Đã tạo phiếu thu thành công!' })
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
                <div className={`fixed bottom-8 right-8 px-6 py-3 rounded-xl shadow-2xl text-white font-bold animate-bounce z-[160] flex items-center gap-2 ${
                    message.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
                }`}>
                    <span>{message.type === 'success' ? '✅' : '❌'}</span>
                    {message.text}
                </div>
            )}
        </div>
    )
}
