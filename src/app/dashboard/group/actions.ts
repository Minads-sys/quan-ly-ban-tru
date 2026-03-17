'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getSettings } from '@/app/dashboard/settings/actions'
import { getFormState, mapTimeSettings } from '@/utils/formState'
import { getSessionInfo } from '@/lib/session'

/** Lấy danh sách lớp + báo cáo trong phòng (cho room_manager) */
export async function getGroupReports(selectedDate?: string) {
    const supabase = await createClient()

    // ⚡ Đọc user ID từ cookie (middleware đã set)
    const { userId } = await getSessionInfo()
    if (!userId) return { error: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, room_id, group_id')
        .eq('id', userId)
        .single()

    if (!profile) return { error: 'Không tìm thấy profile' }

    const isAdmin = profile.role === 'admin'

    // Xây rooms query (cần profile trước)
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
            return { classes: [], today: selectedDate || '', roomName: '' }
        }
    }

    // ⚡ Song song: settings + rooms query
    const [settingsResult, roomsResult] = await Promise.all([
        selectedDate ? null : getSettings(),
        roomsQuery,
    ])

    let activeDate = selectedDate
    if (!activeDate && settingsResult) {
        const now = new Date()
        const state = getFormState(now, mapTimeSettings(settingsResult.settings))
        activeDate = state.reportDate
    }

    const dbRooms = roomsResult.data
    const roomIds = dbRooms?.map(r => r.id) || []

    // ⚡ Song song: reports + header name
    const headerPromise = (async () => {
        if (profile.role === 'group_manager' && profile.group_id) {
            const { data: group } = await supabase.from('groups').select('name').eq('id', profile.group_id).single()
            return group?.name || ''
        } else if (profile.room_id) {
            const { data: room } = await supabase.from('rooms').select('name').eq('id', profile.room_id).single()
            return room?.name || ''
        }
        return 'Tất cả'
    })()

    const reportsPromise = roomIds.length > 0
        ? supabase.from('daily_reports').select('*').eq('report_date', activeDate!).in('room_id', roomIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] })

    const [headerName, reportsResult] = await Promise.all([headerPromise, reportsPromise])
    const reports = reportsResult.data || []

    // Map reports vào rooms
    const roomsWithReports = dbRooms?.map(r => {
        const managers = (r.profiles || []).filter((p: any) => p.role === 'room_manager')
        const teacherName = managers.length > 0 
            ? managers.map((m: any) => m.full_name).join(', ') 
            : (r.teacher_name || '')

        return {
            ...r,
            teacherName,
            report: reports.find((rep: any) => rep.room_id === r.id) || null,
        }
    }) || []

    return { classes: roomsWithReports, today: activeDate, roomName: headerName }
}

/** Duyệt phòng: chuyển tất cả submitted → school_approved (tạm tắt duyệt cấp trường) */
export async function approveReport(reportId: string) {
    const supabase = await createClient()

    // ⚡ Đọc user ID từ cookie
    const { userId } = await getSessionInfo()
    if (!userId) return { error: 'Chưa đăng nhập' }

    const { error } = await supabase
        .from('daily_reports')
        .update({
            status: 'school_approved',
            updated_by: userId,
        })
        .eq('id', reportId)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/group')
    return { success: true }
}

/** Từ chối một báo cáo */
export async function rejectReport(reportId: string) {
    const supabase = await createClient()

    // ⚡ Đọc user ID từ cookie
    const { userId } = await getSessionInfo()
    if (!userId) return { error: 'Chưa đăng nhập' }

    const { error } = await supabase
        .from('daily_reports')
        .update({
            status: 'rejected',
            updated_by: userId,
        })
        .eq('id', reportId)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/group')
    return { success: true }
}

/** Duyệt tất cả submitted trong phòng → school_approved (tạm tắt duyệt cấp trường) */
export async function approveAll(selectedDate?: string) {
    const supabase = await createClient()

    // ⚡ Đọc user ID từ cookie
    const { userId } = await getSessionInfo()
    if (!userId) return { error: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, room_id, group_id')
        .eq('id', userId)
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
            updated_by: userId,
        })
        .eq('report_date', activeDate)
        .eq('status', 'submitted')
        .in('room_id', roomIds)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/group')
    return { success: true }
}
