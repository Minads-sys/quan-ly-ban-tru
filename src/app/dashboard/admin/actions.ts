'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Tìm kiếm báo cáo theo ngày */
export async function searchReports(date: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    // Kiểm tra quyền admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return { error: 'Không có quyền truy cập' }
    }

    const { data: reports } = await supabase
        .from('daily_reports')
        .select('*, rooms(name, group_id, groups(name))')
        .eq('report_date', date)
        .order('created_at')

    return { reports: reports || [], date }
}

/** Admin ghi đè (override) báo cáo — bỏ qua mọi rào cản thời gian */
export async function overrideReport(
    reportId: string,
    data: {
        capacity: number
        absent_count: number
        porridge_count: number
        vegetarian_count: number
        salty_count: number
        note: string | null
        absent_list: { name: string; reason?: string }[]
    }
) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    // Kiểm tra quyền admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return { error: 'Chỉ Admin mới được ghi đè dữ liệu' }
    }

    const { error } = await supabase
        .from('daily_reports')
        .update({
            capacity: data.capacity,
            absent_count: data.absent_count,
            porridge_count: data.porridge_count,
            vegetarian_count: data.vegetarian_count,
            salty_count: data.salty_count,
            note: data.note,
            absent_list: data.absent_list,
            updated_by: user.id,
        })
        .eq('id', reportId)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/admin')
    return { success: true }
}

/** Admin tạo báo cáo mới cho phòng chưa có báo cáo */
export async function createReportForRoom(
    roomId: string,
    date: string,
    data: {
        capacity: number
        absent_count: number
        porridge_count: number
        vegetarian_count: number
        salty_count: number
        note: string | null
        absent_list: { name: string; reason?: string }[]
    }
) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return { error: 'Chỉ Admin mới được tạo báo cáo' }
    }

    const { error } = await supabase
        .from('daily_reports')
        .insert({
            room_id: roomId,
            report_date: date,
            capacity: data.capacity,
            absent_count: data.absent_count,
            porridge_count: data.porridge_count,
            vegetarian_count: data.vegetarian_count,
            salty_count: data.salty_count,
            note: data.note,
            absent_list: data.absent_list,
            status: 'approved',
            created_by: user.id,
            updated_by: user.id,
        })

    if (error) return { error: error.message }

    revalidatePath('/dashboard/admin')
    return { success: true }
}

/** Lấy danh sách phòng */
export async function getAllRooms() {
    const supabase = await createClient()
    const { data: rooms } = await supabase
        .from('rooms')
        .select('*, groups(name)')
        .order('name')
    return { rooms: rooms || [] }
}
