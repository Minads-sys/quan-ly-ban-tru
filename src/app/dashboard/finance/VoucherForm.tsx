'use client'

import { useState, useMemo } from 'react'
import { createAdvancePayment } from './actions'
import { getVietnamNow, getVietnamDateString } from '@/utils/dateUtils'

export interface VoucherCreatedData {
    amount: number
    reason: string
    payer_name: string
    startDate: string
    endDate: string
    payment_date: string
}

interface VoucherFormProps {
    defaultStartDate?: string
    defaultEndDate?: string
    defaultAmount?: number
    schoolName?: string
    bankAccount?: string
    bankName?: string
    onSuccess: () => void
    onSuccessWithData?: (data: VoucherCreatedData) => void
    onCancel: () => void
}

export function VoucherForm({
    defaultStartDate,
    defaultEndDate,
    defaultAmount = 0,
    schoolName = '',
    bankAccount = '',
    bankName = '',
    onSuccess,
    onSuccessWithData,
    onCancel,
}: VoucherFormProps) {
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const now = getVietnamNow()
    const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`

    const formatViewDate = (dStr: string) => {
        if (!dStr) return ''
        const [y, m, d] = dStr.split('-')
        return `${d}/${m}/${y}`
    }

    const [periodStart, setPeriodStart] = useState<string>(defaultStartDate || '')
    const [periodEnd, setPeriodEnd] = useState<string>(defaultEndDate || '')

    const initialReason = useMemo(() => {
        if (defaultStartDate && defaultEndDate) {
            return `Tiền suất ăn bán trú từ ${formatViewDate(defaultStartDate)} đến ${formatViewDate(defaultEndDate)}`
        }
        return `Tạm ứng tiền bán trú tháng ${currentMonth}`
    }, [defaultStartDate, defaultEndDate, currentMonth])

    const [formData, setFormData] = useState({
        amount: defaultAmount,
        reason: initialReason,
        payer_name: schoolName,
        account_number: bankAccount,
        bank: bankName,
        report_month: currentMonth,
        payment_date: getVietnamDateString()
    })

    const handlePeriodChange = (start: string, end: string) => {
        setPeriodStart(start)
        setPeriodEnd(end)
        if (start && end) {
            setFormData(prev => ({
                ...prev,
                reason: `Tiền suất ăn bán trú từ ${formatViewDate(start)} đến ${formatViewDate(end)}`
            }))
        }
    }

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
                if (onSuccessWithData) {
                    onSuccessWithData({
                        amount: formData.amount,
                        reason: formData.reason,
                        payer_name: formData.payer_name,
                        startDate: periodStart || defaultStartDate || getVietnamDateString(),
                        endDate: periodEnd || defaultEndDate || getVietnamDateString(),
                        payment_date: formData.payment_date,
                    })
                } else {
                    onSuccess()
                }
            }
        } catch (err: any) {
            setError(err.message || 'Có lỗi xảy ra')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dải ngày tính tiền (cho phép chọn hoặc kế thừa từ bộ lọc) */}
            <div className="bg-teal-50/60 p-3 rounded-xl border border-teal-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="font-bold text-teal-800">📅 Kỳ thanh toán:</span>
                <div className="flex items-center gap-2">
                    <span className="text-gray-500">Từ:</span>
                    <input
                        type="date"
                        value={periodStart}
                        onChange={e => handlePeriodChange(e.target.value, periodEnd)}
                        className="px-2 py-1 bg-white border border-teal-200 rounded font-semibold text-gray-700 outline-none"
                    />
                    <span className="text-gray-500">Đến:</span>
                    <input
                        type="date"
                        value={periodEnd}
                        onChange={e => handlePeriodChange(periodStart, e.target.value)}
                        className="px-2 py-1 bg-white border border-teal-200 rounded font-semibold text-gray-700 outline-none"
                    />
                </div>
            </div>

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
                    <label className="text-sm font-bold text-gray-700">Ngày thu</label>
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
                    className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                    {submitting ? '⏳ Đang lưu...' : '💾 Tạo phiếu & Lưu'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all cursor-pointer"
                >
                    Hủy
                </button>
            </div>
        </form>
    )
}
