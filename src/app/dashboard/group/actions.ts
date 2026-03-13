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

    // Lấy các lớp trong phòng mình (room_manager) hoặc tất cả (admin)
    let classesQuery = supabase
        .from('classes')
        .select('*, rooms(name, groups(name))')
        .order('name')

    if (!isAdmin && profile.room_id) {
        classesQuery = classesQuery.eq('room_id', profile.room_id)
    }

    const { data: classes } = await classesQuery

    // Lấy báo cáo hôm nay cho các lớp
    const classIds = classes?.map(c => c.id) || []
    let reports: Record<string, unknown>[] = []

    if (classIds.length > 0) {
        const { data } = await supabase
            .from('daily_reports')
            .select('*')
            .eq('report_date', today)
            .in('class_id', classIds)
        reports = data || []
    }

    // Map reports vào classes
    const classesWithReports = classes?.map(cls => ({
        ...cls,
        report: reports.find(r => r.class_id === cls.id) || null,
    })) || []

    // Lấy thông tin phòng
    let roomName = ''
    if (profile.room_id) {
        const { data: room } = await supabase
            .from('rooms')
            .select('name')
            .eq('id', profile.room_id)
            .single()
        roomName = room?.name || ''
    }

    return { classes: classesWithReports, today, roomName }
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
        .select('role, room_id')
        .eq('id', user.id)
        .single()

    if (!profile) return { error: 'Không tìm thấy profile' }

    const today = new Date().toISOString().split('T')[0]

    // Lấy class_ids trong phòng
    let classesQuery = supabase.from('classes').select('id')
    if (profile.role !== 'admin' && profile.room_id) {
        classesQuery = classesQuery.eq('room_id', profile.room_id)
    }
    const { data: classes } = await classesQuery
    const classIds = classes?.map(c => c.id) || []

    if (classIds.length === 0) return { error: 'Không có lớp' }

    const { error } = await supabase
        .from('daily_reports')
        .update({
            status: 'room_approved',
            updated_by: user.id,
        })
        .eq('report_date', today)
        .eq('status', 'submitted')
        .in('class_id', classIds)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/group')
    return { success: true }
}
