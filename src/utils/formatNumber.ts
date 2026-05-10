/**
 * Format số theo kiểu Việt Nam (dấu chấm phân cách hàng nghìn).
 * Dùng thay cho toLocaleString() để tránh hydration mismatch
 * giữa server (có thể dùng en-US locale) và client (vi-VN locale).
 */
export function formatVND(num: number): string {
    // Manual formatting to avoid locale-dependent behavior
    const isNegative = num < 0
    const absStr = Math.abs(Math.round(num)).toString()
    let result = ''
    let count = 0
    for (let i = absStr.length - 1; i >= 0; i--) {
        if (count > 0 && count % 3 === 0) {
            result = '.' + result
        }
        result = absStr[i] + result
        count++
    }
    return isNegative ? '-' + result : result
}
