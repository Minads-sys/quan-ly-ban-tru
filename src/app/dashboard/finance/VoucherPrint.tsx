'use client'

import { useState } from 'react'
import { AdvancePayment } from './actions'
import { formatToViewDate } from '@/utils/dateUtils'

interface VoucherPrintProps {
    payment: AdvancePayment
    onClose: () => void
}

export function VoucherPrint({ payment, onClose }: VoucherPrintProps) {
    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="fixed inset-0 bg-white z-[200] overflow-auto p-4 sm:p-8">
            <div className="max-w-3xl mx-auto border-2 border-double border-gray-400 p-8 bg-white shadow-lg print:shadow-none print:border-none">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div className="text-sm font-bold">
                        Cty TNHH Căn tin Châu Phương Thảo
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-bold">Mẫu số 01 - TT</div>
                        <div className="text-[10px] italic">(Ban hành theo Thông tư số 200/2014/TT-BTC)</div>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold uppercase">Phiếu thu tạm ứng</h1>
                    <p className="text-sm italic">Ngày {new Date(payment.payment_date).getDate()} tháng {new Date(payment.payment_date).getMonth() + 1} năm {new Date(payment.payment_date).getFullYear()}</p>
                </div>

                {/* Content */}
                <div className="space-y-4 text-sm mb-12">
                    <div className="flex">
                        <span className="min-w-[150px]">Người nộp tiền:</span>
                        <span className="font-bold border-b border-dotted border-gray-400 flex-1">Nhà trường / [Tên người đại diện]</span>
                    </div>
                    <div className="flex">
                        <span className="min-w-[150px]">Lý do thu:</span>
                        <span className="border-b border-dotted border-gray-400 flex-1">{payment.reason}</span>
                    </div>
                    <div className="flex">
                        <span className="min-w-[150px]">Số tiền thu:</span>
                        <span className="font-bold border-b border-dotted border-gray-400 flex-1">{payment.amount.toLocaleString('vi-VN')} VNĐ</span>
                    </div>
                    <div className="flex">
                        <span className="min-w-[150px]">Nhận qua TK:</span>
                        <span className="border-b border-dotted border-gray-400 flex-1">{payment.account_number} - {payment.bank}</span>
                    </div>
                    <div className="flex">
                        <span className="min-w-[150px]">Đơn vị nhận:</span>
                        <span className="font-bold border-b border-dotted border-gray-400 flex-1">Cty TNHH Căn tin Châu Phương Thảo</span>
                    </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-4 text-center mt-16">
                    <div className="flex flex-col items-center">
                        <div className="font-bold text-base mb-20 uppercase">Người nộp tiền</div>
                        <div className="text-sm font-semibold text-gray-800">(Ký, ghi rõ họ tên)</div>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="font-bold text-base mb-20 uppercase leading-tight">Người lập phiếu</div>
                        <div className="text-sm font-semibold text-gray-800">(Ký, ghi rõ họ tên)</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center mt-16">
                    <div className="flex flex-col items-center">
                        <div className="font-bold text-base mb-20 uppercase">Duyệt Hiệu trưởng</div>
                        <div className="text-sm font-semibold text-gray-800">[Tên Hiệu trưởng]</div>
                        <div className="text-[10px] italic text-gray-500">(Ký, ghi rõ họ tên)</div>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="font-bold text-base mb-20 uppercase leading-tight">Chủ tịch HĐTV Cty Châu Phương Thảo</div>
                        <div className="text-sm font-semibold text-gray-800">[Tên Chủ tịch]</div>
                        <div className="text-[10px] italic text-gray-500">(Ký, ghi rõ họ tên)</div>
                    </div>
                </div>

                {/* Action Buttons (Hidden on print) */}
                <div className="mt-12 flex justify-center gap-4 print:hidden">
                    <button
                        onClick={handlePrint}
                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md"
                    >
                        🖨️ In phiếu thu
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}
