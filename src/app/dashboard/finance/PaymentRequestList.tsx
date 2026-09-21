'use client'

import { useState } from 'react'
import { PaymentRequest, completePaymentRequest, deletePaymentRequest, AdvancePayment, CompanyPaymentSettings } from './actions'
import { formatVND } from '@/utils/formatNumber'
import { formatToViewDate, getVietnamDateString, getVietnamNow } from '@/utils/dateUtils'
import { FileText, CheckCircle2, Trash2, Printer, Loader2, Calendar, CreditCard, DollarSign, X } from 'lucide-react'

interface PaymentRequestListProps {
    requests: PaymentRequest[]
    companySettings: CompanyPaymentSettings | null
    loading: boolean
    onOpenPaymentRequestPrint: (request: PaymentRequest) => void
    onOpenReconciliationPrint: (request: PaymentRequest) => void
    onPaymentCompleted: (voucher: AdvancePayment, request: PaymentRequest) => void
    onReload: () => void
}

export function PaymentRequestList({
    requests,
    companySettings,
    loading,
    onOpenPaymentRequestPrint,
    onOpenReconciliationPrint,
    onPaymentCompleted,
    onReload,
}: PaymentRequestListProps) {
    // State cho Modal "Hoàn tất thanh toán"
    const [activeCompleteRequest, setActiveCompleteRequest] = useState<PaymentRequest | null>(null)
    const [paymentDate, setPaymentDate] = useState<string>(getVietnamDateString(getVietnamNow()))
    const [paymentMethod, setPaymentMethod] = useState<'bank' | 'cash'>('bank')
    const [receivedAmount, setReceivedAmount] = useState<number>(0)
    const [payerName, setPayerName] = useState<string>('Trường THPT Thanh Đa')
    const [submittingComplete, setSubmittingComplete] = useState(false)
    const [completeError, setCompleteError] = useState<string | null>(null)

    const handleStartComplete = (req: PaymentRequest) => {
        setActiveCompleteRequest(req)
        setPaymentDate(getVietnamDateString(getVietnamNow()))
        setPaymentMethod('bank')
        setReceivedAmount(req.total_amount)
        setPayerName(companySettings?.schoolName || 'Trường THPT Thanh Đa')
        setCompleteError(null)
    }

    const handleConfirmComplete = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeCompleteRequest) return

        if (receivedAmount <= 0) {
            setCompleteError('Số tiền thực nhận phải lớn hơn 0đ.')
            return
        }

        setSubmittingComplete(true)
        setCompleteError(null)
        try {
            const res = await completePaymentRequest(activeCompleteRequest.id, {
                payment_date: paymentDate,
                payment_method: paymentMethod,
                amount: receivedAmount,
                payer_name: payerName,
                account_number: companySettings?.bankAccountNumber,
                bank: paymentMethod === 'cash' ? 'Tiền mặt' : (companySettings?.bankName || 'Ngân hàng ACB'),
            })

            if (res.success && res.voucher) {
                const finishedReq = { ...activeCompleteRequest, status: 'paid' as const, paid_at: paymentDate }
                setActiveCompleteRequest(null)
                onPaymentCompleted(res.voucher, finishedReq)
                onReload()
            } else {
                setCompleteError(res.error || 'Có lỗi xảy ra khi hoàn tất thanh toán.')
            }
        } catch (err: any) {
            setCompleteError(err.message || 'Lỗi kết nối máy chủ.')
        } finally {
            setSubmittingComplete(false)
        }
    }

    const handleDelete = async (req: PaymentRequest) => {
        if (!confirm(`Bạn có chắc muốn xóa Giấy ĐNTT [${req.request_code}]?`)) return
        const res = await deletePaymentRequest(req.id)
        if (res.success) {
            onReload()
        } else {
            alert(res.error || 'Không thể xóa phiếu này.')
        }
    }

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden mt-6">
            {/* Header của bảng */}
            <div className="px-8 py-6 border-b border-gray-50 bg-gradient-to-r from-indigo-50/50 via-blue-50/30 to-white flex justify-between items-center flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center font-bold text-xl shadow-sm">
                        📄
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-gray-800 tracking-tight text-lg">
                                Danh sách Giấy Đề Nghị Thanh Toán
                            </h2>
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                {requests.length} ĐỢT
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            Theo dõi các đợt đề nghị thanh toán gửi cho nhà trường: Chờ chuyển tiền & Đã thanh toán
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200/80">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        <span>Chờ trường duyệt chi</span>
                    </span>
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200/80">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Đã thu vào quỹ</span>
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white text-gray-400 font-bold border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-[10px] uppercase tracking-widest">MÃ ĐỀ NGHỊ</th>
                            <th className="px-6 py-4 text-[10px] uppercase tracking-widest">KỲ ĐỐI SOÁT</th>
                            <th className="px-6 py-4 text-[10px] uppercase tracking-widest">ĐỐI TƯỢNG</th>
                            <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-right">TỔNG TIỀN</th>
                            <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-center">TRẠNG THÁI</th>
                            <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-right">THAO TÁC</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {requests.map((r: PaymentRequest) => {
                            const isPaid = r.status === 'paid'
                            return (
                                <tr key={r.id} className="hover:bg-indigo-50/20 transition-all group">
                                    {/* Mã đề nghị */}
                                    <td className="px-6 py-4">
                                        <div className="font-mono font-bold text-indigo-900 text-xs">
                                            {r.request_code}
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                            Tạo lúc: {formatToViewDate(r.created_at.slice(0, 10))}
                                        </div>
                                    </td>

                                    {/* Kỳ đối soát */}
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-gray-700 text-xs">
                                            {formatToViewDate(r.start_date)} → {formatToViewDate(r.end_date)}
                                        </div>
                                        {r.note && (
                                            <div className="text-[10px] text-gray-400 italic max-w-[200px] truncate mt-0.5">
                                                {r.note}
                                            </div>
                                        )}
                                    </td>

                                    {/* Loại đối tượng */}
                                    <td className="px-6 py-4">
                                        {r.meal_type === 'all' && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                🏫 Toàn trường
                                            </span>
                                        )}
                                        {r.meal_type === 'student' && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                                🎓 Học sinh ({r.student_meal_count} suất)
                                            </span>
                                        )}
                                        {r.meal_type === 'teacher' && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                👩‍🏫 Giáo viên ({r.teacher_meal_count} suất)
                                            </span>
                                        )}
                                    </td>

                                    {/* Tổng tiền */}
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-extrabold text-indigo-700 text-base">
                                            {formatVND(r.total_amount)}
                                        </span>
                                        <span className="text-[10px] ml-1 text-gray-400 font-bold">đ</span>
                                    </td>

                                    {/* Trạng thái */}
                                    <td className="px-6 py-4 text-center">
                                        {isPaid ? (
                                            <div className="inline-flex flex-col items-center">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                    <span>✅</span> ĐÃ THANH TOÁN
                                                </span>
                                                {r.paid_at && (
                                                    <span className="text-[9px] text-emerald-600 font-semibold mt-0.5">
                                                        Ngày thu: {formatToViewDate(r.paid_at)}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="inline-flex flex-col items-center">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                                                    <span>⏳</span> CHỜ THANH TOÁN
                                                </span>
                                                <span className="text-[9px] text-amber-600 mt-0.5">
                                                    Đã gửi trường
                                                </span>
                                            </div>
                                        )}
                                    </td>

                                    {/* Thao tác */}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end items-center gap-1.5 flex-wrap">
                                            {/* Nút 1: Giấy ĐNTT */}
                                            <button
                                                onClick={() => onOpenPaymentRequestPrint(r)}
                                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm"
                                                title="Mở xem, in hoặc tải PDF Giấy Đề Nghị Thanh Toán (Khổ A4)"
                                            >
                                                <span>📄</span> Giấy ĐNTT
                                            </button>

                                            {/* Nút 2: Biên bản đối soát */}
                                            <button
                                                onClick={() => onOpenReconciliationPrint(r)}
                                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm"
                                                title="Mở xem, in hoặc tải PDF Biên bản đối chiếu suất ăn (A4 Dọc)"
                                            >
                                                <span>📑</span> Đối soát
                                            </button>

                                            {/* Nút 3: Hoàn tất thanh toán (CHỈ HIỆN KHI CHỜ THANH TOÁN) */}
                                            {!isPaid && (
                                                <button
                                                    onClick={() => handleStartComplete(r)}
                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all font-bold text-[10px] uppercase active:scale-95 cursor-pointer flex items-center gap-1 animate-pulse"
                                                    title="Bấm khi trường đã chuyển khoản hoặc thanh toán tiền mặt"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    <span>Hoàn tất thu tiền</span>
                                                </button>
                                            )}

                                            {/* Nút 4: Xóa */}
                                            <button
                                                onClick={() => handleDelete(r)}
                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                                title="Xóa đợt đề nghị này"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}

                        {requests.length === 0 && !loading && (
                            <tr>
                                <td colSpan={6} className="px-8 py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-3xl">
                                            📋
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-700 text-sm">
                                                Chưa có Giấy Đề Nghị Thanh Toán nào trong khoảng thời gian này
                                            </p>
                                            <p className="text-gray-400 text-xs mt-1">
                                                Hãy bấm nút <strong>"📄 Lập Giấy Đề Nghị Thanh Toán"</strong> ở góc trên để tạo đợt đề nghị gửi cho nhà trường.
                                            </p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Xác Nhận Hoàn Tất Thanh Toán (Khi Tiền Về) */}
            {activeCompleteRequest && (
                <div className="fixed inset-0 bg-black/60 z-[160] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-emerald-100 animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-gradient-to-br from-emerald-600 to-teal-700 text-white text-center relative">
                            <button
                                onClick={() => setActiveCompleteRequest(null)}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl mx-auto mb-2 shadow-inner">
                                💰
                            </div>
                            <h3 className="text-lg font-extrabold tracking-tight">
                                Xác Nhận Đã Nhận Tiền
                            </h3>
                            <p className="text-xs text-emerald-100 mt-0.5">
                                Hoàn tất thanh toán cho đợt: <strong>{activeCompleteRequest.request_code}</strong>
                            </p>
                            <div className="mt-2 text-2xl font-black text-amber-200">
                                {formatVND(activeCompleteRequest.total_amount)} <span className="text-sm font-normal">VNĐ</span>
                            </div>
                        </div>

                        <form onSubmit={handleConfirmComplete} className="p-6 space-y-3.5">
                            {completeError && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                                    {completeError}
                                </div>
                            )}

                            {/* Ngày thực nhận tiền */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-emerald-600" /> Ngày nhận tiền thực tế:
                                </label>
                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={e => setPaymentDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                    required
                                />
                            </div>

                            {/* Hình thức thanh toán */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                                    <CreditCard className="w-3 h-3 text-emerald-600" /> Hình thức nhận tiền:
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('bank')}
                                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                            paymentMethod === 'bank'
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        🏦 Chuyển khoản ngân hàng
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                            paymentMethod === 'cash'
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        💵 Tiền mặt
                                    </button>
                                </div>
                            </div>

                            {/* Số tiền thực nhận */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                                    <DollarSign className="w-3 h-3 text-emerald-600" /> Số tiền thực nhận:
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={receivedAmount}
                                        onChange={e => setReceivedAmount(Number(e.target.value) || 0)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-extrabold text-emerald-800 outline-none focus:border-emerald-500 focus:bg-white transition-all pr-12"
                                        required
                                    />
                                    <span className="absolute right-3 top-2 text-xs font-bold text-gray-400">
                                        VNĐ
                                    </span>
                                </div>
                            </div>

                            {/* Người nộp tiền */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-500 uppercase">
                                    Đơn vị / Người nộp tiền:
                                </label>
                                <input
                                    type="text"
                                    value={payerName}
                                    onChange={e => setPayerName(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                    required
                                />
                            </div>

                            {/* Tác động vào hệ thống */}
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 leading-relaxed">
                                <strong>⚡ Hệ thống sẽ:</strong>
                                <ul className="list-disc ml-4 mt-0.5 space-y-0.5">
                                    <li>Chuyển trạng thái Giấy ĐNTT sang <strong>ĐÃ THANH TOÁN</strong>.</li>
                                    <li>Tự động sinh <strong>Phiếu thu tiền (Mẫu 01-TT)</strong> vào Sổ quỹ.</li>
                                    <li>Gạch trừ công nợ thực tế ngay lập tức.</li>
                                </ul>
                            </div>

                            {/* Nút hành động */}
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveCompleteRequest(null)}
                                    className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-all cursor-pointer"
                                >
                                    Đóng
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingComplete}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all text-xs flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                                >
                                    {submittingComplete ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Đang xử lý...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Xác nhận đã thu tiền</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
