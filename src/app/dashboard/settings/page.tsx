'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    getSettings, updateSetting,
    getGroups, createGroup, deleteGroup, updateGroup,
    getRooms, createRoom, updateRoom, deleteRoom,
    getUsers, createUser, updateUser, changeUserPassword,
    getClasses, createClass, updateClass, deleteClass,
    importRoomsFromExcel,
} from './actions'

type Tab = 'time' | 'rooms' | 'classes' | 'users'

interface Group { id: string; name: string; rooms: { count: number }[] }
interface Room { id: string; name: string; group_id: string; default_capacity: number; groups: { name: string } | null; teacherName?: string }
interface ClassItem { id: string; name: string; room_id: string; default_capacity: number; rooms: { name: string; groups: { name: string } | null } | null }
interface User {
    id: string; email: string; full_name: string; role: string;
    room_id: string | null; group_id: string | null; class_id: string | null;
    rooms: { name: string } | null; groups: { name: string } | null; classes: { name: string } | null
}

export default function SettingsPage() {
    const [tab, setTab] = useState<Tab>('time')
    const [loading, setLoading] = useState(true)
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Data
    const [moc1Open, setMoc1Open] = useState('07:00')
    const [moc1Close, setMoc1Close] = useState('16:00')
    const [moc2Open, setMoc2Open] = useState('23:59')
    const [moc2Close, setMoc2Close] = useState('07:00')
    const [noTimeLimit, setNoTimeLimit] = useState(false)
    const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
    const [offDays, setOffDays] = useState<string[]>([])
    const [schoolName, setSchoolName] = useState('')
    const [schoolAddress, setSchoolAddress] = useState('')
    const [mealPrice, setMealPrice] = useState(25000)
    const [groups, setGroups] = useState<Group[]>([])
    const [rooms, setRooms] = useState<Room[]>([])
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [users, setUsers] = useState<User[]>([])

    // Forms
    const [newGroupName, setNewGroupName] = useState('')
    const [editGroupId, setEditGroupId] = useState<string | null>(null)
    const [editGroupName, setEditGroupName] = useState('')

    const [roomForm, setRoomForm] = useState({ name: '', groupId: '', capacity: 30, teacherName: '' })
    const [editRoomId, setEditRoomId] = useState<string | null>(null)
    const [editRoomForm, setEditRoomForm] = useState({ name: '', groupId: '', capacity: 30, teacherName: '' })

    const [classForm, setClassForm] = useState({ name: '', roomId: '', capacity: 30 })
    const [editClassId, setEditClassId] = useState<string | null>(null)
    const [editClassForm, setEditClassForm] = useState({ name: '', roomId: '', capacity: 30 })

    const [userForm, setUserForm] = useState({ email: '', password: '', fullName: '', role: 'class_teacher', roomId: '', groupId: '', classId: '' })
    const [editUserId, setEditUserId] = useState<string | null>(null)
    const [editUserForm, setEditUserForm] = useState({ fullName: '', role: 'class_teacher', roomId: '', groupId: '', classId: '' })
    const [pwChangeId, setPwChangeId] = useState<string | null>(null)
    const [pwChangeVal, setPwChangeVal] = useState('')

    // Import Excel
    const [importGroupId, setImportGroupId] = useState('')
    const [importResults, setImportResults] = useState<string[]>([])

    // ⚡ Lazy load: chỉ tải data cho tab đang active
    const loadTabData = useCallback(async (activeTab: Tab) => {
        setLoading(true)
        switch (activeTab) {
            case 'time': {
                const settingsData = await getSettings()
                const allSettings = settingsData.settings as { key: string; value: string }[]
                const get = (k: string) => allSettings?.find(s => s.key === k)?.value
                if (get('moc1_open')) setMoc1Open(get('moc1_open')!)
                if (get('moc1_close')) setMoc1Close(get('moc1_close')!)
                if (get('moc2_open')) setMoc2Open(get('moc2_open')!)
                if (get('moc2_close')) setMoc2Close(get('moc2_close')!)
                setNoTimeLimit(get('deadline_no_limit') === 'true')
                
                if (get('working_days')) {
                    try { setWorkingDays(JSON.parse(get('working_days')!)) } catch {}
                }
                if (get('off_days')) {
                    try { setOffDays(JSON.parse(get('off_days')!)) } catch {}
                }

                setSchoolName(get('school_name') || '')
                setSchoolAddress(get('school_address') || '')
                setMealPrice(parseInt(get('meal_price') || '25000') || 25000)
                break
            }
            case 'rooms': {
                const [groupsData, roomsData] = await Promise.all([getGroups(), getRooms()])
                setGroups(groupsData.groups as Group[])
                setRooms(roomsData.rooms as Room[])
                break
            }
            case 'classes': {
                const [roomsData, classesData] = await Promise.all([getRooms(), getClasses()])
                setRooms(roomsData.rooms as Room[])
                setClasses(classesData.classes as ClassItem[])
                break
            }
            case 'users': {
                const [groupsData, roomsData, classesData, usersData] = await Promise.all([
                    getGroups(), getRooms(), getClasses(), getUsers(),
                ])
                setGroups(groupsData.groups as Group[])
                setRooms(roomsData.rooms as Room[])
                setClasses(classesData.classes as ClassItem[])
                setUsers(usersData.users as User[])
                break
            }
        }
        setLoading(false)
    }, [])

    useEffect(() => { loadTabData(tab) }, [tab, loadTabData])

    function showMsg(type: 'success' | 'error', text: string) {
        setMsg({ type, text })
        setTimeout(() => setMsg(null), 3000)
    }

    // ---- TIME ----
    async function handleSaveTime() {
        const results = await Promise.all([
            updateSetting('moc1_open', moc1Open),
            updateSetting('moc1_close', moc1Close),
            updateSetting('moc2_open', moc2Open),
            updateSetting('moc2_close', moc2Close),
            updateSetting('deadline_no_limit', noTimeLimit ? 'true' : 'false'),
            updateSetting('working_days', JSON.stringify(workingDays)),
            updateSetting('off_days', JSON.stringify(offDays)),
        ])
        const err = results.find(r => r.error)
        if (err?.error) showMsg('error', err.error)
        else showMsg('success', 'Đã lưu cài đặt thời gian!')
    }

    async function handleSaveSchoolInfo() {
        const results = await Promise.all([
            updateSetting('school_name', schoolName),
            updateSetting('school_address', schoolAddress),
            updateSetting('meal_price', mealPrice.toString()),
        ])
        const err = results.find(r => r.error)
        if (err?.error) showMsg('error', err.error)
        else showMsg('success', 'Đã lưu thông tin cấu hình!')
    }

    // ---- GROUPS ----
    async function handleCreateGroup() {
        if (!newGroupName.trim()) return
        const result = await createGroup(newGroupName.trim())
        if (result.error) showMsg('error', result.error)
        else { showMsg('success', 'Đã tạo nhóm!'); setNewGroupName(''); loadTabData(tab) }
    }
    async function handleUpdateGroup() {
        if (!editGroupId || !editGroupName.trim()) return
        const result = await updateGroup(editGroupId, editGroupName.trim())
        if (result.error) showMsg('error', result.error)
        else { showMsg('success', 'Đã sửa nhóm!'); setEditGroupId(null); loadTabData(tab) }
    }
    async function handleDeleteGroup(id: string) {
        if (!confirm('Xóa nhóm này? Tất cả phòng trong nhóm cũng sẽ bị xóa.')) return
        const result = await deleteGroup(id)
        if (result.error) showMsg('error', result.error)
        else { showMsg('success', 'Đã xóa nhóm!'); loadTabData(tab) }
    }

    // ---- ROOMS ----
    async function handleCreateRoom() {
        if (!roomForm.name.trim() || !roomForm.groupId) return
        const result = await createRoom(roomForm.name.trim(), roomForm.groupId, roomForm.capacity, roomForm.teacherName.trim())
        if (result.error) showMsg('error', result.error)
        else { showMsg('success', 'Đã tạo phòng!'); setRoomForm({ name: '', groupId: '', capacity: 30, teacherName: '' }); loadTabData(tab) }
    }
    async function handleUpdateRoom() {
        if (!editRoomId) return
        const result = await updateRoom(editRoomId, editRoomForm.name, editRoomForm.groupId, editRoomForm.capacity, editRoomForm.teacherName.trim())
        if (result.error) showMsg('error', result.error)
        else { showMsg('success', 'Đã sửa phòng!'); setEditRoomId(null); loadTabData(tab) }
    }
    async function handleDeleteRoom(id: string) {
        if (!confirm('Xóa phòng này?')) return
        const result = await deleteRoom(id)
        if (result.error) showMsg('error', result.error)
        else { showMsg('success', 'Đã xóa phòng!'); loadTabData(tab) }
    }

    // ---- CLASSES ----
    async function handleCreateClass() {
        if (!classForm.name.trim() || !classForm.roomId) return
        const result = await createClass(classForm.name.trim(), classForm.roomId, classForm.capacity)
        if (result.error) showMsg('error', result.error)
        else { showMsg('success', 'Đã tạo lớp!'); setClassForm({ name: '', roomId: '', capacity: 30 }); loadTabData(tab) }
    }
    async function handleUpdateClass() {
        if (!editClassId) return
        const result = await updateClass(editClassId, editClassForm.name, editClassForm.roomId, editClassForm.capacity)
        if (result.error) showMsg('error', result.error)
        else { showMsg('success', 'Đã sửa lớp!'); setEditClassId(null); loadTabData(tab) }
    }
    async function handleDeleteClass(id: string) {
        if (!confirm('Xóa lớp này?')) return
        const result = await deleteClass(id)
        if (result.error) showMsg('error', result.error)
        else { showMsg('success', 'Đã xóa lớp!'); loadTabData(tab) }
    }

    // ---- IMPORT EXCEL ----
    async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !importGroupId) {
            showMsg('error', 'Hãy chọn nhóm trước khi import')
            return
        }

        try {
            const XLSX = await import('xlsx')
            const buffer = await file.arrayBuffer()
            const workbook = XLSX.read(buffer)
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

            const rows = jsonData.slice(1).map((row: unknown[]) => ({
                roomName: String(row[0] || '').trim(),
                teacherName: String(row[1] || '').trim(),
                capacity: parseInt(String(row[2] || '0')) || 0,
                groupId: importGroupId,
            })).filter(r => r.roomName)

            if (rows.length === 0) {
                showMsg('error', 'File Excel trống hoặc sai định dạng')
                return
            }

            const result = await importRoomsFromExcel(rows)
            if (result.error) showMsg('error', result.error)
            else {
                showMsg('success', `Đã import ${rows.length} phòng!`)
                setImportResults(result.results || [])
                loadTabData(tab)
            }
        } catch {
            showMsg('error', 'Lỗi đọc file Excel. Đảm bảo file đúng định dạng .xlsx')
        }

        e.target.value = ''
    }

    // ---- USERS ----
    async function handleCreateUser() {
        if (!userForm.email || !userForm.password || !userForm.fullName) return
        const result = await createUser(
            userForm.email, userForm.password, userForm.fullName, userForm.role,
            userForm.roomId || null, userForm.groupId || null
        )
        if (result.error) showMsg('error', result.error)
        else {
            showMsg('success', 'Đã tạo tài khoản!')
            setUserForm({ email: '', password: '', fullName: '', role: 'class_teacher', roomId: '', groupId: '', classId: '' })
            loadTabData(tab)
        }
    }
    async function handleUpdateUser() {
        if (!editUserId) return
        const result = await updateUser(
            editUserId, editUserForm.fullName, editUserForm.role,
            editUserForm.roomId || null, editUserForm.groupId || null
        )
        if (result.error) showMsg('error', result.error)
        else { showMsg('success', 'Đã cập nhật!'); setEditUserId(null); loadTabData(tab) }
    }
    async function handleChangePassword() {
        if (!pwChangeId || !pwChangeVal) return
        const result = await changeUserPassword(pwChangeId, pwChangeVal)
        if (result.error) showMsg('error', result.error)
        else { showMsg('success', 'Đã đổi mật khẩu thành công!'); setPwChangeId(null); setPwChangeVal('') }
    }

    const roleLabels: Record<string, string> = {
        admin: 'Quản trị viên', school_approver: 'GV cấp trường',
        group_manager: 'Quản lý nhóm', room_manager: 'Phụ trách phòng',
        reporter: 'Báo suất',
        class_teacher: 'Giáo viên lớp', kitchen: 'Bếp / Kế toán',
        meal_distributor: 'Chia suất',
    }

    const tabs: { key: Tab; icon: string; label: string; color: string }[] = [
        { key: 'time', icon: '⏰', label: 'Thời gian', color: 'blue' },
        { key: 'rooms', icon: '🏫', label: 'Phòng & Nhóm', color: 'emerald' },
        { key: 'users', icon: '👤', label: 'Giáo viên', color: 'amber' },
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">⚙️ Cài đặt hệ thống</h2>

            {msg && (
                <div className={`rounded-xl p-3 mb-4 text-sm font-medium border ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg.text}</div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
                {tabs.map(t => {
                    const colorStyles: Record<string, string> = {
                        blue: 'bg-blue-50 text-blue-700 shadow-sm border border-blue-200',
                        emerald: 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200',
                        purple: 'bg-purple-50 text-purple-700 shadow-sm border border-purple-200',
                        amber: 'bg-amber-50 text-amber-700 shadow-sm border border-amber-200',
                    }
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                                tab === t.key ? colorStyles[t.color] || 'bg-white shadow-sm text-blue-700' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <span className="mr-1">{t.icon}</span> {t.label}
                        </button>
                    )
                })}
            </div>

            {/* =================== TAB: TIME =================== */}
            {tab === 'time' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="font-semibold text-gray-700 mb-2">⏰ Thời gian chốt suất</h3>
                        <p className="text-sm text-gray-500 mb-5">
                            Cấu hình 4 mốc thời gian: Mốc 1 (báo suất cho ngày mai) và Mốc 2 (bổ sung sáng ngày ăn).
                        </p>
                        <label className="flex items-center gap-3 mb-5 cursor-pointer select-none">
                            <div className="relative">
                                <input type="checkbox" checked={noTimeLimit}
                                    onChange={e => setNoTimeLimit(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
                                <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                            </div>
                            <span className="text-sm font-medium text-gray-700">Không giới hạn thời gian</span>
                        </label>
                        {noTimeLimit && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                                <p className="text-sm text-emerald-700">✅ Giáo viên có thể báo suất bất cứ lúc nào</p>
                            </div>
                        )}
                        {!noTimeLimit && (
                            <div className="space-y-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <h4 className="font-semibold text-blue-800 text-sm mb-3">🛒 Mốc 1 — Báo suất cho ngày mai</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-blue-700 mb-1">Mở form</label>
                                            <input type="time" value={moc1Open} onChange={e => setMoc1Open(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-xl border border-blue-200 text-base font-semibold focus:border-blue-500 outline-none bg-white text-black" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-blue-700 mb-1">Chốt (khóa)</label>
                                            <input type="time" value={moc1Close} onChange={e => setMoc1Close(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-xl border border-blue-200 text-base font-semibold focus:border-blue-500 outline-none bg-white text-black" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <h4 className="font-semibold text-amber-800 text-sm mb-3">☀️ Mốc 2 — Bổ sung sáng ngày ăn</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-amber-700 mb-1">Mở form</label>
                                            <input type="time" value={moc2Open} onChange={e => setMoc2Open(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-xl border border-amber-200 text-base font-semibold focus:border-amber-500 outline-none bg-white text-black" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-amber-700 mb-1">Chốt (khóa)</label>
                                            <input type="time" value={moc2Close} onChange={e => setMoc2Close(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-xl border border-amber-200 text-base font-semibold focus:border-amber-500 outline-none bg-white text-black" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* 📅 Lịch học & Báo suất */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <h3 className="font-semibold text-gray-700 mb-2">📅 Lịch học & Báo suất</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Chọn các ngày học trong tuần và cấu hình các ngày nghỉ lễ/đặc biệt. Hệ thống sẽ bỏ qua các ngày không học và nghỉ lễ.
                        </p>
                        
                        <div className="mb-5">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày học trong tuần</label>
                            <div className="flex flex-wrap gap-2">
                                {[{d: 1, l: 'T2'}, {d: 2, l: 'T3'}, {d: 3, l: 'T4'}, {d: 4, l: 'T5'}, {d: 5, l: 'T6'}, {d: 6, l: 'T7'}, {d: 0, l: 'CN'}].map(day => (
                                    <label key={day.d} className={`px-4 py-2 border rounded-lg cursor-pointer transition-colors text-sm font-medium ${workingDays.includes(day.d) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                        <input type="checkbox" className="hidden" 
                                            checked={workingDays.includes(day.d)}
                                            onChange={(e) => {
                                                if (e.target.checked) setWorkingDays([...workingDays, day.d].sort((a,b)=>a-b))
                                                else setWorkingDays(workingDays.filter(d => d !== day.d))
                                            }}
                                        />
                                        {day.l}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày nghỉ lễ / đặc biệt</label>
                            <div className="flex gap-2 mb-3">
                                <input type="date" className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500" 
                                    id="addOffDayInput"
                                />
                                <button type="button" 
                                    onClick={() => {
                                        const el = document.getElementById('addOffDayInput') as HTMLInputElement
                                        if (el && el.value && !offDays.includes(el.value)) {
                                            setOffDays([...offDays, el.value].sort())
                                            el.value = ''
                                        }
                                    }}
                                    className="px-4 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg text-sm hover:bg-blue-200 transition-colors"
                                >+ Thêm</button>
                            </div>
                            {offDays.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {offDays.map(od => {
                                        const [y, m, d] = od.split('-')
                                        return (
                                        <span key={od} className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-semibold">
                                            {`${d}/${m}/${y}`}
                                            <button onClick={() => setOffDays(offDays.filter(x => x !== od))} className="hover:text-red-900 text-base leading-none">&times;</button>
                                        </span>
                                    )})}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 italic">Chưa có ngày nghỉ nào</p>
                            )}
                        </div>
                    </div>
                    </div>

                    <button onClick={handleSaveTime}
                        className="px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 shadow-md transition-all w-fit">
                        💾 Lưu cài đặt thời gian
                    </button>

                    {/* Thông tin trường */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
                        <h3 className="font-semibold text-gray-700 mb-2">🏫 Thông tin trường</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Thông tin này sẽ hiển thị trên giao diện và phần in báo cáo.
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Tên trường</label>
                                <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)}
                                    placeholder="VD: Trường Tiểu học ABC"
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Địa chỉ</label>
                                <input type="text" value={schoolAddress} onChange={e => setSchoolAddress(e.target.value)}
                                    placeholder="VD: 123 Đường ABC, Quận XYZ, TP.HCM"
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Đơn giá suất ăn (VNĐ)</label>
                                <input type="number" value={mealPrice} onChange={e => setMealPrice(parseInt(e.target.value) || 0)}
                                    placeholder="25000"
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-blue-700 focus:border-blue-500 outline-none" />
                            </div>
                        </div>
                        <button onClick={handleSaveSchoolInfo}
                            className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 shadow-md transition-all">
                            💾 Lưu cấu hình
                        </button>
                    </div>
                </div>
            )}

            {/* =================== TAB: ROOMS =================== */}
            {tab === 'rooms' && (
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
                        <h3 className="font-semibold text-gray-700 mb-4">🏫 Quản lý Phòng</h3>
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
                        <div className="space-y-2">
                            {rooms.map(r => (
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
                            {rooms.length === 0 && <p className="text-sm text-gray-400 italic">Chưa có phòng nào</p>}
                        </div>
                    </div>

                    {/* Import Excel */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-700 mb-4">📥 Import phòng từ Excel</h3>
                        <p className="text-xs text-gray-500 mb-3">File Excel cần có 3 cột: <b>Tên phòng</b> | <b>Tên GV phòng</b> | <b>Sĩ số</b></p>
                        <div className="flex gap-2 mb-3">
                            <select value={importGroupId} onChange={e => setImportGroupId(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none">
                                <option value="">Chọn nhóm để import vào</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                            <label className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${importGroupId ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                                📁 Chọn file .xlsx
                                <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" disabled={!importGroupId} />
                            </label>
                        </div>
                        {importResults.length > 0 && (
                            <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                                {importResults.map((r, i) => <p key={i}>{r}</p>)}
                            </div>
                        )}
                    </div>
                </div>
            )}



            {/* =================== TAB: USERS =================== */}
            {tab === 'users' && (
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
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-emerald-500 text-white rounded-xl text-sm font-semibold hover:from-blue-600 hover:to-emerald-600 shadow-md transition-all">
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
                                                <button onClick={handleUpdateUser} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium">Lưu</button>
                                                <button onClick={() => setEditUserId(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-500">Hủy</button>
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
                                            <button onClick={handleChangePassword} className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium mt-4">Đổi</button>
                                            <button onClick={() => { setPwChangeId(null); setPwChangeVal('') }} className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 mt-4">Hủy</button>
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
                                                }} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">✏️ Sửa</button>
                                                <button onClick={() => { setPwChangeId(u.id); setPwChangeVal('') }}
                                                    className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 border border-amber-200">🔒 Đổi MK</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {users.length === 0 && <p className="px-5 py-4 text-sm text-gray-400 italic">Chưa có tài khoản nào</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
