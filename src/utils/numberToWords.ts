/**
 * Chuyển đổi số tiền thành chữ tiếng Việt chuẩn xác theo quy tắc hành chính.
 * Ví dụ: 134400000 -> "Một trăm ba mươi bốn triệu bốn trăm nghìn đồng."
 */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const TIERS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ']

function readThreeDigits(threeDigits: number, isHighestTier: boolean): string {
    const hundreds = Math.floor(threeDigits / 100)
    const tens = Math.floor((threeDigits % 100) / 10)
    const ones = threeDigits % 10

    if (hundreds === 0 && tens === 0 && ones === 0) {
        return ''
    }

    let result = ''

    // Hàng trăm
    if (!isHighestTier || hundreds > 0) {
        result += `${DIGITS[hundreds]} trăm `
    }

    // Hàng chục
    if (tens === 0 && ones !== 0) {
        if (!isHighestTier || hundreds > 0) {
            result += 'lẻ '
        }
    } else if (tens === 1) {
        result += 'mười '
    } else if (tens > 1) {
        result += `${DIGITS[tens]} mươi `
    }

    // Hàng đơn vị
    if (ones === 1) {
        if (tens > 1) {
            result += 'mốt '
        } else {
            result += 'một '
        }
    } else if (ones === 4) {
        result += 'bốn '
    } else if (ones === 5) {
        if (tens > 0) {
            result += 'lăm '
        } else {
            result += 'năm '
        }
    } else if (ones > 0) {
        result += `${DIGITS[ones]} `
    }

    return result.trim()
}

export function numberToVietnameseWords(amount: number): string {
    if (isNaN(amount) || amount === 0) {
        return 'Không đồng.'
    }

    const isNegative = amount < 0
    let absAmount = Math.abs(Math.round(amount))

    // Phân tách thành từng nhóm 3 chữ số từ phải sang trái
    const groups: number[] = []
    while (absAmount > 0) {
        groups.push(absAmount % 1000)
        absAmount = Math.floor(absAmount / 1000)
    }

    let words = ''
    for (let i = groups.length - 1; i >= 0; i--) {
        const groupValue = groups[i]
        if (groupValue > 0) {
            const isHighest = (i === groups.length - 1)
            const groupText = readThreeDigits(groupValue, isHighest)
            if (groupText) {
                const tierName = TIERS[i % TIERS.length]
                words += `${groupText} ${tierName} `
            }
        }
    }

    words = words.trim()
    if (!words) {
        return 'Không đồng.'
    }

    // Chuẩn hóa khoảng trắng
    words = words.replace(/\s+/g, ' ').trim()

    // Viết hoa chữ cái đầu tiên và thêm "đồng."
    const capitalized = words.charAt(0).toUpperCase() + words.slice(1)
    const prefix = isNegative ? 'Âm ' : ''
    return `${prefix}${capitalized} đồng.`
}
