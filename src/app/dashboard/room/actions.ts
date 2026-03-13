'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ==================================================
// Helper: Lấy settings thời gian & xác định trạng thái form
// ==================================================
interface TimeSettings {
    moc1Open: string   // e.g. "07:00"
    moc1Close: string  // e.g. "16:00"
    moc2Open: string   // e.g. "23:59"
    moc2Close: string  // e.g. "07:00"
    noLimit: boolean
}

type Phase = 'moc1' | 'moc2' | 'locked'

interface FormState {
    reportDate: string   // YYYY-MM-DD — ngày ăn
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

/**
 * Xác định reportDate (ngày ăn) và trạng thái form dựa trên giờ hiện tại.
 */
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

// ==================================================
// Lấy settings từ DB
// ==================================================
async function getTimeSettings(supabase: Awaited<ReturnType<typeof createClient>>): Promise<TimeSettings> {
    const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['moc1_open', 'moc1_close', 'moc2_open', 'moc2_close', 'deadline_no_limit'])

    const get = (key: string, def: string) => data?.find(s => s.key === key)?.value || def

    return {
        moc1Open: get('moc1_open', '07:00'),
        moc1Close: get('moc1_close', '16:00'),
        moc2Open: get('moc2_open', '23:59'),
        moc2Close: get('moc2_close', '07:00'),
        noLimit: get('deadline_no_limit', 'false') === 'true',
    }
}

// ==================================================
// Gửi hoặc cập nhật báo cáo suất ăn (GV Lớp dùng class_id)
// ==================================================
export async function submitReport(formData: FormData) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    // Lấy thông tin profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, room_id, class_id')
        .eq('id', user.id)
        .single()

    if (!profile) return { error: 'Không tìm thấy profile' }

    // GV Lớp dùng class_id, fallback room_id cho backward compatibility
    const classId = profile.class_id
    const roomId = profile.room_id

    if (!classId && !roomId) {
        return { error: 'Không tìm thấy thông tin lớp/phòng. Liên hệ Admin.' }
    }

    // Parse form data
    const capacity = parseInt(formData.get('capacity') as string) || 0
    const absentCount = parseInt(formData.get('absent_count') as string) || 0
    const porridgeCount = parseInt(formData.get('porridge_count') as string) || 0
    const vegetarianCount = parseInt(formData.get('vegetarian_count') as string) || 0
    const note = (formData.get('note') as string) || null
    const reportDate = (formData.get('report_date') as string) || new Date().toISOString().split('T')[0]

    let absentList: { name: string; reason?: string }[] = []
    try {
        const absentListStr = formData.get('absent_list') as string
        if (absentListStr) absentList = JSON.parse(absentListStr)
    } catch { absentList = [] }

    const saltyCount = capacity - absentCount - porridgeCount - vegetarianCount
    if (saltyCount < 0) {
        return { error: 'Số suất mặn không thể âm. Kiểm tra lại số liệu.' }
    }

    // Kiểm tra giờ — chỉ cho class_teacher/room_manager
    if (['class_teacher', 'room_manager'].includes(profile.role)) {
        const settings = await getTimeSettings(supabase)
        const now = new Date()
        const state = getFormState(now, settings)

        if (!state.isOpen) {
            return { error: `${state.phaseLabel}. Không thể báo suất. Liên hệ Admin.` }
        }

        if (reportDate !== state.reportDate) {
            return { error: `Ngày báo cáo không hợp lệ. Hiện tại đang ở giai đoạn: ${state.phaseLabel}` }
        }
    }

    // Build query filter
    const filterKey = classId ? 'class_id' : 'room_id'
    const filterVal = classId || roomId

    // Kiểm tra đã có báo cáo chưa
    const { data: existing } = await supabase
        .from('daily_reports')
        .select('id, capacity, absent_count, salty_count, porridge_count, vegetarian_count, absent_list, moc1_snapshot')
        .eq(filterKey, filterVal)
        .eq('report_date', reportDate)
        .single()

    if (existing) {
        const settings = await getTimeSettings(supabase)
        const state = getFormState(new Date(), settings)
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

        const { error } = await supabase
            .from('daily_reports')
            .update({
                capacity,
                absent_count: absentCount,
                absent_list: absentList,
                porridge_count: porridgeCount,
                vegetarian_count: vegetarianCount,
                salty_count: saltyCount,
                note,
                status: 'submitted',
                updated_by: user.id,
                moc1_snapshot: moc1Snapshot,
            })
            .eq('id', existing.id)

        if (error) return { error: error.message }
    } else {
        const insertData: Record<string, unknown> = {
            report_date: reportDate,
            capacity,
            absent_count: absentCount,
            absent_list: absentList,
            porridge_count: porridgeCount,
            vegetarian_count: vegetarianCount,
            salty_count: saltyCount,
            note,
            status: 'submitted',
            created_by: user.id,
            updated_by: user.id,
        }

        // Set class_id or room_id
        if (classId) {
            insertData.class_id = classId
            // Also get room_id from class for backward compat
            const { data: classData } = await supabase
                .from('classes')
                .select('room_id')
                .eq('id', classId)
                .single()
            if (classData) insertData.room_id = classData.room_id
        } else {
            insertData.room_id = roomId
        }

        const { error } = await supabase
            .from('daily_reports')
            .insert(insertData)

        if (error) return { error: error.message }
    }

    revalidatePath('/dashboard/room')
    return { success: true }
}

// ==================================================
// Lấy thông tin lớp/phòng và báo cáo (dựa trên phase)
// ==================================================
export async function getRoomData() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('room_id, class_id')
        .eq('id', user.id)
        .single()

    // GV Lớp: dùng class_id
    const classId = profile?.class_id
    const roomId = profile?.room_id

    if (!classId && !roomId) return { error: 'Không tìm thấy lớp/phòng' }

    const settings = await getTimeSettings(supabase)
    const now = new Date()
    const state = getFormState(now, settings)

    let roomInfo = null

    if (classId) {
        // Lấy thông tin từ bảng classes
        const { data: classData } = await supabase
            .from('classes')
            .select('name, default_capacity, rooms(name)')
            .eq('id', classId)
            .single()

        if (classData) {
            const roomsData = classData.rooms as unknown as { name: string } | null
            roomInfo = {
                name: classData.name,
                default_capacity: classData.default_capacity,
                room_name: roomsData?.name || '',
            }
        }
    } else if (roomId) {
        const { data: room } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single()
        roomInfo = room
    }

    // Lấy báo cáo
    const filterKey = classId ? 'class_id' : 'room_id'
    const filterVal = classId || roomId

    const { data: report } = await supabase
        .from('daily_reports')
        .select('*')
        .eq(filterKey, filterVal!)
        .eq('report_date', state.reportDate)
        .single()

    return {
        room: roomInfo,
        report,
        isWithinTime: state.isOpen,
        reportDate: state.reportDate,
        phase: state.phase,
        phaseLabel: state.phaseLabel,
        settings: {
            moc1Open: settings.moc1Open,
            moc1Close: settings.moc1Close,
            moc2Open: settings.moc2Open,
            moc2Close: settings.moc2Close,
            noLimit: settings.noLimit,
        },
    }
}
