'use server'

import { createClient } from '@/lib/supabase/server'
import { calculateCong } from '@/utils/calculations'
import { getSessionInfo } from '@/lib/session'
import { getVietnamNow, getVietnamDateString, getVietnamMinutesToday } from '@/utils/dateUtils'
import { getFormState, mapTimeSettings, getMilestoneStatus } from '@/utils/formState'

/** Lấy tổng hợp báo cáo cho Bếp */
export async function getKitchenSummary(date?: string, onlyApproved: boolean = false) {
    const supabase = await createClient()

    // ⚡ Đọc từ cookie (middleware đã set), không cần query DB
    const { userRole } = await getSessionInfo()

    // ⚡ Tính ngày trong action luôn (bỏ gọi getSettings riêng ở page)
    const { data: settingsDataRaw } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['moc1_close', 'working_days', 'off_days'])
    
    const get = (key: string, def: string) => settingsDataRaw?.find(s => s.key === key)?.value || def
    const moc1Close = get('moc1_close', '16:00')
    const [moc1H, moc1M] = moc1Close.split(':').map(Number)
    const moc1TimeInMinutes = moc1H * 60 + moc1M

    let workingDays = [1, 2, 3, 4, 5]
    let offDays: string[] = []
    try {
        const wdStr = get('working_days', '')
        if (wdStr) workingDays = JSON.parse(wdStr)
    } catch {}
    try {
        const odStr = get('off_days', '')
        if (odStr) offDays = JSON.parse(odStr)
    } catch {}

    // Bếp & Chia suất: chỉ xem ngày hôm nay, không cho đổi ngày
    const isRestrictedRole = ['kitchen', 'meal_distributor'].includes(userRole || '')
    
    let reportDate = date
    if (!reportDate || isRestrictedRole) {
        const currentTime = getVietnamMinutesToday()
        if (currentTime >= moc1TimeInMinutes) {
            const vnNow = getVietnamNow()
            let next = new Date(vnNow.getTime() + 86400000)
            reportDate = getVietnamDateString(next)
            for (let i = 0; i < 30; i++) {
                const dateStr = getVietnamDateString(next)
                if (workingDays.includes(next.getDay()) && !offDays.includes(dateStr)) {
                    reportDate = dateStr
                    break
                }
                next = new Date(next.getTime() + 86400000)
            }
        } else {
            reportDate = getVietnamDateString()
        }
    }

    // Lấy tất cả báo cáo của ngày
    let query = supabase
        .from('daily_reports')
        .select('*, rooms(name, group_id, groups(name))')
        .eq('report_date', reportDate)
    
    if (onlyApproved) {
        query = query.eq('status', 'school_approved')
    }

    // ⚡ Song song: reports + groups + rooms + settings
    const [reportsResult, groupsResult, roomsResult, settingsResult] = await Promise.all([
        query.order('created_at'),
        supabase.from('groups').select('*').order('name'),
        supabase.from('rooms').select('*, groups(name)').order('name'),
        supabase.from('settings').select('*')
    ])

    const reports = reportsResult.data as any[]
    const groups = groupsResult.data as any[]
    const allRooms = roomsResult.data as any[]
    const settings = settingsResult.data as any[]

    const schoolName = settings?.find(s => s.key === 'school_name')?.value || ''
    const schoolAddress = settings?.find(s => s.key === 'school_address')?.value || ''

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
            cong: calculateCong(groupSalty) + calculateCong(groupPorridge) + calculateCong(groupVegetarian),
            reportedCount: groupReports.length,
            totalRooms: groupRooms.length,
        }
    }) || []

    // totalCong = sum of each group's công (avoids ceiling-rounding discrepancy)
    const totalCong = groupSummaries.reduce((sum, gs) => sum + gs.cong, 0)
    
    // Tính phase
    const mappedSettings = mapTimeSettings(settings)
    const { isMoc1Closed, isMoc2Closed } = getMilestoneStatus(reportDate as string, getVietnamNow(), mappedSettings)

    return {
        date: reportDate,
        totalSalty,
        totalVegetarian,
        totalPorridge,
        totalMeals,
        totalCong,
        groupSummaries,
        reports,
        userRole: userRole || 'kitchen',
        schoolInfo: { name: schoolName, address: schoolAddress },
        moc1Close,
        isMoc1Closed,
        isMoc2Closed,
    }
}
