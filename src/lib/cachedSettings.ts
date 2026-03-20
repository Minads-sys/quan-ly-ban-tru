/**
 * Cache module cho settings dùng React.cache.
 * - Deduplicates nhiều lần gọi getSettings() trong cùng 1 request
 * - Không cần unstable_cache vì createClient() cần dynamic cookies
 */
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export const getCachedSettings = cache(async () => {
    const supabase = await createClient()
    const { data } = await supabase
        .from('settings')
        .select('*')
        .order('key')
    return data || []
})
