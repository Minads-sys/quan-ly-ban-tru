'use client'

import { useState, useCallback, useMemo } from 'react'
import { submitBulkReports } from './bulk-actions'

interface RoomData {
    id: string
    name: string
    default_capacity: number
    teacherName?: string
    groupName?: string
}

interface Moc1Snapshot {
    capacity: number
    absent_count: number
    salty_count: number
    porridge_count: number
    vegetarian_count: number
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
    moc1_snapshot?: Moc1Snapshot | null
}

interface BulkReportFormProps {
    rooms: RoomData[]
    existingReports: ReportData[]
    isWithinTime: boolean
    phaseLabel: string
    reportDate: string
    phase: string
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
    isEditing: boolean
    // Mốc 1 snapshot for diff
    moc1Snapshot: Moc1Snapshot | null
}

export function BulkReportForm({
    rooms,
    existingReports,
    isWithinTime,
    phaseLabel,
    reportDate,
    phase,
    onSuccess,
}: BulkReportFormProps) {
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [filterGroup, setFilterGroup] = useState<string>('all')
    const [showConfirmPopup, setShowConfirmPopup] = useState(false)

    const isMoc2 = phase === 'moc2'

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
                    isEditing: false,
                    moc1Snapshot: report.moc1_snapshot || {
                        capacity: report.capacity,
                        absent_count: report.absent_count,
                        salty_count: report.salty_count,
                        porridge_count: report.porridge_count,
                        vegetarian_count: report.vegetarian_count,
                    },
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
                    saltyCount: room.default_capacity,
                    note: '',
                    status: 'unsubmitted',
                    isChanged: false,
                    isEditing: false,
                    moc1Snapshot: null,
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



    // ---- Mốc 2 mode: per-row edit
    const toggleRowEdit = (roomId: string) => {
        setRows(prev => prev.map(row => {
            if (row.roomId !== roomId) return row
            return { ...row, isEditing: !row.isEditing }
        }))
    }

    const saveRowEdit = (roomId: string) => {
        setRows(prev => prev.map(row => {
            if (row.roomId !== roomId) return row
            return { ...row, isEditing: false }
        }))
    }

    // Changed rows (for Mốc 2 confirmation popup)
    const changedRows = useMemo(() => rows.filter(r => r.isChanged), [rows])

    // Submit handler — works for both phases
    const handleSubmit = async () => {
        setMessage(null)

        const rowsToSubmit = changedRows

        if (rowsToSubmit.length === 0) {
            setMessage({ type: 'success', text: 'Không có thay đổi nào để lưu.' })
            return
        }

        // Validate salty
        const hasNegativeSalty = rowsToSubmit.some((r) => r.saltyCount < 0)
        if (hasNegativeSalty) {
            setMessage({ type: 'error', text: 'Có phòng báo suất mặn bị âm. Vui lòng kiểm tra lại!' })
            return
        }

        setSubmitting(true)
        try {
            const submitData = rowsToSubmit.map(row => ({
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
                setMessage({ type: 'success', text: `Đã lưu báo cáo cho ${rowsToSubmit.length} phòng thành công!` })
                setRows(prev => prev.map(r => {
                    const wasSubmitted = rowsToSubmit.some(s => s.roomId === r.roomId)
                    if (wasSubmitted) {
                        return { ...r, isChanged: false, isEditing: false, status: r.status === 'unsubmitted' ? 'submitted' : r.status }
                    }
                    return r
                }))
                setShowConfirmPopup(false)
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
                        ? isMoc2 ? 'bg-amber-50 text-amber-800 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}>
                    <div className="font-medium text-sm">
                        {isWithinTime ? (isMoc2 ? '✏️' : '📝') : '🔒'} {phaseLabel}
                        {reportDate && <span className="ml-2 opacity-70">— Ngày ăn: {reportDate}</span>}
                    </div>
                    {isMoc2 && isWithinTime && (
                        <p className="text-xs mt-1 opacity-70">
                            Bấm "Sửa" ở từng dòng phòng cần chỉnh → sửa số liệu → bấm "Xác nhận điều chỉnh" để xem tổng hợp thay đổi.
                        </p>
                    )}
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

            {/* Header controls */}
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
                    {/* Mốc 2: confirm button */}
                    {isMoc2 && isWithinTime && (
                        <button
                            onClick={() => setShowConfirmPopup(true)}
                            disabled={totalChanged === 0 || submitting}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 ${
                                totalChanged === 0
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-amber-500 text-white hover:bg-amber-600'
                            }`}
                        >
                            📋 Xác nhận điều chỉnh ({totalChanged})
                        </button>
                    )}

                    {totalChanged > 0 && (
                        <div className="text-sm font-medium text-gray-600 ml-2">
                            Thay đổi: <span className="text-amber-600 font-bold">{totalChanged}</span> phòng
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto flex-1 relative">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600 font-medium sticky top-0 z-10 shadow-sm">
                        <tr>
                            {/* Action column for Mốc 2 */}
                            {isMoc2 && isWithinTime && (
                                <th className="px-3 py-3 border-b border-gray-200 text-center w-20">Thao tác</th>
                            )}
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

                            // Mốc 1: always editable; Mốc 2: editable only if isEditing
                            let isRowDisabled: boolean
                            if (isMoc2) {
                                isRowDisabled = !row.isEditing || isDisabled
                            } else {
                                isRowDisabled = isDisabled
                            }

                            const rowBg = row.isChanged 
                                ? 'bg-amber-50 border-l-4 border-l-amber-400' 
                                : row.isEditing 
                                    ? 'bg-blue-50/40' 
                                    : 'odd:bg-white even:bg-gray-50'

                            return (
                            <tr key={row.roomId} className={`hover:bg-blue-50/50 transition-colors ${rowBg}`}>
                                {/* Mốc 2: edit/save button */}
                                {isMoc2 && isWithinTime && (
                                    <td className="px-2 py-2 text-center border-r border-gray-100">
                                        {row.isEditing ? (
                                            <button
                                                onClick={() => saveRowEdit(row.roomId)}
                                                className="px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors"
                                            >
                                                💾 Lưu
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => toggleRowEdit(row.roomId)}
                                                disabled={isDisabled}
                                                className="px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-200 disabled:opacity-50"
                                            >
                                                ✏️ Sửa
                                            </button>
                                        )}
                                    </td>
                                )}
                                <td className="px-4 py-3 text-center border-r border-gray-100 min-w-[100px]">
                                    {row.isChanged ? (
                                        <div className="flex flex-col items-center justify-center">
                                            <span title="Chưa lưu thay đổi">⚠️</span>
                                            <span className="text-[10px] text-amber-600 mt-1 font-medium">Đã chỉnh</span>
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
                                <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                                    Không có dữ liệu phòng phù hợp.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Footer — Mốc 1: submit all changed rows */}
            {!isMoc2 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50 text-right shrink-0">
                    <button
                        onClick={handleSubmit}
                        disabled={isDisabled || hasInvalidSalty || totalChanged === 0}
                        className={`py-2.5 px-8 font-bold rounded-xl shadow-lg transition-all duration-300 ${
                            isDisabled || hasInvalidSalty || totalChanged === 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-emerald-200 active:scale-95'
                        }`}
                    >
                        {submitting ? '⏳ Đang lưu...' : `💾 Lưu ${totalChanged} phòng đã thay đổi`}
                    </button>
                </div>
            )}

            {/* ======================== CONFIRMATION POPUP (Mốc 2) ======================== */}
            {showConfirmPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col overflow-hidden">
                        {/* Popup header */}
                        <div className="p-5 border-b border-gray-200 bg-amber-50">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                📋 Duyệt điều chỉnh Mốc 2
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Có <span className="font-bold text-amber-600">{changedRows.length}</span> phòng đã chỉnh sửa. Kiểm tra lại trước khi lưu.
                            </p>
                        </div>

                        {/* Popup body */}
                        <div className="overflow-y-auto flex-1 p-4 space-y-3">
                            {changedRows.map(row => {
                                const snap = row.moc1Snapshot
                                const fields: { label: string; field: string; old: number; new_: number }[] = [
                                    { label: 'Sĩ số', field: 'capacity', old: snap?.capacity ?? 0, new_: row.capacity },
                                    { label: 'Nghỉ', field: 'absent', old: snap?.absent_count ?? 0, new_: row.absentCount },
                                    { label: 'Cháo', field: 'porridge', old: snap?.porridge_count ?? 0, new_: row.porridgeCount },
                                    { label: 'Chay', field: 'vegetarian', old: snap?.vegetarian_count ?? 0, new_: row.vegetarianCount },
                                    { label: 'Mặn', field: 'salty', old: snap?.salty_count ?? 0, new_: row.saltyCount },
                                ]
                                const changedFields = fields.filter(f => f.old !== f.new_)

                                return (
                                    <div key={row.roomId} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-gray-800">{row.roomName}</span>
                                            <span className="text-xs text-gray-400">{row.groupName}</span>
                                        </div>
                                        {changedFields.length > 0 ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {changedFields.map(f => (
                                                    <div key={f.field} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                                                        <span className="text-xs text-gray-500">{f.label}</span>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-sm text-red-500 line-through">{f.old}</span>
                                                            <span className="text-gray-400">→</span>
                                                            <span className="text-sm font-bold text-emerald-600">{f.new_}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic">Ghi chú thay đổi</p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Popup footer */}
                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3 shrink-0">
                            <button
                                onClick={() => setShowConfirmPopup(false)}
                                className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-300 transition-all"
                            >
                                ← Thoát (sửa thêm)
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-md transition-all disabled:opacity-50 active:scale-95"
                            >
                                {submitting ? '⏳ Đang lưu...' : `✅ Lưu lại (${changedRows.length} phòng)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
