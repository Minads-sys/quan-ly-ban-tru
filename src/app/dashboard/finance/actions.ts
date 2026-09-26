'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireAdmin } from '@/lib/auth'
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
    let auth
    try { auth = await requireAuth() } catch { return { error: 'Chưa đăng nhập' } }
    const { supabase } = auth

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
    let auth
    try { auth = await requireAdmin() } catch (e: any) { return { error: e.message } }
    const { supabase, userId } = auth

    const { error } = await supabase
        .from('advance_payments')
        .insert({
            ...data,
            created_by: userId
        })

    if (error) return { error: error.message }

    revalidatePath('/dashboard/finance')
    return { success: true }
}

/** Xóa phiếu tạm ứng */
export async function deleteAdvancePayment(id: string) {
    let auth
    try { auth = await requireAdmin() } catch (e: any) { return { error: e.message } }
    const { supabase } = auth

    const { error } = await supabase
        .from('advance_payments')
        .delete()
        .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/finance')
    return { success: true }
}

export interface PaymentRequest {
    id: string
    request_code: string
    title: string | null
    start_date: string
    end_date: string
    meal_type: 'all' | 'student' | 'teacher'
    student_meal_count: number
    student_meal_amount: number
    teacher_meal_count: number
    teacher_meal_amount: number
    total_amount: number
    status: 'pending' | 'paid' | 'cancelled'
    paid_at: string | null
    payment_method: string | null
    voucher_id: string | null
    note: string | null
    created_at: string
    created_by: string | null
}

async function getStoredPaymentRequestsFallback(supabase: any): Promise<PaymentRequest[]> {
    const { data } = await supabase.from('settings').select('value').eq('key', 'stored_payment_requests').single()
    if (!data?.value) return []
    try {
        return JSON.parse(data.value) as PaymentRequest[]
    } catch {
        return []
    }
}

async function saveStoredPaymentRequestsFallback(supabase: any, list: PaymentRequest[]) {
    await supabase.from('settings').upsert({
        key: 'stored_payment_requests',
        value: JSON.stringify(list),
        description: 'Dữ liệu lưu tạm Giấy Đề Nghị Thanh Toán',
        updated_at: new Date().toISOString()
    }, { onConflict: 'key' })
}

/** Lấy danh sách Giấy Đề Nghị Thanh Toán */
export async function getPaymentRequests(startDate?: string, endDate?: string): Promise<{ data: PaymentRequest[] } | { error: string }> {
    let auth
    try { auth = await requireAuth() } catch { return { error: 'Chưa đăng nhập' } }
    const { supabase } = auth

    try {
        let query = supabase.from('payment_requests').select('*').order('created_at', { ascending: false })
        if (startDate) query = query.gte('end_date', startDate)
        if (endDate) query = query.lte('start_date', endDate)
        const { data, error } = await query
        if (!error && data) {
            return { data: data as PaymentRequest[] }
        }
    } catch (e) {
        console.error('[getPaymentRequests] error:', e)
    }

    // Fallback store in settings
    const list = await getStoredPaymentRequestsFallback(supabase)
    let filtered = list
    if (startDate) filtered = filtered.filter(item => item.end_date >= startDate)
    if (endDate) filtered = filtered.filter(item => item.start_date <= endDate)
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return { data: filtered }
}

