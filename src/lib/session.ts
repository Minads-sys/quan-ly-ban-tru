import { cookies } from 'next/headers'

/**
 * Đọc thông tin user từ cookie (đã được middleware set).
 * Giúp server actions tránh phải gọi lại auth.getUser() + profiles.select('role')
 */
export async function getSessionInfo() {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user-id')?.value || null
    const userRole = cookieStore.get('user-role')?.value || null
    return { userId, userRole }
}
