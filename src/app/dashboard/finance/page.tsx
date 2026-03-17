'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAdvancePayments, AdvancePayment, deleteAdvancePayment } from './actions'
import { VoucherForm } from './VoucherForm'
import { VoucherPrint } from './VoucherPrint'
import { formatToViewDate, getVietnamNow } from '@/utils/dateUtils'

export default function FinancePage() {
    const [payments, setPayments] = useState<AdvancePayment[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [selectedPayment, setSelectedPayment] = useState<AdvancePayment | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const loadData = useCallback(async () => {
        setLoading(true)
        const result = await getAdvancePayments()
        if (result.error) {
            setMessage({ type: 'error', text: result.error })
        } else {
            setPayments(result.data || [])
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa phiếu tạm ứng này?')) return
        const result = await deleteAdvancePayment(id)
        if (result.error) {
            alert(result.error)
        } else {
            loadData()
        }
    }

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        💰 Quản lý Tài chính
                    </h1>
                    <p className="text-gray-500">Tạm ứng và Quyết toán tiền bán trú</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-md flex items-center gap-2 active:scale-95"
                >
                    <span>➕</span> Tạo phiếu tạm ứng
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-teal-100 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">Tổng tiền tạm ứng</div>
                    <div className="text-3xl font-black text-teal-600">
                        {totalAmount.toLocaleString('vi-VN')} <span className="text-base font-normal">đ</span>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-blue-100 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">Số phiếu chi</div>
                    <div className="text-3xl font-black text-blue-600">
                        {payments.length} <span className="text-base font-normal">phiếu</span>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-orange-100 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">Tháng hiện tại</div>
                    <div className="text-3xl font-black text-orange-600">
                        {String(getVietnamNow().getMonth() + 1).padStart(2, '0')}/{getVietnamNow().getFullYear()}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h2 className="font-bold text-gray-700">Lịch sử tạm ứng</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium">
                            <tr>
                                <th className="px-6 py-4">Ngày chi</th>
                                <th className="px-6 py-4">Họ tên</th>
                                <th className="px-6 py-4">Lý do</th>
                                <th className="px-6 py-4">Số tiền</th>
                                <th className="px-6 py-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {payments.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50 transition-all">
                                    <td className="px-6 py-4 font-medium text-gray-700">{formatToViewDate(p.payment_date)}</td>
                                    <td className="px-6 py-4">{p.recipient_name}</td>
                                    <td className="px-6 py-4 text-gray-500 max-w-[200px] truncate">{p.reason}</td>
                                    <td className="px-6 py-4 font-bold text-teal-600">{p.amount.toLocaleString('vi-VN')} đ</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => setSelectedPayment(p)}
                                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all font-bold text-xs"
                                        >
                                            In phiếu
                                        </button>
                                        <button
                                            onClick={() => handleDelete(p.id)}
                                            className="p-1.5 text-red-300 hover:text-red-500 transition-all"
                                            title="Xóa"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {payments.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-400 italic">
                                        Chưa có dữ liệu tạm ứng nào.
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
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-teal-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-teal-800">Tạo phiếu tạm ứng mới</h2>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
                        </div>
                        <div className="p-6">
                            <VoucherForm
                                onSuccess={() => {
                                    setShowForm(false)
                                    loadData()
                                    setMessage({ type: 'success', text: 'Đã tạo phiếu tạm ứng thành công!' })
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
                <div className={`fixed bottom-8 right-8 px-6 py-3 rounded-xl shadow-2xl text-white font-bold animate-bounce z-[160] ${
                    message.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
                }`}>
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                </div>
            )}
        </div>
    )
}
