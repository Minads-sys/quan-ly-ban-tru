'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSchoolReports, approveRoom, approveGroup, approveSchool } from './actions'

interface GroupData { id: string; name: string }
interface RoomData { id: string; name: string; group_id: string; groups: { name: string } | null }
interface ClassData { id: string; name: string; room_id: string; default_capacity: number }
interface ReportData {
    id: string; class_id: string; room_id: string
    capacity: number; absent_count: number; salty_count: number
    porridge_count: number; vegetarian_count: number; status: string
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
    draft: { label: 'Nháp', color: 'bg-gray-100 text-gray-600', icon: '⚪' },
    submitted: { label: 'Chờ phòng duyệt', color: 'bg-amber-100 text-amber-700', icon: '⏳' },
    room_approved: { label: 'Phòng đã duyệt', color: 'bg-blue-100 text-blue-700', icon: '✅' },
    school_approved: { label: 'Trường đã duyệt', color: 'bg-emerald-100 text-emerald-700', icon: '🏫' },
    rejected: { label: 'Từ chối', color: 'bg-red-100 text-red-700', icon: '❌' },
}

export default function SchoolPage() {
    const [groups, setGroups] = useState<GroupData[]>([])
    const [rooms, setRooms] = useState<RoomData[]>([])
    const [classes, setClasses] = useState<ClassData[]>([])
    const [reports, setReports] = useState<ReportData[]>([])
    const [today, setToday] = useState('')
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const loadData = useCallback(async () => {
        const data = await getSchoolReports()
        if ('error' in data && data.error) return
        setGroups((data.groups || []) as GroupData[])
        setRooms((data.rooms || []) as RoomData[])
        setClasses((data.classes || []) as ClassData[])
        setReports((data.reports || []) as ReportData[])
        setToday(data.today as string)
        setLoading(false)
    }, [])

    useEffect(() => { loadData() }, [loadData])

    async function handleApproveRoom(roomId: string) {
        setActionLoading(roomId)
        await approveRoom(roomId)
        await loadData()
        setActionLoading(null)
    }

    async function handleApproveGroup(groupId: string) {
        if (!confirm('Bạn có chắc muốn duyệt toàn bộ nhóm này?')) return
        setActionLoading(`group-${groupId}`)
        await approveGroup(groupId)
        await loadData()
        setActionLoading(null)
    }

    async function handleApproveSchool() {
        if (!confirm('Bạn có chắc muốn duyệt TOÀN BỘ TRƯỜNG? Tất cả báo cáo đã duyệt phòng sẽ được duyệt cấp trường.')) return
        setActionLoading('school')
        await approveSchool()
        await loadData()
        setActionLoading(null)
    }

    // Aggregate data
    function getRoomReport(roomId: string) {
        const roomClasses = classes.filter(c => c.room_id === roomId)
        const roomReports = reports.filter(r => roomClasses.some(c => c.id === r.class_id))
        const totalCapacity = roomReports.reduce((s, r) => s + r.capacity, 0)
        const totalAbsent = roomReports.reduce((s, r) => s + r.absent_count, 0)
        const totalSalty = roomReports.reduce((s, r) => s + r.salty_count, 0)
        const totalPorridge = roomReports.reduce((s, r) => s + r.porridge_count, 0)
        const totalVegetarian = roomReports.reduce((s, r) => s + r.vegetarian_count, 0)
        const pendingApproval = roomReports.filter(r => r.status === 'room_approved').length
        const allApproved = roomReports.length > 0 && roomReports.every(r => r.status === 'school_approved')
        const hasRoomApproved = pendingApproval > 0

        return { totalCapacity, totalAbsent, totalSalty, totalPorridge, totalVegetarian, pendingApproval, allApproved, hasRoomApproved, reportCount: roomReports.length, classCount: roomClasses.length }
    }

    const totalPendingRooms = rooms.filter(r => getRoomReport(r.id).hasRoomApproved).length

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        🏫 Duyệt cấp Trường
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Ngày: <span className="font-semibold">{today}</span>
                        {' · '}Chờ duyệt: <span className="font-semibold text-blue-600">{totalPendingRooms} phòng</span>
                    </p>
                </div>
                <div className="flex gap-2">
                    {totalPendingRooms > 0 && (
                        <button onClick={handleApproveSchool}
                            disabled={actionLoading === 'school'}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-md hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 transition-all text-sm">
                            {actionLoading === 'school' ? 'Đang duyệt...' : `🏫 Duyệt toàn Trường (${totalPendingRooms})`}
                        </button>
                    )}
                </div>
            </div>

            {/* Groups */}
            <div className="space-y-6">
                {groups.map(group => {
                    const groupRooms = rooms.filter(r => r.group_id === group.id)
                    const groupPending = groupRooms.filter(r => getRoomReport(r.id).hasRoomApproved).length

                    return (
                        <div key={group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            {/* Group header */}
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                <h3 className="font-semibold text-gray-700">📁 {group.name} ({groupRooms.length} phòng)</h3>
                                {groupPending > 0 && (
                                    <button onClick={() => handleApproveGroup(group.id)}
                                        disabled={actionLoading === `group-${group.id}`}
                                        className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 disabled:opacity-50 transition-all">
                                        {actionLoading === `group-${group.id}` ? '...' : `✅ Duyệt toàn Nhóm (${groupPending})`}
                                    </button>
                                )}
                            </div>

                            {/* Rooms table */}
                            <div className="hidden sm:block">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-gray-500 text-xs border-b border-gray-200">
                                            <th className="text-left px-4 py-2 font-medium">Phòng</th>
                                            <th className="text-center px-2 py-2 font-medium">Lớp</th>
                                            <th className="text-center px-2 py-2 font-medium">Sĩ số</th>
                                            <th className="text-center px-2 py-2 font-medium">Nghỉ</th>
                                            <th className="text-center px-2 py-2 font-medium">🍖 Mặn</th>
                                            <th className="text-center px-2 py-2 font-medium">🥣 Cháo</th>
                                            <th className="text-center px-2 py-2 font-medium">🥬 Chay</th>
                                            <th className="text-center px-2 py-2 font-medium">TT</th>
                                            <th className="text-center px-2 py-2 font-medium">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupRooms.map(room => {
                                            const rd = getRoomReport(room.id)
                                            return (
                                                <tr key={room.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                                                    <td className="px-4 py-2 font-medium text-gray-700">{room.name}</td>
                                                    <td className="text-center px-2 py-2 text-gray-400">{rd.classCount}</td>
                                                    <td className="text-center px-2 py-2">{rd.totalCapacity}</td>
                                                    <td className="text-center px-2 py-2 text-red-500">{rd.totalAbsent}</td>
                                                    <td className="text-center px-2 py-2 font-semibold text-blue-700">{rd.totalSalty}</td>
                                                    <td className="text-center px-2 py-2">{rd.totalPorridge}</td>
                                                    <td className="text-center px-2 py-2">{rd.totalVegetarian}</td>
                                                    <td className="text-center px-2 py-2">
                                                        {rd.allApproved ? (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">🏫 Đã duyệt</span>
                                                        ) : rd.hasRoomApproved ? (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">✅ Phòng duyệt</span>
                                                        ) : rd.reportCount > 0 ? (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">⏳ Chờ</span>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="text-center px-2 py-2">
                                                        {rd.hasRoomApproved && !rd.allApproved && (
                                                            <button onClick={() => handleApproveRoom(room.id)}
                                                                disabled={actionLoading === room.id}
                                                                className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                                                                Duyệt
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="sm:hidden divide-y divide-gray-100">
                                {groupRooms.map(room => {
                                    const rd = getRoomReport(room.id)
                                    return (
                                        <div key={room.id} className="p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-semibold text-gray-800">{room.name}</h4>
                                                {rd.allApproved ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">🏫 Đã duyệt</span>
                                                ) : rd.hasRoomApproved ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">✅ Phòng duyệt</span>
                                                ) : null}
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 text-center text-xs mb-2">
                                                <div><p className="text-gray-400">SN</p><p className="font-semibold">{rd.totalCapacity}</p></div>
                                                <div><p className="text-gray-400">🍖 Mặn</p><p className="font-semibold text-blue-700">{rd.totalSalty}</p></div>
                                                <div><p className="text-gray-400">🥣 Cháo</p><p className="font-semibold">{rd.totalPorridge}</p></div>
                                                <div><p className="text-gray-400">🥬 Chay</p><p className="font-semibold">{rd.totalVegetarian}</p></div>
                                            </div>
                                            {rd.hasRoomApproved && !rd.allApproved && (
                                                <button onClick={() => handleApproveRoom(room.id)}
                                                    disabled={actionLoading === room.id}
                                                    className="w-full py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 disabled:opacity-50">
                                                    ✅ Duyệt phòng
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            {groups.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                    <p className="text-4xl mb-3">🏫</p>
                    <p>Chưa có nhóm nào trong hệ thống</p>
                </div>
            )}
        </div>
    )
}
