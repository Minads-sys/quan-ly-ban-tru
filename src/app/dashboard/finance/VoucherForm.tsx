'use client'

import { useState, useEffect } from 'react'
import { createAdvancePayment } from './actions'
import { getVietnamNow, getVietnamDateString } from '@/utils/dateUtils'

interface VoucherFormProps {
    onSuccess: () => void
    onCancel: () => void
}

export function VoucherForm({ onSuccess, onCancel }: VoucherFormProps) {
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const now = getVietnamNow()
    const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`

    const [formData, setFormData] = useState({
        amount: 0,
        reason: `Tạm ứng tiền bán trú tháng ${currentMonth}`,
        payer_name: '',
        account_number: '',
        bank: '',
        report_month: currentMonth,
        payment_date: getVietnamDateString()
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: name === 'amount' ? (parseInt(value) || 0) : value
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (formData.amount <= 0) {
            setError('Số tiền phải lớn hơn 0')
            return
        }
        if (!formData.payer_name) {
            setError('Vui lòng nhập họ tên người nộp tiền')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            const result = await createAdvancePayment(formData)
            if (result.error) {
                setError(result.error)
            } else {
                onSuccess()
            }
        } catch (err: any) {
            setError(err.message || 'Có lỗi xảy ra')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-sm font-bold text-gray-700">Tháng quyết toán</label>
                    <input
                        type="text"
                        name="report_month"
                        value={formData.report_month}
                        onChange={handleChange}
                        placeholder="MM/YYYY"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-teal-500"
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-bold text-gray-700">Ngày chi</label>
                    <input
                        type="date"
                        name="payment_date"
                        value={formData.payment_date}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-teal-500"
                        required
                    />
                </div>
                <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-bold text-gray-700">Lý do thu</label>
                    <input
                        type="text"
                        name="reason"
                        value={formData.reason}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-teal-500"
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-bold text-gray-700">Số tiền (VNĐ)</label>
                    <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg text-lg font-bold text-teal-700 outline-none focus:border-teal-500"
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-bold text-gray-700">Người nộp tiền (Nhà trường)</label>
                    <input
                        type="text"
                        name="payer_name"
                        value={formData.payer_name}
                        onChange={handleChange}
                        placeholder="Tên người đại diện nộp tiền"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-teal-500"
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-bold text-gray-700">Số tài khoản nhận</label>
                    <input
                        type="text"
                        name="account_number"
                        value={formData.account_number}
                        onChange={handleChange}
                        placeholder="STK của bếp để nhận tiền"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-teal-500"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-bold text-gray-700">Ngân hàng</label>
                    <input
                        type="text"
                        name="bank"
                        value={formData.bank}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-teal-500"
                    />
                </div>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium">{error}</div>}

            <div className="flex gap-3 pt-4">
                <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                    {submitting ? '⏳ Đang lưu...' : '💾 Tạo phiếu & Lưu'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                    Hủy
                </button>
            </div>
        </form>
    )
}
