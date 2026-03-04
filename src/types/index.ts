// =============================================
// Enum & Type Definitions
// =============================================

/** Vai trò người dùng trong hệ thống */
export type UserRole = 'admin' | 'group_manager' | 'room_manager' | 'kitchen'

/** Trạng thái báo cáo suất ăn */
export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

// =============================================
// Database Interfaces
// =============================================

/** Thông tin profile người dùng (liên kết với auth.users) */
export interface Profile {
    id: string                  // UUID, FK → auth.users.id
    email: string
    full_name: string
    role: UserRole
    group_id: string | null     // FK → groups.id (cho group_manager)
    room_id: string | null      // FK → rooms.id (cho room_manager)
    created_at: string
    updated_at: string
}

/** Nhóm (ví dụ: Khối 1, Khối 2...) */
export interface Group {
    id: string                  // UUID
    name: string                // Tên nhóm
    created_at: string
}

/** Phòng học / Lớp học */
export interface Room {
    id: string                  // UUID
    name: string                // Tên phòng/lớp
    group_id: string            // FK → groups.id
    default_capacity: number    // Sĩ số mặc định
    created_at: string
}

/** Thông tin học sinh nghỉ (lưu trong JSONB) */
export interface AbsentStudent {
    name: string                // Họ tên học sinh
    reason?: string             // Lý do nghỉ (không bắt buộc)
}

/** Báo cáo suất ăn hàng ngày */
export interface DailyReport {
    id: string                  // UUID
    room_id: string             // FK → rooms.id
    report_date: string         // Ngày báo cáo (YYYY-MM-DD)
    capacity: number            // Sĩ số hiện tại
    absent_count: number        // Số học sinh nghỉ
    absent_list: AbsentStudent[] // Danh sách nghỉ (JSONB, không bắt buộc)
    porridge_count: number      // Số suất cháo
    vegetarian_count: number    // Số suất chay
    salty_count: number         // Số suất mặn (tính tự động)
    note: string | null         // Ghi chú
    status: ReportStatus        // Trạng thái báo cáo
    created_by: string          // FK → profiles.id
    updated_by: string | null   // FK → profiles.id (người cập nhật cuối)
    created_at: string
    updated_at: string
}

// =============================================
// Helper Types (dùng cho UI)
// =============================================

/** Thông tin tổng hợp cho Bếp */
export interface KitchenSummary {
    total_salty: number         // Tổng suất mặn
    total_vegetarian: number    // Tổng suất chay
    total_porridge: number      // Tổng suất cháo
    total_meals: number         // Tổng tất cả suất
    cong: number                // Số công = Math.ceil(total_meals / 20)
}

/** Thông tin tổng hợp theo nhóm */
export interface GroupSummary {
    group: Group
    rooms: (Room & { report?: DailyReport })[]
    total_meals: number
    cong: number
}
