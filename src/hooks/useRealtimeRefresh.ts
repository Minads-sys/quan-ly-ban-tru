'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook lắng nghe thay đổi từ Supabase Realtime và gọi callback để làm mới dữ liệu.
 * - Hỗ trợ nhiều bảng trong 1 channel.
 * - Debounce để tránh gọi quá nhiều khi có burst events.
 * - ⚡ Hỗ trợ filter tùy chọn để giảm event không cần thiết.
 * 
 * @param tables  Tên các bảng cần theo dõi
 * @param onRefresh  Hàm tải lại dữ liệu (thường là loadData)
 * @param debounceMs  Thời gian debounce (mặc định 1500ms)
 * @param filter  Filter tùy chọn theo column=value (VD: { column: 'report_date', value: '2024-01-01' })
 */
export function useRealtimeRefresh(
    tables: string[],
    onRefresh: () => void,
    debounceMs = 1500,
    filter?: { column: string; value: string }
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
        const channelName = `realtime_refresh_${tables.join('_')}${filter ? `_${filter.column}_${filter.value}` : ''}`

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let channel: any = supabase.channel(channelName)

        for (const table of tables) {
            // ⚡ Dùng event: '*' thay vì 3 listener riêng (INSERT/UPDATE/DELETE)
            // và thêm filter nếu có để giảm event không liên quan
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const eventConfig: any = { event: '*', schema: 'public', table }
            if (filter) {
                eventConfig.filter = `${filter.column}=eq.${filter.value}`
            }
            channel = channel.on('postgres_changes', eventConfig, () => trigger())
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
    }, [debounceMs, filter?.column, filter?.value]) // Re-subscribe khi filter thay đổi
}
