'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getVietnamNow, getVietnamDateString } from '@/utils/dateUtils'

// ==================================================
// Helper: Lấy settings thời gian & xác định trạng thái form
// ==================================================
interface TimeSettings {
    moc1Open: string   // e.g. "07:00"
    moc1Close: string  // e.g. "16:00"
    moc2Open: string   // e.g. "23:59"
    moc2Close: string  // e.g. "07:00"
    noLimit: boolean
    workingDays: number[]
    offDays: string[]
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
    return getVietnamDateString(d)
}

function getNextWorkingDayStr(date: Date, workingDays: number[], offDays: string[]): string {
    if (!workingDays || workingDays.length === 0) {
        workingDays = [1, 2, 3, 4, 5]
    }
    if (!offDays) offDays = []

    let next = new Date(date.getTime() + 86400000)
    for (let i = 0; i < 30; i++) {
        const dateStr = getVietnamDateString(next)
        if (workingDays.includes(next.getDay()) && !offDays.includes(dateStr)) {
            return dateStr
        }
        next = new Date(next.getTime() + 86400000)
    }
    return getVietnamDateString(next)
}

/**
 * Tim ngay lam viec cuoi cung TRUOC ngay `date`.
 * VD: T2 la ngay an, T7 nghi -> tra ve T6; T7 hoc -> tra ve T7
 */
function getPreviousWorkingDayDate(date: Date, workingDays: number[], offDays: string[]): Date {
    if (!workingDays || workingDays.length === 0) workingDays = [1, 2, 3, 4, 5]
    if (!offDays) offDays = []
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    for (let i = 0; i < 14; i++) {
        const dateStr = getVietnamDateString(d)
        if (workingDays.includes(d.getDay()) && !offDays.includes(dateStr)) return d
        d.setDate(d.getDate() - 1)
    }
    return d
}

/**
 * Xác định reportDate (ngày ăn) và trạng thái form dựa trên giờ hiện tại.
 */
