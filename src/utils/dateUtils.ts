/**
 * Tiện ích xử lý ngày tháng cho Múi giờ Việt Nam (UTC+7)
 */

/**
 * Lấy đối tượng Date hiện tại theo múi giờ Việt Nam
 */
export function getVietnamNow(): Date {
    const now = new Date()
    // Chuyển đổi sang giờ Việt Nam (UTC+7)
    // Cách an toàn để tính toán thời gian thực tế ở VN dù server ở đâu
    return new Date(now.getTime() + (7 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000))
}

/**
 * Lấy chuỗi ngày YYYY-MM-DD theo giờ Việt Nam
 */
export function getVietnamDateString(date?: Date): string {
    const d = date || getVietnamNow()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

/**
 * Định dạng ngày YYYY-MM-DD sang DD/MM/YYYY để hiển thị
 */
export function formatToViewDate(dateStr: string): string {
    if (!dateStr || !dateStr.includes('-')) return dateStr
    const [yyyy, mm, dd] = dateStr.split('-')
    return `${dd}/${mm}/${yyyy}`
}

/**
 * Láy giờ hiện tại ở Việt Nam (0-23)
 */
export function getVietnamHours(): number {
    return getVietnamNow().getHours()
}

/**
 * Lấy số phút hiện tại ở Việt Nam tính từ đầu ngày (0-1439)
 */
export function getVietnamMinutesToday(): number {
    const now = getVietnamNow()
    return now.getHours() * 60 + now.getMinutes()
}
