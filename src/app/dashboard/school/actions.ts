'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Lấy tất cả reports theo nhóm cho school_approver */
export async function getSchoolReports() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !['admin', 'school_approver'].includes(profile.role)) {
        return { error: 'Không có quyền' }
    }

    const today = new Date().toISOString().split('T')[0]

    // Lấy tất cả nhóm
    const { data: groups } = await supabase
        .from('groups')
        .select('*')
        .order('name')

    // Lấy tất cả phòng
    const { data: rooms } = await supabase
        .from('rooms')
        .select('*, groups(name)')
        .order('name')

    // Lấy tất cả lớp
    const { data: classes } = await supabase
        .from('classes')
        .select('*')
        .order('name')

    // Lấy tất cả reports hôm nay
    const { data: reports } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('report_date', today)

    return { groups: groups || [], rooms: rooms || [], classes: classes || [], reports: reports || [], today }
}

/** Duyệt cấp trường cho 1 phòng (tất cả báo cáo room_approved → school_approved) */
export async function approveRoom(roomId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const today = new Date().toISOString().split('T')[0]

    // Lấy class_ids trong phòng này
    const { data: classesInRoom } = await supabase
        .from('classes')
        .select('id')
        .eq('room_id', roomId)

    const classIds = classesInRoom?.map(c => c.id) || []
    if (classIds.length === 0) return { error: 'Không tìm thấy lớp trong phòng' }

    const { error } = await supabase
        .from('daily_reports')
        .update({ status: 'school_approved', updated_by: user.id })
        .eq('report_date', today)
        .eq('status', 'room_approved')
        .in('class_id', classIds)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/school')
    return { success: true }
}

/** Duyệt toàn bộ nhóm */
export async function approveGroup(groupId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const today = new Date().toISOString().split('T')[0]

    // Lấy room_ids trong nhóm
    const { data: roomsInGroup } = await supabase
        .from('rooms')
        .select('id')
        .eq('group_id', groupId)

    const roomIds = roomsInGroup?.map(r => r.id) || []
    if (roomIds.length === 0) return { error: 'Không có phòng trong nhóm' }

    // Lấy class_ids trong các phòng
    const { data: classesInRooms } = await supabase
        .from('classes')
        .select('id')
        .in('room_id', roomIds)

    const classIds = classesInRooms?.map(c => c.id) || []
    if (classIds.length === 0) return { error: 'Không có lớp trong nhóm' }

    const { error } = await supabase
        .from('daily_reports')
        .update({ status: 'school_approved', updated_by: user.id })
        .eq('report_date', today)
        .eq('status', 'room_approved')
        .in('class_id', classIds)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/school')
    return { success: true }
}

/** Duyệt toàn trường */
export async function approveSchool() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase
        .from('daily_reports')
        .update({ status: 'school_approved', updated_by: user.id })
        .eq('report_date', today)
        .eq('status', 'room_approved')

    if (error) return { error: error.message }
    revalidatePath('/dashboard/school')
    return { success: true }
}
