'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ToastContainer, type ToastMessage } from '@/components/ui/Toast'

interface RealtimeListenerProps {
    userRole: string
}

export function RealtimeListener({ userRole }: RealtimeListenerProps) {
    const [toasts, setToasts] = useState<ToastMessage[]>([])

    const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 5)
        setToasts(prev => [...prev, { id, message, type }])
    }, [])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    useEffect(() => {
        // Chỉ lắng nghe cho admin và group_manager
        if (userRole !== 'admin' && userRole !== 'group_manager') return

        const supabase = createClient()

        const channel = supabase
            .channel('daily_reports_realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'daily_reports',
                },
                (payload) => {
                    addToast(
                        `📋 Có báo cáo mới được gửi!`,
                        'info'
                    )
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'daily_reports',
                },
                (payload) => {
                    const status = payload.new?.status
                    if (status === 'submitted') {
                        addToast(`📤 Một phòng vừa cập nhật báo cáo`, 'info')
                    } else if (status === 'approved') {
                        addToast(`✅ Báo cáo đã được duyệt`, 'success')
                    } else if (status === 'rejected') {
                        addToast(`❌ Báo cáo bị từ chối`, 'warning')
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userRole, addToast])

    return <ToastContainer toasts={toasts} onRemove={removeToast} />
}
