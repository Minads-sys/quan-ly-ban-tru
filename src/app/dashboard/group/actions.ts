'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Lấy danh sách lớp + báo cáo trong phòng (cho room_manager) */
export async function getGroupReports() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, room_id, group_id')
        .eq('id', user.id)
        .single()

    if (!profile) return { error: 'Không tìm thấy profile' }

    const isAdmin = profile.role === 'admin'
    const today = new Date().toISOString().split('T')[0]

    // Lấy các phòng quản lý
    let roomsQuery = supabase
        .from('rooms')
        .select('*, groups(name)')
        .order('name')

    if (!isAdmin) {
        if (profile.role === 'group_manager' && profile.group_id) {
            roomsQuery = roomsQuery.eq('group_id', profile.group_id)
        } else if (profile.room_id) {
            roomsQuery = roomsQuery.eq('id', profile.room_id)
        } else {
            return { classes: [], today, roomName: '' } // fallback structure name until renamed
        }
    }

    const { data: dbRooms } = await roomsQuery

    // Lấy báo cáo hôm nay cho các phòng
    const roomIds = dbRooms?.map(r => r.id) || []
    let reports: Record<string, unknown>[] = []

    if (roomIds.length > 0) {
        const { data } = await supabase
            .from('daily_reports')
            .select('*')
            .eq('report_date', today)
            .in('room_id', roomIds)
        reports = data || []
    }

    // Map reports vào rooms (giữ tên biến classes để tương thích UI tạm thời, hoặc đổi luôn)
    const roomsWithReports = dbRooms?.map(r => ({
        ...r,
        report: reports.find(rep => rep.room_id === r.id) || null,
    })) || []

    // Lấy thông tin nhóm/phòng cho header
    let headerName = 'Tất cả'
    if (profile.role === 'group_manager' && profile.group_id) {
         const { data: group } = await supabase.from('groups').select('name').eq('id', profile.group_id).single()
         headerName = group?.name || ''
    } else if (profile.room_id) {
        const { data: room } = await supabase.from('rooms').select('name').eq('id', profile.room_id).single()
        headerName = room?.name || ''
    }

    return { classes: roomsWithReports, today, roomName: headerName }
}

/** Duyệt phòng: chuyển tất cả submitted → room_approved */
export async function approveReport(reportId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { error } = await supabase
        .from('daily_reports')
        .update({
            status: 'room_approved',
            updated_by: user.id,
        })
        .eq('id', reportId)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/group')
    return { success: true }
}

/** Từ chối một báo cáo */
export async function rejectReport(reportId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { error } = await supabase
        .from('daily_reports')
        .update({
            status: 'rejected',
            updated_by: user.id,
        })
        .eq('id', reportId)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/group')
    return { success: true }
}

/** Duyệt tất cả submitted trong phòng → room_approved */
export async function approveAll() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, room_id, group_id')
        .eq('id', user.id)
        .single()

    if (!profile) return { error: 'Không tìm thấy profile' }

    const today = new Date().toISOString().split('T')[0]

    // Lấy room_ids trong phạm vi quản lý
    let roomsQuery = supabase.from('rooms').select('id')
    if (profile.role !== 'admin') {
        if (profile.role === 'group_manager' && profile.group_id) {
            roomsQuery = roomsQuery.eq('group_id', profile.group_id)
        } else if (profile.room_id) {
            roomsQuery = roomsQuery.eq('id', profile.room_id)
        } else {
            return { error: 'Không quyền truy cập' }
        }
    }
    const { data: rooms } = await roomsQuery
    const roomIds = rooms?.map(r => r.id) || []

    if (roomIds.length === 0) return { error: 'Không có phòng' }

    const { error } = await supabase
        .from('daily_reports')
        .update({
            status: 'room_approved',
            updated_by: user.id,
        })
        .eq('report_date', today)
        .eq('status', 'submitted')
        .in('room_id', roomIds)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/group')
    return { success: true }
}
