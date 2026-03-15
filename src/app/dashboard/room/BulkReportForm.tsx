'use client'

import { useState, useCallback, useMemo } from 'react'
import { submitBulkReports } from './bulk-actions'

interface RoomData {
    id: string
    name: string
    default_capacity: number
}

interface ReportData {
    id?: string
    room_id: string
    capacity: number
    absent_count: number
    porridge_count: number
    vegetarian_count: number
    salty_count: number
    note: string
    status: 'draft' | 'submitted' | 'room_approved' | 'school_approved' | 'rejected'
}

interface BulkReportFormProps {
    rooms: RoomData[]
    existingReports: ReportData[]
    isWithinTime: boolean
    phaseLabel: string
    reportDate: string
    onSuccess: () => void
}

type RowData = {
    roomId: string
    roomName: string
    capacity: number
    absentCount: number
    porridgeCount: number
    vegetarianCount: number
    saltyCount: number
    note: string
    status: ReportData['status'] | 'unsubmitted'
    isChanged: boolean
}

export function BulkReportForm({
    rooms,
    existingReports,
    isWithinTime,
    phaseLabel,
    reportDate,
    onSuccess,
}: BulkReportFormProps) {
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Initialize rows based on rooms and existing reports
    const initialRows = useMemo(() => {
        return rooms.map((room): RowData => {
            const report = existingReports.find((r) => r.room_id === room.id)
            if (report) {
                return {
                    roomId: room.id,
                    roomName: room.name,
                    capacity: report.capacity,
                    absentCount: report.absent_count,
                    porridgeCount: report.porridge_count,
                    vegetarianCount: report.vegetarian_count,
                    saltyCount: report.salty_count,
                    note: report.note || '',
                    status: report.status,
                    isChanged: false,
                }
            } else {
                return {
                    roomId: room.id,
                    roomName: room.name,
                    capacity: room.default_capacity,
                    absentCount: 0,
                    porridgeCount: 0,
                    vegetarianCount: 0,
                    saltyCount: room.default_capacity, // Initial salty count
                    note: '',
                    status: 'unsubmitted',
                    isChanged: false,
                }
            }
        }).sort((a, b) => a.roomName.localeCompare(b.roomName))
    }, [rooms, existingReports])

    const [rows, setRows] = useState<RowData[]>(initialRows)

    const handleInputChange = (roomId: string, field: keyof RowData, value: string | number) => {
        setRows((prevRows) =>
            prevRows.map((row) => {
                if (row.roomId !== roomId) return row

                const updatedRow = { ...row, [field]: value, isChanged: true }
                
                // Recalculate salty count if relevant fields change
                if (['capacity', 'absentCount', 'porridgeCount', 'vegetarianCount'].includes(field)) {
                    updatedRow.saltyCount =
                        Number(updatedRow.capacity) -
                        Number(updatedRow.absentCount) -
                        Number(updatedRow.porridgeCount) -
                        Number(updatedRow.vegetarianCount)
                }

                return updatedRow
            })
        )
    }

    const handleSubmit = async () => {
        setMessage(null)
        
        // Validate
        const hasNegativeSalty = rows.some((r) => r.saltyCount < 0)
        if (hasNegativeSalty) {
            setMessage({ type: 'error', text: 'Có phòng báo suất mặn bị âm. Vui lòng kiểm tra lại!' })
            return
        }

        const changedRows = rows.filter((r) => r.isChanged)
        if (changedRows.length === 0) {
            setMessage({ type: 'success', text: 'Không có dữ liệu mới để cập nhật.' })
            return
        }

        setSubmitting(true)
        try {
            const submitData = changedRows.map(row => ({
                room_id: row.roomId,
                capacity: Number(row.capacity),
                absent_count: Number(row.absentCount),
                porridge_count: Number(row.porridgeCount),
                vegetarian_count: Number(row.vegetarianCount),
                salty_count: Number(row.saltyCount),
                note: row.note,
                report_date: reportDate
            }))

            const result = await submitBulkReports(submitData)
            
            if (result.error) {
                setMessage({ type: 'error', text: result.error })
            } else {
                setMessage({ type: 'success', text: `Đã lưu báo cáo cho ${changedRows.length} phòng thành công!` })
                // Reset isChanged flag for submitted rows
                setRows(prev => prev.map(r => ({...r, isChanged: false, status: r.status === 'unsubmitted' ? 'submitted' : r.status})))
                onSuccess()
            }
        } catch (error: any) {
             setMessage({ type: 'error', text: error.message || 'Có lỗi xảy ra khi gửi dữ liệu.' })
        } finally {
            setSubmitting(false)
        }
    }

    const isDisabled = !isWithinTime || submitting

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
             {/* Phase banner */}
             {phaseLabel && (
                <div className={`p-4 border-b ${isWithinTime
                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                        : 'bg-amber-50 text-amber-800 border-amber-100'
                    }`}>
                    <div className="font-medium text-sm">
                        {isWithinTime ? '📝' : '🔒'} {phaseLabel}
                        {reportDate && <span className="ml-2 opacity-70">— Ngày ăn: {reportDate}</span>}
                    </div>
                </div>
            )}

            {/* Time warning */}
            {!isWithinTime && (
                <div className="bg-amber-50 border-b border-amber-200 p-4">
                    <p className="text-amber-800 text-sm font-medium">
                        ⏰ {phaseLabel || 'Đã hết giờ báo suất'}. Tính năng nhập liệu đã bị khóa.
                    </p>
                </div>
            )}

            {/* Message */}
            {message && (
                <div className={`p-4 border-b text-sm font-medium ${message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-red-50 text-red-700 border-red-100'
                    }`}>
                    {message.text}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3">Phòng</th>
                            <th className="px-3 py-3 w-24 text-center">Sĩ số</th>
                            <th className="px-3 py-3 w-24 text-center">Nghỉ</th>
                            <th className="px-3 py-3 w-24 text-center">Cháo</th>
                            <th className="px-3 py-3 w-24 text-center">Chay</th>
                            <th className="px-3 py-3 w-24 text-center">Mặn</th>
                            <th className="px-4 py-3 min-w-[200px]">Ghi chú</th>
                            <th className="px-4 py-3 text-center">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {rows.map((row) => {
                            const hasError = row.saltyCount < 0
                            
                            const statusColor = {
                                unsubmitted: 'bg-gray-100 text-gray-600',
                                draft: 'bg-gray-100 text-gray-600',
                                submitted: 'bg-blue-100 text-blue-700',
                                room_approved: 'bg-emerald-100 text-emerald-700',
                                school_approved: 'bg-emerald-100 text-emerald-700',
                                rejected: 'bg-red-100 text-red-700'
                            }[row.status] || 'bg-gray-100'

                            const statusLabel = {
                                unsubmitted: 'Chưa nhập',
                                draft: 'Nháp',
                                submitted: 'Đã gửi',
                                room_approved: 'Đã duyệt',
                                school_approved: 'Đã duyệt',
                                rejected: 'Từ chối'
                            }[row.status] || ''

                            // Disabled if out of time, or if already approved (maybe allow re-submit if not strictly locked by role, but usually locked once approved)
                            const isRowDisabled = isDisabled || row.status === 'school_approved' || row.status === 'room_approved'

                            return (
                            <tr key={row.roomId} className={`hover:bg-blue-50/50 transition-colors ${row.isChanged ? 'bg-blue-50/30' : ''}`}>
                                <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
                                    {row.roomName}
                                    {row.isChanged && <span className="ml-1 text-[10px] text-blue-500 font-bold" title="Chưa lưu">*</span>}
                                </td>
                                <td className="px-2 py-2">
                                    <input
                                        type="number"
                                        min={0}
                                        value={row.capacity}
                                        onChange={(e) => handleInputChange(row.roomId, 'capacity', parseInt(e.target.value) || 0)}
                                        disabled={isRowDisabled}
                                        className="w-full px-2 py-1.5 text-center border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <input
                                        type="number"
                                        min={0}
                                        value={row.absentCount}
                                        onChange={(e) => handleInputChange(row.roomId, 'absentCount', parseInt(e.target.value) || 0)}
                                        disabled={isRowDisabled}
                                        className="w-full px-2 py-1.5 text-center border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <input
                                        type="number"
                                        min={0}
                                        value={row.porridgeCount}
                                        onChange={(e) => handleInputChange(row.roomId, 'porridgeCount', parseInt(e.target.value) || 0)}
                                        disabled={isRowDisabled}
                                        className="w-full px-2 py-1.5 text-center border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <input
                                        type="number"
                                        min={0}
                                        value={row.vegetarianCount}
                                        onChange={(e) => handleInputChange(row.roomId, 'vegetarianCount', parseInt(e.target.value) || 0)}
                                        disabled={isRowDisabled}
                                        className="w-full px-2 py-1.5 text-center border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                                    />
                                </td>
                                <td className="px-2 py-2 text-center">
                                    <span className={`font-semibold inline-block w-full py-1.5 rounded-md ${hasError ? 'bg-red-100 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
                                        {row.saltyCount}
                                    </span>
                                </td>
                                <td className="px-2 py-2">
                                    <input
                                        type="text"
                                        value={row.note}
                                        onChange={(e) => handleInputChange(row.roomId, 'note', e.target.value)}
                                        disabled={isRowDisabled}
                                        placeholder="Ghi chú..."
                                        className="w-full px-3 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400 text-sm"
                                    />
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColor}`}>
                                        {statusLabel}
                                    </span>
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 text-right">
                <button
                    onClick={handleSubmit}
                    disabled={isDisabled || submitting || rows.filter(r => r.isChanged).length === 0}
                    className="py-2.5 px-6 bg-gradient-to-r from-blue-500 to-emerald-500
                    text-white font-semibold rounded-lg shadow-sm
                    hover:from-blue-600 hover:to-emerald-600
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200"
                >
                    {submitting ? 'Đang gửi...' : `📤 Gửi báo cáo hàng loạt (${rows.filter(r => r.isChanged).length} thay đổi)`}
                </button>
            </div>
        </div>
    )
}
