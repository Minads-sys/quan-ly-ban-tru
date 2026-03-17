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
export async function getAdvancePayments(month?: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    let query = supabase
        .from('advance_payments')
        .select('*')
        .order('payment_date', { ascending: false })

    if (month) {
        query = query.eq('report_month', month)
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

/** Lấy tóm tắt công nợ theo tháng */
export async function getDebtSummary(month: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    // 1. Lấy đơn giá suất ăn
    const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'meal_price')
        .single()
    const mealPrice = parseInt(settings?.value || '25000') || 25000

    // 2. Tính tổng số suất trong tháng
    const [m, y] = month.split('/')
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate()
    const startDate = `${y}-${m}-01`
    const endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`

    const { data: reports } = await supabase
        .from('daily_reports')
        .select('salty_count, porridge_count, vegetarian_count')
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .eq('status', 'approved')

    const totalMeals = (reports || []).reduce((sum, r) => 
        sum + (Number(r.salty_count) || 0) + (Number(r.porridge_count) || 0) + (Number(r.vegetarian_count) || 0), 0)
    const totalMealMoney = totalMeals * mealPrice

    // 3. Tính tổng tiền đã thu tạm ứng trong tháng
    const { data: advances } = await supabase
        .from('advance_payments')
        .select('amount')
        .eq('report_month', month)

    const totalAdvance = (advances || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0)

    return {
        totalMeals,
        totalMealMoney,
        totalAdvance,
        debt: totalMealMoney - totalAdvance,
        mealPrice
    }
}
