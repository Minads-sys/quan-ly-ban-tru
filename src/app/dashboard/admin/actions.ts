'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Tìm kiếm báo cáo theo khoảng ngày */
export async function searchReportsRange(startDate: string, endDate: string) {
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
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .order('report_date', { ascending: false })

    const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'meal_price')
        .single()

    const mealPrice = parseInt(settings?.value || '25000') || 25000

    return { reports: reports || [], startDate, endDate, mealPrice }
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
            status: 'school_approved',
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

/** Nhập dữ liệu lịch sử từ Excel */
export async function importHistoricalReports(rows: {
    report_date: string,
    salty_count: number,
    porridge_count: number,
    vegetarian_count: number,
    note?: string
}[]) {
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
        return { error: 'Chỉ Admin mới được nhập dữ liệu lịch sử' }
    }

    // 1. Đảm bảo có nhóm "Hệ thống"
    let { data: group } = await supabase
        .from('groups')
        .select('id')
        .eq('name', 'Hệ thống')
        .single()
    
    if (!group) {
        const { data: newGroup, error: groupErr } = await supabase
            .from('groups')
            .insert({ name: 'Hệ thống' })
            .select('id')
            .single()
        if (groupErr) return { error: 'Lỗi tạo nhóm Hệ thống: ' + groupErr.message }
        group = newGroup
    }

    // 2. Đảm bảo có phòng "Dữ liệu lịch sử (Import)"
    let { data: room } = await supabase
        .from('rooms')
        .select('id')
        .eq('name', 'Dữ liệu lịch sử (Import)')
        .single()
    
    if (!room) {
        const { data: newRoom, error: roomErr } = await supabase
            .from('rooms')
            .insert({ 
                name: 'Dữ liệu lịch sử (Import)', 
                group_id: group!.id, 
                default_capacity: 0 
            })
            .select('id')
            .single()
        if (roomErr) return { error: 'Lỗi tạo phòng lịch sử: ' + roomErr.message }
        room = newRoom
    }

    // 3. Chuẩn bị dữ liệu insert
    const insertData = rows.map(row => ({
        report_date: row.report_date,
        room_id: room!.id,
        capacity: row.salty_count + row.porridge_count + row.vegetarian_count,
        absent_count: 0,
        salty_count: row.salty_count,
        porridge_count: row.porridge_count,
        vegetarian_count: row.vegetarian_count,
        note: row.note || 'Import lịch sử',
        status: 'school_approved',
        created_by: user.id,
        updated_by: user.id
    }))

    // 4. Thực hiện insert (upsert theo date + room_id nếu có constraint, 
    // ở đây ta chỉ dùng insert đơn giản vì mỗi ngày 1 dòng cho phòng này)
    const { error: insertErr } = await supabase
        .from('daily_reports')
        .insert(insertData)

    if (insertErr) return { error: 'Lỗi lưu dữ liệu: ' + insertErr.message }

    revalidatePath('/dashboard/admin')
    return { success: true, count: rows.length }
}
