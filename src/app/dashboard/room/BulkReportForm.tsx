'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { submitBulkReports } from './bulk-actions'

interface RoomData {
    id: string
    name: string
    default_capacity: number
    teacherName?: string
    groupName?: string
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
    teacherName: string
    groupName: string
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
    const [filterGroup, setFilterGroup] = useState<string>('all')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // groups list for filter
    const uniqueGroups = useMemo(() => {
        const groupsList = rooms.map(r => r.groupName || 'Chưa xếp nhóm')
        return Array.from(new Set(groupsList)).sort()
    }, [rooms])

    // Initialize rows based on rooms and existing reports
    const initialRows = useMemo(() => {
        return rooms.map((room): RowData => {
            const report = existingReports.find((r) => r.room_id === room.id)
            if (report) {
                return {
                    roomId: room.id,
                    roomName: room.name,
                    teacherName: room.teacherName || '',
                    groupName: room.groupName || 'Chưa xếp nhóm',
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
                    teacherName: room.teacherName || '',
                    groupName: room.groupName || 'Chưa xếp nhóm',
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

    const filteredRows = useMemo(() => {
        if (filterGroup === 'all') return rows
        return rows.filter(r => r.groupName === filterGroup)
    }, [rows, filterGroup])

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

    const toggleSelect = useCallback((roomId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(roomId)) next.delete(roomId)
            else next.add(roomId)
            return next
        })
    }, [])

    const toggleSelectAll = useCallback(() => {
        if (selectedIds.size === filteredRows.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredRows.map(r => r.roomId)))
        }
    }, [selectedIds.size, filteredRows])

    const autoSelectUnsubmitted = useCallback(() => {
        const unsubmitted = rows.filter(r => r.status === 'unsubmitted' || r.status === 'draft').map(r => r.roomId)
        setSelectedIds(new Set(unsubmitted))
        setMessage({ type: 'success', text: `Đã chọn ${unsubmitted.length} phòng chưa có báo cáo hoặc đang nháp.` })
    }, [rows])

    const handleSubmit = async () => {
        setMessage(null)
        
        // Validate
        const selectedRows = rows.filter(r => selectedIds.has(r.roomId))
        const hasNegativeSalty = selectedRows.some((r) => r.saltyCount < 0)
        if (hasNegativeSalty) {
            setMessage({ type: 'error', text: 'Có phòng trong các mục đã chọn báo suất mặn bị âm. Vui lòng kiểm tra lại!' })
            return
        }

        const changedSelectedRows = selectedRows.filter((r) => r.isChanged || r.status === 'unsubmitted')
        if (changedSelectedRows.length === 0) {
            setMessage({ type: 'success', text: 'Vui lòng chỉnh sửa dữ liệu các phòng đã chọn trước khi lưu.' })
            return
        }

        setSubmitting(true)
        try {
            const submitData = changedSelectedRows.map(row => ({
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
                setMessage({ type: 'success', text: `Đã lưu báo cáo cho ${changedSelectedRows.length} phòng thành công!` })
                // Reset isChanged flag for submitted rows
                setRows(prev => prev.map(r => {
                    if (selectedIds.has(r.roomId)) {
                        return {...r, isChanged: false, status: r.status === 'unsubmitted' ? 'submitted' : r.status}
                    }
                    return r
                }))
                setSelectedIds(new Set())
                onSuccess()
            }
        } catch (error: any) {
             setMessage({ type: 'error', text: error.message || 'Có lỗi xảy ra khi gửi dữ liệu.' })
        } finally {
            setSubmitting(false)
        }
    }

    const isDisabled = !isWithinTime || submitting
    const totalChanged = rows.filter(r => r.isChanged).length
    const hasInvalidSalty = rows.some((r) => r.saltyCount < 0)

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col max-h-[85vh]">
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

            {/* Header controls: Filter and Submit */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Lọc theo nhóm:</label>
                    <select
                        value={filterGroup}
                        onChange={e => setFilterGroup(e.target.value)}
                        className="px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-sm outline-none focus:border-blue-500 min-w-[150px]"
                    >
                        <option value="all">Tất cả các nhóm</option>
                        {uniqueGroups.map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={autoSelectUnsubmitted}
                        disabled={isDisabled}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        🔄 Cập nhật (Chọn phòng chưa báo)
                    </button>
                    <div className="text-sm font-medium text-gray-600 ml-2">
                        Đã chọn: <span className="text-blue-600 font-bold">{selectedIds.size}</span>
                        {totalChanged > 0 && <span> · Thay đổi: <span className="text-amber-600 font-bold">{totalChanged}</span></span>}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto flex-1 relative">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600 font-medium sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-4 py-3 border-b border-gray-200 text-center w-12">
                                <input
                                    type="checkbox"
                                    checked={filteredRows.length > 0 && selectedIds.size === filteredRows.length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                            </th>
                            <th className="px-4 py-3 border-b border-gray-200 text-center">Trạng thái</th>
                            <th className="px-4 py-3 border-b border-gray-200">Phòng</th>
                            <th className="px-4 py-3 min-w-[140px] border-b border-gray-200">Giáo viên</th>
                            <th className="px-3 py-3 w-28 text-center border-b border-gray-200">Sĩ số</th>
                            <th className="px-3 py-3 w-28 text-center border-b border-gray-200">Nghỉ</th>
                            <th className="px-3 py-3 w-28 text-center border-b border-gray-200">Cháo</th>
                            <th className="px-3 py-3 w-28 text-center border-b border-gray-200">Chay</th>
                            <th className="px-3 py-3 w-28 text-center border-b border-gray-200">Mặn</th>
                            <th className="px-3 py-3 min-w-[200px] border-b border-gray-200">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredRows.map((row) => {
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

                            // Admins are not disabled unless time is strictly up, but even then, admin can override if we relax it.
                            // For bulk view, we allow editing if the room is SELECTED.
                            const isSelected = selectedIds.has(row.roomId)
                            const isRowDisabled = isDisabled || !isSelected

                            return (
                            <tr key={row.roomId} className={`hover:bg-blue-50/50 transition-colors ${row.isChanged ? 'bg-amber-50' : isSelected ? 'bg-blue-50/30' : 'odd:bg-white even:bg-gray-50'}`}>
                                <td className="px-4 py-3 text-center border-r border-gray-100">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelect(row.roomId)}
                                        disabled={isDisabled}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </td>
                                <td className="px-4 py-3 text-center border-r border-gray-100 min-w-[100px]">
                                    {row.isChanged ? (
                                        <div className="flex flex-col items-center justify-center">
                                            <span title="Chưa lưu thay đổi">⚠️</span>
                                            <span className="text-[10px] text-amber-600 mt-1 font-medium">Chưa lưu</span>
                                        </div>
                                    ) : row.status !== 'unsubmitted' ? (
                                        <div className="flex flex-col items-center justify-center">
                                            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${statusColor}`}>
                                                {statusLabel}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 text-xs">Trống</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                                    <div className="flex flex-col">
                                        <span>{row.roomName}</span>
                                        <span className="text-xs text-gray-400 font-normal mt-0.5">{row.groupName}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                    {row.teacherName || <span className="italic opacity-50">Chưa xếp</span>}
                                </td>
                                <td className="px-2 py-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={row.capacity || ''}
                                        onChange={(e) => handleInputChange(row.roomId, 'capacity', parseInt(e.target.value) || 0)}
                                        disabled={isRowDisabled}
                                        className="w-full min-w-[64px] px-2 py-1.5 text-center border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={row.absentCount || ''}
                                        onChange={(e) => handleInputChange(row.roomId, 'absentCount', parseInt(e.target.value) || 0)}
                                        disabled={isRowDisabled}
                                        className="w-full min-w-[64px] px-2 py-1.5 text-center border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={row.porridgeCount || ''}
                                        onChange={(e) => handleInputChange(row.roomId, 'porridgeCount', parseInt(e.target.value) || 0)}
                                        disabled={isRowDisabled}
                                        className="w-full min-w-[64px] px-2 py-1.5 text-center border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={row.vegetarianCount || ''}
                                        onChange={(e) => handleInputChange(row.roomId, 'vegetarianCount', parseInt(e.target.value) || 0)}
                                        disabled={isRowDisabled}
                                        className="w-full min-w-[64px] px-2 py-1.5 text-center border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
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
                            </tr>
                        )})}
                        {filteredRows.length === 0 && (
                            <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                                    Không có dữ liệu phòng phù hợp.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 text-right shrink-0">
                <button
                    onClick={handleSubmit}
                    disabled={isDisabled || hasInvalidSalty || selectedIds.size === 0}
                    className={`py-2.5 px-8 font-bold rounded-xl shadow-lg transition-all duration-300 ${
                        isDisabled || hasInvalidSalty || selectedIds.size === 0
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-emerald-200 active:scale-95'
                    }`}
                >
                    {submitting ? '⏳ Đang lưu...' : `💾 Lưu ${selectedIds.size} phòng đã chọn`}
                </button>
            </div>
        </div>
    )
}
