'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getVietnamNow } from '@/utils/dateUtils'

export interface AdvancePayment {
    id: string
    amount: number
    reason: string
    payer_name: string
    account_number: string
    bank: string
    report_month: string
    payment_date: string
    created_at: string
    created_by: string
}

/** Lấy danh sách tạm ứng */
export async function getAdvancePayments(startDate?: string, endDate?: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    let query = supabase
        .from('advance_payments')
        .select('*')
        .order('payment_date', { ascending: false })

    if (startDate) {
        query = query.gte('payment_date', startDate)
    }
    if (endDate) {
        query = query.lte('payment_date', endDate)
    }

    const { data, error } = await query

    if (error) return { error: error.message }
    return { data: data as AdvancePayment[] }
}

/** Tạo phiếu tạm ứng mới */
export async function createAdvancePayment(data: {
    amount: number
    reason: string
    payer_name: string
    account_number: string
    bank: string
    report_month: string
    payment_date: string
}) {
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
        return { error: 'Chỉ Admin mới có quyền thực hiện thao tác này' }
    }

    const { error } = await supabase
        .from('advance_payments')
        .insert({
            ...data,
            created_by: user.id
        })

    if (error) return { error: error.message }

    revalidatePath('/dashboard/finance')
    return { success: true }
}

/** Xóa phiếu tạm ứng */
export async function deleteAdvancePayment(id: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return { error: 'Không có quyền xóa' }
    }

    const { error } = await supabase
        .from('advance_payments')
        .delete()
        .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/finance')
    return { success: true }
}

/** Lấy tóm tắt công nợ theo thời gian */
export async function getDebtSummary(startDate: string, endDate: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    // 1. Lấy đơn giá suất ăn HS + GV
    const { data: settingsData } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['meal_price', 'teacher_meal_price'])

    const getVal = (k: string, def: string) => settingsData?.find(s => s.key === k)?.value || def
    const mealPrice = parseInt(getVal('meal_price', '25000')) || 25000
    const teacherMealPrice = parseInt(getVal('teacher_meal_price', '35000')) || 35000

    // 2. Tính tổng số suất HS trong khoảng thời gian
    const { data: reports } = await supabase
        .from('daily_reports')
        .select('salty_count, porridge_count, vegetarian_count')
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .eq('status', 'school_approved')

    const totalMeals = (reports || []).reduce((sum, r) => 
        sum + (Number(r.salty_count) || 0) + (Number(r.porridge_count) || 0) + (Number(r.vegetarian_count) || 0), 0)
    const totalMealMoney = totalMeals * mealPrice

    // 3. Tính tổng suất GV
    const { data: teacherReports } = await supabase
        .from('teacher_meal_reports')
        .select('salty_count, porridge_count, vegetarian_count')
        .gte('report_date', startDate)
        .lte('report_date', endDate)

    const teacherTotalMeals = (teacherReports || []).reduce((sum, r) =>
        sum + (Number(r.salty_count) || 0) + (Number(r.porridge_count) || 0) + (Number(r.vegetarian_count) || 0), 0)
    const teacherTotalMoney = teacherTotalMeals * teacherMealPrice

    // 4. Tính tổng tiền đã thu tạm ứng trong khoảng thời gian
    const { data: advances } = await supabase
        .from('advance_payments')
        .select('amount')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)

    const totalAdvance = (advances || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0)

    const totalAllMoney = totalMealMoney + teacherTotalMoney
    const overallDebt = totalAllMoney - totalAdvance

    return {
        totalMeals,
        totalMealMoney,
        totalAdvance,
        debt: totalMealMoney - totalAdvance,
        overallDebt,
        mealPrice,
        // Teacher meal data (riêng biệt)
        teacherTotalMeals,
        teacherTotalMoney,
        teacherMealPrice,
        totalAllMoney,
    }
}

export interface TeacherDebtDay {
    report_date: string
    salty_count: number
    vegetarian_count: number
    porridge_count: number
    total_meals: number
    total_money: number
    teacher_name: string | null
    class_name: string | null
    room_name: string | null
}

/** Lấy chi tiết nợ giáo viên theo từng ngày báo cáo */
export async function getTeacherDebtReport(startDate: string, endDate: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    // Lấy đơn giá GV
    const { data: settingsData } = await supabase
        .from('settings')
        .select('key, value')
        .eq('key', 'teacher_meal_price')

    const teacherMealPrice = parseInt(settingsData?.find(s => s.key === 'teacher_meal_price')?.value || '35000') || 35000

    // Lấy báo cáo suất ăn GV kèm thông tin lớp/phòng
    const { data: reports, error } = await supabase
        .from('teacher_meal_reports')
        .select(`
            report_date,
            salty_count,
            vegetarian_count,
            porridge_count,
            teacher_name,
            classes ( name, rooms ( name ) )
        `)
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .order('report_date', { ascending: false })

    if (error) return { error: error.message }

    const rows: TeacherDebtDay[] = (reports || []).map((r: any) => {
        const total = (r.salty_count || 0) + (r.vegetarian_count || 0) + (r.porridge_count || 0)
        return {
            report_date: r.report_date,
            salty_count: r.salty_count || 0,
            vegetarian_count: r.vegetarian_count || 0,
            porridge_count: r.porridge_count || 0,
            total_meals: total,
            total_money: total * teacherMealPrice,
            teacher_name: r.teacher_name || null,
            class_name: r.classes?.name || null,
            room_name: r.classes?.rooms?.name || null,
        }
    })

    const grandTotal = rows.reduce((s, r) => s + r.total_meals, 0)
    const grandMoney = rows.reduce((s, r) => s + r.total_money, 0)

    return {
        rows,
        grandTotal,
        grandMoney,
        teacherMealPrice,
    }
}

