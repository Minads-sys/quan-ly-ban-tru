'use client'

import { useState, useEffect } from 'react'
import { searchReports, overrideReport, getAllRooms, createReportForRoom } from './actions'
import { calculateSaltyMeals } from '@/utils/calculations'

interface Report {
    id: string
    room_id: string
    capacity: number
    absent_count: number
    porridge_count: number
    vegetarian_count: number
    salty_count: number
    status: string
    note: string | null
    absent_list: { name: string; reason?: string }[]
    rooms: { name: string; groups: { name: string } | null } | null
}

interface Room {
    id: string
    name: string
    default_capacity: number
    groups: { name: string } | null
}

export default function AdminPage() {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [reports, setReports] = useState<Report[]>([])
    const [rooms, setRooms] = useState<Room[]>([])
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editData, setEditData] = useState({
        capacity: 0, absent_count: 0, porridge_count: 0, vegetarian_count: 0, note: '',
    })
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    async function handleSearch() {
        setLoading(true)
        setMessage(null)
        const data = await searchReports(date)
        if ('error' in data && data.error) {
            setMessage({ type: 'error', text: data.error as string })
        } else {
            setReports((data.reports || []) as Report[])
        }

        const roomData = await getAllRooms()
        setRooms((roomData.rooms || []) as Room[])
        setLoading(false)
    }

    useEffect(() => {
        handleSearch()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function startEdit(report: Report) {
        setEditingId(report.id)
        setEditData({
            capacity: report.capacity,
            absent_count: report.absent_count,
            porridge_count: report.porridge_count,
            vegetarian_count: report.vegetarian_count,
            note: report.note || '',
        })
    }

    async function handleOverride() {
        if (!editingId) return
        setMessage(null)

        const saltyCount = calculateSaltyMeals(
            editData.capacity, editData.absent_count, editData.porridge_count, editData.vegetarian_count
        )

        if (saltyCount < 0) {
            setMessage({ type: 'error', text: 'Số suất mặn không thể âm!' })
            return
        }

        const result = await overrideReport(editingId, {
            ...editData,
            salty_count: saltyCount,
            note: editData.note || null,
            absent_list: [],
        })

        if (result.error) {
            setMessage({ type: 'error', text: result.error })
        } else {
            setMessage({ type: 'success', text: 'Đã ghi đè thành công!' })
            setEditingId(null)
            handleSearch()
        }
    }

    async function handleCreateReport(room: Room) {
        setMessage(null)
        const result = await createReportForRoom(room.id, date, {
            capacity: room.default_capacity,
            absent_count: 0,
            porridge_count: 0,
            vegetarian_count: 0,
            salty_count: room.default_capacity,
            note: 'Tạo bởi Admin',
            absent_list: [],
        })

        if (result.error) {
            setMessage({ type: 'error', text: result.error })
        } else {
            setMessage({ type: 'success', text: `Đã tạo báo cáo cho ${room.name}` })
            handleSearch()
        }
    }

    const reportedRoomIds = reports.map(r => r.room_id)
    const unreportedRooms = rooms.filter(r => !reportedRoomIds.includes(r.id))

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        🔑 Admin — Quản lý dữ liệu
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Tìm kiếm và ghi đè báo cáo, bỏ qua rào cản thời gian</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-sm
              focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="px-5 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold
              hover:bg-blue-600 shadow-md transition-all disabled:opacity-50"
                    >
                        {loading ? '...' : '🔍 Tìm'}
                    </button>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`rounded-xl p-4 mb-4 text-sm font-medium border ${message.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Edit Modal */}
            {editingId && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">✏️ Ghi đè dữ liệu</h3>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-gray-500">Sĩ số</label>
                                <input type="number" min={0} value={editData.capacity}
                                    onChange={e => setEditData({ ...editData, capacity: parseInt(e.target.value) || 0 })}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-500">Nghỉ</label>
                                    <input type="number" min={0} value={editData.absent_count}
                                        onChange={e => setEditData({ ...editData, absent_count: parseInt(e.target.value) || 0 })}
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500">Cháo</label>
                                    <input type="number" min={0} value={editData.porridge_count}
                                        onChange={e => setEditData({ ...editData, porridge_count: parseInt(e.target.value) || 0 })}
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500">Chay</label>
                                    <input type="number" min={0} value={editData.vegetarian_count}
                                        onChange={e => setEditData({ ...editData, vegetarian_count: parseInt(e.target.value) || 0 })}
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className={`rounded-lg p-3 text-center font-bold text-lg ${calculateSaltyMeals(editData.capacity, editData.absent_count, editData.porridge_count, editData.vegetarian_count) < 0
                                    ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
                                }`}>
                                Mặn: {calculateSaltyMeals(editData.capacity, editData.absent_count, editData.porridge_count, editData.vegetarian_count)}
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500">Ghi chú</label>
                                <input type="text" value={editData.note}
                                    onChange={e => setEditData({ ...editData, note: e.target.value })}
                                    placeholder="Lý do ghi đè..."
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setEditingId(null)}
                                className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                            >
                                Hủy
                            </button>
                            <button onClick={handleOverride}
                                className="flex-1 py-2 bg-gradient-to-r from-blue-500 to-emerald-500 text-white rounded-xl text-sm font-semibold
                  hover:from-blue-600 hover:to-emerald-600 shadow-md"
                            >
                                💾 Lưu ghi đè
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reports Table */}
            {reports.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-6">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-700">📋 Báo cáo ngày {date} ({reports.length} phòng)</h3>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden sm:block">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-500 text-xs border-b border-gray-200">
                                    <th className="text-left px-4 py-2 font-medium">Nhóm</th>
                                    <th className="text-left px-3 py-2 font-medium">Phòng</th>
                                    <th className="text-center px-2 py-2 font-medium">SN</th>
                                    <th className="text-center px-2 py-2 font-medium">Nghỉ</th>
                                    <th className="text-center px-2 py-2 font-medium">Mặn</th>
                                    <th className="text-center px-2 py-2 font-medium">Cháo</th>
                                    <th className="text-center px-2 py-2 font-medium">Chay</th>
                                    <th className="text-center px-2 py-2 font-medium">TT</th>
                                    <th className="text-center px-2 py-2 font-medium">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map(r => (
                                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                                        <td className="px-4 py-2 text-gray-500 text-xs">{r.rooms?.groups?.name || '—'}</td>
                                        <td className="px-3 py-2 font-medium text-gray-700">{r.rooms?.name || '—'}</td>
                                        <td className="text-center px-2 py-2">{r.capacity}</td>
                                        <td className="text-center px-2 py-2 text-red-500">{r.absent_count}</td>
                                        <td className="text-center px-2 py-2 font-semibold text-blue-700">{r.salty_count}</td>
                                        <td className="text-center px-2 py-2">{r.porridge_count}</td>
                                        <td className="text-center px-2 py-2">{r.vegetarian_count}</td>
                                        <td className="text-center px-2 py-2">
                                            {r.status === 'approved' ? '✅' : r.status === 'submitted' ? '⏳' : '⚪'}
                                        </td>
                                        <td className="text-center px-2 py-2">
                                            <button onClick={() => startEdit(r)}
                                                className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium
                          hover:bg-amber-100 transition-colors"
                                            >
                                                ✏️ Sửa
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-gray-100">
                        {reports.map(r => (
                            <div key={r.id} className="p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-medium text-gray-700">{r.rooms?.name}</p>
                                        <p className="text-xs text-gray-400">{r.rooms?.groups?.name}</p>
                                    </div>
                                    <button onClick={() => startEdit(r)}
                                        className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium"
                                    >
                                        ✏️ Sửa
                                    </button>
                                </div>
                                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                    <span>SN:{r.capacity}</span>
                                    <span className="text-blue-600 font-semibold">Mặn:{r.salty_count}</span>
                                    <span>Cháo:{r.porridge_count}</span>
                                    <span>Chay:{r.vegetarian_count}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Unreported Rooms */}
            {unreportedRooms.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-amber-50 border-b border-gray-200">
                        <h3 className="font-semibold text-amber-700">⚠️ Phòng chưa báo ({unreportedRooms.length})</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {unreportedRooms.map(room => (
                            <div key={room.id} className="px-4 py-3 flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-700 text-sm">{room.name}</p>
                                    <p className="text-xs text-gray-400">{room.groups?.name} · Sĩ số: {room.default_capacity}</p>
                                </div>
                                <button onClick={() => handleCreateReport(room)}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium
                    hover:bg-blue-100 transition-colors"
                                >
                                    ➕ Tạo báo cáo
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {reports.length === 0 && unreportedRooms.length === 0 && !loading && (
                <div className="text-center py-16 text-gray-400">
                    <p className="text-4xl mb-3">🔍</p>
                    <p>Chọn ngày và nhấn Tìm để xem báo cáo</p>
                </div>
            )}
        </div>
    )
}
