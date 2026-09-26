'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/session'

export interface AuthResult {
    supabase: Awaited<ReturnType<typeof createClient>>
    userId: string
    userRole: string
}

/**
 * Hàm auth dùng chung cho tất cả server actions.
 * Ưu tiên đọc từ cookie (0ms) do middleware đã set sẵn.
 * Fallback sang auth.getUser() nếu cookie chưa có.
 */
export async function requireAuth(): Promise<AuthResult> {
    const supabase = await createClient()

    // Ưu tiên đọc từ cookie (middleware đã set)
    const { userId: cachedId, userRole: cachedRole } = await getSessionInfo()

    if (cachedId && cachedRole) {
        return { supabase, userId: cachedId, userRole: cachedRole }
    }

    // Fallback: gọi auth nếu cookie chưa có
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Chưa đăng nhập')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    return {
        supabase,
        userId: user.id,
        userRole: profile?.role || 'class_teacher'
    }
}

/**
 * Kiểm tra quyền admin. Throw error nếu không phải admin.
 */
export async function requireAdmin(): Promise<AuthResult> {
    const auth = await requireAuth()
    if (auth.userRole !== 'admin') {
        throw new Error('Chỉ Admin mới có quyền thực hiện thao tác này')
    }
    return auth
}
