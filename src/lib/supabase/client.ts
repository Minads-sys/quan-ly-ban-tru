import { createBrowserClient } from '@supabase/ssr'

// ⚡ Singleton pattern — tạo 1 lần, dùng lại cho toàn bộ app.
// Tránh tạo nhiều WebSocket connection không cần thiết
// (RealtimeListener, useRealtimeRefresh, etc. dùng chung 1 instance).
let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
    if (client) return client

    client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    return client
}
