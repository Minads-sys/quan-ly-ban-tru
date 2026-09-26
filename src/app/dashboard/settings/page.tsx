'use client'

import { useState, useEffect, useCallback } from 'react'
import { TimeSettingsTab } from './TimeSettingsTab'
import { RoomsGroupsTab } from './RoomsGroupsTab'
import { UsersTab } from './UsersTab'
import { CompanyTab } from './CompanyTab'

type Tab = 'time' | 'rooms' | 'users' | 'company'

const tabs: { key: Tab; icon: string; label: string; color: string }[] = [
    { key: 'time', icon: '⏰', label: 'Thời gian', color: 'blue' },
    { key: 'rooms', icon: '🏫', label: 'Phòng & Nhóm', color: 'emerald' },
    { key: 'users', icon: '👤', label: 'Giáo viên', color: 'amber' },
    { key: 'company', icon: '🏢', label: 'Doanh nghiệp & In ấn', color: 'purple' },
]

export default function SettingsPage() {
    const [tab, setTabState] = useState<Tab>('time')
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Khôi phục tab đang làm việc khi tải lại trang
    useEffect(() => {
        try {
            const savedTab = localStorage.getItem('settings_active_tab') as Tab | null
            if (savedTab && ['time', 'rooms', 'users', 'company'].includes(savedTab)) {
                setTabState(savedTab)
            }
        } catch (e) {
            console.error('Lỗi khi đọc settings_active_tab từ localStorage:', e)
        }
    }, [])

    const setTab = (newTab: Tab) => {
        setTabState(newTab)
        try {
            localStorage.setItem('settings_active_tab', newTab)
        } catch (e) {
            console.error('Lỗi khi lưu settings_active_tab vào localStorage:', e)
        }
    }

    const showMsg = useCallback((type: 'success' | 'error', text: string) => {
        setMsg({ type, text })
        setTimeout(() => setMsg(null), 4000)
    }, [])

    return (
        <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">⚙️ Cài đặt hệ thống</h2>

            {/* Floating Toast Notification */}
            {msg && (
                <div
                    className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-semibold transition-all duration-300 ${
                        msg.type === 'success'
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
                            : 'bg-red-600 text-white border-red-500 shadow-red-600/30'
                    }`}
                >
                    <span className="text-base">{msg.type === 'success' ? '✅' : '❌'}</span>
                    <span>{msg.text}</span>
                    <button onClick={() => setMsg(null)} className="ml-2 text-white/80 hover:text-white font-bold text-xs cursor-pointer">
                        ✕
                    </button>
                </div>
            )}

            {/* Inline message banner */}
            {msg && (
                <div
                    className={`rounded-xl p-3 mb-4 text-sm font-medium border ${
                        msg.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                >
                    {msg.text}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
                {tabs.map(t => {
                    const colorStyles: Record<string, string> = {
                        blue: 'bg-blue-50 text-blue-700 shadow-sm border border-blue-200',
                        emerald: 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200',
                        purple: 'bg-purple-50 text-purple-700 shadow-sm border border-purple-200',
                        amber: 'bg-amber-50 text-amber-700 shadow-sm border border-amber-200',
                    }
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                                tab === t.key
                                    ? colorStyles[t.color] || 'bg-white shadow-sm text-blue-700'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <span className="mr-1">{t.icon}</span> {t.label}
                        </button>
                    )
                })}
            </div>

            {/* Tab contents */}
            {tab === 'time' && <TimeSettingsTab onMessage={showMsg} />}
            {tab === 'rooms' && <RoomsGroupsTab onMessage={showMsg} />}
            {tab === 'users' && <UsersTab onMessage={showMsg} />}
            {tab === 'company' && <CompanyTab onMessage={showMsg} />}
        </div>
    )
}
