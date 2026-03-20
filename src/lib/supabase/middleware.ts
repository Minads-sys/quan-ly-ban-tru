import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Map role → trang mặc định
const ROLE_REDIRECT: Record<string, string> = {
    admin: '/dashboard/admin',
    school_approver: '/dashboard/school',
    group_manager: '/dashboard/group',
    room_manager: '/dashboard/group',
    reporter: '/dashboard/room',
    class_teacher: '/dashboard/room',
    kitchen: '/dashboard/kitchen',
    meal_distributor: '/dashboard/kitchen',
}

// Map trang → role được phép truy cập
const ROUTE_ROLES: Record<string, string[]> = {
    '/dashboard/admin': ['admin'],
    '/dashboard/finance': ['admin'],
    '/dashboard/school': ['admin', 'school_approver'],
    '/dashboard/group': ['admin', 'room_manager', 'school_approver', 'reporter'],
    '/dashboard/room': ['admin', 'class_teacher', 'reporter'],
    '/dashboard/kitchen': ['admin', 'kitchen', 'meal_distributor', 'school_approver', 'group_manager', 'reporter'],
    '/dashboard/settings': ['admin'],
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // QUAN TRỌNG: getUser() ở đây để refresh session token (bắt buộc cho Supabase SSR).
    // Nhưng chúng ta không dùng kết quả để query profile DB nữa —
    // thay vào đó đọc role từ cookie đã cache.
    const { data: { user } } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    // --- Chưa đăng nhập ---
    if (!user) {
        if (pathname.startsWith('/dashboard')) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }
        return supabaseResponse
    }

    // --- Đã đăng nhập ---

    // Đọc role từ cookie (đã cache từ lần login hoặc request trước)
    const cachedRole = request.cookies.get('user-role')?.value
    const cachedUserId = request.cookies.get('user-id')?.value

    // Kiểm tra cache có hợp lệ không (đúng user)
    const roleFromCache = (cachedRole && cachedUserId === user.id) ? cachedRole : null

    // Đang ở trang login → redirect về dashboard theo role
    if (pathname.startsWith('/login') || pathname === '/') {
        let role: string = roleFromCache ?? ''
        if (!role) {
            // Chỉ query DB khi cookie chưa có (lần đầu hoặc hết hạn)
            const { data: profile } = await supabase
                .from('profiles').select('role').eq('id', user.id).single()
            role = profile?.role || 'class_teacher'
        }
        const url = request.nextUrl.clone()
        url.pathname = ROLE_REDIRECT[role] || '/dashboard/room'
        const redirectResponse = NextResponse.redirect(url)
        redirectResponse.cookies.set('user-id', user.id, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 3600 })
        redirectResponse.cookies.set('user-role', role, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 3600 })
        return redirectResponse
    }

    // Kiểm tra phân quyền khi vào dashboard
    if (pathname.startsWith('/dashboard')) {
        let role: string = roleFromCache ?? ''
        if (!role) {
            // Chỉ query DB khi cookie chưa có (lần đầu hoặc hết hạn)
            const { data: profile } = await supabase
                .from('profiles').select('role').eq('id', user.id).single()
            role = profile?.role || 'class_teacher'
            // Lưu vào cookie để dùng cho request tiếp theo
            supabaseResponse.cookies.set('user-id', user.id, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 3600 })
            supabaseResponse.cookies.set('user-role', role, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 3600 })
        }

        // Kiểm tra quyền truy cập route
        const matchedRoute = Object.keys(ROUTE_ROLES).find(route => pathname.startsWith(route))
        if (matchedRoute) {
            const allowedRoles = ROUTE_ROLES[matchedRoute]
            if (!allowedRoles.includes(role)) {
                const url = request.nextUrl.clone()
                url.pathname = ROLE_REDIRECT[role] || '/dashboard/room'
                return NextResponse.redirect(url)
            }
        }
    }

    return supabaseResponse
}
