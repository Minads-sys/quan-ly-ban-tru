/**
 * Tính số suất mặn
 * Công thức: Sĩ số - Nghỉ học - Cháo - Chay
 */
export function calculateSaltyMeals(
    capacity: number,
    absentCount: number,
    porridgeCount: number,
    vegetarianCount: number
): number {
    return capacity - absentCount - porridgeCount - vegetarianCount
}

/**
 * Tính số Công
 * Công thức: Math.ceil(Tổng suất / 20)
 */
export function calculateCong(totalMeals: number): number {
    return Math.ceil(totalMeals / 20)
}

/**
 * Tính tổng suất ăn (mặn + chay + cháo)
 */
export function calculateTotalMeals(
    saltyCount: number,
    vegetarianCount: number,
    porridgeCount: number
): number {
    return saltyCount + vegetarianCount + porridgeCount
}

/**
 * Kiểm tra có đang trong giờ cho phép báo suất không (trước 7:00 AM)
 * @param serverTime - Thời gian server (ISO string)
 */
export function isWithinReportingTime(serverTime?: string): boolean {
    const now = serverTime ? new Date(serverTime) : new Date()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    return hours < 7 || (hours === 7 && minutes === 0)
}
