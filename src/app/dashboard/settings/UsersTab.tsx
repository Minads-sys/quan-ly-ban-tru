'use client'

import React, { useState, useEffect, useCallback, memo } from 'react'
import {
    getGroups, getRooms, getClasses, getUsers,
    createUser, updateUser, changeUserPassword
} from './actions'

interface Group { id: string; name: string }
interface Room { id: string; name: string; groups: { name: string } | null }
interface ClassItem { id: string; name: string; rooms: { name: string } | null }
interface User {
    id: string; email: string; full_name: string; role: string;
    room_id: string | null; group_id: string | null; class_id: string | null;
    rooms: { name: string } | null; groups: { name: string } | null; classes: { name: string } | null
}

interface UsersTabProps {
    onMessage: (type: 'success' | 'error', text: string) => void
}

const roleLabels: Record<string, string> = {
    admin: 'Quản trị viên', school_approver: 'GV cấp trường',
    group_manager: 'Quản lý nhóm', room_manager: 'Phụ trách phòng',
    reporter: 'Báo suất',
    class_teacher: 'Giáo viên lớp', kitchen: 'Bếp / Kế toán',
    meal_distributor: 'Chia suất',
}

export const UsersTab = memo(function UsersTab({ onMessage }: UsersTabProps) {
    const [loading, setLoading] = useState(true)
    const [groups, setGroups] = useState<Group[]>([])
    const [rooms, setRooms] = useState<Room[]>([])
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [users, setUsers] = useState<User[]>([])

    const [userForm, setUserForm] = useState({ email: '', password: '', fullName: '', role: 'class_teacher', roomId: '', groupId: '', classId: '' })
    const [editUserId, setEditUserId] = useState<string | null>(null)
    const [editUserForm, setEditUserForm] = useState({ fullName: '', role: 'class_teacher', roomId: '', groupId: '', classId: '' })
    const [pwChangeId, setPwChangeId] = useState<string | null>(null)
    const [pwChangeVal, setPwChangeVal] = useState('')

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [groupsData, roomsData, classesData, usersData] = await Promise.all([
                getGroups(), getRooms(), getClasses(), getUsers(),
            ])
            setGroups(groupsData.groups as Group[])
            setRooms(roomsData.rooms as Room[])
            setClasses(classesData.classes as ClassItem[])
            setUsers(usersData.users as User[])
        } catch (e) {
            console.error('[UsersTab loadData] error:', e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    async function handleCreateUser() {
        if (!userForm.email || !userForm.password || !userForm.fullName) return
        const result = await createUser(
            userForm.email, userForm.password, userForm.fullName, userForm.role,
            userForm.roomId || null, userForm.groupId || null
        )
        if (result.error) onMessage('error', result.error)
        else {
            onMessage('success', 'Đã tạo tài khoản!')
            setUserForm({ email: '', password: '', fullName: '', role: 'class_teacher', roomId: '', groupId: '', classId: '' })
            loadData()
        }
    }

    async function handleUpdateUser() {
        if (!editUserId) return
        const result = await updateUser(
            editUserId, editUserForm.fullName, editUserForm.role,
            editUserForm.roomId || null, editUserForm.groupId || null
        )
        if (result.error) onMessage('error', result.error)
        else { onMessage('success', 'Đã cập nhật!'); setEditUserId(null); loadData() }
    }

    async function handleChangePassword() {
        if (!pwChangeId || !pwChangeVal) return
        const result = await changeUserPassword(pwChangeId, pwChangeVal)
        if (result.error) onMessage('error', result.error)
        else { onMessage('success', 'Đã đổi mật khẩu thành công!'); setPwChangeId(null); setPwChangeVal('') }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-700 mb-4">➕ Tạo tài khoản mới</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Họ tên *</label>
                        <input type="text" placeholder="Nguyễn Văn A"
                            value={userForm.fullName} onChange={e => setUserForm({ ...userForm, fullName: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
                        <input type="email" placeholder="email@example.com"
                            value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Mật khẩu *</label>
                        <input type="password" placeholder="Ít nhất 6 ký tự"
                            value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Quyền</label>
                        <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none">
                            {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    {userForm.role === 'class_teacher' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Lớp phụ trách</label>
                            <select value={userForm.classId} onChange={e => setUserForm({ ...userForm, classId: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none">
                                <option value="">Chọn lớp</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.rooms?.name})</option>)}
                            </select>
                        </div>
                    )}
                    {userForm.role === 'room_manager' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Phòng phụ trách</label>
                            <select value={userForm.roomId} onChange={e => setUserForm({ ...userForm, roomId: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none">
                                <option value="">Chọn phòng</option>
                                {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.groups?.name})</option>)}
                            </select>
                        </div>
                    )}
                    {userForm.role === 'group_manager' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Nhóm quản lý</label>
                            <select value={userForm.groupId} onChange={e => setUserForm({ ...userForm, groupId: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none">
                                <option value="">Chọn nhóm</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                <button onClick={handleCreateUser}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-emerald-500 text-white rounded-xl text-sm font-semibold hover:from-blue-600 hover:to-emerald-600 shadow-md transition-all cursor-pointer">
                    👤 Tạo tài khoản
                </button>
            </div>

            {/* Users list */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-700">📋 Danh sách giáo viên ({users.length})</h3>
                </div>
                <div className="divide-y divide-gray-100">
                    {users.map(u => (
                        <div key={u.id} className="px-5 py-3">
                            {editUserId === u.id ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Họ tên</label>
                                            <input type="text" value={editUserForm.fullName}
                                                onChange={e => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Quyền</label>
                                            <select value={editUserForm.role}
                                                onChange={e => setEditUserForm({ ...editUserForm, role: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                                                {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                            </select>
                                        </div>
                                        {editUserForm.role === 'class_teacher' && (
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Lớp</label>
                                                <select value={editUserForm.classId}
                                                    onChange={e => setEditUserForm({ ...editUserForm, classId: e.target.value })}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                                                    <option value="">Chọn lớp</option>
                                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.rooms?.name})</option>)}
                                                </select>
                                            </div>
                                        )}
                                        {editUserForm.role === 'room_manager' && (
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Phòng</label>
                                                <select value={editUserForm.roomId}
                                                    onChange={e => setEditUserForm({ ...editUserForm, roomId: e.target.value })}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                                                    <option value="">Chọn phòng</option>
                                                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.groups?.name})</option>)}
                                                </select>
                                            </div>
                                        )}
                                        {editUserForm.role === 'group_manager' && (
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Nhóm</label>
                                                <select value={editUserForm.groupId}
                                                    onChange={e => setEditUserForm({ ...editUserForm, groupId: e.target.value })}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                                                    <option value="">Chọn nhóm</option>
                                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handleUpdateUser} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer">Lưu</button>
                                        <button onClick={() => setEditUserId(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 cursor-pointer">Hủy</button>
                                    </div>
                                </div>
                            ) : pwChangeId === u.id ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">🔒 Mật khẩu mới cho {u.full_name}</label>
                                        <input type="password" placeholder="Ít nhất 6 ký tự"
                                            value={pwChangeVal} onChange={e => setPwChangeVal(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-500" />
                                    </div>
                                    <button onClick={handleChangePassword} className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium mt-4 cursor-pointer">Đổi</button>
                                    <button onClick={() => { setPwChangeId(null); setPwChangeVal('') }} className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 mt-4 cursor-pointer">Hủy</button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-700 text-sm">{u.full_name}</p>
                                        <p className="text-xs text-gray-400">
                                            {u.email} · <span className="font-medium">{roleLabels[u.role] || u.role}</span>
                                            {u.rooms && <span> · Phòng: {u.rooms.name}</span>}
                                            {u.groups && <span> · Nhóm: {u.groups.name}</span>}
                                            {u.classes && <span> · Lớp: {u.classes.name}</span>}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => {
                                            setEditUserId(u.id)
                                            setEditUserForm({
                                                fullName: u.full_name, role: u.role,
                                                roomId: u.room_id || '', groupId: u.group_id || '',
                                                classId: u.class_id || '',
                                            })
                                        }} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 cursor-pointer">✏️ Sửa</button>
                                        <button onClick={() => { setPwChangeId(u.id); setPwChangeVal('') }}
                                            className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 border border-amber-200 cursor-pointer">🔒 Đổi MK</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {users.length === 0 && <p className="px-5 py-4 text-sm text-gray-400 italic">Chưa có tài khoản nào</p>}
                </div>
            </div>
        </div>
    )
})
