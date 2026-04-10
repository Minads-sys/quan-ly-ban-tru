'use client'

import { useState, useEffect, useCallback } from 'react'
import { getGroupReports, approveReport, rejectReport, approveAll } from './actions'
import { getDayOfWeek } from '@/utils/dateUtils'

interface ClassWithReport {
    id: string
    name: string
    default_capacity: number
    room_id: string
    teacherName?: string
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
    const [selectedDate, setSelectedDate] = useState('')
    const [roomName, setRoomName] = useState('')
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [schoolInfo, setSchoolInfo] = useState({ name: '', address: '' })
    const [userRole, setUserRole] = useState('')
    const [isMoc1Closed, setIsMoc1Closed] = useState(false)
    const [isMoc2Closed, setIsMoc2Closed] = useState(false)

    const loadData = useCallback(async () => {
        const data = await getGroupReports(selectedDate || undefined)
        if ('error' in data && data.error) return
        setClasses((data.classes || []) as ClassWithReport[])
        setToday(data.today as string)
        setRoomName((data.roomName as string) || '')
        if (data.schoolInfo) setSchoolInfo(data.schoolInfo)
        if (data.userRole) setUserRole(data.userRole as string)
        if (typeof data.isMoc1Closed === 'boolean') setIsMoc1Closed(data.isMoc1Closed)
        if (typeof data.isMoc2Closed === 'boolean') setIsMoc2Closed(data.isMoc2Closed)
        setLoading(false)
    }, [selectedDate])

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
        await approveAll(selectedDate || undefined)
        await loadData()
        setActionLoading(null)
    }

    const pendingCount = classes.filter(c => c.report?.status === 'submitted').length
    const reportedCount = classes.filter(c => c.report).length

    // Check school approval status
    const schoolApprovedCount = classes.filter(c => c.report?.status === 'school_approved').length
    const roomApprovedCount = classes.filter(c => c.report?.status === 'room_approved').length
    const isReadOnly = userRole === 'school_approver'

    // Calculate totals
    const totalCapacity = classes.reduce((sum, cls) => sum + (cls.report?.capacity || 0), 0)
    const totalAbsent = classes.reduce((sum, cls) => sum + (cls.report?.absent_count || 0), 0)
    const totalSalty = classes.reduce((sum, cls) => sum + (cls.report?.salty_count || 0), 0)
    const totalPorridge = classes.reduce((sum, cls) => sum + (cls.report?.porridge_count || 0), 0)
    const totalVegetarian = classes.reduce((sum, cls) => sum + (cls.report?.vegetarian_count || 0), 0)

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div>
            {/* Print Header */}
            <div className="hidden print:block text-center mb-6">
                <h1 className="text-2xl font-bold uppercase">{schoolInfo.name || 'Suất ăn Bán trú'}</h1>
                <p className="text-sm">{schoolInfo.address}</p>
                <div className="h-px bg-gray-300 w-full my-4" />
                <h2 className="text-xl font-bold">BÁO CÁO DUYỆT SUẤT ĂN</h2>
                <p className="text-sm">Phòng: {roomName} | Ngày: {selectedDate || today}</p>
            </div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 print:hidden">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        👥 Duyệt suất ăn — Phòng {roomName} {schoolInfo.name && <span className="text-blue-600">| {schoolInfo.name}</span>}
                    </h2>
                    <div className="flex items-center gap-2 text-sm mt-2 mb-1">
                        <span className="text-gray-600">Ngày:</span>
                        <input 
                            type="date"
                            value={selectedDate || today}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-700 bg-white"
                        />
                        {(selectedDate || today) && (
                            <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 text-xs whitespace-nowrap">
                                📅 {getDayOfWeek(selectedDate || today)}
                            </span>
                        )}
                    </div>
                    <p className="text-gray-600 text-sm mt-1">
                        Đã báo: <span className="font-semibold text-blue-600">{reportedCount}/{classes.length}</span>
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
                        <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 xl:ml-2">
                            <span className={`px-2.5 py-1.5 rounded-full text-xs font-bold uppercase border shadow-sm ${
                                isMoc1Closed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                            }`}>
                                ⏱️ {isMoc1Closed ? 'Đã chốt Mốc 1 đi chợ' : 'Chưa chốt Mốc 1 đi chợ'}
                            </span>
                            <span className={`px-2.5 py-1.5 rounded-full text-xs font-bold uppercase border shadow-sm ${
                                isMoc2Closed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
                            }`}>
                                ⏱️ {isMoc2Closed ? 'Đã chốt Mốc 2 chia suất' : 'Chưa chốt Mốc 2 chia suất'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {pendingCount > 0 && !isReadOnly && (
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
                    {isReadOnly && (
                        <span className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold border border-gray-200">
                            🔒 Chế độ xem
                        </span>
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
            <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm max-h-[70vh] print:max-h-none print:overflow-visible print:border-none print:shadow-none" data-print-show>
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-gray-600 font-medium sticky top-0 z-10 shadow-sm">
                        <tr className="border-b border-gray-200">
                            <th className="text-left px-4 py-3 font-semibold">Phòng</th>
                            <th className="text-left px-4 py-3 font-semibold">Giáo viên</th>
                            <th className="text-center px-3 py-3 font-semibold">Sĩ số<br/><span className="text-xs text-blue-600">{totalCapacity}</span></th>
                            <th className="text-center px-3 py-3 font-semibold">Nghỉ<br/><span className="text-xs text-red-600">{totalAbsent}</span></th>
                            <th className="text-center px-3 py-3 font-semibold">🍖 Mặn<br/><span className="text-xs text-blue-700">{totalSalty}</span></th>
                            <th className="text-center px-3 py-3 font-semibold">🥣 Cháo<br/><span className="text-xs text-amber-600">{totalPorridge}</span></th>
                            <th className="text-center px-3 py-3 font-semibold">🥬 Chay<br/><span className="text-xs text-emerald-600">{totalVegetarian}</span></th>
                            <th className="text-center px-3 py-3 font-semibold">Trạng thái</th>
                            <th className="text-center px-3 py-3 font-semibold">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {classes.map((cls) => (
                            <tr key={cls.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                                <td className="px-4 py-3 font-medium text-gray-800">{cls.name}</td>
                                <td className="px-4 py-3 text-gray-600 text-xs">{cls.teacherName}</td>
                                {cls.report ? (
                                    <>
                                        <td className="text-center px-3 py-3 font-bold text-gray-800">{cls.report.capacity}</td>
                                        <td className="text-center px-3 py-3 text-red-600">{cls.report.absent_count}</td>
                                        <td className="text-center px-3 py-3 font-semibold text-blue-700">{cls.report.salty_count}</td>
                                        <td className="text-center px-3 py-3 font-semibold text-amber-600">{cls.report.porridge_count}</td>
                                        <td className="text-center px-3 py-3 font-semibold text-emerald-600">{cls.report.vegetarian_count}</td>
                                        <td className="text-center px-3 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusConfig[cls.report.status]?.color}`}>
                                                {statusConfig[cls.report.status]?.label}
                                            </span>
                                        </td>
                                        <td className="text-center px-3 py-3">
                                            {cls.report.status === 'submitted' && !isReadOnly && (
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
                                    <td colSpan={8} className="text-center px-3 py-3 text-gray-500 italic">
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
                                        <p className="text-xs text-gray-500">Sĩ số</p>
                                        <p className="font-bold text-gray-800">{cls.report.capacity}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">🍖 Mặn</p>
                                        <p className="font-semibold text-blue-700">{cls.report.salty_count}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">🥣 Cháo</p>
                                        <p className="font-semibold text-amber-600">{cls.report.porridge_count}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">🥬 Chay</p>
                                        <p className="font-semibold text-emerald-600">{cls.report.vegetarian_count}</p>
                                    </div>
                                </div>
                                {cls.report.status === 'submitted' && !isReadOnly && (
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
                            <p className="text-sm text-gray-500 italic">Chưa báo suất</p>
                        )}
                    </div>
                ))}
                {classes.length > 0 && (
                    <div className="bg-gray-50 rounded-xl border-2 border-gray-200 p-4 shadow-sm mt-4">
                        <h3 className="font-bold text-gray-800 mb-3 text-center">Tổng cộng Nhóm</h3>
                        <div className="grid grid-cols-4 gap-2 text-center">
                            <div>
                                <p className="text-xs text-gray-600">Sĩ số</p>
                                <p className="font-bold text-blue-600">{totalCapacity}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-600">🍖 Mặn</p>
                                <p className="font-bold text-blue-700">{totalSalty}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-600">🥣 Cháo</p>
                                <p className="font-bold text-amber-600">{totalPorridge}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-600">🥬 Chay</p>
                                <p className="font-bold text-emerald-600">{totalVegetarian}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {classes.length === 0 && (
                <div className="text-center py-16 text-gray-500 print:hidden">
                    <p className="text-4xl mb-3">📋</p>
                    <p>Chưa có phòng nào trong danh sách quản lý</p>
                </div>
            )}

            {/* Signature Block (Only Visible on Print) */}
            <div className="hidden print:flex justify-between items-start mt-12 text-center text-sm font-bold w-full break-inside-avoid px-8">
                <div className="flex flex-col items-center">
                    <p>ĐẠI DIỆN TRƯỜNG</p>
                    <p className="invisible h-24">Signature</p>
                </div>
                <div className="flex flex-col items-center">
                    <p>QUẢN LÝ BẾP</p>
                    <p className="invisible h-24">Signature</p>
                </div>
                <div className="flex flex-col items-center">
                    <p>NGƯỜI LẬP</p>
                    <p className="invisible h-24">Signature</p>
                    <p className="font-normal border-t border-dashed w-32 pt-1 uppercase">ký, ghi rõ họ tên</p>
                </div>
            </div>
        </div>
    )
}
