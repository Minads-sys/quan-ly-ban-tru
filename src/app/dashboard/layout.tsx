import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/layout/LogoutButton'
import { NavBar } from '@/components/layout/NavBar'
import { RealtimeListener } from '@/components/features/RealtimeListener'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    // Dùng getSession() thay getUser() để ĐỌC JWT từ cookie local (không cần gọi mạng)
    // - getUser()   : gọi Supabase Auth server mỗi lần → chậm ~100-200ms/tab
    // - getSession(): đọc cookie local → gần như tức thì
    // Layout chỉ dùng để hiển thị UI nên getSession() đủ an toàn.
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
        redirect('/login')
    }
    const userId = session.user.id

    const [{ data: profile }, { data: schoolNameRow }] = await Promise.all([
        supabase.from('profiles').select('full_name, role').eq('id', userId).single(),
        supabase.from('settings').select('value').eq('key', 'school_name').maybeSingle()
    ])

    const schoolName = schoolNameRow?.value || ''

    const roleName: Record<string, string> = {
        admin: 'Quản trị viên',
        school_approver: 'GV cấp trường',
        group_manager: 'Quản lý nhóm',
        room_manager: 'Phụ trách phòng',
        reporter: 'Báo suất',
        class_teacher: 'Giáo viên lớp',
        kitchen: 'Bếp / Kế toán',
        meal_distributor: 'Chia suất',
    }

    const userRole = profile?.role || ''

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center justify-between h-14">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🍱</span>
                            <div className="flex flex-col leading-tight">
                                <h1 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider">
                                    Suất ăn Bán trú
                                </h1>
                                {schoolName && (
                                    <p className="text-sm sm:text-base font-bold text-blue-700 whitespace-nowrap">
                                        {schoolName}
                                    </p>
                                )}
                            </div>
                            </div>
                            {/* Navigation */}
                            <NavBar userRole={userRole} />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-gray-700">
                                    {profile?.full_name || 'Người dùng'}
                                </p>
                                <p className="text-xs text-gray-400">
                                    {roleName[userRole] || userRole}
                                </p>
                            </div>
                            <LogoutButton />
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main content */}
            <main className="max-w-7xl mx-auto p-4 sm:p-6">
                {children}
            </main>

            {/* Realtime Toast Notifications */}
            <RealtimeListener userRole={userRole} />
        </div>
    )
}
