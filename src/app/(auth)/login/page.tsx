'use client'

import { useState } from 'react'
import { login } from './actions'

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)

        const result = await login(formData)
        if (result?.error) {
            setError(result.error)
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl shadow-lg mb-4">
                        <span className="text-3xl">🍱</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        Quản lý Suất ăn Bán trú
                    </h1>
                    <p className="text-gray-500 mt-1">Đăng nhập để tiếp tục</p>
                </div>

                {/* Login Form */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
                    <form action={handleSubmit} className="space-y-5">
                        {/* Error message */}
                        {error && (
                            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700 mb-1.5"
                            >
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="giaovien@truong.edu.vn"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 
                  focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 
                  outline-none transition-all duration-200
                  placeholder:text-gray-400 text-gray-800"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700 mb-1.5"
                            >
                                Mật khẩu
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 
                  focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 
                  outline-none transition-all duration-200
                  placeholder:text-gray-400 text-gray-800"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-emerald-500 
                text-white font-semibold rounded-xl shadow-md
                hover:from-blue-600 hover:to-emerald-600
                focus:ring-2 focus:ring-blue-500/50 focus:outline-none
                disabled:opacity-60 disabled:cursor-not-allowed
                transition-all duration-200 transform active:scale-[0.98]"
                        >
                            {loading ? (
                                <span className="inline-flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Đang đăng nhập...
                                </span>
                            ) : (
                                'Đăng nhập'
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    © 2026 Hệ thống Quản lý Suất ăn Bán trú
                </p>
            </div>
        </div>
    )
}
