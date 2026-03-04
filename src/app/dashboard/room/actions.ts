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
 *
 * Timeline trong 1 ngày (VD: moc1_open=07:00, moc1_close=16:00, moc2_open=23:59, moc2_close=07:00):
 *   00:00 ─ moc2_close : Mốc 2 (sửa bữa HÔM NAY) → reportDate = today
 *   moc2_close ─ moc1_open : Chờ mở (thực tế moc1_open = moc2_close)
 *   moc1_open ─ moc1_close : Mốc 1 (báo bữa NGÀY MAI) → reportDate = tomorrow
 *   moc1_close ─ moc2_open : Khóa (bếp đi chợ)
 *   moc2_open ─ 23:59      : Mốc 2 (sửa bữa NGÀY MAI) → reportDate = tomorrow
 */
function getFormState(now: Date, settings: TimeSettings): FormState {
    if (settings.noLimit) {
        // Không giới hạn: luôn mở, report cho ngày mai nếu sau mốc 2 close, else hôm nay
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

    // Window 1: 00:00 → moc2_close  (Mốc 2 cho HÔM NAY)
    if (current < m2c) {
        return {
            reportDate: formatDate(now),
            phase: 'moc2',
            isOpen: true,
            phaseLabel: `Mốc 2 — Bổ sung (trước ${settings.moc2Close})`
        }
    }

    // Window 2: moc1_open → moc1_close  (Mốc 1 cho NGÀY MAI)
    if (current >= m1o && current < m1c) {
        return {
            reportDate: getTomorrow(now),
            phase: 'moc1',
            isOpen: true,
            phaseLabel: `Mốc 1 — Báo suất ngày mai (trước ${settings.moc1Close})`
        }
    }

    // Window 3: moc1_close → moc2_open  (KHÓA — bếp đi chợ)
    if (current >= m1c && current < m2o) {
        return {
            reportDate: getTomorrow(now),
            phase: 'locked',
            isOpen: false,
            phaseLabel: `Đã chốt Mốc 1. Chờ mở Mốc 2 lúc ${settings.moc2Open}`
        }
    }

    // Window 4: moc2_open → 23:59  (Mốc 2 cho NGÀY MAI — bổ sung tối)
    if (current >= m2o) {
        return {
            reportDate: getTomorrow(now),
            phase: 'moc2',
            isOpen: true,
            phaseLabel: `Mốc 2 — Bổ sung cho ngày mai (trước ${settings.moc2Close})`
        }
    }

    // Fallback: giữa moc2_close và moc1_open (nếu khác nhau)
    return {
        reportDate: getTomorrow(now),
        phase: 'locked',
        isOpen: false,
        phaseLabel: `Chờ mở Mốc 1 lúc ${settings.moc1Open}`
    }
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
// Gửi hoặc cập nhật báo cáo suất ăn
// ==================================================
export async function submitReport(formData: FormData) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    // Lấy thông tin profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, room_id')
        .eq('id', user.id)
        .single()

    if (!profile || !profile.room_id) {
        return { error: 'Không tìm thấy thông tin phòng' }
    }

    // Parse form data
    const capacity = parseInt(formData.get('capacity') as string) || 0
    const absentCount = parseInt(formData.get('absent_count') as string) || 0
    const porridgeCount = parseInt(formData.get('porridge_count') as string) || 0
    const vegetarianCount = parseInt(formData.get('vegetarian_count') as string) || 0
    const note = (formData.get('note') as string) || null
    const reportDate = (formData.get('report_date') as string) || new Date().toISOString().split('T')[0]

    // Parse absent list (JSON string)
    let absentList: { name: string; reason?: string }[] = []
    try {
        const absentListStr = formData.get('absent_list') as string
        if (absentListStr) absentList = JSON.parse(absentListStr)
    } catch { absentList = [] }

    // Validation
    const saltyCount = capacity - absentCount - porridgeCount - vegetarianCount
    if (saltyCount < 0) {
        return { error: 'Số suất mặn không thể âm. Kiểm tra lại số liệu.' }
    }

    // Kiểm tra giờ — chỉ cho room_manager
    if (profile.role === 'room_manager') {
        const settings = await getTimeSettings(supabase)
        const now = new Date()
        const state = getFormState(now, settings)

        if (!state.isOpen) {
            return { error: `${state.phaseLabel}. Không thể báo suất. Liên hệ Admin.` }
        }

        // Đảm bảo report_date khớp với state
        if (reportDate !== state.reportDate) {
            return { error: `Ngày báo cáo không hợp lệ. Hiện tại đang ở giai đoạn: ${state.phaseLabel}` }
        }
    }

    // Kiểm tra đã có báo cáo chưa
    const { data: existing } = await supabase
        .from('daily_reports')
        .select('id, capacity, absent_count, salty_count, porridge_count, vegetarian_count, absent_list, moc1_snapshot')
        .eq('room_id', profile.room_id)
        .eq('report_date', reportDate)
        .single()

    if (existing) {
        // Nếu đang ở Mốc 2 và chưa có snapshot → lưu snapshot Mốc 1
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

        // Update
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
        // Insert
        const { error } = await supabase
            .from('daily_reports')
            .insert({
                room_id: profile.room_id,
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
            })

        if (error) return { error: error.message }
    }

    revalidatePath('/dashboard/room')
    return { success: true }
}

// ==================================================
// Lấy thông tin phòng và báo cáo (dựa trên phase)
// ==================================================
export async function getRoomData() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('room_id')
        .eq('id', user.id)
        .single()

    if (!profile?.room_id) return { error: 'Không tìm thấy phòng' }

    // Lấy settings
    const settings = await getTimeSettings(supabase)
    const now = new Date()
    const state = getFormState(now, settings)

    // Lấy thông tin phòng
    const { data: room } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', profile.room_id)
        .single()

    // Lấy báo cáo cho ngày ăn đúng
    const { data: report } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('room_id', profile.room_id)
        .eq('report_date', state.reportDate)
        .single()

    return {
        room,
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