function getFormState(now: Date, settings: TimeSettings): FormState {
    if (settings.noLimit) {
        const m2c = toMinutes(settings.moc2Close)
        const current = now.getHours() * 60 + now.getMinutes()
        const reportDate = current < m2c ? formatDate(now) : getNextWorkingDayStr(now, settings.workingDays, settings.offDays)
        return { reportDate, phase: 'moc1', isOpen: true, phaseLabel: 'Khong gioi han' }
    }

    const current = now.getHours() * 60 + now.getMinutes()
    const m1o = toMinutes(settings.moc1Open)
    const m1c = toMinutes(settings.moc1Close)
    const m2o = toMinutes(settings.moc2Open)
    const m2c = toMinutes(settings.moc2Close)

    // Ngay an ke tiep (ngay lam viec tiep theo)
    const tomorrowStr = getNextWorkingDayStr(now, settings.workingDays, settings.offDays)
    const tomorrowDate = new Date(tomorrowStr + 'T00:00:00')

    // Tim ngay lam viec cuoi cung truoc ngay an (de xac dinh khi nao Moc 1 mo)
    // VD: T2 la ngay an, T7 nghi -> prevWorkDay = T6; T7 hoc -> prevWorkDay = T7
    const prevWorkDay = getPreviousWorkingDayDate(tomorrowDate, settings.workingDays, settings.offDays)
    const prevWorkDayStr = formatDate(prevWorkDay)
    const nowDateStr = formatDate(now)

    // Kiem tra xem hien tai co dang trong ngay lam viec truoc ngay an khong
    const isOnPrevWorkDay = nowDateStr === prevWorkDayStr
    // Kiem tra xem hien tai co dang trong ngay truoc ngay an (CN) khong
    const dayBeforeTomorrow = new Date(tomorrowDate)
    dayBeforeTomorrow.setDate(dayBeforeTomorrow.getDate() - 1)
    const dayBeforeTomorrowStr = formatDate(dayBeforeTomorrow)
    const isOnDayBeforeMeal = nowDateStr === dayBeforeTomorrowStr

    // Moc 2: sang ngay an
    if (current < m2c && nowDateStr === tomorrowStr) {
        return { reportDate: tomorrowStr, phase: 'moc2', isOpen: true, phaseLabel: `Moc 2 - Bo sung (truoc ${settings.moc2Close})` }
    }

    // Moc 1 mo: tu sang ngay lam viec truoc - het gio dong moc1 ngay truoc ngay an
    // Truong hop 1: Dang o ngay lam viec truoc (prevWorkDay), trong gio Moc 1
    if (isOnPrevWorkDay && current >= m1o && current < m1c) {
        return { reportDate: tomorrowStr, phase: 'moc1', isOpen: true, phaseLabel: `Moc 1 - Bao suat ngay mai (truoc ${settings.moc1Close})` }
    }
    // Truong hop 2: Dang o ngay truoc ngay an (CN neu T2 la ngay an, T7 nghi)
    // Va day KHONG PHAI la ngay lam viec truoc (tuc la T7 nghi -> CN la ngay truoc, prevWorkDay la T6)
    // -> Moc 1 van mo trong ngay nay cho den gio dong
    if (isOnDayBeforeMeal && !isOnPrevWorkDay && current < m1c) {
        return { reportDate: tomorrowStr, phase: 'moc1', isOpen: true, phaseLabel: `Moc 1 - Bao suat ngay mai (truoc ${settings.moc1Close})` }
    }
    // Truong hop 3: Dang o ngay lam viec truoc, qua gio dong Moc 1
    if (isOnPrevWorkDay && current >= m1c) {
        // Neu prevWorkDay = dayBeforeMeal (T7 hoc): khoa den Moc 2
        if (isOnDayBeforeMeal) {
            if (current >= m2o) {
                return { reportDate: tomorrowStr, phase: 'moc2', isOpen: true, phaseLabel: `Moc 2 - Bo sung ngay mai (truoc ${settings.moc2Close})` }
            }
            return { reportDate: tomorrowStr, phase: 'locked', isOpen: false, phaseLabel: `Da chot Moc 1. Cho mo Moc 2 luc ${settings.moc2Open}` }
        }
        // Neu prevWorkDay != dayBeforeMeal (T7 nghi, prevWorkDay=T6): khoa trong T7, mo lai Moc 1 tu CN sang
        return { reportDate: tomorrowStr, phase: 'locked', isOpen: false, phaseLabel: `Da chot Moc 1. Cho mo lai sang ${dayBeforeTomorrowStr}` }
    }
    // Truong hop 4: Ngay truoc ngay an (CN khi T7 nghi), sau gio dong Moc 1
    if (isOnDayBeforeMeal && !isOnPrevWorkDay && current >= m1c) {
        if (current >= m2o) {
            return { reportDate: tomorrowStr, phase: 'moc2', isOpen: true, phaseLabel: `Moc 2 - Bo sung ngay mai (truoc ${settings.moc2Close})` }
        }
        return { reportDate: tomorrowStr, phase: 'locked', isOpen: false, phaseLabel: `Da chot Moc 1. Cho mo Moc 2 luc ${settings.moc2Open}` }
    }

    // Mac dinh: chua den gio mo Moc 1
    return { reportDate: tomorrowStr, phase: 'locked', isOpen: false, phaseLabel: `Cho mo Moc 1 luc ${settings.moc1Open} ngay ${prevWorkDayStr}` }
}

// ==================================================
// Lấy settings từ DB
// ==================================================
async function getTimeSettings(supabase: Awaited<ReturnType<typeof createClient>>): Promise<TimeSettings> {
    const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['moc1_open', 'moc1_close', 'moc2_open', 'moc2_close', 'deadline_no_limit', 'working_days', 'off_days'])

    const get = (key: string, def: string) => data?.find(s => s.key === key)?.value || def

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

    return {
        moc1Open: get('moc1_open', '07:00'),
        moc1Close: get('moc1_close', '16:00'),
        moc2Open: get('moc2_open', '23:59'),
        moc2Close: get('moc2_close', '07:00'),
        noLimit: get('deadline_no_limit', 'false') === 'true',
        workingDays,
        offDays,
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
        const now = getVietnamNow()
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
        const now = getVietnamNow()
        const state = getFormState(now, settings)
        let moc1Snapshot = existing.moc1_snapshot

        if (state.phase === 'moc2' && !moc1Snapshot) {
            moc1Snapshot = {
                capacity: existing.capacity,
                absent_count: existing.absent_count,
                salty_count: existing.salty_count,
                porridge_count: existing.porridge_count,
                vegetarian_count: existing.vegetarian_count,
                absent_list: existing.absent_list,
                snapshot_at: getVietnamNow().toISOString(),
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
    const now = getVietnamNow()
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
            workingDays: settings.workingDays,
            offDays: settings.offDays,
        },
    }
}