/** Tạo và lưu Giấy Đề Nghị Thanh Toán mới (trạng thái Chờ thanh toán) */
export async function createPaymentRequest(data: {
    start_date: string
    end_date: string
    meal_type: 'all' | 'student' | 'teacher'
    student_meal_count: number
    student_meal_amount: number
    teacher_meal_count: number
    teacher_meal_amount: number
    total_amount: number
    note?: string
}): Promise<{ success: boolean; data?: PaymentRequest; error?: string }> {
    let auth
    try { auth = await requireAuth() } catch { return { success: false, error: 'Chưa đăng nhập' } }
    const { supabase, userId } = auth

    // Sinh mã: DNTT-YYYYMM-XX
    const datePart = data.end_date.replace(/-/g, '').slice(0, 6)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString().slice(-2)
    const requestCode = `DNTT-${datePart}-${randomSuffix}`

    const newRecord: Omit<PaymentRequest, 'id'> = {
        request_code: requestCode,
        title: `Đề nghị thanh toán suất ăn bán trú từ ${data.start_date} đến ${data.end_date}`,
        start_date: data.start_date,
        end_date: data.end_date,
        meal_type: data.meal_type,
        student_meal_count: data.student_meal_count,
        student_meal_amount: data.student_meal_amount,
        teacher_meal_count: data.teacher_meal_count,
        teacher_meal_amount: data.teacher_meal_amount,
        total_amount: data.total_amount,
        status: 'pending',
        paid_at: null,
        payment_method: 'bank',
        voucher_id: null,
        note: data.note || null,
        created_at: new Date().toISOString(),
        created_by: userId
    }

    try {
        const { data: inserted, error } = await supabase
            .from('payment_requests')
            .insert(newRecord)
            .select()
            .single()

        if (!error && inserted) {
            revalidatePath('/dashboard/finance')
            return { success: true, data: inserted as PaymentRequest }
        }
    } catch (e) {
        console.error('[createPaymentRequest] error:', e)
    }

    // Fallback store in settings
    const list = await getStoredPaymentRequestsFallback(supabase)
    const fallbackRecord: PaymentRequest = {
        ...newRecord,
        id: 'pr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
    }
    list.unshift(fallbackRecord)
    await saveStoredPaymentRequestsFallback(supabase, list)
    revalidatePath('/dashboard/finance')
    return { success: true, data: fallbackRecord }
}

