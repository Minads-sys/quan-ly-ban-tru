import { getVietnamNow, getVietnamDateString, formatToViewDate } from './dateUtils'

export interface TimeSettings {
    moc1Open: string
    moc1Close: string
    moc2Open: string
    moc2Close: string
    noLimit: boolean
    workingDays: number[]
    offDays: string[]
}

export function mapTimeSettings(data: any[] | null): TimeSettings {
    const get = (key: string, def: string) => data?.find((s: any) => s.key === key)?.value || def

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

export type Phase = 'moc1' | 'moc2' | 'locked'

export interface FormState {
    reportDate: string
    targetDate: Date
    phase: Phase
    isOpen: boolean
    phaseLabel: string
}

function parseTimeObj(date: Date, timeStr: string, offsetDays: number): Date {
    const [h, m] = timeStr.split(':').map(Number)
    const d = new Date(date)
    d.setDate(d.getDate() + offsetDays)
    d.setHours(h, m, 0, 0)
    return d
}

function isWorkingDay(d: Date, settings: TimeSettings): boolean {
    const wDays = settings.workingDays || [1, 2, 3, 4, 5]
    const oDays = settings.offDays || []
    const dateStr = getVietnamDateString(d)
    return wDays.includes(d.getDay()) && !oDays.includes(dateStr)
}

/**
 * Tìm ngày làm việc cuối cùng TRƯỚC ngày `date`.
 * Dùng để xác định khi nào Mốc 1 mở:
 *   - Nếu T7 nghỉ và T2 là ngày ăn → trả về T6
 *   - Nếu T7 học và T2 là ngày ăn → trả về T7
 */
function getPreviousWorkingDay(date: Date, settings: TimeSettings): Date {
    const d = new Date(date)
    d.setDate(d.getDate() - 1) // bắt đầu từ ngày trước
    for (let i = 0; i < 14; i++) {
        if (isWorkingDay(d, settings)) return d
        d.setDate(d.getDate() - 1)
    }
    return d // fallback
}

export function getFormState(now: Date, settings: TimeSettings): FormState {
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)

    let candidate = new Date(today)
    for (let i = 0; i < 30; i++) {
        if (isWorkingDay(candidate, settings)) {
            // Tìm ngày làm việc cuối cùng trước ngày ăn để tính thời điểm mở Mốc 1
            // VD: T2 là ngày ăn, T7 nghỉ → prevWorkDay = T6; T7 học → prevWorkDay = T7
            const prevWorkDay = getPreviousWorkingDay(candidate, settings)
            const m1o = parseTimeObj(prevWorkDay, settings.moc1Open, 0)  // mở vào ngày làm việc cuối trước
            const m1c = parseTimeObj(candidate, settings.moc1Close, -1)  // đóng vào ngày hôm trước ngày ăn
            const m2o = parseTimeObj(candidate, settings.moc2Open, -1)
            const m2c = parseTimeObj(candidate, settings.moc2Close, 0)

            if (settings.noLimit) {
                if (now < m2c) {
                    return { reportDate: getVietnamDateString(candidate), targetDate: candidate, phase: 'moc1', isOpen: true, phaseLabel: 'Không giới hạn' }
                }
            } else {
                if (now < m1o) {
                    return { reportDate: getVietnamDateString(candidate), targetDate: candidate, phase: 'locked', isOpen: false, phaseLabel: `Chờ mở Mốc 1 lúc ${settings.moc1Open} ngày ${formatToViewDate(getVietnamDateString(m1o))}` }
                }
                if (now >= m1o && now < m1c) {
                    return { reportDate: getVietnamDateString(candidate), targetDate: candidate, phase: 'moc1', isOpen: true, phaseLabel: `Mốc 1 — Báo suất ngày mai (trước ${settings.moc1Close})` }
                }
                if (now >= m1c && now < m2o) {
                    return { reportDate: getVietnamDateString(candidate), targetDate: candidate, phase: 'locked', isOpen: false, phaseLabel: `Đã chốt Mốc 1. Chờ mở Mốc 2 lúc ${settings.moc2Open} ngày ${formatToViewDate(getVietnamDateString(m2o))}` }
                }
                if (now >= m2o && now < m2c) {
                    return { reportDate: getVietnamDateString(candidate), targetDate: candidate, phase: 'moc2', isOpen: true, phaseLabel: `Mốc 2 — Bổ sung sáng ngày ăn (trước ${settings.moc2Close})` }
                }
            }
        }
        candidate.setDate(candidate.getDate() + 1)
    }
    return { reportDate: getVietnamDateString(candidate), targetDate: candidate, phase: 'locked', isOpen: false, phaseLabel: 'Không tìm thấy ngày học tiếp theo' }
}
