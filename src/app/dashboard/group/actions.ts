'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getSettings } from '@/app/dashboard/settings/actions'
import { getFormState, mapTimeSettings } from '@/utils/formState'

/** Lấy danh sách lớp + báo cáo trong phòng (cho room_manager) */
export async function getGroupReports(selectedDate?: string) {
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
    
    // Determine the active target date for reports
    let activeDate = selectedDate
    if (!activeDate) {
        const { settings } = await getSettings()
        const now = new Date()
        const state = getFormState(now, mapTimeSettings(settings))
        activeDate = state.reportDate
    }

    // Lấy các phòng quản lý
    let roomsQuery = supabase
        .from('rooms')
        .select(`
            *,
            groups(name),
            profiles!room_id(full_name, role)
        `)
        .order('name')

    if (!isAdmin) {
        if (profile.role === 'group_manager' && profile.group_id) {
            roomsQuery = roomsQuery.eq('group_id', profile.group_id)
        } else if (profile.room_id) {
            roomsQuery = roomsQuery.eq('id', profile.room_id)
        } else {
            return { classes: [], today: activeDate, roomName: '' } // fallback structure name until renamed
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
            .eq('report_date', activeDate)
            .in('room_id', roomIds)
        reports = data || []
    }

    // Map reports vào rooms (giữ tên biến classes để tương thích UI tạm thời, hoặc đổi luôn)
    const roomsWithReports = dbRooms?.map(r => {
        const managers = (r.profiles || []).filter((p: any) => p.role === 'room_manager')
        const teacherName = managers.length > 0 
            ? managers.map((m: any) => m.full_name).join(', ') 
            : (r.teacher_name || '')

        return {
            ...r,
            teacherName,
            report: reports.find(rep => rep.room_id === r.id) || null,
        }
    }) || []

    // Lấy thông tin nhóm/phòng cho header
    let headerName = 'Tất cả'
    if (profile.role === 'group_manager' && profile.group_id) {
         const { data: group } = await supabase.from('groups').select('name').eq('id', profile.group_id).single()
         headerName = group?.name || ''
    } else if (profile.room_id) {
        const { data: room } = await supabase.from('rooms').select('name').eq('id', profile.room_id).single()
        headerName = room?.name || ''
    }

    return { classes: roomsWithReports, today: activeDate, roomName: headerName }
}

/** Duyệt phòng: chuyển tất cả submitted → school_approved (tạm tắt duyệt cấp trường) */
export async function approveReport(reportId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { error } = await supabase
        .from('daily_reports')
        .update({
            status: 'school_approved',
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

/** Duyệt tất cả submitted trong phòng → school_approved (tạm tắt duyệt cấp trường) */
export async function approveAll(selectedDate?: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, room_id, group_id')
        .eq('id', user.id)
        .single()

    if (!profile) return { error: 'Không tìm thấy profile' }

    // Determine the active target date
    let activeDate = selectedDate
    if (!activeDate) {
        const { settings } = await getSettings()
        const now = new Date()
        const state = getFormState(now, mapTimeSettings(settings))
        activeDate = state.reportDate
    }

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
            status: 'school_approved',
            updated_by: user.id,
        })
        .eq('report_date', activeDate)
        .eq('status', 'submitted')
        .in('room_id', roomIds)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/group')
    return { success: true }
}
