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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()

    const roleName: Record<string, string> = {
        admin: 'Quản trị viên',
        school_approver: 'GV cấp trường',
        group_manager: 'Quản lý nhóm',
        room_manager: 'Phụ trách phòng',
        class_teacher: 'Giáo viên lớp',
        kitchen: 'Bếp / Kế toán',
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
                                <h1 className="text-base sm:text-lg font-bold text-gray-800">
                                    Suất ăn Bán trú
                                </h1>
                            </div>
                            {/* Navigation */}
                            <NavBar userRole={userRole} />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-gray-700">
                                    {profile?.full_name || user.email}
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
