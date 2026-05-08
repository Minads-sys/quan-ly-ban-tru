'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getSessionInfo } from '@/lib/session'

export interface TeacherMealReport {
    id: string
    report_date: string
    salty_count: number
    porridge_count: number
    vegetarian_count: number
    note: string | null
    created_by: string | null
    updated_by: string | null
    created_at: string
    updated_at: string
}

/** Lấy báo cáo suất ăn GV theo ngày */
export async function getTeacherMealReport(date: string): Promise<{ report: TeacherMealReport | null; error?: string }> {
    const supabase = await createClient()
    const { userId } = await getSessionInfo()
    if (!userId) return { report: null, error: 'Chưa đăng nhập' }

    const { data, error } = await supabase
        .from('teacher_meal_reports')
        .select('*')
        .eq('report_date', date)
        .maybeSingle()

    if (error) return { report: null, error: error.message }
    return { report: data as TeacherMealReport | null }
}

/** Lấy báo cáo suất ăn GV theo khoảng ngày (cho báo cáo / tài chính) */
export async function getTeacherMealReportsRange(startDate: string, endDate: string) {
    const supabase = await createClient()
    const { userId } = await getSessionInfo()
    if (!userId) return { reports: [], error: 'Chưa đăng nhập' }

    const { data, error } = await supabase
        .from('teacher_meal_reports')
        .select('*')
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .order('report_date', { ascending: true })

    if (error) return { reports: [], error: error.message }
    return { reports: (data || []) as TeacherMealReport[] }
}

/** Tạo/cập nhật báo cáo suất ăn GV (chỉ admin + school_approver) */
export async function upsertTeacherMealReport(
    date: string,
    data: {
        salty_count: number
        porridge_count: number
        vegetarian_count: number
        note?: string
    }
) {
    const supabase = await createClient()
    const { userId, userRole } = await getSessionInfo()
    if (!userId) return { error: 'Chưa đăng nhập' }

    // Chỉ admin + school_approver được phép
    if (!['admin', 'school_approver'].includes(userRole || '')) {
        return { error: 'Chỉ Admin hoặc GV cấp trường mới được nhập suất GV' }
    }

    // Kiểm tra đã có báo cáo chưa
    const { data: existing } = await supabase
        .from('teacher_meal_reports')
        .select('id')
        .eq('report_date', date)
        .maybeSingle()

    if (existing) {
        // Update
        const { error } = await supabase
            .from('teacher_meal_reports')
            .update({
                salty_count: data.salty_count,
                porridge_count: data.porridge_count,
                vegetarian_count: data.vegetarian_count,
                note: data.note || null,
                updated_by: userId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)

        if (error) return { error: error.message }
    } else {
        // Insert
        const { error } = await supabase
            .from('teacher_meal_reports')
            .insert({
                report_date: date,
                salty_count: data.salty_count,
                porridge_count: data.porridge_count,
                vegetarian_count: data.vegetarian_count,
                note: data.note || null,
                created_by: userId,
                updated_by: userId,
            })

        if (error) return { error: error.message }
    }

    revalidatePath('/dashboard/kitchen')
    return { success: true }
}
