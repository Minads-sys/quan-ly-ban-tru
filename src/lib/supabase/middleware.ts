import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Map role → trang mặc định
const ROLE_REDIRECT: Record<string, string> = {
    admin: '/dashboard/admin',
    group_manager: '/dashboard/group',
    room_manager: '/dashboard/room',
    kitchen: '/dashboard/kitchen',
}

// Map trang → role được phép truy cập
const ROUTE_ROLES: Record<string, string[]> = {
    '/dashboard/admin': ['admin'],
    '/dashboard/group': ['admin', 'group_manager'],
    '/dashboard/room': ['admin', 'room_manager'],
    '/dashboard/kitchen': ['admin', 'kitchen'],
    '/dashboard/settings': ['admin'],
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    // --- Chưa đăng nhập ---
    if (!user) {
        // Đang truy cập dashboard → redirect về login
        if (pathname.startsWith('/dashboard')) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }
        return supabaseResponse
    }

    // --- Đã đăng nhập ---

    // Đang ở trang login → redirect về dashboard theo role
    if (pathname.startsWith('/login') || pathname === '/') {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        const role = profile?.role || 'room_manager'
        const url = request.nextUrl.clone()
        url.pathname = ROLE_REDIRECT[role] || '/dashboard/room'
        return NextResponse.redirect(url)
    }

    // Kiểm tra phân quyền: user có role đúng cho trang này không
    if (pathname.startsWith('/dashboard')) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        const role = profile?.role || 'room_manager'

        // Tìm route phù hợp nhất
        const matchedRoute = Object.keys(ROUTE_ROLES).find(route =>
            pathname.startsWith(route)
        )

        if (matchedRoute) {
            const allowedRoles = ROUTE_ROLES[matchedRoute]
            if (!allowedRoles.includes(role)) {
                // Không có quyền → redirect về trang đúng role
                const url = request.nextUrl.clone()
                url.pathname = ROLE_REDIRECT[role] || '/dashboard/room'
                return NextResponse.redirect(url)
            }
        }
    }

    return supabaseResponse
}
