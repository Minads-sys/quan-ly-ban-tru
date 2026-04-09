'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getSettings } from '@/app/dashboard/settings/actions'
import { getFormState, mapTimeSettings } from '@/utils/formState'

/** Lấy tất cả reports theo nhóm cho school_approver */
export async function getSchoolReports(selectedDate?: string) {
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

    let activeDate = selectedDate
    if (!activeDate) {
        const { settings } = await getSettings()
        const now = new Date()
        const state = getFormState(now, mapTimeSettings(settings))
        activeDate = state.reportDate
    }

    // Lấy tất cả nhóm
    const { data: groups } = await supabase
        .from('groups')
        .select('*')
        .order('name')

    // Lấy tất cả phòng
    const { data: dbRooms } = await supabase
        .from('rooms')
        .select(`
            *,
            groups(name),
            profiles!room_id(full_name, role)
        `)
        .neq('name', 'Dữ liệu lịch sử (Import)')
        .order('name')

    // Map teacherName vào rooms
    const rooms = (dbRooms || []).map(r => {
        const managers = (r.profiles || []).filter((p: any) => p.role === 'room_manager')
        const teacherName = managers.length > 0
            ? managers.map((m: any) => m.full_name).join(', ')
            : (r.teacher_name || '')
            
        return {
            ...r,
            teacherName
        }
    })

    // Lấy tất cả lớp
    const { data: classes } = await supabase
        .from('classes')
        .select('*')
        .order('name')

    // Lấy tất cả reports hôm nay
    const { data: reports } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('report_date', activeDate)

    return { groups: groups || [], rooms: rooms || [], classes: classes || [], reports: reports || [], today: activeDate }
}

/** Duyệt cấp trường cho 1 phòng (tất cả báo cáo room_approved → school_approved) */
export async function approveRoom(roomId: string, selectedDate?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    let activeDate = selectedDate
    if (!activeDate) {
        const { settings } = await getSettings()
        const now = new Date()
        const state = getFormState(now, mapTimeSettings(settings))
        activeDate = state.reportDate
    }

    const { error } = await supabase
        .from('daily_reports')
        .update({ status: 'school_approved', updated_by: user.id })
        .eq('report_date', activeDate)
        .eq('status', 'room_approved')
        .eq('room_id', roomId)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/school')
    return { success: true }
}

/** Duyệt toàn bộ nhóm */
export async function approveGroup(groupId: string, selectedDate?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    let activeDate = selectedDate
    if (!activeDate) {
        const { settings } = await getSettings()
        const now = new Date()
        const state = getFormState(now, mapTimeSettings(settings))
        activeDate = state.reportDate
    }

    // Lấy room_ids trong nhóm
    const { data: roomsInGroup } = await supabase
        .from('rooms')
        .select('id')
        .eq('group_id', groupId)

    const roomIds = roomsInGroup?.map(r => r.id) || []
    if (roomIds.length === 0) return { error: 'Không có phòng trong nhóm' }

    const { error } = await supabase
        .from('daily_reports')
        .update({ status: 'school_approved', updated_by: user.id })
        .eq('report_date', activeDate)
        .eq('status', 'room_approved')
        .in('room_id', roomIds)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/school')
    return { success: true }
}

/** Duyệt toàn trường */
export async function approveSchool(selectedDate?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    let activeDate = selectedDate
    if (!activeDate) {
        const { settings } = await getSettings()
        const now = new Date()
        const state = getFormState(now, mapTimeSettings(settings))
        activeDate = state.reportDate
    }

    const { error } = await supabase
        .from('daily_reports')
        .update({ status: 'school_approved', updated_by: user.id })
        .eq('report_date', activeDate)
        .eq('status', 'room_approved')

    if (error) return { error: error.message }
    revalidatePath('/dashboard/school')
    return { success: true }
}
