'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getSettings } from '@/app/dashboard/settings/actions'
import { getFormState, mapTimeSettings, getMilestoneStatus } from '@/utils/formState'
import { getSessionInfo } from '@/lib/session'
import { getVietnamNow } from '@/utils/dateUtils'

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
    const isSchoolApprover = profile.role === 'school_approver'
    const isReporter = profile.role === 'reporter'

    // Xây rooms query (cần profile trước)
    let roomsQuery = supabase
        .from('rooms')
        .select(`
            *,
            groups(name),
            profiles!room_id(full_name, role)
        `)
        .neq('name', 'Dữ liệu lịch sử (Import)')
        .order('name')

    if (!isAdmin && !isSchoolApprover && !isReporter) {
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
        getSettings(),
        roomsQuery,
    ])

    const { settings } = settingsResult
    const schoolName = settings?.find(s => s.key === 'school_name')?.value || ''
    const schoolAddress = settings?.find(s => s.key === 'school_address')?.value || ''

    let activeDate = selectedDate

    const now = getVietnamNow()
    const mappedSettings = mapTimeSettings(settings)
    const state = getFormState(now, mappedSettings)

    if (!activeDate) {
        activeDate = state.reportDate
    }
    
    // Tính trạng thái mốc 1 và mốc 2 dựa trên ngày activeDate
    const { isMoc1Closed, isMoc2Closed } = getMilestoneStatus(activeDate, now, mappedSettings)

    const dbRooms = roomsResult.data
    const roomIds = dbRooms?.map(r => r.id) || []

    // ⚡ Song song: reports + header name
    const headerPromise = (async () => {
        if (isSchoolApprover) {
            return 'Tất cả (xem)'
        } else if (isReporter) {
            return 'Tất cả'
        } else if (profile.role === 'group_manager' && profile.group_id) {
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

    return { 
        classes: roomsWithReports, 
        today: activeDate, 
        roomName: headerName,
        userRole: profile.role,
        schoolInfo: { name: schoolName, address: schoolAddress },
        isMoc1Closed,
        isMoc2Closed
    }
}

/** Duyệt phòng: chuyển tất cả submitted → school_approved (tạm tắt duyệt cấp trường) */
export async function approveReport(reportId: string) {
    const supabase = await createClient()

    // ⚡ Đọc user ID từ cookie
    const { userId } = await getSessionInfo()
    if (!userId) return { error: 'Chưa đăng nhập' }

    // Kiểm tra quyền
    const { data: profile } = await supabase.from('profiles').select('role, room_id, group_id').eq('id', userId).single()
    if (!profile) return { error: 'Lỗi xác thực' }
    if (profile.role === 'school_approver') return { error: 'Bạn chỉ có quyền xem, không được duyệt' }

    // Xác thực quyền với từng báo cáo con (bypass RLS requires software check)
    const { data: report } = await supabase.from('daily_reports').select('room_id').eq('id', reportId).single()
    if (!report) return { error: 'Không tìm thấy báo cáo' }

    if (profile.role !== 'admin' && profile.role !== 'reporter') {
        if (profile.role === 'group_manager' && profile.group_id) {
            const { data: roomGroup } = await supabase.from('rooms').select('group_id').eq('id', report.room_id).single()
            if (roomGroup?.group_id !== profile.group_id) return { error: 'Không quyền truy cập' }
        } else if (profile.room_id) {
            if (report.room_id !== profile.room_id) return { error: 'Không quyền truy cập' }
        } else {
            return { error: 'Không quyền truy cập' }
        }
    }

    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
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

    // Kiểm tra quyền
    const { data: profile } = await supabase.from('profiles').select('role, room_id, group_id').eq('id', userId).single()
    if (!profile) return { error: 'Lỗi xác thực' }
    if (profile.role === 'school_approver') return { error: 'Bạn chỉ có quyền xem, không được từ chối' }

    const { data: report } = await supabase.from('daily_reports').select('room_id').eq('id', reportId).single()
    if (!report) return { error: 'Không tìm thấy báo cáo' }

    if (profile.role !== 'admin' && profile.role !== 'reporter') {
        if (profile.role === 'group_manager' && profile.group_id) {
            const { data: roomGroup } = await supabase.from('rooms').select('group_id').eq('id', report.room_id).single()
            if (roomGroup?.group_id !== profile.group_id) return { error: 'Không quyền truy cập' }
        } else if (profile.room_id) {
            if (report.room_id !== profile.room_id) return { error: 'Không quyền truy cập' }
        } else {
            return { error: 'Không quyền truy cập' }
        }
    }

    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
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

    // Chặn school_approver
    if (profile.role === 'school_approver') return { error: 'Bạn chỉ có quyền xem, không được duyệt' }

    // Determine the active target date
    let activeDate = selectedDate
    if (!activeDate) {
        const { settings } = await getSettings()
        const now = new Date()
        const state = getFormState(now, mapTimeSettings(settings))
        activeDate = state.reportDate
    }

    // Lấy room_ids trong phạm vi quản lý
    let roomsQuery = supabase.from('rooms').select('id').neq('name', 'Dữ liệu lịch sử (Import)')
    if (profile.role !== 'admin' && profile.role !== 'reporter') {
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

    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
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
