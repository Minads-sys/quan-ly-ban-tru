'use server'

import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/app/dashboard/settings/actions'
import { getFormState, mapTimeSettings } from '@/utils/formState'

export async function getDistributorSummary(date?: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    // Xác định ngày
    let reportDate = date
    if (!reportDate) {
        const { settings } = await getSettings()
        const now = new Date()
        const state = getFormState(now, mapTimeSettings(settings))
        reportDate = state.reportDate
    }

    // Lấy tất cả báo cáo đã duyệt
    const { data: reports } = await supabase
        .from('daily_reports')
        .select('*, rooms(name, group_id, groups(name))')
        .eq('report_date', reportDate)
        .eq('status', 'school_approved')
        .order('created_at')

    // Lấy tất cả groups
    const { data: groups } = await supabase
        .from('groups')
        .select('*')
        .order('name')

    // Tổng hợp theo nhóm
    const groupSummaries = groups?.map((group) => {
        const groupReports = reports?.filter(
            (r) => (r.rooms as { group_id: string })?.group_id === group.id
        ) || []

        let totalSalty = 0
        let totalVegetarian = 0
        let totalPorridge = 0

        groupReports.forEach((r) => {
            totalSalty += r.salty_count || 0
            totalVegetarian += r.vegetarian_count || 0
            totalPorridge += r.porridge_count || 0
        })

        const totalMeals = totalSalty + totalVegetarian + totalPorridge

        // Tính công và suất lẻ (floor division)
        const congSalty = Math.floor(totalSalty / 20)
        const leSalty = totalSalty % 20
        const congVegetarian = Math.floor(totalVegetarian / 20)
        const leVegetarian = totalVegetarian % 20
        const congPorridge = Math.floor(totalPorridge / 20)
        const lePorridge = totalPorridge % 20
        const totalCong = congSalty + congVegetarian + congPorridge

        return {
            group,
            totalSalty,
            totalVegetarian,
            totalPorridge,
            totalMeals,
            congSalty, leSalty,
            congVegetarian, leVegetarian,
            congPorridge, lePorridge,
            totalCong,
            reportedCount: groupReports.length,
        }
    }) || []

    return {
        date: reportDate,
        groupSummaries,
    }
}
