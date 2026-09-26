'use client'

import React, { useState, useEffect, useCallback, useRef, memo } from 'react'
import {
    getGroups, createGroup, deleteGroup, updateGroup,
    getRooms, createRoom, updateRoom, deleteRoom,
    importRoomsFromExcel, getSettings
} from './actions'

interface Group { id: string; name: string; rooms: { count: number }[] }
interface Room { id: string; name: string; group_id: string; default_capacity: number; groups: { name: string } | null; teacherName?: string }

interface PreviewRow {
    rowNumber: number
    roomName: string
    teacherName: string
    capacity: number
    groupId: string
    groupName: string
    status: 'new' | 'update' | 'error'
    errorReason?: string
    existingCapacity?: number
    existingTeacher?: string
}

interface RoomsGroupsTabProps {
    onMessage: (type: 'success' | 'error', text: string) => void
    schoolName?: string
}

export const RoomsGroupsTab = memo(function RoomsGroupsTab({ onMessage, schoolName = '' }: RoomsGroupsTabProps) {
    const [loading, setLoading] = useState(true)
    const [groups, setGroups] = useState<Group[]>([])
    const [rooms, setRooms] = useState<Room[]>([])

    // Forms
    const [newGroupName, setNewGroupName] = useState('')
    const [editGroupId, setEditGroupId] = useState<string | null>(null)
    const [editGroupName, setEditGroupName] = useState('')

    const [roomForm, setRoomForm] = useState({ name: '', groupId: '', capacity: 30, teacherName: '' })
    const [editRoomId, setEditRoomId] = useState<string | null>(null)
    const [editRoomForm, setEditRoomForm] = useState({ name: '', groupId: '', capacity: 30, teacherName: '' })

    // Import & Export Excel
    const [importGroupId, setImportGroupId] = useState('')
    const [importResults, setImportResults] = useState<string[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
    const [showPreviewModal, setShowPreviewModal] = useState(false)
    const [isImporting, setIsImporting] = useState(false)

    // Room Search & Filter
    const [roomSearch, setRoomSearch] = useState('')
    const [roomGroupFilter, setRoomGroupFilter] = useState('')

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [groupsData, roomsData] = await Promise.all([getGroups(), getRooms()])
            setGroups(groupsData.groups as Group[])
            setRooms(roomsData.rooms as Room[])
        } catch (e) {
            console.error('[RoomsGroupsTab loadData] error:', e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    // ---- GROUPS ----
    async function handleCreateGroup() {
        if (!newGroupName.trim()) return
        const result = await createGroup(newGroupName.trim())
        if (result.error) onMessage('error', result.error)
        else { onMessage('success', 'Đã tạo nhóm!'); setNewGroupName(''); loadData() }
    }

    async function handleUpdateGroup() {
        if (!editGroupId || !editGroupName.trim()) return
        const result = await updateGroup(editGroupId, editGroupName.trim())
        if (result.error) onMessage('error', result.error)
        else { onMessage('success', 'Đã sửa nhóm!'); setEditGroupId(null); loadData() }
    }

    async function handleDeleteGroup(id: string) {
        if (!confirm('Xóa nhóm này? Tất cả phòng trong nhóm cũng sẽ bị xóa.')) return
        const result = await deleteGroup(id)
        if (result.error) onMessage('error', result.error)
        else { onMessage('success', 'Đã xóa nhóm!'); loadData() }
    }

    // ---- ROOMS ----
    async function handleCreateRoom() {
        if (!roomForm.name.trim() || !roomForm.groupId) return
        const result = await createRoom(roomForm.name.trim(), roomForm.groupId, roomForm.capacity, roomForm.teacherName.trim())
        if (result.error) onMessage('error', result.error)
        else { onMessage('success', 'Đã tạo phòng!'); setRoomForm({ name: '', groupId: '', capacity: 30, teacherName: '' }); loadData() }
    }

    async function handleUpdateRoom() {
        if (!editRoomId) return
        const result = await updateRoom(editRoomId, editRoomForm.name, editRoomForm.groupId, editRoomForm.capacity, editRoomForm.teacherName.trim())
        if (result.error) onMessage('error', result.error)
        else { onMessage('success', 'Đã sửa phòng!'); setEditRoomId(null); loadData() }
    }

    async function handleDeleteRoom(id: string) {
        if (!confirm('Xóa phòng này?')) return
        const result = await deleteRoom(id)
        if (result.error) onMessage('error', result.error)
        else { onMessage('success', 'Đã xóa phòng!'); loadData() }
    }

    // ---- EXCEL: IMPORT & EXPORT ----

    // Xuất danh sách quản lý phòng ra Excel (5 cột: STT, Nhóm, Tên phòng, Tên GV, Sĩ số)
    async function handleExportRoomsExcel() {
        if (rooms.length === 0) {
            onMessage('error', 'Chưa có dữ liệu phòng để xuất')
            return
        }

        try {
            const XLSX = await import('xlsx')

            // Sắp xếp danh sách theo Nhóm / Khối rồi theo Tên phòng
            const sortedRooms = [...rooms].sort((a, b) => {
                const groupA = a.groups?.name || ''
                const groupB = b.groups?.name || ''
                if (groupA !== groupB) return groupA.localeCompare(groupB, 'vi')
                return a.name.localeCompare(b.name, 'vi', { numeric: true })
            })

            const now = new Date()
            const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

            const title = 'DANH SÁCH QUẢN LÝ PHÒNG BÁN TRÚ'
            const subtitle = `${schoolName ? `Trường: ${schoolName}  |  ` : ''}Ngày xuất: ${dateStr} ${timeStr}`

            const headers = ['STT', 'Nhóm / Khối', 'Tên phòng', 'Tên GV', 'Sĩ số']

            let totalCapacity = 0
            const dataRows = sortedRooms.map((r, idx) => {
                const cap = r.default_capacity || 0
                totalCapacity += cap
                return [
                    idx + 1,
                    r.groups?.name || 'Chưa phân nhóm',
                    r.name,
                    r.teacherName || '',
                    cap,
                ]
            })

            const summaryRow = ['TỔNG CỘNG', '', `${sortedRooms.length} phòng`, '', totalCapacity]

            const wsData = [
                [title],
                [subtitle],
                [],
                headers,
                ...dataRows,
                summaryRow,
            ]

            const ws = XLSX.utils.aoa_to_sheet(wsData)

            // Merge ô tiêu đề
            ws['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
                { s: { r: wsData.length - 1, c: 0 }, e: { r: wsData.length - 1, c: 1 } },
            ]

            // Độ rộng các cột
            ws['!cols'] = [
                { wch: 8 },  // STT
                { wch: 20 }, // Nhóm / Khối
                { wch: 20 }, // Tên phòng
                { wch: 25 }, // Tên GV
                { wch: 12 }, // Sĩ số
            ]

            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Danh sách phòng')

            const fileDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
            XLSX.writeFile(wb, `danh-sach-phong-ban-tru_${fileDate}.xlsx`)
            onMessage('success', `Đã xuất ${sortedRooms.length} phòng ra file Excel!`)
        } catch (err: any) {
            onMessage('error', `Lỗi khi xuất file: ${err?.message || 'Không xác định'}`)
        }
    }

    // Đọc & Kiểm tra file Excel trước khi Import
    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const XLSX = await import('xlsx')
            const buffer = await file.arrayBuffer()
            const workbook = XLSX.read(buffer, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const sheet = workbook.Sheets[sheetName]
            if (!sheet) {
                onMessage('error', 'File Excel không có dữ liệu')
                return
            }

            const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
            if (!rawData || rawData.length === 0) {
                onMessage('error', 'File Excel trống')
                return
            }

            // Tìm dòng header
            let headerRowIdx = -1
            let colRoom = -1
            let colTeacher = -1
            let colCapacity = -1
            let colGroup = -1

            for (let r = 0; r < Math.min(rawData.length, 10); r++) {
                const row = rawData[r]
                if (!Array.isArray(row)) continue
                const rowStr = row.map(c => String(c || '').toLowerCase().trim())

                const rIdx = rowStr.findIndex(c => c.includes('phòng') || c.includes('room') || c.includes('lớp'))
                const tIdx = rowStr.findIndex(c => c.includes('giáo viên') || c === 'gv' || c.includes('tên gv') || c.includes('teacher'))
                const cIdx = rowStr.findIndex(c => c.includes('sĩ số') || c.includes('capacity') || c.includes('số lượng'))
                const gIdx = rowStr.findIndex(c => c.includes('nhóm') || c.includes('khối') || c.includes('group'))

                if (rIdx !== -1 || (tIdx !== -1 && cIdx !== -1)) {
                    headerRowIdx = r
                    colRoom = rIdx
                    colTeacher = tIdx
                    colCapacity = cIdx
                    colGroup = gIdx
                    break
                }
            }

            if (headerRowIdx === -1) {
                // Thử nhận diện tự động cột
                headerRowIdx = 0
                colRoom = 0
                colTeacher = 1
                colCapacity = 2
            }

            // Parse từng dòng dữ liệu
            const parsed: PreviewRow[] = []
            const seenKeys = new Set<string>()

            for (let i = headerRowIdx + 1; i < rawData.length; i++) {
                const row = rawData[i]
                if (!Array.isArray(row) || row.length === 0) continue

                const rowNum = i + 1
                const roomName = colRoom !== -1 ? String(row[colRoom] || '').trim() : ''
                const teacherName = colTeacher !== -1 ? String(row[colTeacher] || '').trim() : ''
                const rawCap = colCapacity !== -1 ? row[colCapacity] : undefined
                const rawGroup = colGroup !== -1 ? String(row[colGroup] || '').trim() : ''

                // Xác định Nhóm
                let targetGroupId = importGroupId
                let targetGroupName = groups.find(g => g.id === importGroupId)?.name || ''

                if (rawGroup) {
                    const matchedGroup = groups.find(g => g.name.toLowerCase().trim() === rawGroup.toLowerCase().trim())
                    if (matchedGroup) {
                        targetGroupId = matchedGroup.id
                        targetGroupName = matchedGroup.name
                    } else if (!targetGroupId) {
                        targetGroupName = rawGroup
                    }
                }

                // Parse sĩ số
                let capacity = 0
                let isCapValid = true
                if (rawCap !== undefined && rawCap !== null && String(rawCap).trim() !== '') {
                    const parsedNum = Number(String(rawCap).replace(/,/g, '').trim())
                    if (isNaN(parsedNum) || parsedNum < 0) {
                        isCapValid = false
                    } else {
                        capacity = Math.round(parsedNum)
                    }
                }

                // Kiểm tra các lỗi
                let errorReason = ''
                if (!roomName) {
                    errorReason = 'Thiếu tên phòng'
                } else if (!targetGroupId) {
                    if (rawGroup) {
                        errorReason = `Nhóm "${rawGroup}" không tồn tại trong hệ thống`
                    } else {
                        errorReason = 'Chưa chọn nhóm (hãy chọn nhóm mặc định trước khi chọn file)'
                    }
                } else if (!isCapValid) {
                    errorReason = `Sĩ số "${rawCap}" không hợp lệ (phải là số >= 0)`
                }

                // Kiểm tra trùng lặp trong file
                if (roomName && targetGroupId) {
                    const key = `${targetGroupId}_${roomName.toLowerCase()}`
                    if (seenKeys.has(key)) {
                        errorReason = `Trùng tên phòng "${roomName}" với dòng khác trong file`
                    } else {
                        seenKeys.add(key)
                    }
                }

                if (errorReason) {
                    parsed.push({
                        rowNumber: rowNum,
                        roomName: roomName || '(Trống)',
                        teacherName,
                        capacity,
                        groupId: targetGroupId,
                        groupName: targetGroupName || 'Chưa xác định',
                        status: 'error',
                        errorReason,
                    })
                } else {
                    // Kiểm tra xem phòng đã có trong hệ thống chưa
                    const existing = rooms.find(
                        r => r.group_id === targetGroupId && r.name.toLowerCase().trim() === roomName.toLowerCase().trim()
                    )

                    if (existing) {
                        parsed.push({
                            rowNumber: rowNum,
                            roomName,
                            teacherName,
                            capacity,
                            groupId: targetGroupId,
                            groupName: targetGroupName,
                            status: 'update',
                            existingCapacity: existing.default_capacity,
                            existingTeacher: existing.teacherName || '',
                        })
                    } else {
                        parsed.push({
                            rowNumber: rowNum,
                            roomName,
                            teacherName,
                            capacity,
                            groupId: targetGroupId,
                            groupName: targetGroupName,
                            status: 'new',
                        })
                    }
                }
            }

            if (parsed.length === 0) {
                onMessage('error', 'Không tìm thấy dòng dữ liệu phòng nào trong file Excel')
                return
            }

            setPreviewRows(parsed)
            setShowPreviewModal(true)
        } catch (err: any) {
            onMessage('error', `Lỗi đọc file Excel: ${err?.message || 'Đảm bảo file đúng định dạng .xlsx'}`)
        } finally {
            e.target.value = ''
        }
    }

    // Thực hiện Import các dòng hợp lệ sau khi người dùng xác nhận
    async function handleConfirmImport() {
        const validRows = previewRows.filter(r => r.status !== 'error')
        if (validRows.length === 0) {
            onMessage('error', 'Không có dòng hợp lệ nào để import')
            return
        }

        setIsImporting(true)
        try {
            const rowsToImport = validRows.map(r => ({
                roomName: r.roomName,
                teacherName: r.teacherName,
                capacity: r.capacity,
                groupId: r.groupId,
            }))

            const result = await importRoomsFromExcel(rowsToImport)
            if (result.error) {
                onMessage('error', result.error)
            } else {
                onMessage('success', `Đã xử lý xong: Thêm mới ${result.addedCount} phòng, Cập nhật ${result.updatedCount} phòng!`)
                setImportResults(result.results || [])
                setShowPreviewModal(false)
                setPreviewRows([])
                loadData()
            }
        } catch (err: any) {
            onMessage('error', `Lỗi khi import: ${err?.message || 'Không xác định'}`)
        } finally {
            setIsImporting(false)
        }
    }

    const filteredRooms = rooms.filter(r => {
        const matchesGroup = !roomGroupFilter || r.group_id === roomGroupFilter
        const matchesSearch = !roomSearch.trim() || 
            r.name.toLowerCase().includes(roomSearch.toLowerCase()) || 
            (r.teacherName && r.teacherName.toLowerCase().includes(roomSearch.toLowerCase()))
        return matchesGroup && matchesSearch
    })

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Groups Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-700 mb-4">📁 Quản lý Nhóm / Khối</h3>
                <div className="flex gap-2 mb-4">
                    <input type="text" placeholder="Tên nhóm mới (VD: Khối 1)"
                        value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                    <button onClick={handleCreateGroup} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">+ Thêm</button>
                </div>
                <div className="space-y-2">
                    {groups.map(g => (
                        <div key={g.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                            {editGroupId === g.id ? (
                                <div className="flex gap-2 flex-1">
                                    <input type="text" value={editGroupName} onChange={e => setEditGroupName(e.target.value)}
                                        className="flex-1 px-2 py-1 rounded border border-gray-200 text-sm outline-none" />
                                    <button onClick={handleUpdateGroup} className="text-xs text-blue-600 font-medium">Lưu</button>
                                    <button onClick={() => setEditGroupId(null)} className="text-xs text-gray-400">Hủy</button>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <span className="font-medium text-gray-700 text-sm">{g.name}</span>
                                        <span className="text-xs text-gray-400 ml-2">({g.rooms?.[0]?.count || 0} phòng)</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditGroupId(g.id); setEditGroupName(g.name) }}
                                            className="text-xs text-blue-600 font-medium hover:text-blue-700">Sửa</button>
                                        <button onClick={() => handleDeleteGroup(g.id)}
                                            className="text-xs text-red-500 font-medium hover:text-red-600">Xóa</button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    {groups.length === 0 && <p className="text-sm text-gray-400 italic">Chưa có nhóm nào</p>}
                </div>
            </div>

            {/* Rooms Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-semibold text-gray-700">🏫 Quản lý Phòng</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Tổng cộng: {rooms.length} phòng {roomGroupFilter || roomSearch ? `(đang lọc: ${filteredRooms.length})` : ''}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleExportRoomsExcel}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all cursor-pointer"
                        title="Xuất danh sách phòng kèm giáo viên và sĩ số ra file Excel"
                    >
                        <span>📊 Xuất Excel</span>
                    </button>
                </div>

                {/* Thanh tìm kiếm & lọc nhóm */}
                {rooms.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-2 mb-4 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder="🔍 Tìm nhanh phòng hoặc tên GV..."
                                value={roomSearch}
                                onChange={e => setRoomSearch(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none bg-white"
                            />
                            {roomSearch && (
                                <button
                                    onClick={() => setRoomSearch('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                                >✕</button>
                            )}
                        </div>
                        <select
                            value={roomGroupFilter}
                            onChange={e => setRoomGroupFilter(e.target.value)}
                            className="sm:w-48 px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none bg-white"
                        >
                            <option value="">Tất cả các nhóm</option>
                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                )}

                {/* Thêm phòng mới */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-4">
                    <input type="text" placeholder="Tên phòng (VD: Phòng B31)"
                        value={roomForm.name} onChange={e => setRoomForm({ ...roomForm, name: e.target.value })}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                    <select value={roomForm.groupId} onChange={e => setRoomForm({ ...roomForm, groupId: e.target.value })}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none">
                        <option value="">Chọn nhóm</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <input type="text" placeholder="Tên Giáo Viên"
                        value={roomForm.teacherName} onChange={e => setRoomForm({ ...roomForm, teacherName: e.target.value })}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                    <input type="number" min={0} placeholder="Sĩ số"
                        value={roomForm.capacity} onChange={e => setRoomForm({ ...roomForm, capacity: parseInt(e.target.value) || 0 })}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                    <button onClick={handleCreateRoom} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">+ Thêm phòng</button>
                </div>

                {/* Danh sách phòng */}
                <div className="space-y-2">
                    {filteredRooms.map(r => (
                        <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                            {editRoomId === r.id ? (
                                <div className="flex gap-2 flex-1 flex-wrap">
                                    <input type="text" value={editRoomForm.name} onChange={e => setEditRoomForm({ ...editRoomForm, name: e.target.value })}
                                        className="flex-1 min-w-[120px] px-2 py-1 rounded border border-gray-200 text-sm outline-none" />
                                    <select value={editRoomForm.groupId} onChange={e => setEditRoomForm({ ...editRoomForm, groupId: e.target.value })}
                                        className="px-2 py-1 rounded border border-gray-200 text-sm outline-none">
                                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                    <input type="text" placeholder="Tên Giáo Viên" value={editRoomForm.teacherName}
                                        onChange={e => setEditRoomForm({ ...editRoomForm, teacherName: e.target.value })}
                                        className="w-24 px-2 py-1 rounded border border-gray-200 text-sm outline-none" />
                                    <input type="number" min={0} value={editRoomForm.capacity}
                                        onChange={e => setEditRoomForm({ ...editRoomForm, capacity: parseInt(e.target.value) || 0 })}
                                        className="w-16 px-2 py-1 rounded border border-gray-200 text-sm outline-none" />
                                    <button onClick={handleUpdateRoom} className="text-xs text-blue-600 font-medium">Lưu</button>
                                    <button onClick={() => setEditRoomId(null)} className="text-xs text-gray-400">Hủy</button>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <span className="font-medium text-gray-700 text-sm">{r.name}</span>
                                        <span className="text-xs text-gray-400 ml-2">
                                            {r.groups?.name} · Sĩ số: {r.default_capacity} 
                                            {r.teacherName && ` · GV: ${r.teacherName}`}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditRoomId(r.id); setEditRoomForm({ name: r.name, groupId: r.group_id, capacity: r.default_capacity, teacherName: r.teacherName || '' }) }}
                                            className="text-xs text-blue-600 font-medium hover:text-blue-700">Sửa</button>
                                        <button onClick={() => handleDeleteRoom(r.id)}
                                            className="text-xs text-red-500 font-medium hover:text-red-600">Xóa</button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    {filteredRooms.length === 0 && (
                        <p className="text-sm text-gray-400 italic py-2">
                            {rooms.length === 0 ? 'Chưa có phòng nào' : 'Không tìm thấy phòng nào phù hợp điều kiện lọc'}
                        </p>
                    )}
                </div>
            </div>

            {/* Import Excel */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-gray-700">📥 Import phòng từ Excel</h3>
                    <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
                        ✨ Có kiểm tra & xem trước trước khi lưu
                    </span>
                </div>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                    File Excel hỗ trợ 2 dạng: (1) <b>Tên phòng | Tên GV | Sĩ số</b> (dùng nhóm mặc định bên dưới), hoặc (2) <b>STT | Nhóm / Khối | Tên phòng | Tên GV | Sĩ số</b> (file xuất từ chức năng Xuất Excel).<br />
                    <span className="text-amber-700 font-medium">⚡ Lưu ý: Nếu phòng đã có trong nhóm, hệ thống sẽ <b>cập nhật</b> sĩ số và tên GV chứ không tạo trùng lặp.</span>
                </p>

                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <select value={importGroupId} onChange={e => setImportGroupId(e.target.value)}
                        className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none bg-white">
                        <option value="">Chọn nhóm mặc định (nếu file không có cột Nhóm)</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition shadow-sm cursor-pointer"
                    >
                        📁 Chọn file .xlsx
                    </button>
                </div>

                {importResults.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1 border border-gray-100 max-h-48 overflow-y-auto">
                        <p className="font-semibold text-gray-700 mb-1">Kết quả import gần nhất:</p>
                        {importResults.map((r, i) => <p key={i}>{r}</p>)}
                    </div>
                )}
            </div>

            {/* Modal Xem Trước Dữ Liệu Excel (Preview & Validation) */}
            {showPreviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-gray-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/60 to-emerald-50/60">
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <span>🔍 Kiểm tra file Excel trước khi Import</span>
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Xem trước và kiểm tra các dòng thêm mới, cập nhật và lỗi trước khi lưu vào hệ thống.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setShowPreviewModal(false); setPreviewRows([]) }}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Stats Cards */}
                        <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white p-3 rounded-xl border border-gray-200/70 shadow-xs">
                                <p className="text-xs font-medium text-gray-500">Tổng số dòng</p>
                                <p className="text-xl font-bold text-gray-800 mt-0.5">{previewRows.length}</p>
                            </div>
                            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/70 shadow-xs">
                                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                                    <span>🟢</span> Thêm mới
                                </p>
                                <p className="text-xl font-bold text-emerald-700 mt-0.5">
                                    {previewRows.filter(r => r.status === 'new').length}
                                </p>
                            </div>
                            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/70 shadow-xs">
                                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                                    <span>🟡</span> Cập nhật
                                </p>
                                <p className="text-xl font-bold text-amber-700 mt-0.5">
                                    {previewRows.filter(r => r.status === 'update').length}
                                </p>
                            </div>
                            <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200/70 shadow-xs">
                                <p className="text-xs font-semibold text-rose-700 flex items-center gap-1">
                                    <span>🔴</span> Dòng lỗi
                                </p>
                                <p className="text-xl font-bold text-rose-700 mt-0.5">
                                    {previewRows.filter(r => r.status === 'error').length}
                                </p>
                            </div>
                        </div>

                        {/* Modal Table */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100/80 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                                            <th className="py-2.5 px-3 w-12 text-center">Dòng</th>
                                            <th className="py-2.5 px-3">Nhóm / Khối</th>
                                            <th className="py-2.5 px-3">Tên phòng</th>
                                            <th className="py-2.5 px-3">Tên GV</th>
                                            <th className="py-2.5 px-3 text-center">Sĩ số</th>
                                            <th className="py-2.5 px-3">Trạng thái & Chi tiết</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {previewRows.map((r, idx) => {
                                            const isErr = r.status === 'error'
                                            const isUpdate = r.status === 'update'
                                            const isNew = r.status === 'new'

                                            return (
                                                <tr
                                                    key={idx}
                                                    className={`transition-colors ${
                                                        isErr
                                                            ? 'bg-rose-50/60 hover:bg-rose-50'
                                                            : isUpdate
                                                            ? 'bg-amber-50/30 hover:bg-amber-50/50'
                                                            : 'hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <td className="py-2.5 px-3 text-center text-xs text-gray-400 font-mono">
                                                        {r.rowNumber}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-medium text-gray-700">
                                                        {r.groupName}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-semibold text-gray-900">
                                                        {r.roomName}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-gray-600">
                                                        {r.teacherName || <span className="text-gray-300 italic">Trống</span>}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center font-bold text-gray-700">
                                                        {r.capacity}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        {isErr && (
                                                            <div className="flex items-center gap-1.5 text-rose-600 text-xs font-semibold">
                                                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                                                <span>{r.errorReason}</span>
                                                            </div>
                                                        )}
                                                        {isNew && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                                                🟢 Thêm mới
                                                            </span>
                                                        )}
                                                        {isUpdate && (
                                                            <div className="flex flex-col gap-0.5 text-xs">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800 w-fit text-[11px]">
                                                                    🟡 Cập nhật
                                                                </span>
                                                                <span className="text-gray-500 text-[11px] mt-0.5">
                                                                    {r.existingCapacity !== r.capacity ? `Sĩ số: ${r.existingCapacity} ➔ ${r.capacity}` : `Sĩ số: ${r.capacity} (không đổi)`}
                                                                    {r.existingTeacher !== r.teacherName && (
                                                                        <span> · GV: ${r.existingTeacher || 'Chưa có'} ➔ ${r.teacherName || 'Trống'}</span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="text-xs">
                                {previewRows.some(r => r.status === 'error') ? (
                                    <p className="text-amber-700 font-medium">
                                        ⚠️ Có {previewRows.filter(r => r.status === 'error').length} dòng lỗi sẽ được bỏ qua. Hệ thống chỉ xử lý {previewRows.filter(r => r.status !== 'error').length} phòng hợp lệ.
                                    </p>
                                ) : (
                                    <p className="text-emerald-700 font-medium">
                                        ✅ Tất cả {previewRows.length} dòng đều hợp lệ và sẵn sàng lưu vào hệ thống!
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => { setShowPreviewModal(false); setPreviewRows([]) }}
                                    disabled={isImporting}
                                    className="flex-1 sm:flex-initial px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmImport}
                                    disabled={isImporting || previewRows.filter(r => r.status !== 'error').length === 0}
                                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-md transition-all cursor-pointer ${
                                        isImporting || previewRows.filter(r => r.status !== 'error').length === 0
                                            ? 'bg-gray-300 cursor-not-allowed shadow-none'
                                            : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                >
                                    {isImporting ? (
                                        <>
                                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                            <span>Đang import...</span>
                                        </>
                                    ) : (
                                        <span>🚀 Tiến hành Import ({previewRows.filter(r => r.status !== 'error').length} phòng)</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
})
