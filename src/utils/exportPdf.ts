/**
 * Tiện ích xuất phần tử DOM thành file PDF tải trực tiếp về máy tính
 * Sử dụng html2canvas + jsPDF với cơ chế dynamic import (an toàn SSR)
 */

export interface ExportPdfOptions {
    scale?: number
    fileName?: string
    orientation?: 'portrait' | 'landscape'
}

export async function exportElementToPdf(
    elementId: string,
    fileName: string = 'document.pdf',
    options?: ExportPdfOptions
): Promise<boolean> {
    try {
        const element = document.getElementById(elementId)
        if (!element) {
            console.error(`Không tìm thấy phần tử với ID: ${elementId}`)
            return false
        }

        // Dynamic import để tránh lỗi SSR trong Next.js
        const html2canvas = (await import('html2canvas')).default
        const { jsPDF } = await import('jspdf')

        const orientation = options?.orientation || 'portrait'
        const scale = options?.scale || 2

        // Tạm thời lưu và xóa box-shadow để không làm xấu viền PDF
        const originalShadow = element.style.boxShadow
        element.style.boxShadow = 'none'

        const canvas = await html2canvas(element, {
            scale: scale,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
        })

        // Khôi phục lại shadow
        element.style.boxShadow = originalShadow

        const imgData = canvas.toDataURL('image/jpeg', 0.98)

        // Khởi tạo tài liệu PDF khổ A4
        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'mm',
            format: 'a4',
            compress: true,
        })

        const pageWidth = orientation === 'portrait' ? 210 : 297
        const pageHeight = orientation === 'portrait' ? 297 : 210

        // Tính chiều cao ảnh tương ứng theo bề rộng trang A4
        const imgHeight = (canvas.height * pageWidth) / canvas.width

        // Biên độ dung sai (tolerance 6mm) để loại bỏ hoàn toàn việc sinh trang trắng thứ hai
        // do sai số làm tròn subpixel (px sang mm) khi chụp tài liệu A4
        const TOLERANCE_MM = 6

        if (imgHeight <= pageHeight + TOLERANCE_MM) {
            // Vừa khít trong 1 trang A4 duy nhất
            pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, Math.min(imgHeight, pageHeight))
        } else {
            // Xử lý chia nhiều trang nếu văn bản thực sự dài hơn 1 trang
            let heightLeft = imgHeight
            let position = 0

            pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight)
            heightLeft -= pageHeight

            // Chỉ thêm trang mới nếu phần nội dung còn lại thực sự vượt quá dung sai (> 6mm)
            while (heightLeft > TOLERANCE_MM) {
                position -= pageHeight
                pdf.addPage()
                pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight)
                heightLeft -= pageHeight
            }
        }

        // Tải trực tiếp file về máy
        const finalName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`
        pdf.save(finalName)
        return true
    } catch (error) {
        console.error('Lỗi khi xuất file PDF:', error)
        throw error
    }
}
