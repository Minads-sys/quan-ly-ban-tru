'use server'

import { createClient } from '@/lib/supabase/server'
import { getCachedSettings } from '@/lib/cachedSettings'
import { getSessionInfo } from '@/lib/session'

export interface ReportFilter {
    period: 'today' | 'yesterday' | 'this_month' | 'last_month' | 'custom'
    startDate?: string
    endDate?: string
}

export interface ReportSummary {
    totalMeals: number
    totalSalty: number
    totalVegetarian: number
    totalPorridge: number
    totalAbsent: number
    totalCapacity: number
    schoolName: string
    dailyData: {
        date: string
        meals: number
        salty: number
        vegetarian: number
        porridge: number
        absent: number
        capacity: number
    }[]
}

export async function getReportsData(filter: ReportFilter): Promise<ReportSummary | { error: string }> {
    const supabase = await createClient()
    const { userRole, userId } = await getSessionInfo()

    if (!userId) {
        return { error: 'Not authenticated' }
    }

    // Role check: Only admin, school_approver, reporter should see reports
    const allowedRoles = ['admin', 'school_approver', 'reporter', 'kitchen', 'meal_distributor'] // Allowed for kitchen/distributor as well if needed in future, but we'll restrict UI in nav
    if (!allowedRoles.includes(userRole || '')) {
        return { error: 'Unauthorized' }
    }

    // Determine Date Range
    let startD = ''
    let endD = ''

    const getVietnamDateString = (d: Date) => {
        return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0]
    }

    const vnNow = new Date(new Date().getTime() + 7 * 60 * 60 * 1000)
    const today = vnNow.toISOString().split('T')[0]

    if (filter.period === 'today') {
        startD = today
        endD = today
    } else if (filter.period === 'yesterday') {
        const yesterday = new Date(vnNow.getTime() - 86400000)
        startD = yesterday.toISOString().split('T')[0]
        endD = startD
    } else if (filter.period === 'this_month') {
        const y = vnNow.getUTCFullYear()
        const m = vnNow.getUTCMonth()
        startD = new Date(Date.UTC(y, m, 1)).toISOString().split('T')[0]
        endD = new Date(Date.UTC(y, m + 1, 0)).toISOString().split('T')[0]
    } else if (filter.period === 'last_month') {
        const y = vnNow.getUTCFullYear()
        const m = vnNow.getUTCMonth()
        startD = new Date(Date.UTC(y, m - 1, 1)).toISOString().split('T')[0]
        endD = new Date(Date.UTC(y, m, 0)).toISOString().split('T')[0]
    } else if (filter.period === 'custom') {
        if (!filter.startDate || !filter.endDate) {
            return { error: 'Invalid custom date range' }
        }
        startD = filter.startDate
        endD = filter.endDate
    }

    // Fetch school name from settings
    const allSettings = await getCachedSettings()
    const getSettingVal = (k: string) => (allSettings as { key: string; value: string }[]).find(s => s.key === k)?.value || ''
    const schoolName = getSettingVal('school_name')

    // Query Data from daily_reports
    const { data: reports, error } = await supabase
        .from('daily_reports')
        .select(`
            report_date,
            salty_count,
            vegetarian_count,
            porridge_count,
            absent_count,
            capacity,
            status
        `)
        .gte('report_date', startD)
        .lte('report_date', endD)
        // Optionally only approved reports? Usually reports tab wants all or just approved. We'll include all but might want to add a status filter later.

    if (error) {
        console.error("Error fetching reports:", error)
        return { error: 'Failed to fetch reports' }
    }

    // Aggregation
    let totalSalty = 0
    let totalVegetarian = 0
    let totalPorridge = 0
    let totalAbsent = 0
    let totalCapacity = 0

    // Group by Date for Chart
    const dailyMap = new Map<string, { meals: number, salty: number, vegetarian: number, porridge: number, absent: number, capacity: number }>()

    reports?.forEach(r => {
        const date = r.report_date
        const s = r.salty_count || 0
        const v = r.vegetarian_count || 0
        const p = r.porridge_count || 0
        const a = r.absent_count || 0
        const c = r.capacity || 0

        const meals = s + v + p

        totalSalty += s
        totalVegetarian += v
        totalPorridge += p
        totalAbsent += a
        totalCapacity += c

        if (!dailyMap.has(date)) {
            dailyMap.set(date, { meals: 0, salty: 0, vegetarian: 0, porridge: 0, absent: 0, capacity: 0 })
        }
        const dm = dailyMap.get(date)!
        dm.meals += meals
        dm.salty += s
        dm.vegetarian += v
        dm.porridge += p
        dm.absent += a
        dm.capacity += c
    })

    const totalMeals = totalSalty + totalVegetarian + totalPorridge

    // Convert Map to Array and sort by date
    const dailyData = Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date))

    return {
        totalMeals,
        totalSalty,
        totalVegetarian,
        totalPorridge,
        totalAbsent,
        totalCapacity,
        schoolName,
        dailyData
    }
}
