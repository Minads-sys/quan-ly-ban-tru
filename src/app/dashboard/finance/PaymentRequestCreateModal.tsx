'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPaymentRequest, getReconciliationData, PaymentRequest, CompanyPaymentSettings } from './actions'
import { formatVND } from '@/utils/formatNumber'
import { formatToViewDate } from '@/utils/dateUtils'
import { FileText, Loader2, Calendar, CheckCircle2, DollarSign, X } from 'lucide-react'

interface PaymentRequestCreateModalProps {
    isOpen: boolean
    onClose: () => void
    defaultStartDate: string
    defaultEndDate: string
    defaultMealType?: 'all' | 'student' | 'teacher'
    companySettings: CompanyPaymentSettings | null
    onSuccess: (createdRequest: PaymentRequest) => void
}

export function PaymentRequestCreateModal({
    isOpen,
    onClose,
    defaultStartDate,
    defaultEndDate,
    defaultMealType = 'all',
    companySettings,
    onSuccess,
}: PaymentRequestCreateModalProps) {
    const [startDate, setStartDate] = useState(defaultStartDate)
    const [endDate, setEndDate] = useState(defaultEndDate)
    const [mealType, setMealType] = useState<'all' | 'student' | 'teacher'>(defaultMealType)
    const [note, setNote] = useState('')

    // Preview data
    const [loadingPreview, setLoadingPreview] = useState(false)
    const [studentMeals, setStudentMeals] = useState(0)
    const [studentAmount, setStudentAmount] = useState(0)
    const [studentPrice, setStudentPrice] = useState(35000)

    const [teacherMeals, setTeacherMeals] = useState(0)
    const [teacherAmount, setTeacherAmount] = useState(0)
    const [teacherPrice, setTeacherPrice] = useState(35000)

    const [submitting, setSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Load preview numbers based on date range
    const loadPreview = useCallback(async () => {
        if (!startDate || !endDate) return
        setLoadingPreview(true)
        setErrorMsg(null)
        try {
            const [studentRes, teacherRes] = await Promise.all([
                getReconciliationData('student', startDate, endDate),
                getReconciliationData('teacher', startDate, endDate),
            ])

            if ('data' in studentRes) {
                setStudentMeals(studentRes.data.grandTotalMeals)
                setStudentAmount(studentRes.data.grandTotalAmount)
                setStudentPrice(studentRes.data.unitPrice)
            }
            if ('data' in teacherRes) {
                setTeacherMeals(teacherRes.data.grandTotalMeals)
                setTeacherAmount(teacherRes.data.grandTotalAmount)
                setTeacherPrice(teacherRes.data.unitPrice)
            }
        } catch (err: any) {
            console.error('Error loading preview for payment request:', err)
            setErrorMsg('Không thể tính toán số liệu đối soát cho khoảng ngày này.')
        } finally {
            setLoadingPreview(false)
        }
    }, [startDate, endDate])

    // 1. Khởi tạo giá trị khi mở modal
    useEffect(() => {
        if (isOpen) {
            setStartDate(defaultStartDate)
            setEndDate(defaultEndDate)
            setMealType(defaultMealType)
            setNote('')
        }
    }, [isOpen])

    // 2. Tải lại số liệu preview khi startDate hoặc endDate thay đổi (kèm debounce 250ms chống nghẽn socket mạng)
    useEffect(() => {
        if (!isOpen || !startDate || !endDate) return
        const timer = setTimeout(() => {
            loadPreview()
        }, 250)
        return () => clearTimeout(timer)
    }, [isOpen, startDate, endDate, loadPreview])

    if (!isOpen) return null

    // Compute final totals based on mealType
    const finalStudentCount = mealType === 'teacher' ? 0 : studentMeals
    const finalStudentAmount = mealType === 'teacher' ? 0 : studentAmount
    const finalTeacherCount = mealType === 'student' ? 0 : teacherMeals
    const finalTeacherAmount = mealType === 'student' ? 0 : teacherAmount
    const finalTotalAmount = finalStudentAmount + finalTeacherAmount
    const finalTotalMeals = finalStudentCount + finalTeacherCount

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (finalTotalAmount <= 0) {
            if (!confirm('Tổng tiền của đợt đề nghị này đang là 0đ. Bạn vẫn muốn tiếp tục lưu?')) {
                return
            }
        }

        setSubmitting(true)
        setErrorMsg(null)
        try {
            const res = await createPaymentRequest({
                start_date: startDate,
                end_date: endDate,
                meal_type: mealType,
                student_meal_count: finalStudentCount,
                student_meal_amount: finalStudentAmount,
                teacher_meal_count: finalTeacherCount,
                teacher_meal_amount: finalTeacherAmount,
                total_amount: finalTotalAmount,
                note: note.trim() || undefined,
            })

            if (res.success && res.data) {
                onSuccess(res.data)
            } else {
                setErrorMsg(res.error || 'Có lỗi xảy ra khi tạo Giấy Đề Nghị Thanh Toán.')
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Lỗi kết nối máy chủ.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden border border-indigo-100 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-8 py-5 bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-xl shadow-inner">
                            <FileText className="w-5 h-5 text-indigo-100" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold tracking-tight">Lập Giấy Đề Nghị Thanh Toán</h2>
                            <p className="text-[11px] text-indigo-200">
                                Lưu hồ sơ đề nghị để in gửi nhà trường duyệt chi (Chờ thanh toán)
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {errorMsg && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                            {errorMsg}
                        </div>
                    )}

                    {/* Dải ngày & Nút tính lại */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-indigo-500" /> Từ ngày:
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-indigo-500" /> Đến ngày:
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                required
                            />
                        </div>
                    </div>

                    {/* Chọn đối tượng */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase">
                            Đối tượng áp dụng đợt này:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setMealType('all')}
                                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                    mealType === 'all'
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                🏫 Cả trường (HS & GV)
                            </button>
                            <button
                                type="button"
                                onClick={() => setMealType('student')}
                                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                    mealType === 'student'
                                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                🎓 Chỉ Học sinh
                            </button>
                            <button
                                type="button"
                                onClick={() => setMealType('teacher')}
                                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                    mealType === 'teacher'
                                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                👩‍🏫 Chỉ Giáo viên
                            </button>
                        </div>
                    </div>

                    {/* Preview tính toán từ Biên bản đối chiếu */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                        {loadingPreview && (
                            <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] flex items-center justify-center gap-2 text-xs font-semibold text-indigo-700 z-10">
                                <Loader2 className="w-4 h-4 animate-spin" /> Đang tính số liệu đối soát...
                            </div>
                        )}

                        <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200/80">
                            <span className="font-semibold text-slate-500">Kỳ thanh toán:</span>
                            <span className="font-bold text-slate-800">
                                {formatToViewDate(startDate)} → {formatToViewDate(endDate)}
                            </span>
                        </div>

                        {(mealType === 'all' || mealType === 'student') && (
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-600">
                                    Suất ăn Học sinh ({formatVND(finalStudentCount)} suất × {formatVND(studentPrice)}đ):
                                </span>
                                <span className="font-bold text-teal-700">
                                    {formatVND(finalStudentAmount)} đ
                                </span>
                            </div>
                        )}

                        {(mealType === 'all' || mealType === 'teacher') && (
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-600">
                                    Suất ăn Giáo viên ({formatVND(finalTeacherCount)} suất × {formatVND(teacherPrice)}đ):
                                </span>
                                <span className="font-bold text-rose-700">
                                    {formatVND(finalTeacherAmount)} đ
                                </span>
                            </div>
                        )}

                        <div className="pt-2 border-t border-slate-300 flex justify-between items-center">
                            <div>
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                    Tổng tiền đề nghị:
                                </span>
                                <span className="block text-[10px] text-slate-400">
                                    Tổng cộng {formatVND(finalTotalMeals)} suất ăn
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-xl font-extrabold text-indigo-700">
                                    {formatVND(finalTotalAmount)}
                                </span>
                                <span className="text-xs font-bold text-slate-500 ml-1">VNĐ</span>
                            </div>
                        </div>
                    </div>

                    {/* Ghi chú */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-500 uppercase">
                            Ghi chú bổ sung (nếu có):
                        </label>
                        <input
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Ví dụ: Đợt thanh toán số 1 tháng 05/2026..."
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                        />
                    </div>

                    {/* Nhắc nhở quy trình */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                        <span className="font-bold">ℹ️ Lưu ý kế toán:</span> Sau khi lưu, Giấy ĐNTT sẽ ở trạng thái <strong>⏳ Chờ thanh toán</strong> để in/gửi cho trường. Tiền <em>chưa được ghi nhận vào quỹ</em> và công nợ vẫn giữ nguyên cho đến khi bạn bấm <strong>Hoàn tất thanh toán</strong> lúc tiền thực tế đã về.
                    </div>

                    {/* Nút hành động */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-all cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || loadingPreview}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-xs flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Đang lưu...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>💾 Lưu Giấy Đề Nghị Thanh Toán</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
