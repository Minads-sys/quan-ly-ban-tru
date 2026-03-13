'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
    href: string
    label: string
    icon: string
    roles: string[]
}

const navItems: NavItem[] = [
    { href: '/dashboard/admin', label: 'Admin', icon: '🔑', roles: ['admin'] },
    { href: '/dashboard/school', label: 'Duyệt trường', icon: '🏫', roles: ['admin', 'school_approver'] },
    { href: '/dashboard/group', label: 'Duyệt phòng', icon: '👥', roles: ['admin', 'room_manager'] },
    { href: '/dashboard/room', label: 'Báo suất', icon: '🧑‍🏫', roles: ['admin', 'class_teacher'] },
    { href: '/dashboard/kitchen', label: 'Bếp', icon: '🍳', roles: ['admin', 'kitchen'] },
    { href: '/dashboard/settings', label: 'Cài đặt', icon: '⚙️', roles: ['admin'] },
]

interface NavBarProps {
    userRole: string
}

export function NavBar({ userRole }: NavBarProps) {
    const pathname = usePathname()

    const visibleItems = navItems.filter(item => item.roles.includes(userRole))

    if (visibleItems.length <= 1) return null

    return (
        <div className="flex gap-1 overflow-x-auto pb-1">
            {visibleItems.map(item => {
                const isActive = pathname.startsWith(item.href)
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium 
              whitespace-nowrap transition-all duration-200
              ${isActive
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                            }
            `}
                    >
                        <span className="text-base">{item.icon}</span>
                        <span className="hidden sm:inline">{item.label}</span>
                    </Link>
                )
            })}
        </div>
    )
}
