import { getVietnamNow, getVietnamDateString } from './dateUtils'

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

function toMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number)
    return h * 60 + m
}

export function formatDate(d: Date): string {
    return getVietnamDateString(d)
}

export function getNextWorkingDay(date: Date, workingDays: number[], offDays: string[]): Date {
    if (!workingDays || workingDays.length === 0) {
        workingDays = [1, 2, 3, 4, 5]
    }
    if (!offDays) offDays = []

    let next = new Date(date.getTime() + 86400000)
    for (let i = 0; i < 30; i++) {
        const dateStr = getVietnamDateString(next)
        if (workingDays.includes(next.getDay()) && !offDays.includes(dateStr)) {
            return next
        }
        next = new Date(next.getTime() + 86400000)
    }
    return next
}

export function getFormState(now: Date, settings: TimeSettings): FormState {
    if (settings.noLimit) {
        const m2c = toMinutes(settings.moc2Close)
        const current = now.getHours() * 60 + now.getMinutes()
        const targetDate = current < m2c ? now : getNextWorkingDay(now, settings.workingDays, settings.offDays)
        return { reportDate: formatDate(targetDate), targetDate, phase: 'moc1', isOpen: true, phaseLabel: 'Không giới hạn' }
    }

    const current = now.getHours() * 60 + now.getMinutes()
    const m1o = toMinutes(settings.moc1Open)
    const m1c = toMinutes(settings.moc1Close)
    const m2o = toMinutes(settings.moc2Open)
    const m2c = toMinutes(settings.moc2Close)

    if (current < m2c) {
        return { reportDate: formatDate(now), targetDate: now, phase: 'moc2', isOpen: true, phaseLabel: `Mốc 2 — Bổ sung (trước ${settings.moc2Close})` }
    }
    
    const tomorrow = getNextWorkingDay(now, settings.workingDays, settings.offDays)
    
    if (current >= m1o && current < m1c) {
        return { reportDate: formatDate(tomorrow), targetDate: tomorrow, phase: 'moc1', isOpen: true, phaseLabel: `Mốc 1 — Báo suất ngày mai (trước ${settings.moc1Close})` }
    }
    if (current >= m1c && current < m2o) {
        return { reportDate: formatDate(tomorrow), targetDate: tomorrow, phase: 'locked', isOpen: false, phaseLabel: `Đã chốt Mốc 1. Chờ mở Mốc 2 lúc ${settings.moc2Open}` }
    }
    if (current >= m2o) {
        return { reportDate: formatDate(tomorrow), targetDate: tomorrow, phase: 'moc2', isOpen: true, phaseLabel: `Mốc 2 — Bổ sung cho ngày mai (trước ${settings.moc2Close})` }
    }
    
    return { reportDate: formatDate(tomorrow), targetDate: tomorrow, phase: 'locked', isOpen: false, phaseLabel: `Chờ mở Mốc 1 lúc ${settings.moc1Open}` }
}
