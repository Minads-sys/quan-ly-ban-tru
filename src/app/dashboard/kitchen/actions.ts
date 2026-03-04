'use server'

import { createClient } from '@/lib/supabase/server'
import { calculateCong } from '@/utils/calculations'

/** Lấy tổng hợp báo cáo cho Bếp */
export async function getKitchenSummary(date?: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const reportDate = date || new Date().toISOString().split('T')[0]

    // Lấy tất cả báo cáo của ngày
    const { data: reports } = await supabase
        .from('daily_reports')
        .select('*, rooms(name, group_id, groups(name))')
        .eq('report_date', reportDate)
        .order('created_at')

    // Lấy tất cả groups
    const { data: groups } = await supabase
        .from('groups')
        .select('*')
        .order('name')

    // Lấy tất cả rooms
    const { data: allRooms } = await supabase
        .from('rooms')
        .select('*, groups(name)')
        .order('name')

    // Tính tổng
    let totalSalty = 0
    let totalVegetarian = 0
    let totalPorridge = 0

    reports?.forEach((r) => {
        totalSalty += r.salty_count || 0
        totalVegetarian += r.vegetarian_count || 0
        totalPorridge += r.porridge_count || 0
    })

    const totalMeals = totalSalty + totalVegetarian + totalPorridge
    const totalCong = calculateCong(totalMeals)

    // Tổng hợp theo nhóm
    const groupSummaries = groups?.map((group) => {
        const groupReports = reports?.filter(
            (r) => (r.rooms as { group_id: string })?.group_id === group.id
        ) || []

        const groupRooms = allRooms?.filter(r => r.group_id === group.id) || []

        let groupSalty = 0
        let groupVegetarian = 0
        let groupPorridge = 0

        groupReports.forEach((r) => {
            groupSalty += r.salty_count || 0
            groupVegetarian += r.vegetarian_count || 0
            groupPorridge += r.porridge_count || 0
        })

        const groupTotal = groupSalty + groupVegetarian + groupPorridge

        return {
            group,
            rooms: groupRooms.map(room => ({
                ...room,
                report: reports?.find(r => r.room_id === room.id) || null,
            })),
            totalSalty: groupSalty,
            totalVegetarian: groupVegetarian,
            totalPorridge: groupPorridge,
            totalMeals: groupTotal,
            cong: calculateCong(groupTotal),
            reportedCount: groupReports.length,
            totalRooms: groupRooms.length,
        }
    }) || []

    return {
        date: reportDate,
        totalSalty,
        totalVegetarian,
        totalPorridge,
        totalMeals,
        totalCong,
        groupSummaries,
        reports,
    }
}
