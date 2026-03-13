'use client'

import { useState, useEffect, useCallback } from 'react'
import { submitReport, getRoomData } from './actions'
import { calculateSaltyMeals } from '@/utils/calculations'

interface AbsentStudent {
    name: string
    reason?: string
}

export default function RoomPage() {
    const [room, setRoom] = useState<{ name: string; default_capacity: number } | null>(null)
    const [isWithinTime, setIsWithinTime] = useState(true)
    const [reportDate, setReportDate] = useState('')
    const [phaseLabel, setPhaseLabel] = useState('')
    const [existingReport, setExistingReport] = useState<Record<string, unknown> | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Form state
    const [capacity, setCapacity] = useState(0)
    const [absentCount, setAbsentCount] = useState(0)
    const [porridgeCount, setPorridgeCount] = useState(0)
    const [vegetarianCount, setVegetarianCount] = useState(0)
    const [note, setNote] = useState('')
    const [absentList, setAbsentList] = useState<AbsentStudent[]>([])

    const saltyCount = calculateSaltyMeals(capacity, absentCount, porridgeCount, vegetarianCount)

    const loadData = useCallback(async () => {
        const data = await getRoomData()
        if ('error' in data && data.error) {
            setMessage({ type: 'error', text: data.error as string })
            setLoading(false)
            return
        }

        if (data.room) {
            setRoom(data.room as { name: string; default_capacity: number })
            setCapacity((data.room as { default_capacity: number }).default_capacity || 0)
        }
        setIsWithinTime(data.isWithinTime as boolean)
        setReportDate((data.reportDate as string) || '')
        setPhaseLabel((data.phaseLabel as string) || '')

        if (data.report) {
            const r = data.report as Record<string, unknown>
            setExistingReport(r)
            setCapacity(r.capacity as number)
            setAbsentCount(r.absent_count as number)
            setPorridgeCount(r.porridge_count as number)
            setVegetarianCount(r.vegetarian_count as number)
            setNote((r.note as string) || '')
            setAbsentList((r.absent_list as AbsentStudent[]) || [])
        }

        setLoading(false)
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (saltyCount < 0) {
            setMessage({ type: 'error', text: 'Số suất mặn không thể âm!' })
            return
        }

        setSubmitting(true)
        setMessage(null)

        const formData = new FormData()
        formData.set('capacity', capacity.toString())
        formData.set('absent_count', absentCount.toString())
        formData.set('porridge_count', porridgeCount.toString())
        formData.set('vegetarian_count', vegetarianCount.toString())
        formData.set('note', note)
        formData.set('absent_list', JSON.stringify(absentList))
        formData.set('report_date', reportDate)

        const result = await submitReport(formData)
        if (result.error) {
            setMessage({ type: 'error', text: result.error })
        } else {
            setMessage({ type: 'success', text: existingReport ? 'Đã cập nhật báo cáo!' : 'Đã gửi báo cáo thành công!' })
            loadData()
        }
        setSubmitting(false)
    }

    function addAbsentStudent() {
        setAbsentList([...absentList, { name: '', reason: '' }])
    }

    function removeAbsentStudent(index: number) {
        setAbsentList(absentList.filter((_, i) => i !== index))
    }

    function updateAbsentStudent(index: number, field: 'name' | 'reason', value: string) {
        const updated = [...absentList]
        updated[index] = { ...updated[index], [field]: value }
        setAbsentList(updated)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    const isDisabled = !isWithinTime
    const statusLabel = existingReport
        ? { draft: 'Nháp', submitted: 'Đã gửi', approved: 'Đã duyệt', rejected: 'Bị từ chối' }[(existingReport.status as string)] || ''
        : null
    const statusColor = existingReport
        ? { draft: 'bg-gray-100 text-gray-600', submitted: 'bg-blue-100 text-blue-700', approved: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700' }[(existingReport.status as string)] || ''
        : ''

    return (
        <div className="max-w-lg mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    🧑‍🏫 Báo suất ăn
                </h2>
                {room && (
                    <p className="text-gray-500 mt-1">
                        Lớp: <span className="font-semibold text-gray-700">{room.name}</span>
                        {'room_name' in room && (room as {room_name?: string}).room_name && (
                            <span> · Phòng: <span className="font-semibold text-gray-700">{String((room as {room_name?: string}).room_name)}</span></span>
                        )}
                        {' · '}Sĩ số: <span className="font-semibold text-gray-700">{room.default_capacity}</span>
                    </p>
                )}
                {existingReport && (
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                        {statusLabel}
                    </span>
                )}
            </div>

            {/* Phase banner */}
            {phaseLabel && (
                <div className={`rounded-xl p-3 mb-4 text-sm font-medium border ${isWithinTime
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                    {isWithinTime ? '📝' : '🔒'} {phaseLabel}
                    {reportDate && <span className="ml-2 opacity-70">— Ngày ăn: {reportDate}</span>}
                </div>
            )}

            {/* Time warning */}
            {isDisabled && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                    <p className="text-amber-800 text-sm font-medium">
                        ⏰ {phaseLabel || 'Đã hết giờ báo suất'}. Liên hệ Admin để ghi đè.
                    </p>
                </div>
            )}

            {/* Message */}
            {message && (
                <div className={`rounded-xl p-4 mb-4 text-sm font-medium border ${message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Sĩ số */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <label className="block text-sm font-medium text-gray-600 mb-2">Sĩ số hiện tại</label>
                    <input
                        type="number"
                        min={0}
                        value={capacity}
                        onChange={e => setCapacity(parseInt(e.target.value) || 0)}
                        disabled={isDisabled}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg font-semibold text-center
              focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none
              disabled:bg-gray-50 disabled:text-gray-400"
                    />
                </div>

                {/* Nghỉ / Cháo / Chay */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <label className="block text-xs font-medium text-gray-500 mb-2 text-center">🚫 Nghỉ học</label>
                        <input
                            type="number"
                            min={0}
                            max={capacity}
                            value={absentCount}
                            onChange={e => setAbsentCount(parseInt(e.target.value) || 0)}
                            disabled={isDisabled}
                            className="w-full px-2 py-2.5 rounded-lg border border-gray-200 text-lg font-semibold text-center
                focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none
                disabled:bg-gray-50 disabled:text-gray-400"
                        />
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <label className="block text-xs font-medium text-gray-500 mb-2 text-center">🥣 Cháo</label>
                        <input
                            type="number"
                            min={0}
                            value={porridgeCount}
                            onChange={e => setPorridgeCount(parseInt(e.target.value) || 0)}
                            disabled={isDisabled}
                            className="w-full px-2 py-2.5 rounded-lg border border-gray-200 text-lg font-semibold text-center
                focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none
                disabled:bg-gray-50 disabled:text-gray-400"
                        />
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <label className="block text-xs font-medium text-gray-500 mb-2 text-center">🥬 Chay</label>
                        <input
                            type="number"
                            min={0}
                            value={vegetarianCount}
                            onChange={e => setVegetarianCount(parseInt(e.target.value) || 0)}
                            disabled={isDisabled}
                            className="w-full px-2 py-2.5 rounded-lg border border-gray-200 text-lg font-semibold text-center
                focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none
                disabled:bg-gray-50 disabled:text-gray-400"
                        />
                    </div>
                </div>

                {/* Suất mặn (tính tự động) */}
                <div className={`rounded-xl p-4 border-2 ${saltyCount < 0 ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-200'
                    }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">🍖 Suất mặn (tự động)</span>
                        <span className={`text-2xl font-bold ${saltyCount < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                            {saltyCount}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                        = {capacity} - {absentCount} - {porridgeCount} - {vegetarianCount}
                    </p>
                    {saltyCount < 0 && (
                        <p className="text-xs text-red-500 mt-1 font-medium">⚠️ Số suất mặn không thể âm!</p>
                    )}
                </div>

                {/* Danh sách nghỉ (không bắt buộc) */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-600">
                            📝 Danh sách nghỉ <span className="text-gray-400 font-normal">(không bắt buộc)</span>
                        </label>
                        <button
                            type="button"
                            onClick={addAbsentStudent}
                            disabled={isDisabled}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                        >
                            + Thêm
                        </button>
                    </div>
                    {absentList.length > 0 ? (
                        <div className="space-y-2">
                            {absentList.map((student, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                    <input
                                        type="text"
                                        placeholder="Họ tên"
                                        value={student.name}
                                        onChange={e => updateAbsentStudent(i, 'name', e.target.value)}
                                        disabled={isDisabled}
                                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm
                      focus:border-blue-500 outline-none disabled:bg-gray-50"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Lý do"
                                        value={student.reason || ''}
                                        onChange={e => updateAbsentStudent(i, 'reason', e.target.value)}
                                        disabled={isDisabled}
                                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm
                      focus:border-blue-500 outline-none disabled:bg-gray-50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeAbsentStudent(i)}
                                        disabled={isDisabled}
                                        className="p-2 text-red-400 hover:text-red-600 disabled:text-gray-300"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 italic">Chưa có học sinh nghỉ</p>
                    )}
                </div>

                {/* Ghi chú */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <label className="block text-sm font-medium text-gray-600 mb-2">💬 Ghi chú</label>
                    <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        disabled={isDisabled}
                        placeholder="Ghi chú thêm (nếu có)..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm
              focus:border-blue-500 outline-none resize-none
              disabled:bg-gray-50 disabled:text-gray-400"
                    />
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={isDisabled || submitting || saltyCount < 0}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-500 to-emerald-500
            text-white font-semibold rounded-xl shadow-md
            hover:from-blue-600 hover:to-emerald-600
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 transform active:scale-[0.98]"
                >
                    {submitting ? 'Đang gửi...' : existingReport ? '📤 Cập nhật báo cáo' : '📤 Gửi báo cáo'}
                </button>
            </form>
        </div>
    )
}
