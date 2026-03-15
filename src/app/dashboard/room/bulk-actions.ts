'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper: Lấy settings thời gian (sao chép logic từ actions.ts để độc lập hoặc có thể export từ actions.ts, tạm copy)
interface TimeSettings {
    moc1Open: string
    moc1Close: string
    moc2Open: string
    moc2Close: string
    noLimit: boolean
}

type Phase = 'moc1' | 'moc2' | 'locked'

interface FormState {
    reportDate: string
    phase: Phase
    isOpen: boolean
    phaseLabel: string
}

function toMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number)
    return h * 60 + m
}

function formatDate(d: Date): string {
    return d.toISOString().split('T')[0]
}

function getTomorrow(now: Date): string {
    const t = new Date(now.getTime() + 86400000)
    return formatDate(t)
}

function getFormState(now: Date, settings: TimeSettings): FormState {
    if (settings.noLimit) {
        const m2c = toMinutes(settings.moc2Close)
        const current = now.getHours() * 60 + now.getMinutes()
        const reportDate = current < m2c ? formatDate(now) : getTomorrow(now)
        return { reportDate, phase: 'moc1', isOpen: true, phaseLabel: 'Không giới hạn' }
    }

    const current = now.getHours() * 60 + now.getMinutes()
    const m1o = toMinutes(settings.moc1Open)
    const m1c = toMinutes(settings.moc1Close)
    const m2o = toMinutes(settings.moc2Open)
    const m2c = toMinutes(settings.moc2Close)

    if (current < m2c) {
        return { reportDate: formatDate(now), phase: 'moc2', isOpen: true, phaseLabel: `Mốc 2 — Bổ sung (trước ${settings.moc2Close})` }
    }
    if (current >= m1o && current < m1c) {
        return { reportDate: getTomorrow(now), phase: 'moc1', isOpen: true, phaseLabel: `Mốc 1 — Báo suất ngày mai (trước ${settings.moc1Close})` }
    }
    if (current >= m1c && current < m2o) {
        return { reportDate: getTomorrow(now), phase: 'locked', isOpen: false, phaseLabel: `Đã chốt Mốc 1. Chờ mở Mốc 2 lúc ${settings.moc2Open}` }
    }
    if (current >= m2o) {
        return { reportDate: getTomorrow(now), phase: 'moc2', isOpen: true, phaseLabel: `Mốc 2 — Bổ sung cho ngày mai (trước ${settings.moc2Close})` }
    }
    return { reportDate: getTomorrow(now), phase: 'locked', isOpen: false, phaseLabel: `Chờ mở Mốc 1 lúc ${settings.moc1Open}` }
}

async function getTimeSettings(supabase: any): Promise<TimeSettings> {
    const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['moc1_open', 'moc1_close', 'moc2_open', 'moc2_close', 'deadline_no_limit'])

    const get = (key: string, def: string) => data?.find((s: any) => s.key === key)?.value || def

    return {
        moc1Open: get('moc1_open', '07:00'),
        moc1Close: get('moc1_close', '16:00'),
        moc2Open: get('moc2_open', '23:59'),
        moc2Close: get('moc2_close', '07:00'),
        noLimit: get('deadline_no_limit', 'false') === 'true',
    }
}


export type BulkReportData = {
    room_id: string
    capacity: number
    absent_count: number
    porridge_count: number
    vegetarian_count: number
    salty_count: number
    note: string
    report_date: string
}

export async function submitBulkReports(reports: BulkReportData[]) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !['admin', 'school_approver'].includes(profile.role)) {
        return { error: 'Không có quyền thực hiện thao tác này' }
    }

    if (!reports || reports.length === 0) {
        return { success: true }
    }

     // Build query to check existing reports for the same date and rooms
     const roomIds = reports.map(r => r.room_id)
     const reportDate = reports[0].report_date // Assume all reports are for the same date
 
     const { data: existingReports, error: fetchError } = await supabase
         .from('daily_reports')
         .select('id, room_id, capacity, absent_count, salty_count, porridge_count, vegetarian_count, absent_list, moc1_snapshot')
         .in('room_id', roomIds)
         .is('class_id', null) // Ensure we only update room-level reports
         .eq('report_date', reportDate)
 
     if (fetchError) return { error: fetchError.message }
 
     const settings = await getTimeSettings(supabase)
     const state = getFormState(new Date(), settings)

    // Prepare data for upsert
    const upsertDataList = []
    
    // Process existing ones
    for (const report of reports) {
        const existing = existingReports?.find(r => r.room_id === report.room_id)
        
        let reportToSave: any = {
             room_id: report.room_id,
             // Explicitly set class_id to null for bulk room reports, as they aggregate by room
             class_id: null,
             capacity: report.capacity,
             absent_count: report.absent_count,
             porridge_count: report.porridge_count,
             vegetarian_count: report.vegetarian_count,
             salty_count: report.salty_count,
             note: report.note,
             report_date: report.report_date,
             status: 'submitted',
             updated_by: user.id
        }

        if (existing) {
             reportToSave.id = existing.id
             
             let moc1Snapshot = existing.moc1_snapshot
             if (state.phase === 'moc2' && !moc1Snapshot) {
                 moc1Snapshot = {
                     capacity: existing.capacity,
                     absent_count: existing.absent_count,
                     salty_count: existing.salty_count,
                     porridge_count: existing.porridge_count,
                     vegetarian_count: existing.vegetarian_count,
                     absent_list: existing.absent_list,
                     snapshot_at: new Date().toISOString(),
                 }
             }
             reportToSave.moc1_snapshot = moc1Snapshot
             // Retain old absent_list if updating
             reportToSave.absent_list = existing.absent_list || []
        } else {
             reportToSave.created_by = user.id
             reportToSave.absent_list = []
        }
        
        upsertDataList.push(reportToSave)
    }

    const { error: upsertError } = await supabase
        .from('daily_reports')
        .upsert(upsertDataList, { onConflict: 'id' })

    if (upsertError) return { error: upsertError.message }

    revalidatePath('/dashboard/room')
    return { success: true }
}

export async function getBulkRoomData() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    // Check roles
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !['admin', 'school_approver'].includes(profile.role)) {
       return { error: 'Không có quyền' }
    }

    const settings = await getTimeSettings(supabase)
    const now = new Date()
    const state = getFormState(now, settings)

    // Lấy tất cả phòng kèm giáo viên và nhóm
    const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select(`
            id, name, default_capacity,
            groups(name),
            profiles!room_id(full_name, role)
        `)
        .order('name')
        
    if (roomsError) return { error: roomsError.message }

    const rooms = (roomsData || []).map((room: any) => {
        const managers = (room.profiles || []).filter((p: any) => p.role === 'room_manager')
        const teacherName = managers.length > 0 ? managers.map((m: any) => m.full_name).join(', ') : ''
        return {
            id: room.id,
            name: room.name,
            default_capacity: room.default_capacity,
            teacherName,
            groupName: room.groups?.name || 'Chưa xếp nhóm'
        }
    })

    // Lấy báo cáo ngày hiện tại
    const { data: reports, error: reportsError } = await supabase
        .from('daily_reports')
        .select('id, room_id, capacity, absent_count, porridge_count, vegetarian_count, salty_count, note, status')
        .is('class_id', null) 
        .eq('report_date', state.reportDate)
        
    if (reportsError) return { error: reportsError.message }

    return {
        rooms,
        reports,
        isWithinTime: state.isOpen,
        reportDate: state.reportDate,
        phaseLabel: state.phaseLabel,
    }
}
