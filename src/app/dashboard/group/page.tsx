'use client'

import { useState, useEffect, useCallback } from 'react'
import { getGroupReports, approveReport, rejectReport, approveAll } from './actions'

interface ClassWithReport {
    id: string
    name: string
    default_capacity: number
    room_id: string
    rooms: { name: string; groups: { name: string } | null } | null
    report: {
        id: string
        capacity: number
        absent_count: number
        porridge_count: number
        vegetarian_count: number
        salty_count: number
        status: string
        note: string | null
        created_at: string
    } | null
}

const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: 'Nháp', color: 'bg-gray-100 text-gray-600' },
    submitted: { label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-700' },
    room_approved: { label: 'Đã duyệt phòng', color: 'bg-blue-100 text-blue-700' },
    school_approved: { label: 'Trường đã duyệt', color: 'bg-emerald-100 text-emerald-700' },
    rejected: { label: 'Từ chối', color: 'bg-red-100 text-red-700' },
}

export default function GroupPage() {
    const [classes, setClasses] = useState<ClassWithReport[]>([])
    const [today, setToday] = useState('')
    const [roomName, setRoomName] = useState('')
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const loadData = useCallback(async () => {
        const data = await getGroupReports()
        if ('error' in data && data.error) return
        setClasses((data.classes || []) as ClassWithReport[])
        setToday(data.today as string)
        setRoomName((data.roomName as string) || '')
        setLoading(false)
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    async function handleApprove(reportId: string) {
        setActionLoading(reportId)
        await approveReport(reportId)
        await loadData()
        setActionLoading(null)
    }

    async function handleReject(reportId: string) {
        setActionLoading(reportId)
        await rejectReport(reportId)
        await loadData()
        setActionLoading(null)
    }

    async function handleApproveAll() {
        setActionLoading('all')
        await approveAll()
        await loadData()
        setActionLoading(null)
    }

    const pendingCount = classes.filter(c => c.report?.status === 'submitted').length
    const reportedCount = classes.filter(c => c.report).length

    // Check school approval status
    const schoolApprovedCount = classes.filter(c => c.report?.status === 'school_approved').length
    const roomApprovedCount = classes.filter(c => c.report?.status === 'room_approved').length

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        👥 Duyệt suất ăn — Phòng {roomName}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Ngày: <span className="font-semibold">{today}</span>
                        {' · '}Đã báo: <span className="font-semibold text-blue-600">{reportedCount}/{classes.length}</span>
                        {' · '}Chờ duyệt: <span className="font-semibold text-amber-600">{pendingCount}</span>
                    </p>
                    {/* Show school approval status */}
                    <div className="flex gap-2 mt-2">
                        {roomApprovedCount > 0 && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                ✅ Đã duyệt phòng: {roomApprovedCount}
                            </span>
                        )}
                        {schoolApprovedCount > 0 && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                🏫 Cấp trường: Đã duyệt ({schoolApprovedCount})
                            </span>
                        )}
                        {reportedCount > 0 && schoolApprovedCount === 0 && roomApprovedCount === 0 && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                🏫 Cấp trường: Chưa duyệt
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    {pendingCount > 0 && (
                        <button
                            onClick={handleApproveAll}
                            disabled={actionLoading === 'all'}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white 
              font-semibold rounded-xl shadow-md hover:from-emerald-600 hover:to-teal-600
              disabled:opacity-50 transition-all duration-200 text-sm
              active:scale-[0.98]"
                        >
                            {actionLoading === 'all' ? 'Đang duyệt...' : `✅ Duyệt tất cả (${pendingCount})`}
                        </button>
                    )}
                    <button
                        onClick={() => window.print()}
                        className="px-4 py-2.5 bg-gray-600 text-white rounded-xl text-sm font-semibold
              hover:bg-gray-700 shadow-md transition-all active:scale-[0.98]"
                    >
                        🖨️ In
                    </button>
                </div>
            </div>

            {/* Table - Desktop */}
            <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm" data-print-show>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Lớp</th>
                            <th className="text-center px-3 py-3 font-semibold text-gray-600">Sĩ số</th>
                            <th className="text-center px-3 py-3 font-semibold text-gray-600">Nghỉ</th>
                            <th className="text-center px-3 py-3 font-semibold text-gray-600">🍖 Mặn</th>
                            <th className="text-center px-3 py-3 font-semibold text-gray-600">🥣 Cháo</th>
                            <th className="text-center px-3 py-3 font-semibold text-gray-600">🥬 Chay</th>
                            <th className="text-center px-3 py-3 font-semibold text-gray-600">Trạng thái</th>
                            <th className="text-center px-3 py-3 font-semibold text-gray-600">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {classes.map((cls) => (
                            <tr key={cls.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                                <td className="px-4 py-3 font-medium text-gray-800">{cls.name}</td>
                                {cls.report ? (
                                    <>
                                        <td className="text-center px-3 py-3">{cls.report.capacity}</td>
                                        <td className="text-center px-3 py-3 text-red-600">{cls.report.absent_count}</td>
                                        <td className="text-center px-3 py-3 font-semibold text-blue-700">{cls.report.salty_count}</td>
                                        <td className="text-center px-3 py-3">{cls.report.porridge_count}</td>
                                        <td className="text-center px-3 py-3">{cls.report.vegetarian_count}</td>
                                        <td className="text-center px-3 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusConfig[cls.report.status]?.color}`}>
                                                {statusConfig[cls.report.status]?.label}
                                            </span>
                                        </td>
                                        <td className="text-center px-3 py-3">
                                            {cls.report.status === 'submitted' && (
                                                <div className="flex gap-1.5 justify-center">
                                                    <button
                                                        onClick={() => handleApprove(cls.report!.id)}
                                                        disabled={actionLoading === cls.report!.id}
                                                        className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium
                              hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                                    >
                                                        Duyệt
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(cls.report!.id)}
                                                        disabled={actionLoading === cls.report!.id}
                                                        className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-medium
                              hover:bg-red-100 transition-colors disabled:opacity-50"
                                                    >
                                                        Từ chối
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </>
                                ) : (
                                    <td colSpan={7} className="text-center px-3 py-3 text-gray-400 italic">
                                        Chưa báo suất
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Cards - Mobile */}
            <div className="sm:hidden space-y-3" data-print-hide>
                {classes.map((cls) => (
                    <div key={cls.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-800">{cls.name}</h3>
                            {cls.report && (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusConfig[cls.report.status]?.color}`}>
                                    {statusConfig[cls.report.status]?.label}
                                </span>
                            )}
                        </div>
                        {cls.report ? (
                            <>
                                <div className="grid grid-cols-4 gap-2 text-center mb-3">
                                    <div>
                                        <p className="text-xs text-gray-400">Sĩ số</p>
                                        <p className="font-semibold">{cls.report.capacity}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">🍖 Mặn</p>
                                        <p className="font-semibold text-blue-700">{cls.report.salty_count}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">🥣 Cháo</p>
                                        <p className="font-semibold">{cls.report.porridge_count}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">🥬 Chay</p>
                                        <p className="font-semibold">{cls.report.vegetarian_count}</p>
                                    </div>
                                </div>
                                {cls.report.status === 'submitted' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(cls.report!.id)}
                                            disabled={actionLoading === cls.report!.id}
                                            className="flex-1 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium
                        hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                        >
                                            ✅ Duyệt
                                        </button>
                                        <button
                                            onClick={() => handleReject(cls.report!.id)}
                                            disabled={actionLoading === cls.report!.id}
                                            className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium
                        hover:bg-red-100 transition-colors disabled:opacity-50"
                                        >
                                            ❌ Từ chối
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-sm text-gray-400 italic">Chưa báo suất</p>
                        )}
                    </div>
                ))}
            </div>

            {classes.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                    <p className="text-4xl mb-3">📋</p>
                    <p>Chưa có lớp nào trong phòng</p>
                </div>
            )}
        </div>
    )
}
