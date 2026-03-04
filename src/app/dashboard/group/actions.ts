'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Lấy danh sách phòng + báo cáo trong nhóm */
export async function getGroupReports() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, group_id')
        .eq('id', user.id)
        .single()

    if (!profile) return { error: 'Không tìm thấy profile' }

    const isAdmin = profile.role === 'admin'
    const today = new Date().toISOString().split('T')[0]

    // Admin xem tất cả, group_manager chỉ xem nhóm mình
    let roomsQuery = supabase
        .from('rooms')
        .select('*, groups(name)')
        .order('name')

    if (!isAdmin && profile.group_id) {
        roomsQuery = roomsQuery.eq('group_id', profile.group_id)
    }

    const { data: rooms } = await roomsQuery

    // Lấy tất cả reports hôm nay
    const roomIds = rooms?.map(r => r.id) || []
    const { data: reports } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('report_date', today)
        .in('room_id', roomIds)

    // Map reports vào rooms
    const roomsWithReports = rooms?.map(room => ({
        ...room,
        report: reports?.find(r => r.room_id === room.id) || null,
    })) || []

    return { rooms: roomsWithReports, today }
}

/** Duyệt một báo cáo */
export async function approveReport(reportId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { error } = await supabase
        .from('daily_reports')
        .update({
            status: 'approved',
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

/** Duyệt tất cả báo cáo đang chờ */
export async function approveAll() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, group_id')
        .eq('id', user.id)
        .single()

    if (!profile) return { error: 'Không tìm thấy profile' }

    const today = new Date().toISOString().split('T')[0]

    // Lấy room_ids trong nhóm
    let roomsQuery = supabase.from('rooms').select('id')
    if (profile.role !== 'admin' && profile.group_id) {
        roomsQuery = roomsQuery.eq('group_id', profile.group_id)
    }
    const { data: rooms } = await roomsQuery
    const roomIds = rooms?.map(r => r.id) || []

    // Duyệt tất cả submitted reports
    const { error } = await supabase
        .from('daily_reports')
        .update({
            status: 'approved',
            updated_by: user.id,
        })
        .eq('report_date', today)
        .eq('status', 'submitted')
        .in('room_id', roomIds)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/group')
    return { success: true }
}
