'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTeacherMealReport, upsertTeacherMealReport } from '../kitchen/teacher-actions'

export function TeacherReportForm({ reportDate, isWithinTime, phaseLabel }: { reportDate: string, isWithinTime: boolean, phaseLabel: string }) {
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const [salty, setSalty] = useState(0)
    const [porridge, setPorridge] = useState(0)
    const [vegetarian, setVegetarian] = useState(0)
    const [note, setNote] = useState('')
    const [exists, setExists] = useState(false)

    const loadData = useCallback(async () => {
        setLoading(true)
        if (reportDate) {
            const { report, error } = await getTeacherMealReport(reportDate)
            if (error) {
                console.error(error)
            } else if (report) {
                setSalty(report.salty_count)
                setPorridge(report.porridge_count)
                setVegetarian(report.vegetarian_count)
                setNote(report.note || '')
                setExists(true)
            } else {
                setSalty(0)
                setPorridge(0)
                setVegetarian(0)
                setNote('')
                setExists(false)
            }
        }
        setLoading(false)
    }, [reportDate])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        setMessage(null)

        const result = await upsertTeacherMealReport(reportDate, {
            salty_count: salty,
            porridge_count: porridge,
            vegetarian_count: vegetarian,
            note: note
        })

        if (result.error) {
            setMessage({ type: 'error', text: result.error })
        } else {
            setMessage({ type: 'success', text: exists ? 'Đã cập nhật báo cáo suất Giáo viên!' : 'Đã lưu báo cáo suất Giáo viên!' })
            loadData()
        }
        setSubmitting(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    const isDisabled = !isWithinTime

    return (
        <div className="max-w-lg mx-auto">
            {/* Phase banner */}
            {phaseLabel && (
                <div className={`rounded-xl p-3 mb-4 text-sm font-medium border ${isWithinTime
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                    {isWithinTime ? '📝' : '🔒'} {phaseLabel}
                    {reportDate && (
                        <span className="ml-2 opacity-70">
                            — Ngày ăn: {reportDate}
                        </span>
                    )}
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

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-2 border-rose-200 shadow-md p-6 sm:p-8">
                <h3 className="text-xl font-bold text-rose-800 mb-6 flex items-center gap-2">
                    👩‍🏫 {exists ? 'Cập nhật' : 'Nhập'} suất ăn Giáo viên
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">🍖 Suất mặn</label>
                        <input
                            type="number"
                            min={0}
                            value={salty}
                            onChange={e => setSalty(parseInt(e.target.value) || 0)}
                            disabled={isDisabled}
                            className="w-full px-4 py-3 rounded-xl border-2 border-blue-200 text-2xl font-bold text-center text-blue-700
                                focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">🥣 Suất cháo</label>
                        <input
                            type="number"
                            min={0}
                            value={porridge}
                            onChange={e => setPorridge(parseInt(e.target.value) || 0)}
                            disabled={isDisabled}
                            className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 text-2xl font-bold text-center text-amber-700
                                focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">🥬 Suất chay</label>
                        <input
                            type="number"
                            min={0}
                            value={vegetarian}
                            onChange={e => setVegetarian(parseInt(e.target.value) || 0)}
                            disabled={isDisabled}
                            className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 text-2xl font-bold text-center text-emerald-700
                                focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:opacity-50"
                        />
                    </div>
                </div>

                {/* Tổng suất tự động */}
                <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 mb-6 flex items-center justify-between">
                    <span className="text-sm font-bold text-rose-700 uppercase tracking-wider">📊 Tổng suất Giáo viên</span>
                    <span className="text-3xl font-bold text-rose-800">{salty + porridge + vegetarian}</span>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">💬 Ghi chú (nếu có)</label>
                    <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        disabled={isDisabled}
                        placeholder="Ví dụ: 1 suất chay không hành..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none resize-none disabled:opacity-50"
                        rows={2}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isDisabled || submitting}
                    className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700
                        text-white font-bold rounded-xl shadow-lg transition-all duration-200 transform active:scale-[0.98]
                        disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                    {submitting ? 'Đang lưu...' : '💾 Lưu Suất Giáo viên'}
                </button>
            </form>
        </div>
    )
}