/** Hoàn tất thanh toán cho Giấy ĐNTT khi nhận được tiền (Tự động sinh Phiếu thu) */
export async function completePaymentRequest(
    id: string,
    paymentData: {
        payment_date: string
        payment_method: 'bank' | 'cash'
        amount: number
        payer_name?: string
        account_number?: string
        bank?: string
    }
): Promise<{ success: boolean; voucher?: AdvancePayment; error?: string }> {
    let auth
    try { auth = await requireAuth() } catch { return { success: false, error: 'Chưa đăng nhập' } }
    const { supabase, userId } = auth

    // 1. Lấy bản ghi Payment Request
    let targetRequest: PaymentRequest | null = null
    try {
        const { data } = await supabase.from('payment_requests').select('*').eq('id', id).single()
        if (data) targetRequest = data as PaymentRequest
    } catch (e) {
        console.error('[completePaymentRequest find] error:', e)
    }

    let isFallback = false
    let fallbackList: PaymentRequest[] = []
    if (!targetRequest) {
        fallbackList = await getStoredPaymentRequestsFallback(supabase)
        targetRequest = fallbackList.find(p => p.id === id) || null
        if (targetRequest) isFallback = true
    }

    if (!targetRequest) {
        return { success: false, error: 'Không tìm thấy Giấy Đề Nghị Thanh Toán' }
    }

    if (targetRequest.status === 'paid') {
        return { success: false, error: 'Giấy đề nghị này đã được hoàn tất thanh toán trước đó' }
    }

    // 2. Tự động sinh Phiếu Thu trong bảng advance_payments (sổ quỹ)
    const reasonText = `Thanh toán theo Giấy ĐNTT ${targetRequest.request_code} (từ ${targetRequest.start_date} đến ${targetRequest.end_date})`
    const voucherPayload = {
        amount: paymentData.amount,
        reason: reasonText,
        payer_name: paymentData.payer_name || 'Trường THPT Thanh Đa',
        account_number: paymentData.account_number || '',
        bank: paymentData.payment_method === 'cash' ? 'Tiền mặt' : (paymentData.bank || 'Ngân hàng ACB'),
        report_month: paymentData.payment_date.slice(0, 7),
        payment_date: paymentData.payment_date,
        created_by: userId
    }

    const { data: voucher, error: voucherErr } = await supabase
        .from('advance_payments')
        .insert(voucherPayload)
        .select()
        .single()

    if (voucherErr || !voucher) {
        return { success: false, error: 'Lỗi khi tạo phiếu thu tiền: ' + (voucherErr?.message || '') }
    }

    // 3. Cập nhật trạng thái Payment Request -> paid
    if (!isFallback) {
        try {
            await supabase
                .from('payment_requests')
                .update({
                    status: 'paid',
                    paid_at: paymentData.payment_date,
                    payment_method: paymentData.payment_method,
                    voucher_id: voucher.id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
        } catch (e) {
            console.error('[completePaymentRequest update] error:', e)
        }
    } else {
        const idx = fallbackList.findIndex(p => p.id === id)
        if (idx !== -1) {
            fallbackList[idx].status = 'paid'
            fallbackList[idx].paid_at = paymentData.payment_date
            fallbackList[idx].payment_method = paymentData.payment_method
            fallbackList[idx].voucher_id = voucher.id
            await saveStoredPaymentRequestsFallback(supabase, fallbackList)
        }
    }

    revalidatePath('/dashboard/finance')
    return { success: true, voucher: voucher as AdvancePayment }
}

/** Xóa / Hủy Giấy Đề Nghị Thanh Toán */
export async function deletePaymentRequest(id: string): Promise<{ success: boolean; error?: string }> {
    let auth
    try { auth = await requireAdmin() } catch (e: any) { return { success: false, error: e.message } }
    const { supabase } = auth

    try {
        const { error } = await supabase.from('payment_requests').delete().eq('id', id)
        if (!error) {
            revalidatePath('/dashboard/finance')
            return { success: true }
        }
    } catch (e) {
        console.error('[deletePaymentRequest] error:', e)
    }

    const list = await getStoredPaymentRequestsFallback(supabase)
    const nextList = list.filter(p => p.id !== id)
    await saveStoredPaymentRequestsFallback(supabase, nextList)
    revalidatePath('/dashboard/finance')
    return { success: true }
}

/** Lấy tóm tắt công nợ theo thời gian */
export async function getDebtSummary(startDate: string, endDate: string) {
    let auth
    try { auth = await requireAuth() } catch { return { error: 'Chưa đăng nhập' } }
    const { supabase } = auth

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
    let auth
    try { auth = await requireAuth() } catch { return { error: 'Chưa đăng nhập' } }
    const { supabase } = auth

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

export interface CompanyPaymentSettings {
    companyName: string
    companyAddress: string
    companyTaxCode: string
    companyRepresentative: string
    companyPosition: string
    bankAccountHolder: string
    bankAccountNumber: string
    bankName: string
    schoolName: string
    schoolRepresentative: string
    principalName: string
    city: string
    canPrint: boolean
    userRole: string
    allowedPrintRoles: string[]
}

/** Lấy thông tin công ty, ngân hàng và quyền in Giấy đề nghị thanh toán */
export async function getCompanyAndPaymentSettings(): Promise<{ settings: CompanyPaymentSettings } | { error: string }> {
    let auth
    try { auth = await requireAuth() } catch { return { error: 'Chưa đăng nhập' } }
    const { supabase, userId, userRole } = auth

    const { data: settingsData } = await supabase
        .from('settings')
        .select('key, value')

    const getVal = (k: string, def: string) => settingsData?.find(s => s.key === k)?.value || def

    const allowedRolesRaw = getVal('payment_request_allowed_roles', '["admin"]')
    let allowedRoles: string[] = ['admin']
    try {
        allowedRoles = JSON.parse(allowedRolesRaw)
    } catch (e) {
        console.error('[getPaymentRequestPrintData] error parsing allowedRoles:', e)
    }

    const allowedUsersRaw = getVal('payment_request_allowed_users', '[]')
    let allowedUsers: string[] = []
    try {
        allowedUsers = JSON.parse(allowedUsersRaw)
    } catch (e) {
        console.error('[getPaymentRequestPrintData] error parsing allowedUsers:', e)
    }

    // Admin luôn có quyền; hoặc vai trò nằm trong danh sách được phân quyền; hoặc user ID cụ thể
    const canPrint = userRole === 'admin' || allowedRoles.includes(userRole) || allowedUsers.includes(userId)

    return {
        settings: {
            companyName: getVal('company_name', 'CÔNG TY TNHH CHÂU PHƯƠNG THẢO'),
            companyAddress: getVal('company_address', '20A Ngô Đức Kế, Phường Bình Thạnh, TP Hồ Chí Minh'),
            companyTaxCode: getVal('company_tax_code', '0317986511'),
            companyRepresentative: getVal('company_representative', 'Bà NGUYỄN THỊ THU TRANG'),
            companyPosition: getVal('company_position', 'Chủ tịch hội đồng thành viên'),
            bankAccountHolder: getVal('company_bank_account_holder', 'CÔNG TY TNHH CĂN TIN CHÂU PHƯƠNG THẢO'),
            bankAccountNumber: getVal('company_bank_account_number', '667879888'),
            bankName: getVal('company_bank_name', 'Ngân hàng Á Châu - ACB'),
            schoolName: getVal('school_name', 'Trường THPT Thanh Đa'),
            schoolRepresentative: getVal('school_representative', 'LÊ THỊ HÀ GIANG'),
            principalName: getVal('principal_name', 'TRẦN KHẮC HUY'),
            city: getVal('company_city', 'Tp Hồ Chí Minh'),
            canPrint,
            userRole,
            allowedPrintRoles: allowedRoles,
        }
    }
}

export interface ReconciliationDayRow {
    date: string
    formattedDate: string
    dayOfWeek: string
    totalMeals: number
    unitPrice: number
    totalAmount: number
    note: string
}

export interface ReconciliationResult {
    type: 'student' | 'teacher'
    startDate: string
    endDate: string
    schoolName: string
    schoolRepresentative: string
    companyName: string
    companyRepresentative: string
    companyCity: string
    unitPrice: number
    rows: ReconciliationDayRow[]
    grandTotalMeals: number
    grandTotalAmount: number
    canPrint: boolean
}

function getDatesInRange(startStr: string, endStr: string): string[] {
    const dates: string[] = []
    if (!startStr || !endStr) return dates
    const [sy, sm, sd] = startStr.split('-').map(Number)
    const [ey, em, ed] = endStr.split('-').map(Number)
    const cur = new Date(Date.UTC(sy, sm - 1, sd))
    const end = new Date(Date.UTC(ey, em - 1, ed))

    while (cur <= end) {
        const y = cur.getUTCFullYear()
        const m = String(cur.getUTCMonth() + 1).padStart(2, '0')
        const d = String(cur.getUTCDate()).padStart(2, '0')
        dates.push(`${y}-${m}-${d}`)
        cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return dates
}

/** Lấy dữ liệu Biên bản đối chiếu cung cấp suất ăn (Học sinh hoặc Giáo viên) */
export async function getReconciliationData(
    type: 'student' | 'teacher',
    startDate: string,
    endDate: string,
    customUnitPrice?: number
): Promise<{ data: ReconciliationResult } | { error: string }> {
    let auth
    try { auth = await requireAuth() } catch { return { error: 'Chưa đăng nhập' } }
    const { supabase, userRole } = auth

    // 1. Lấy cài đặt hệ thống
    const { data: settingsData } = await supabase
        .from('settings')
        .select('key, value')

    const getVal = (k: string, def: string) => settingsData?.find(s => s.key === k)?.value || def

    const allowedRolesRaw = getVal('payment_request_allowed_roles', '["admin"]')
    let allowedRoles: string[] = ['admin']
    try {
        allowedRoles = JSON.parse(allowedRolesRaw)
    } catch (e) {
        console.error('[createPaymentRequest] error parsing allowedRoles:', e)
    }

    const canPrint = userRole === 'admin' || allowedRoles.includes(userRole)

    const defaultMealPrice = parseInt(getVal('meal_price', '38000')) || 38000
    const defaultTeacherMealPrice = parseInt(getVal('teacher_meal_price', '17000')) || 17000
    const unitPrice = customUnitPrice !== undefined && customUnitPrice > 0 
        ? customUnitPrice 
        : (type === 'student' ? defaultMealPrice : defaultTeacherMealPrice)

    const schoolName = getVal('school_name', 'Trường THPT Thanh Đa')
    const schoolRepresentative = getVal('school_representative', 'LÊ THỊ HÀ GIANG')
    const companyName = getVal('company_name', 'CÔNG TY TNHH CHÂU PHƯƠNG THẢO')
    const companyRepresentative = getVal('company_representative', 'NGUYỄN THỊ THU TRANG')
    const companyCity = getVal('company_city', 'Tp Hồ Chí Minh')

    // 2. Gom nhóm dữ liệu theo ngày
    const dailyMap = new Map<string, { totalMeals: number }>()

    if (type === 'student') {
        const { data: reports, error } = await supabase
            .from('daily_reports')
            .select('report_date, salty_count, vegetarian_count, porridge_count')
            .gte('report_date', startDate)
            .lte('report_date', endDate)
            .eq('status', 'school_approved');

        if (error) return { error: error.message };

        const reportList = reports || [];
        reportList.forEach((r: any) => {
            const meals = (Number(r.salty_count) || 0) + (Number(r.vegetarian_count) || 0) + (Number(r.porridge_count) || 0)
            if (!dailyMap.has(r.report_date)) {
                dailyMap.set(r.report_date, { totalMeals: 0 })
            }
            const item = dailyMap.get(r.report_date)!
            item.totalMeals += meals
        })
    } else {
        const { data: teacherReports, error } = await supabase
            .from('teacher_meal_reports')
            .select('report_date, salty_count, vegetarian_count, porridge_count')
            .gte('report_date', startDate)
            .lte('report_date', endDate);

        if (error) return { error: error.message };

        const teacherList = teacherReports || [];
        teacherList.forEach((r: any) => {
            const meals = (Number(r.salty_count) || 0) + (Number(r.vegetarian_count) || 0) + (Number(r.porridge_count) || 0)
            if (!dailyMap.has(r.report_date)) {
                dailyMap.set(r.report_date, { totalMeals: 0 })
            }
            const item = dailyMap.get(r.report_date)!
            item.totalMeals += meals
        })
    }

    // 3. Tạo danh sách tất cả các ngày trong dải ngày đã chọn
    const allDates = getDatesInRange(startDate, endDate)
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

    const rows: ReconciliationDayRow[] = allDates.map(dateStr => {
        const [y, m, d] = dateStr.split('-').map(Number)
        const dateObj = new Date(y, m - 1, d)
        const dayOfWeek = dayNames[dateObj.getDay()]
        const formattedDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
        const item = dailyMap.get(dateStr)
        const totalMeals = item ? item.totalMeals : 0

        return {
            date: dateStr,
            formattedDate,
            dayOfWeek,
            totalMeals,
            unitPrice,
            totalAmount: totalMeals * unitPrice,
            note: '',
        }
    })

    const grandTotalMeals = rows.reduce((s, r) => s + r.totalMeals, 0)
    const grandTotalAmount = rows.reduce((s, r) => s + r.totalAmount, 0)

    return {
        data: {
            type,
            startDate,
            endDate,
            schoolName,
            schoolRepresentative,
            companyName,
            companyRepresentative,
            companyCity,
            unitPrice,
            rows,
            grandTotalMeals,
            grandTotalAmount,
            canPrint,
        }
    }
}

export interface FinancePageData {
    payments: AdvancePayment[]
    paymentRequests: PaymentRequest[]
    debtSummary: {
        totalMeals: number
        totalMealMoney: number
        totalAdvance: number
        debt: number
        mealPrice: number
        teacherTotalMeals: number
        teacherTotalMoney: number
        teacherMealPrice: number
        overallDebt: number
        totalAllMoney: number
    }
    teacherDebtRows: TeacherDebtDay[]
    companySettings: CompanyPaymentSettings
}

/**
 * Gom toàn bộ dữ liệu cần thiết cho trang Finance trong 1 lần gọi duy nhất.
 * Tối ưu: 1 lần auth, 1 lần load settings, chạy song song các DB queries.
 */
export async function getFinancePageData(startDate: string, endDate: string): Promise<FinancePageData | { error: string }> {
    let auth
    try { auth = await requireAuth() } catch { return { error: 'Chưa đăng nhập' } }
    const { supabase, userId, userRole } = auth

    let advanceQuery = supabase
        .from('advance_payments')
        .select('*')
        .order('payment_date', { ascending: false })
    if (startDate) advanceQuery = advanceQuery.gte('payment_date', startDate)
    if (endDate) advanceQuery = advanceQuery.lte('payment_date', endDate)

    let dailyReportsQuery = supabase
        .from('daily_reports')
        .select('salty_count, porridge_count, vegetarian_count')
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .eq('status', 'school_approved')

    let teacherReportsQuery = supabase
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

    let prQuery = supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false })
    if (startDate) prQuery = prQuery.gte('end_date', startDate)
    if (endDate) prQuery = prQuery.lte('start_date', endDate)

    // Chạy song song tất cả các queries
    const [settingsResult, advancesResult, dailyReportsResult, teacherReportsResult, prResult] = await Promise.all([
        supabase.from('settings').select('key, value'),
        advanceQuery,
        dailyReportsQuery,
        teacherReportsQuery,
        prQuery,
    ])

    const allSettings = settingsResult.data || []
    const getVal = (k: string, def: string) => allSettings.find(s => s.key === k)?.value || def

    const mealPrice = parseInt(getVal('meal_price', '25000')) || 25000
    const teacherMealPrice = parseInt(getVal('teacher_meal_price', '35000')) || 35000

    // Payments
    const payments = (advancesResult.data || []) as AdvancePayment[]
    const totalAdvance = payments.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)

    // Daily Reports (Student)
    const studentReports = dailyReportsResult.data || []
    const totalMeals = studentReports.reduce((sum, r) => 
        sum + (Number(r.salty_count) || 0) + (Number(r.porridge_count) || 0) + (Number(r.vegetarian_count) || 0), 0)
    const totalMealMoney = totalMeals * mealPrice

    // Teacher Reports
    const teacherReports = teacherReportsResult.data || []
    const teacherDebtRows: TeacherDebtDay[] = teacherReports.map((r: any) => {
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

    const teacherTotalMeals = teacherDebtRows.reduce((sum, r) => sum + r.total_meals, 0)
    const teacherTotalMoney = teacherDebtRows.reduce((sum, r) => sum + r.total_money, 0)

    // Debt Summary
    const totalAllMoney = totalMealMoney + teacherTotalMoney
    const overallDebt = totalAllMoney - totalAdvance

    const debtSummary = {
        totalMeals,
        totalMealMoney,
        totalAdvance,
        debt: totalMealMoney - totalAdvance,
        overallDebt,
        mealPrice,
        teacherTotalMeals,
        teacherTotalMoney,
        teacherMealPrice,
        totalAllMoney,
    }

    // Company Settings
    const allowedRolesRaw = getVal('payment_request_allowed_roles', '["admin"]')
    let allowedRoles: string[] = ['admin']
    try { allowedRoles = JSON.parse(allowedRolesRaw) } catch (e) {
        console.error('[getFinancePageData allowedRoles] error:', e)
    }

    const allowedUsersRaw = getVal('payment_request_allowed_users', '[]')
    let allowedUsers: string[] = []
    try { allowedUsers = JSON.parse(allowedUsersRaw) } catch (e) {
        console.error('[getFinancePageData allowedUsers] error:', e)
    }

    const canPrint = userRole === 'admin' || allowedRoles.includes(userRole) || allowedUsers.includes(userId)

    const companySettings: CompanyPaymentSettings = {
        companyName: getVal('company_name', 'CÔNG TY TNHH CHÂU PHƯƠNG THẢO'),
        companyAddress: getVal('company_address', '20A Ngô Đức Kế, Phường Bình Thạnh, TP Hồ Chí Minh'),
        companyTaxCode: getVal('company_tax_code', '0317986511'),
        companyRepresentative: getVal('company_representative', 'Bà NGUYỄN THỊ THU TRANG'),
        companyPosition: getVal('company_position', 'Chủ tịch hội đồng thành viên'),
        bankAccountHolder: getVal('company_bank_account_holder', 'CÔNG TY TNHH CĂN TIN CHÂU PHƯƠNG THẢO'),
        bankAccountNumber: getVal('company_bank_account_number', '667879888'),
        bankName: getVal('company_bank_name', 'Ngân hàng Á Châu - ACB'),
        schoolName: getVal('school_name', 'Trường THPT Thanh Đa'),
        schoolRepresentative: getVal('school_representative', 'LÊ THỊ HÀ GIANG'),
        principalName: getVal('principal_name', 'TRẦN KHẮC HUY'),
        city: getVal('company_city', 'Tp Hồ Chí Minh'),
        canPrint,
        userRole,
        allowedPrintRoles: allowedRoles,
    }

    // Payment Requests
    let paymentRequests: PaymentRequest[] = []
    if (!prResult.error && prResult.data) {
        paymentRequests = prResult.data as PaymentRequest[]
    } else {
        const storedVal = getVal('stored_payment_requests', '')
        let list: PaymentRequest[] = []
        if (storedVal) {
            try { list = JSON.parse(storedVal) } catch (e) {
                console.error('[getFinancePageData fallback PR] error:', e)
            }
        }
        let filtered = list
        if (startDate) filtered = filtered.filter(item => item.end_date >= startDate)
        if (endDate) filtered = filtered.filter(item => item.start_date <= endDate)
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        paymentRequests = filtered
    }

    return {
        payments,
        paymentRequests,
        debtSummary,
        teacherDebtRows,
        companySettings,
    }
}


