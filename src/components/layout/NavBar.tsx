'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

interface NavItem {
    href: string
    label: string
    icon: string
    roles: string[]
    color: string       // tailwind color name (e.g. 'red', 'blue')
}

const navItems: NavItem[] = [
    { href: '/dashboard/admin', label: 'Admin', icon: '🔑', roles: ['admin'], color: 'red' },
    { href: '/dashboard/school', label: 'Duyệt trường', icon: '🏫', roles: ['admin', 'school_approver'], color: 'purple' },
    { href: '/dashboard/group', label: 'Duyệt phòng', icon: '👥', roles: ['admin', 'room_manager'], color: 'blue' },
    { href: '/dashboard/room', label: 'Báo suất', icon: '🧑‍🏫', roles: ['admin', 'class_teacher'], color: 'amber' },
    { href: '/dashboard/kitchen', label: 'Bếp', icon: '🍳', roles: ['admin', 'kitchen', 'meal_distributor'], color: 'orange' },
    { href: '/dashboard/settings', label: 'Cài đặt', icon: '⚙️', roles: ['admin'], color: 'gray' },
]

// Map color → tailwind classes
const colorMap: Record<string, { active: string; inactive: string; sidebar: string }> = {
    red:    { active: 'bg-red-50 text-red-700 border-red-200', inactive: 'text-red-600 hover:bg-red-50', sidebar: 'border-red-500 bg-red-50 text-red-700' },
    purple: { active: 'bg-purple-50 text-purple-700 border-purple-200', inactive: 'text-purple-600 hover:bg-purple-50', sidebar: 'border-purple-500 bg-purple-50 text-purple-700' },
    blue:   { active: 'bg-blue-50 text-blue-700 border-blue-200', inactive: 'text-blue-600 hover:bg-blue-50', sidebar: 'border-blue-500 bg-blue-50 text-blue-700' },
    amber:  { active: 'bg-amber-50 text-amber-700 border-amber-200', inactive: 'text-amber-600 hover:bg-amber-50', sidebar: 'border-amber-500 bg-amber-50 text-amber-700' },
    orange: { active: 'bg-orange-50 text-orange-700 border-orange-200', inactive: 'text-orange-600 hover:bg-orange-50', sidebar: 'border-orange-500 bg-orange-50 text-orange-700' },
    teal:   { active: 'bg-teal-50 text-teal-700 border-teal-200', inactive: 'text-teal-600 hover:bg-teal-50', sidebar: 'border-teal-500 bg-teal-50 text-teal-700' },
    gray:   { active: 'bg-gray-100 text-gray-700 border-gray-300', inactive: 'text-gray-500 hover:bg-gray-50', sidebar: 'border-gray-500 bg-gray-50 text-gray-700' },
}

interface NavBarProps {
    userRole: string
}

export function NavBar({ userRole }: NavBarProps) {
    const pathname = usePathname()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const visibleItems = navItems.filter(item => item.roles.includes(userRole))

    // Đóng sidebar khi chuyển trang
    useEffect(() => { setSidebarOpen(false) }, [pathname])

    if (visibleItems.length <= 1) return null

    const currentItem = visibleItems.find(item => pathname.startsWith(item.href))

    return (
        <>
            {/* === Desktop: nav ngang có màu === */}
            <div className="hidden sm:flex gap-1 overflow-x-auto pb-1">
                {visibleItems.map(item => {
                    const isActive = pathname.startsWith(item.href)
                    const colors = colorMap[item.color] || colorMap.gray
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold 
                                whitespace-nowrap transition-all duration-200
                                ${isActive
                                    ? `${colors.active} border`
                                    : `${colors.inactive}`
                                }
                            `}
                        >
                            <span>{item.label}</span>
                        </Link>
                    )
                })}
            </div>

            {/* === Mobile: nút hamburger + sidebar === */}
            <button
                onClick={() => setSidebarOpen(true)}
                className={`sm:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold text-sm
                    ${currentItem ? `${colorMap[currentItem.color]?.active} border` : 'bg-blue-50 text-blue-700 border-blue-200'}`}
                aria-label="Mở menu"
            >
                <span className="text-base">☰</span>
                <span className="text-xs">{currentItem?.label || 'Menu'}</span>
                <span className="text-[10px] opacity-50">▼</span>
            </button>

            {/* Overlay */}
            {sidebarOpen && (
                <div
                    className="sm:hidden fixed inset-0 bg-black/40 z-[100] backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar panel */}
            <div
                className={`
                    sm:hidden fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-[101]
                    transform transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                    <span className="text-xl font-black text-gray-800 uppercase tracking-tight">Danh mục</span>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                        aria-label="Đóng menu"
                    >
                        <span className="text-xl">✕</span>
                    </button>
                </div>

                <nav className="py-3">
                    {visibleItems.map(item => {
                        const isActive = pathname.startsWith(item.href)
                        const colors = colorMap[item.color] || colorMap.gray
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`
                                    flex items-center px-6 py-4 text-lg font-bold
                                    transition-all duration-150
                                    ${isActive
                                        ? `${colors.sidebar} border-r-4`
                                        : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                                    }
                                `}
                            >
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>
            </div>
        </>
    )
}

