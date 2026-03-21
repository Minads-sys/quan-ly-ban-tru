'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook lắng nghe thay đổi từ Supabase Realtime và gọi callback để làm mới dữ liệu.
 * - Hỗ trợ nhiều bảng trong 1 channel.
 * - Debounce để tránh gọi quá nhiều khi có burst events.
 * 
 * @param tables  Tên các bảng cần theo dõi
 * @param onRefresh  Hàm tải lại dữ liệu (thường là loadData)
 * @param debounceMs  Thời gian debounce (mặc định 1500ms)
 */
export function useRealtimeRefresh(
    tables: string[],
    onRefresh: () => void,
    debounceMs = 1500
) {
    const onRefreshRef = useRef(onRefresh)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Cập nhật ref mỗi khi callback thay đổi (tránh stale closure)
    useEffect(() => {
        onRefreshRef.current = onRefresh
    }, [onRefresh])

    useEffect(() => {
        if (tables.length === 0) return

        const supabase = createClient()
        const channelName = `realtime_refresh_${tables.join('_')}`

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let channel: any = supabase.channel(channelName)

        for (const table of tables) {
            channel = channel
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, () => trigger())
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table }, () => trigger())
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, () => trigger())
        }

        channel.subscribe()

        function trigger() {
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => {
                onRefreshRef.current()
            }, debounceMs)
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            supabase.removeChannel(channel)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounceMs]) // tables là static array nên không cần thêm vào deps
}
