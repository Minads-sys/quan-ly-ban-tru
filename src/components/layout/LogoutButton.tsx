'use client'

import { logout } from '@/app/(auth)/login/actions'

export function LogoutButton() {
    return (
        <form action={logout}>
            <button
                type="submit"
                className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 
          rounded-lg hover:bg-red-100 transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-red-500/30"
            >
                Đăng xuất
            </button>
        </form>
    )
}
