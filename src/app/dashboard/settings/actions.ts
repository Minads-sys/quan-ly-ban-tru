'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// =============================================
// SETTINGS
// =============================================

/** Lấy tất cả settings */
export async function getSettings() {
    const supabase = await createClient()
    const { data } = await supabase
        .from('settings')
        .select('*')
        .order('key')
    return { settings: data || [] }
}

/** Cập nhật setting */
export async function updateSetting(key: string, value: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { error } = await supabase
        .from('settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    return { success: true }
}

/** Lấy giá trị thời gian chốt suất */
export async function getDeadlineTime(): Promise<string> {
    const supabase = await createClient()
    const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'deadline_time')
        .single()
    return data?.value || '07:00'
}

// =============================================
// GROUPS
// =============================================

/** Lấy danh sách nhóm */
export async function getGroups() {
    const supabase = await createClient()
    const { data } = await supabase
        .from('groups')
        .select('*, rooms(count)')
        .order('name')
    return { groups: data || [] }
}

/** Tạo nhóm mới */
export async function createGroup(name: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('groups').insert({ name })
    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    return { success: true }
}

/** Xóa nhóm */
export async function deleteGroup(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('groups').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    return { success: true }
}

/** Sửa tên nhóm */
export async function updateGroup(id: string, name: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('groups').update({ name }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    return { success: true }
}

// =============================================
// ROOMS
// =============================================

/** Lấy danh sách phòng */
export async function getRooms() {
    const supabase = await createClient()
    const { data } = await supabase
        .from('rooms')
        .select('*, groups(name)')
        .order('name')
    return { rooms: data || [] }
}

/** Tạo phòng mới */
export async function createRoom(name: string, groupId: string, defaultCapacity: number) {
    const supabase = await createClient()
    const { error } = await supabase.from('rooms').insert({
        name,
        group_id: groupId,
        default_capacity: defaultCapacity,
    })
    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    return { success: true }
}

/** Cập nhật phòng */
export async function updateRoom(id: string, name: string, groupId: string, defaultCapacity: number) {
    const supabase = await createClient()
    const { error } = await supabase.from('rooms').update({
        name,
        group_id: groupId,
        default_capacity: defaultCapacity,
    }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    return { success: true }
}

/** Xóa phòng */
export async function deleteRoom(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('rooms').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    return { success: true }
}

// =============================================
// USERS / PROFILES
// =============================================

/** Lấy danh sách user */
export async function getUsers() {
    const supabase = await createClient()
    const { data } = await supabase
        .from('profiles')
        .select('*, rooms(name), groups(name)')
        .order('full_name')
    return { users: data || [] }
}

/** Tạo user mới qua Supabase Admin API */
export async function createUser(
    email: string,
    password: string,
    fullName: string,
    role: string,
    roomId: string | null,
    groupId: string | null
) {
    const supabase = await createClient()

    // Kiểm tra quyền admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return { error: 'Không có quyền' }

    // Dùng admin client nếu có service_role key
    try {
        const { createAdminClient } = await import('@/lib/supabase/admin')
        const adminClient = createAdminClient()
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, role },
        })
        if (authError) return { error: authError.message }
        if (!authData.user) return { error: 'Không tạo được user' }

        // Cập nhật profile
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ full_name: fullName, role, room_id: roomId, group_id: groupId })
            .eq('id', authData.user.id)
        if (profileError) return { error: profileError.message }
    } catch {
        // Fallback: dùng signUp nếu không có service_role key
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email, password,
            options: { data: { full_name: fullName, role } },
        })
        if (authError) return { error: authError.message }
        if (!authData.user) return { error: 'Không tạo được user' }

        const { error: profileError } = await supabase
            .from('profiles')
            .update({ full_name: fullName, role, room_id: roomId, group_id: groupId })
            .eq('id', authData.user.id)
        if (profileError) return { error: profileError.message }
    }

    revalidatePath('/dashboard/settings')
    return { success: true }
}

/** Cập nhật profile user */
export async function updateUser(
    userId: string,
    fullName: string,
    role: string,
    roomId: string | null,
    groupId: string | null
) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('profiles')
        .update({
            full_name: fullName,
            role,
            room_id: roomId,
            group_id: groupId,
        })
        .eq('id', userId)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    return { success: true }
}

/** Admin đổi mật khẩu user */
export async function changeUserPassword(userId: string, newPassword: string) {
    const supabase = await createClient()

    // Kiểm tra quyền admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return { error: 'Không có quyền đổi mật khẩu' }

    if (!newPassword || newPassword.length < 6) {
        return { error: 'Mật khẩu phải có ít nhất 6 ký tự' }
    }

    try {
        const { createAdminClient } = await import('@/lib/supabase/admin')
        const adminClient = createAdminClient()
        const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword })
        if (error) return { error: error.message }
        return { success: true }
    } catch {
        return { error: 'Cần cấu hình SUPABASE_SERVICE_ROLE_KEY trong .env.local để đổi mật khẩu' }
    }
}
