'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    AdvancePayment,
    deleteAdvancePayment,
    TeacherDebtDay,
    CompanyPaymentSettings,
    PaymentRequest,
    getFinancePageData,
    FinancePageData,
} from './actions'
import { VoucherForm } from './VoucherForm'
import { VoucherPrint } from './VoucherPrint'
import { PaymentRequestPrint } from './PaymentRequestPrint'
import { ReconciliationPrint } from './ReconciliationPrint'
import { PaymentRequestCreateModal } from './PaymentRequestCreateModal'
import { PaymentRequestList } from './PaymentRequestList'
import { formatToViewDate } from '@/utils/dateUtils'
import { formatVND } from '@/utils/formatNumber'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'

interface FinanceClientProps {
    initialData: FinancePageData | { error: string }
    defaultStartDate: string
    defaultEndDate: string
}

export function FinanceClient({ initialData, defaultStartDate, defaultEndDate }: FinanceClientProps) {
    const isInitOk = !('error' in initialData)
    const initData = isInitOk ? (initialData as FinancePageData) : null

    const [payments, setPayments] = useState<AdvancePayment[]>(initData?.payments || [])
    const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>(initData?.paymentRequests || [])
    const [loading, setLoading] = useState(false)
    const [showDirectVoucherForm, setShowDirectVoucherForm] = useState(false)
    const [showCreatePaymentRequest, setShowCreatePaymentRequest] = useState(false)
    const [selectedPayment, setSelectedPayment] = useState<AdvancePayment | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
        !isInitOk ? { type: 'error', text: (initialData as { error: string }).error } : null
    )
    const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student')
    const [teacherReports, setTeacherReports] = useState<TeacherDebtDay[]>(initData?.teacherDebtRows || [])
    const [companySettings, setCompanySettings] = useState<CompanyPaymentSettings | null>(initData?.companySettings || null)

    // In Giấy Đề Nghị Thanh Toán
    const [showPaymentRequest, setShowPaymentRequest] = useState(false)
    const [paymentRequestPrintConfig, setPaymentRequestPrintConfig] = useState<{
        startDate: string
        endDate: string
        customAmount?: number
    } | null>(null)

    // In Biên Bản Đối Chiếu
    const [showReconciliation, setShowReconciliation] = useState(false)
    const [reconciliationPrintConfig, setReconciliationPrintConfig] = useState<{
        startDate: string
        endDate: string
        type: 'student' | 'teacher'
    } | null>(null)

    // Modal xuất chứng từ sau khi Tạo ĐNTT
    const [newlyCreatedRequest, setNewlyCreatedRequest] = useState<PaymentRequest | null>(null)

    // Modal thông báo sau khi Hoàn tất thanh toán
    const [completedPaymentData, setCompletedPaymentData] = useState<{
        voucher: AdvancePayment
        request: PaymentRequest
    } | null>(null)

    // Bộ lọc dải ngày
    const [startDate, setStartDate] = useState(defaultStartDate)
    const [endDate, setEndDate] = useState(defaultEndDate)

    const [debtSummary, setDebtSummary] = useState(initData?.debtSummary || {
        totalMeals: 0,
        totalMealMoney: 0,
        totalAdvance: 0,
        debt: 0,
        mealPrice: 0,
        teacherTotalMeals: 0,
        teacherTotalMoney: 0,
        teacherMealPrice: 0,
        overallDebt: 0,
        totalAllMoney: 0,
    })

    const pendingPaymentRequests = paymentRequests.filter(p => p.status === 'pending')
    const pendingPaymentAmount = pendingPaymentRequests.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const result = await getFinancePageData(startDate, endDate)
            if ('error' in result) {
                setMessage({ type: 'error', text: result.error })
                return
            }
            setPayments(result.payments)
            setPaymentRequests(result.paymentRequests)
            setDebtSummary(result.debtSummary)
            setTeacherReports(result.teacherDebtRows)
            setCompanySettings(result.companySettings)
        } catch (err) {
            console.error('[FinanceClient loadData] error:', err)
        } finally {
            setLoading(false)
        }
    }, [startDate, endDate])

    // Bỏ loadData() khi mount (vì đã có initialData), nhưng tự động chạy khi startDate/endDate thay đổi
    const isFirstRender = useRef(true)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }
        loadData()
    }, [loadData])

    // ⚡ Realtime: tự động làm mới khi có thay đổi phiếu thu, đề nghị thanh toán hoặc báo cáo
    useRealtimeRefresh(['advance_payments', 'daily_reports', 'teacher_meal_reports', 'payment_requests'], loadData)

    const handleDeleteVoucher = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa phiếu thu này?')) return
        const result = await deleteAdvancePayment(id)
        if (result.error) {
            alert(result.error)
        } else {
            loadData()
            setMessage({ type: 'success', text: 'Đã xóa phiếu thu thành công' })
            setTimeout(() => setMessage(null), 3000)
        }
    }

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
            {/* Header & Thanh công cụ chính */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        💰 Quản lý Tài chính & Thanh toán
                    </h1>
                    <div className="text-gray-500 text-xs mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-gray-400">Quy trình:</span>
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">1. Lập Giấy ĐNTT</span>
                        <span className="text-gray-400 font-bold">→</span>
                        <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">2. Chờ nhận tiền</span>
                        <span className="text-gray-400 font-bold">→</span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">3. Hoàn tất & Gạch nợ</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    {/* Bộ lọc ngày */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Từ:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent outline-none text-xs font-bold text-indigo-700 cursor-pointer"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Đến:</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent outline-none text-xs font-bold text-indigo-700 cursor-pointer"
                        />
                    </div>

                    {/* NÚT 1 (CHÍNH): Lập Giấy Đề Nghị Thanh Toán (Khổ A4) - LUÔN HIỂN THỊ */}
                    <button
                        onClick={() => setShowCreatePaymentRequest(true)}
                        className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95 text-xs cursor-pointer"
                        title="Lập và lưu hồ sơ Giấy Đề Nghị Thanh Toán để in gửi trường duyệt chi"
                    >
                        <span className="text-base">📄</span> Lập Giấy ĐNTT (A4)
                    </button>

                    {/* NÚT 2: Biên bản đối chiếu */}
                    <button
                        onClick={() => {
                            setReconciliationPrintConfig({
                                startDate,
                                endDate,
                                type: activeTab,
                            })
                            setShowReconciliation(true)
                        }}
                        className="px-3.5 py-2 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-md flex items-center gap-1.5 active:scale-95 text-xs cursor-pointer"
                        title="In hoặc xuất PDF Biên bản đối chiếu cung cấp suất ăn (Khổ A4 Dọc)"
                    >
                        <span>📑</span> Biên bản đối chiếu
                    </button>

                    {/* NÚT 3: Thu tiền ngoài đợt (tùy chọn) */}
                    <button
                        onClick={() => setShowDirectVoucherForm(true)}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all border border-gray-200 flex items-center gap-1.5 active:scale-95 text-xs cursor-pointer"
                        title="Ghi nhận khoản thu tiền mặt hoặc tạm ứng lẻ ngoài các đợt đối soát"
                    >
                        <span>➕</span> Thu ngoài đợt
                    </button>
                </div>
            </div>

            {/* 4 Thẻ Thống Kê Tài Chính Tổng Quan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Tiền cơm trong kỳ */}
                <div className="bg-white rounded-2xl p-5 border border-blue-100 shadow-sm transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-2">
                        <div className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Tiền cơm trong kỳ</div>
                        <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {loading ? '...' : `${debtSummary.totalMeals + debtSummary.teacherTotalMeals} SUẤT`}
                        </span>
                    </div>
                    <div className="text-2xl font-black text-blue-600">
                        {loading ? (
                            <span className="text-base text-gray-400 font-semibold animate-pulse">Đang tải...</span>
                        ) : (
                            <>{formatVND(debtSummary.totalAllMoney)} <span className="text-xs font-normal">đ</span></>
                        )}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 italic font-medium">
                        {loading ? 'Đang tính toán...' : `HS: ${formatVND(debtSummary.totalMealMoney)}đ | GV: ${formatVND(debtSummary.teacherTotalMoney)}đ`}
                    </div>
                </div>

                {/* Card 2: Đang chờ thanh toán (Đã gửi Giấy ĐNTT) */}
                <div className="bg-white rounded-2xl p-5 border border-amber-200/80 shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-white via-white to-amber-50/40">
                    <div className="flex justify-between items-start mb-2">
                        <div className="text-amber-800 text-[10px] font-bold uppercase tracking-wider">Đang chờ thanh toán</div>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {loading ? '...' : `${pendingPaymentRequests.length} ĐỢT CHỜ`}
                        </span>
                    </div>
                    <div className="text-2xl font-black text-amber-600">
                        {loading ? (
                            <span className="text-base text-gray-400 font-semibold animate-pulse">Đang tải...</span>
                        ) : (
                            <>{formatVND(pendingPaymentAmount)} <span className="text-xs font-normal">đ</span></>
                        )}
                    </div>
                    <div className="text-[10px] text-amber-700/80 mt-1 font-medium">
                        {loading ? 'Đang tính toán...' : 'Đã lập giấy đề nghị, chờ nhà trường chi'}
                    </div>
                </div>

                {/* Card 3: Đã thực thu / Tạm ứng */}
                <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-2">
                        <div className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Đã thực thu (Sổ quỹ)</div>
                        <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {loading ? '...' : `${payments.length} PHIẾU`}
                        </span>
                    </div>
                    <div className="text-2xl font-black text-emerald-600">
                        {loading ? (
                            <span className="text-base text-gray-400 font-semibold animate-pulse">Đang tải...</span>
                        ) : (
                            <>{formatVND(debtSummary.totalAdvance)} <span className="text-xs font-normal">đ</span></>
                        )}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 italic font-medium">
                        {loading ? 'Đang tính toán...' : 'Tổng các khoản tiền mặt & chuyển khoản đã nhận'}
                    </div>
                </div>

                {/* Card 4: Còn nợ thực tế (Tổng tiền cơm - Đã thực thu) */}
                <div className={`rounded-2xl p-5 border text-white shadow-sm transition-all hover:shadow-md hover:scale-[1.02] flex flex-col justify-center ${
                    loading ? 'bg-slate-700' : (debtSummary.overallDebt <= 0 ? 'bg-emerald-600' : 'bg-red-500')
                }`}>
                    <div className="text-white/70 text-[10px] font-bold mb-1 uppercase tracking-wider">
                        {loading ? 'Đang kiểm tra công nợ...' : (debtSummary.overallDebt <= 0 ? 'Trạng thái kỳ này' : 'Còn nợ thực tế')}
                    </div>
                    <div className="text-2xl font-black flex items-center gap-2">
                        {loading ? (
                            <span className="text-base text-white/70 font-semibold animate-pulse">Đang tải số liệu...</span>
                        ) : debtSummary.overallDebt <= 0 ? (
                            <><span>✨</span> ĐÃ TẤT TOÁN</>
                        ) : (
                            <>{formatVND(debtSummary.overallDebt)} <span className="text-xs font-normal">đ</span></>
                        )}
                    </div>
                    <div className="text-[10px] text-white/70 mt-1 font-medium">
                        {loading ? 'Vui lòng chờ giây lát...' : (debtSummary.overallDebt <= 0 ? 'Không còn công nợ tồn đọng' : 'Số tiền trường chưa thanh toán')}
                    </div>
                </div>
            </div>

            {/* PHẦN TRỌNG TÂM: DANH SÁCH GIẤY ĐỀ NGHỊ THANH TOÁN */}
            <PaymentRequestList
                requests={paymentRequests}
                companySettings={companySettings}
                loading={loading}
                onOpenPaymentRequestPrint={(req) => {
                    setPaymentRequestPrintConfig({
                        startDate: req.start_date,
                        endDate: req.end_date,
                        customAmount: req.total_amount,
                    })
                    setShowPaymentRequest(true)
                }}
                onOpenReconciliationPrint={(req) => {
                    setReconciliationPrintConfig({
                        startDate: req.start_date,
                        endDate: req.end_date,
                        type: req.meal_type === 'teacher' ? 'teacher' : 'student',
                    })
                    setShowReconciliation(true)
                }}
                onPaymentCompleted={(voucher, req) => {
                    setCompletedPaymentData({ voucher, request: req })
                    loadData()
                    setMessage({ type: 'success', text: `Đã hoàn tất thanh toán cho đợt ${req.request_code}!` })
                    setTimeout(() => setMessage(null), 4000)
                }}
                onReload={loadData}
            />

            {/* Tabs Xem Chi Tiết Báo Suất & Sổ Quỹ Thu Tiền */}
            <div className="pt-4">
                <div className="flex gap-4 border-b border-gray-200 mb-6">
                    <button
                        className={`py-3 px-6 font-semibold text-sm transition-all border-b-2 ${
                            activeTab === 'student' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setActiveTab('student')}
                    >
                        🎓 Chi tiết & Phiếu thu Học sinh
                    </button>
                    <button
                        className={`py-3 px-6 font-semibold text-sm transition-all border-b-2 ${
                            activeTab === 'teacher' ? 'border-rose-500 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setActiveTab('teacher')}
                    >
                        👩‍🏫 Chi tiết Báo suất Giáo viên
                    </button>
                </div>

                {activeTab === 'student' && (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center flex-wrap gap-3">
                            <div>
                                <h2 className="font-bold text-gray-800 tracking-tight text-lg">Sổ quỹ: Lịch sử phiếu thu đã nhận tiền</h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                                    Thời gian: {formatToViewDate(startDate)} → {formatToViewDate(endDate)}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        setReconciliationPrintConfig({
                                            startDate,
                                            endDate,
                                            type: 'student',
                                        })
                                        setShowReconciliation(true)
                                    }}
                                    className="px-3.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                                >
                                    <span>📑</span> Biên bản đối chiếu HS (A4 Dọc)
                                </button>
                                <div className="flex items-center gap-2 bg-teal-50 px-3 py-1.5 rounded-full border border-teal-100">
                                    <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></span>
                                    <span className="text-[10px] text-teal-700 font-bold uppercase">Dữ liệu thực tế</span>
                                </div>
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
                                        <th className="px-8 py-5 text-[10px] uppercase tracking-widest text-right">CHỨNG TỪ</th>
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
                                            <td className="px-8 py-5 text-gray-600 max-w-[280px] truncate leading-relaxed">{p.reason}</td>
                                            <td className="px-8 py-5 text-right">
                                                <span className="font-bold text-teal-700 text-lg">{formatVND(p.amount)}</span>
                                                <span className="text-[10px] ml-1 text-gray-400 font-bold">đ</span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end items-center gap-2 opacity-90 group-hover:opacity-100 transition-all">
                                                    <button
                                                        onClick={() => setSelectedPayment(p)}
                                                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition-all font-bold text-[10px] uppercase active:scale-95 cursor-pointer flex items-center gap-1"
                                                        title="In phiếu thu (Mẫu 01-TT)"
                                                    >
                                                        <span>🖨️</span> Phiếu thu
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteVoucher(p.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                                        title="Xóa phiếu thu"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {payments.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={5} className="px-8 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-3xl grayscale opacity-50">📂</div>
                                                    <div className="space-y-1">
                                                        <p className="font-bold text-gray-400 uppercase text-xs tracking-widest">Chưa có phiếu thu nào trong kỳ</p>
                                                        <p className="text-gray-300 text-[10px] font-bold">Tiền sẽ xuất hiện tại đây khi bạn bấm "Hoàn tất thu tiền" trên Giấy ĐNTT</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'teacher' && (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-50 bg-rose-50/30 flex justify-between items-center flex-wrap gap-3">
                            <div>
                                <h2 className="font-bold text-rose-900 tracking-tight text-lg">Chi tiết Báo suất Giáo viên</h2>
                                <p className="text-[10px] text-rose-600 font-bold uppercase mt-0.5">Thời gian: {formatToViewDate(startDate)} → {formatToViewDate(endDate)}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setReconciliationPrintConfig({
                                        startDate,
                                        endDate,
                                        type: 'teacher',
                                    })
                                    setShowReconciliation(true)
                                }}
                                className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                            >
                                <span>📑</span> Biên bản đối chiếu GV (A4 Dọc)
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white text-gray-400 font-bold border-b border-gray-100">
                                    <tr>
                                        <th className="px-8 py-5 text-[10px] uppercase tracking-widest">NGÀY BÁO</th>
                                        <th className="px-8 py-5 text-[10px] uppercase tracking-widest">TỔNG SUẤT</th>
                                        <th className="px-8 py-5 text-[10px] uppercase tracking-widest">MẶN / CHAY / CHÁO</th>
                                        <th className="px-8 py-5 text-[10px] uppercase tracking-widest text-right">THÀNH TIỀN</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {teacherReports.map((r: TeacherDebtDay, idx) => (
                                        <tr key={idx} className="hover:bg-rose-50/20 transition-all">
                                            <td className="px-8 py-5 font-semibold text-gray-700">
                                                {formatToViewDate(r.report_date)}
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="font-bold text-rose-600 text-lg">{r.total_meals}</span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex gap-2 text-xs font-medium">
                                                    <span className="text-gray-600">🍖 {r.salty_count}</span>
                                                    <span className="text-emerald-600">🥬 {r.vegetarian_count}</span>
                                                    <span className="text-amber-600">🥣 {r.porridge_count}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <span className="font-bold text-rose-700 text-lg">{formatVND(r.total_money)}</span>
                                                <span className="text-[10px] ml-1 text-gray-400 font-bold">đ</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {teacherReports.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={4} className="px-8 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-3xl grayscale opacity-50">📂</div>
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
                )}
            </div>

            {/* MODAL 1: Lập Giấy Đề Nghị Thanh Toán Mới */}
            <PaymentRequestCreateModal
                isOpen={showCreatePaymentRequest}
                onClose={() => setShowCreatePaymentRequest(false)}
                defaultStartDate={startDate}
                defaultEndDate={endDate}
                defaultMealType={activeTab === 'teacher' ? 'teacher' : 'all'}
                companySettings={companySettings}
                onSuccess={(created) => {
                    setShowCreatePaymentRequest(false)
                    loadData()
                    setNewlyCreatedRequest(created)
                    setMessage({ type: 'success', text: `Đã tạo Giấy ĐNTT [${created.request_code}]!` })
                    setTimeout(() => setMessage(null), 3500)
                }}
            />

            {/* MODAL 2: Hỏi Xuất Giấy ĐNTT & Biên Bản Sau Khi Lưu ĐNTT */}
            {newlyCreatedRequest && (
                <div className="fixed inset-0 bg-black/60 z-[170] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-indigo-100 animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-700 text-white text-center relative">
                            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-3xl mx-auto mb-2.5 shadow-inner">
                                📄
                            </div>
                            <h3 className="text-xl font-extrabold tracking-tight">Đã Lưu Giấy Đề Nghị Thanh Toán!</h3>
                            <p className="text-xs text-indigo-100 mt-1 font-mono">
                                Mã: <span className="font-bold text-amber-200">{newlyCreatedRequest.request_code}</span> | Kỳ: {formatToViewDate(newlyCreatedRequest.start_date)} → {formatToViewDate(newlyCreatedRequest.end_date)}
                            </p>
                            <p className="text-xl font-black text-amber-300 mt-1.5">
                                {formatVND(newlyCreatedRequest.total_amount)} VNĐ
                            </p>
                            <div className="inline-flex items-center gap-1 mt-2 bg-amber-500/20 text-amber-200 border border-amber-400/30 px-3 py-0.5 rounded-full text-[10px] font-bold">
                                ⏳ Trạng thái: Chờ thanh toán (Sẵn sàng gửi trường duyệt chi)
                            </div>
                        </div>

                        <div className="p-6 space-y-2.5">
                            <p className="text-xs font-semibold text-gray-600 text-center mb-1">
                                Bạn có muốn xuất PDF hoặc in các chứng từ gửi nhà trường duyệt chi không?
                            </p>

                            {/* Nút Giấy ĐNTT */}
                            {companySettings?.canPrint && (
                                <button
                                    onClick={() => {
                                        setPaymentRequestPrintConfig({
                                            startDate: newlyCreatedRequest.start_date,
                                            endDate: newlyCreatedRequest.end_date,
                                            customAmount: newlyCreatedRequest.total_amount,
                                        })
                                        setShowPaymentRequest(true)
                                    }}
                                    className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-xl font-bold text-xs flex items-center justify-between transition-all group cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-lg">📄</span>
                                        <div className="text-left">
                                            <div className="font-bold">Giấy Đề Nghị Thanh Toán (Khổ A4)</div>
                                            <div className="text-[10px] text-indigo-500 font-normal">Tải PDF trực tiếp hoặc in văn bản trình ký</div>
                                        </div>
                                    </div>
                                    <span className="text-indigo-400 group-hover:translate-x-1 transition-transform font-bold">→</span>
                                </button>
                            )}

                            {/* Nút Biên bản đối soát */}
                            <button
                                onClick={() => {
                                    setReconciliationPrintConfig({
                                        startDate: newlyCreatedRequest.start_date,
                                        endDate: newlyCreatedRequest.end_date,
                                        type: newlyCreatedRequest.meal_type === 'teacher' ? 'teacher' : 'student',
                                    })
                                    setShowReconciliation(true)
                                }}
                                className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-xl font-bold text-xs flex items-center justify-between transition-all group cursor-pointer"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className="text-lg">📑</span>
                                    <div className="text-left">
                                        <div className="font-bold">Biên Bản Đối Chiếu Suất Ăn (A4 Dọc)</div>
                                        <div className="text-[10px] text-emerald-500 font-normal">Tải PDF trực tiếp hoặc in bảng chi tiết theo ngày kèm theo</div>
                                    </div>
                                </div>
                                <span className="text-emerald-400 group-hover:translate-x-1 transition-transform font-bold">→</span>
                            </button>

                            <button
                                onClick={() => setNewlyCreatedRequest(null)}
                                className="w-full py-2 text-gray-500 hover:text-gray-800 font-semibold text-xs transition-colors mt-2 cursor-pointer"
                            >
                                ✕ Hoàn tất / Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: Thông Báo Sau Khi Hoàn Tất Thu Tiền */}
            {completedPaymentData && (
                <div className="fixed inset-0 bg-black/60 z-[170] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-emerald-100 animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-gradient-to-br from-emerald-600 to-teal-700 text-white text-center relative">
                            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-3xl mx-auto mb-2.5 shadow-inner">
                                🧾
                            </div>
                            <h3 className="text-xl font-extrabold tracking-tight">Đã Thu Tiền & Cấn Trừ Công Nợ!</h3>
                            <p className="text-xs text-emerald-100 mt-1">
                                Đã ghi nhận vào sổ quỹ: <span className="font-bold text-amber-200 text-sm">{formatVND(completedPaymentData.voucher.amount)} đ</span>
                            </p>
                            <p className="text-[11px] text-emerald-200 mt-0.5 max-w-sm mx-auto truncate">
                                Cho đợt đề nghị: <strong>{completedPaymentData.request.request_code}</strong>
                            </p>
                        </div>

                        <div className="p-6 space-y-2.5">
                            <p className="text-xs font-semibold text-gray-600 text-center mb-1">
                                Bạn có muốn in Phiếu thu tiền (Mẫu 01-TT) gửi cho trường làm chứng từ quyết toán không?
                            </p>

                            <button
                                onClick={() => {
                                    setSelectedPayment(completedPaymentData.voucher)
                                    setCompletedPaymentData(null)
                                }}
                                className="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 rounded-xl font-bold text-xs flex items-center justify-between transition-all group cursor-pointer"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className="text-lg">🖨️</span>
                                    <div className="text-left">
                                        <div className="font-bold">In Phiếu Thu Tiền (Mẫu 01 - TT)</div>
                                        <div className="text-[10px] text-blue-500 font-normal">Phiếu thu chuẩn Thông tư 200/2014/TT-BTC</div>
                                    </div>
                                </div>
                                <span className="text-blue-400 group-hover:translate-x-1 transition-transform font-bold">→</span>
                            </button>

                            <button
                                onClick={() => setCompletedPaymentData(null)}
                                className="w-full py-2 text-gray-500 hover:text-gray-800 font-semibold text-xs transition-colors mt-2 cursor-pointer"
                            >
                                ✕ Hoàn tất / Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 4: Form Thu Tiền Ngoài Đợt */}
            {showDirectVoucherForm && (
                <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="px-8 py-6 border-b border-gray-50 bg-teal-50/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-extrabold text-teal-900 tracking-tight">Thu tiền ngoài đợt</h2>
                                <p className="text-[10px] text-teal-600 font-bold uppercase mt-0.5 tracking-wider">
                                    Ghi nhận tiền tạm ứng / nộp tiền trực tiếp không qua Giấy ĐNTT
                                </p>
                            </div>
                            <button onClick={() => setShowDirectVoucherForm(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-400 hover:text-gray-600 transition-all cursor-pointer">✕</button>
                        </div>
                        <div className="p-8">
                            <VoucherForm
                                defaultStartDate={startDate}
                                defaultEndDate={endDate}
                                defaultAmount={debtSummary.debt > 0 ? debtSummary.debt : debtSummary.totalMealMoney}
                                schoolName={companySettings?.schoolName}
                                bankAccount={companySettings?.bankAccountNumber}
                                bankName={companySettings?.bankName}
                                onSuccess={() => {
                                    setShowDirectVoucherForm(false)
                                    loadData()
                                    setMessage({ type: 'success', text: 'Đã tạo phiếu thu tiền thành công!' })
                                    setTimeout(() => setMessage(null), 3000)
                                }}
                                onCancel={() => setShowDirectVoucherForm(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* In Phiếu Thu Mẫu 01-TT */}
            {selectedPayment && (
                <VoucherPrint
                    payment={selectedPayment}
                    onClose={() => setSelectedPayment(null)}
                />
            )}

            {/* In Giấy Đề Nghị Thanh Toán Khổ A4 */}
            {showPaymentRequest && companySettings && (
                <PaymentRequestPrint
                    settings={companySettings}
                    startDate={paymentRequestPrintConfig?.startDate || startDate}
                    endDate={paymentRequestPrintConfig?.endDate || endDate}
                    studentMealMoney={debtSummary.totalMealMoney}
                    teacherMealMoney={debtSummary.teacherTotalMoney}
                    totalAllMoney={debtSummary.totalAllMoney}
                    initialAmount={paymentRequestPrintConfig?.customAmount}
                    onClose={() => {
                        setShowPaymentRequest(false)
                        setPaymentRequestPrintConfig(null)
                    }}
                />
            )}

            {/* In Biên Bản Đối Chiếu Suất Ăn Khổ A4 Dọc */}
            {showReconciliation && (
                <ReconciliationPrint
                    type={reconciliationPrintConfig?.type || activeTab}
                    startDate={reconciliationPrintConfig?.startDate || startDate}
                    endDate={reconciliationPrintConfig?.endDate || endDate}
                    onClose={() => {
                        setShowReconciliation(false)
                        setReconciliationPrintConfig(null)
                    }}
                />
            )}

            {/* Toast Thông Báo */}
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
