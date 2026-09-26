# 📋 YÊU CẦU TỐI ƯU HIỆU SUẤT - DỰ ÁN BAN-TRU

> **Dự án**: Hệ thống Quản lý Suất ăn Bán trú  
> **Đường dẫn**: `D:\2. HYMINH\PHẦN MỀM\DAT-SUAT-BAN-TRU\ban-tru`  
> **Ngày tạo**: 2026-09-26  
> **Mục tiêu**: Giảm thời gian load data từ ~2-3 giây xuống dưới 0.5 giây  
> **Nguyên tắc chung**: KHÔNG thay đổi UI/giao diện, KHÔNG xóa chức năng, giữ nguyên comment tiếng Việt

---

## TỔNG QUAN VẤN ĐỀ

Dự án hiện tại có **3 điểm nghẽn chính** gây load chậm:

1. **Auth check trùng lặp**: Mỗi server action đều gọi `supabase.auth.getUser()` + query bảng `profiles` riêng lẻ (~200-300ms mỗi lần), dù middleware đã cache `user-role` và `user-id` vào cookie rồi.
2. **Không gom queries**: Trang Finance gọi 5 server actions riêng lẻ qua `Promise.all()`, mỗi action tự tạo Supabase client + auth check riêng → tổng cộng 15-20 DB queries cho 1 lần load trang.
3. **Thiếu database indexes**: Các bảng `teacher_meal_reports`, `advance_payments`, `settings` thiếu index trên các cột hay query.

---

## THỨ TỰ THỰC HIỆN

```
Bước 1 → Nhiệm vụ 1 (tạo requireAuth)      → Chạy: npm run build → phải pass
Bước 2 → Nhiệm vụ 2 (thêm DB indexes)       → Chạy SQL trên Supabase hoặc VPS
Bước 3 → Nhiệm vụ 3 (gom Finance actions)    → Kiểm tra trang Finance load OK
Bước 4 → Nhiệm vụ 4 (SSR Finance)            → Kiểm tra first load nhanh
Bước 5 → Nhiệm vụ 5 (tách Settings)          → Kiểm tra Settings hoạt động
Bước 6 → Nhiệm vụ 6 (TypeScript/errors)      → Kiểm tra không có lỗi console
```

---

## NHIỆM VỤ 1: TẠO HÀM AUTH DÙNG CHUNG

**Ưu tiên: 🔴 CAO — Làm đầu tiên**

### Vấn đề

Pattern dưới đây lặp lại hơn **20 lần** trong toàn bộ dự án. Mỗi lần gọi tốn ~200-300ms network:

```typescript
// ❌ Pattern cũ — lặp lại trong MỌI server action
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()   // ~100-150ms gọi mạng
if (!user) return { error: 'Chưa đăng nhập' }

const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()  // ~80-120ms gọi mạng
```

Trong khi đó, middleware (`src/lib/supabase/middleware.ts` dòng 68-101) đã lưu `user-role` và `user-id` vào cookie httpOnly, và file `src/lib/session.ts` đã có hàm `getSessionInfo()` đọc cookie này (0ms). Nhưng hầu hết server actions không sử dụng nó.

### Yêu cầu

**Tạo file mới**: `src/lib/auth.ts`

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/session'

interface AuthResult {
    supabase: Awaited<ReturnType<typeof createClient>>
    userId: string
    userRole: string
}

/**
 * Hàm auth dùng chung cho tất cả server actions.
 * Ưu tiên đọc từ cookie (0ms) do middleware đã set sẵn.
 * Fallback sang auth.getUser() nếu cookie chưa có.
 */
export async function requireAuth(): Promise<AuthResult> {
    const supabase = await createClient()

    // Ưu tiên đọc từ cookie (middleware đã set)
    const { userId: cachedId, userRole: cachedRole } = await getSessionInfo()

    if (cachedId && cachedRole) {
        return { supabase, userId: cachedId, userRole: cachedRole }
    }

    // Fallback: gọi auth nếu cookie chưa có
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Chưa đăng nhập')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    return {
        supabase,
        userId: user.id,
        userRole: profile?.role || 'class_teacher'
    }
}

/**
 * Kiểm tra quyền admin. Throw error nếu không phải admin.
 */
export async function requireAdmin(): Promise<AuthResult> {
    const auth = await requireAuth()
    if (auth.userRole !== 'admin') {
        throw new Error('Chỉ Admin mới có quyền thực hiện thao tác này')
    }
    return auth
}
```

### Danh sách files cần sửa

Với mỗi file bên dưới, tìm tất cả chỗ có pattern `auth.getUser()` + `profiles.select('role')` rồi thay bằng `requireAuth()` hoặc `requireAdmin()`.

| File | Số lần auth lặp cần sửa | Dùng hàm nào |
|---|---|---|
| `src/app/dashboard/finance/actions.ts` | 8 lần (dòng 22-25, 57-65, 88-95, 156-157, 192-193, 259-260, 341-348, 527-535) | `requireAuth()` cho read, `requireAdmin()` cho delete |
| `src/app/dashboard/admin/actions.ts` | 5 lần (dòng 10-11+14-18, 57-58+61-65, 107-108+110-114, 164-165+168-172, 253-254+257-261) | `requireAdmin()` cho tất cả |
| `src/app/dashboard/settings/actions.ts` | 4 lần (dòng 20-21, 41-42, 213-216, 287-290+360-363) | `requireAdmin()` cho create/update/delete |
| `src/app/dashboard/room/actions.ts` | 2 lần (dòng 186-187+190-194, 332-333) | `requireAuth()` |
| `src/app/dashboard/group/actions.ts` | Kiểm tra và sửa tương tự |
| `src/app/dashboard/reports/actions.ts` | Kiểm tra và sửa tương tự |
| `src/app/dashboard/school/actions.ts` | Kiểm tra và sửa tương tự |
| `src/app/dashboard/distributor/actions.ts` | Kiểm tra và sửa tương tự |

**Lưu ý**: `src/app/dashboard/kitchen/actions.ts` đã dùng `getSessionInfo()` rồi → KHÔNG cần sửa.

### Cách sửa mẫu

**Ví dụ 1 — Hàm read (không cần admin)**:

```typescript
// ❌ TRƯỚC — file: finance/actions.ts, hàm getAdvancePayments (dòng 21-25)
export async function getAdvancePayments(startDate?: string, endDate?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }
    let query = supabase.from('advance_payments').select('*')...

// ✅ SAU:
import { requireAuth } from '@/lib/auth'

export async function getAdvancePayments(startDate?: string, endDate?: string) {
    let auth
    try { auth = await requireAuth() } catch { return { error: 'Chưa đăng nhập' } }
    const { supabase } = auth
    let query = supabase.from('advance_payments').select('*')...
```

**Ví dụ 2 — Hàm cần quyền admin**:

```typescript
// ❌ TRƯỚC — file: admin/actions.ts, hàm overrideReport (dòng 55-69)
export async function overrideReport(reportId: string, data: {...}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Chưa đăng nhập' }
    const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return { error: 'Chỉ Admin...' }
    const { error } = await supabase.from('daily_reports').update({...updated_by: user.id...

// ✅ SAU:
import { requireAdmin } from '@/lib/auth'

export async function overrideReport(reportId: string, data: {...}) {
    let auth
    try { auth = await requireAdmin() } catch (e: any) { return { error: e.message } }
    const { supabase, userId } = auth
    const { error } = await supabase.from('daily_reports').update({...updated_by: userId...
```

### Quy tắc bắt buộc

- KHÔNG xóa `import { createClient }` nếu file vẫn còn hàm nào cần nó trực tiếp (VD: hàm `getSettings()` dùng `getCachedSettings()` chứ không dùng `createClient()` trực tiếp)
- Giữ nguyên logic nghiệp vụ, chỉ thay phần auth check
- Hàm `requireAuth()` throw error → caller phải try-catch và return `{ error: ... }`
- Nơi nào dùng `user.id` cho `created_by` / `updated_by` → thay bằng `userId` từ auth result
- Sau khi sửa xong tất cả → chạy `npm run build` phải pass

---

## NHIỆM VỤ 2: THÊM DATABASE INDEXES

**Ưu tiên: 🔴 CAO**

### Yêu cầu

Tạo file mới: `supabase/add_indexes.sql`

```sql
-- =============================================
-- INDEXES TỐI ƯU HIỆU SUẤT
-- Chạy trên Supabase SQL Editor hoặc psql trên VPS
-- =============================================

-- teacher_meal_reports: query theo report_date rất thường xuyên
CREATE INDEX IF NOT EXISTS idx_teacher_meal_reports_date
    ON public.teacher_meal_reports(report_date);

-- advance_payments: filter theo payment_date trong finance
CREATE INDEX IF NOT EXISTS idx_advance_payments_payment_date
    ON public.advance_payments(payment_date);

-- daily_reports: filter theo status + report_date (cho debt summary)
CREATE INDEX IF NOT EXISTS idx_daily_reports_status_date
    ON public.daily_reports(status, report_date);

-- profiles: lookup nhanh cho RLS policies (id + role)
CREATE INDEX IF NOT EXISTS idx_profiles_id_role
    ON public.profiles(id, role);
```

Đồng thời cập nhật file `supabase/setup_vps_db.sh` — thêm các câu CREATE INDEX trên vào cuối phần SCHEMA (trước dòng `SCHEMA`).

---

## NHIỆM VỤ 3: GOM SERVER ACTIONS TRANG FINANCE

**Ưu tiên: 🔴 CAO**

### Vấn đề

File `src/app/dashboard/finance/page.tsx` dòng 85-94 gọi 5 server actions song song:

```typescript
const [paymentsResult, debtResult, teacherDebtResult, companyResult, requestsResult] = await Promise.all([
    getAdvancePayments(startDate, endDate),       // auth + 1 query
    getDebtSummary(startDate, endDate),            // auth + 4 queries
    getTeacherDebtReport(startDate, endDate),      // auth + 2 queries
    getCompanyAndPaymentSettings(),                // auth + 2 queries
    getPaymentRequests(startDate, endDate),        // auth + 1 query
])
```

Tổng: 5 lần auth check trùng lặp + 15-20 DB queries + settings bị query 3 lần.

### Yêu cầu

**Bước A**: Thêm hàm `getFinancePageData()` vào file `src/app/dashboard/finance/actions.ts`.

Hàm này phải:
1. Gọi `requireAuth()` **1 lần duy nhất**
2. Query bảng `settings` **1 lần duy nhất** (thay vì 3 lần)
3. Dùng `Promise.all()` chạy song song tất cả queries DATA (advance_payments, daily_reports, teacher_meal_reports, payment_requests)
4. Tính toán debt summary, teacher debt rows, company settings từ kết quả queries
5. Trả về 1 object chứa tất cả dữ liệu trang Finance cần

Logic tính toán lấy từ các hàm hiện có:
- `getDebtSummary()` → tính totalMeals, totalMealMoney, teacherTotalMeals, teacherTotalMoney, totalAdvance, overallDebt
- `getTeacherDebtReport()` → tính teacherDebtRows (map ra TeacherDebtDay[])
- `getCompanyAndPaymentSettings()` → build CompanyPaymentSettings object từ settings data

Return type gợi ý:
```typescript
{
    payments: AdvancePayment[]
    paymentRequests: PaymentRequest[]
    debtSummary: { totalMeals, totalMealMoney, totalAdvance, debt, mealPrice, teacherTotalMeals, teacherTotalMoney, teacherMealPrice, overallDebt, totalAllMoney }
    teacherDebtRows: TeacherDebtDay[]
    companySettings: CompanyPaymentSettings
}
```

**Bước B**: Sửa hàm `loadData()` trong `src/app/dashboard/finance/page.tsx` để gọi `getFinancePageData()` thay vì 5 actions riêng lẻ.

```typescript
const loadData = useCallback(async () => {
    setLoading(true)
    try {
        const result = await getFinancePageData(startDate, endDate)
        if ('error' in result) {
            setMessage({ type: 'error', text: result.error })
            return
        }
        setPayments(result.payments)
        setPaymentRequests(result.paymentRequests)
        setDebtSummary(result.debtSummary as any)
        setTeacherReports(result.teacherDebtRows)
        setCompanySettings(result.companySettings)
    } catch (err) {
        console.error(err)
    } finally {
        setLoading(false)
    }
}, [startDate, endDate])
```

### Quy tắc bắt buộc

- **KHÔNG xóa** các hàm cũ (`getAdvancePayments`, `getDebtSummary`, `getTeacherDebtReport`, `getCompanyAndPaymentSettings`, `getPaymentRequests`) vì chúng vẫn được import và sử dụng ở các file khác như `ReconciliationPrint.tsx`, `PaymentRequestCreateModal.tsx`
- Chỉ **thêm** hàm mới `getFinancePageData()` và **sửa** `loadData()` trong page.tsx
- Giữ nguyên toàn bộ UI/JSX — chỉ thay nguồn data

---

## NHIỆM VỤ 4: CHUYỂN FINANCE PAGE SANG SSR

**Ưu tiên: 🟠 TRUNG BÌNH**

### Yêu cầu

Áp dụng cùng pattern mà Kitchen page đã dùng thành công (`page.tsx` server component → `KitchenClient.tsx` client component).

**Bước A**: Tạo file mới `src/app/dashboard/finance/FinanceClient.tsx`

- Copy toàn bộ nội dung hiện tại từ `finance/page.tsx` vào file mới
- Thêm `'use client'` đầu file
- Đổi tên component: `export default function FinancePage()` → `export function FinanceClient({ initialData, defaultStartDate, defaultEndDate })`
- Thêm props interface
- Khởi tạo tất cả state từ `initialData` thay vì state rỗng + loading
- Giữ nguyên `loadData()` cho khi user đổi filter hoặc realtime event
- Bỏ `useEffect(() => { loadData() }, [loadData])` ban đầu (vì đã có initialData)

**Bước B**: Sửa `src/app/dashboard/finance/page.tsx` thành server component:

```typescript
// KHÔNG có 'use client' ở đây — đây là Server Component
import { getFinancePageData } from './actions'
import { FinanceClient } from './FinanceClient'
import { getVietnamNow, getVietnamDateString } from '@/utils/dateUtils'

export default async function FinancePage() {
    const now = getVietnamNow()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const startDate = getVietnamDateString(firstDay)
    const endDate = getVietnamDateString(now)

    const initialData = await getFinancePageData(startDate, endDate)

    return (
        <FinanceClient
            initialData={initialData}
            defaultStartDate={startDate}
            defaultEndDate={endDate}
        />
    )
}
```

### Quy tắc bắt buộc

- File `FinanceClient.tsx` phải có `'use client'` ở dòng đầu
- File `page.tsx` mới KHÔNG có `'use client'` (nó là Server Component)
- Giữ nguyên `useRealtimeRefresh` trong FinanceClient
- Giữ nguyên tất cả modal, tab, button, UI hiện tại

---

## NHIỆM VỤ 5: TÁCH SETTINGS PAGE THÀNH COMPONENTS NHỎ

**Ưu tiên: 🟠 TRUNG BÌNH**

### Vấn đề

File `src/app/dashboard/settings/page.tsx` có **1,734 dòng** và **30+ biến useState()** trong 1 component duy nhất. Mỗi keystroke vào bất kỳ input nào sẽ re-render toàn bộ 1,734 dòng JSX.

### Yêu cầu

Tách thành cấu trúc file:

```
src/app/dashboard/settings/
├── page.tsx                  # ~100 dòng: tabs container, toast, lazy import
├── TimeSettingsTab.tsx        # ~250 dòng: tab "Thời gian" + "Cấu hình trường"
├── RoomsGroupsTab.tsx         # ~500 dòng: tab "Phòng & Nhóm" + Import/Export Excel modal
├── UsersTab.tsx               # ~300 dòng: tab "Giáo viên" (CRUD users, đổi mật khẩu)
├── CompanyTab.tsx             # ~250 dòng: tab "Doanh nghiệp & In ấn"
└── actions.ts                 # Giữ nguyên, KHÔNG sửa file này
```

### Cách tách

Mỗi tab component:
- Có `'use client'` riêng
- Tự quản lý state (useState) của mình — chỉ chứa state liên quan đến tab đó
- Nhận prop `onMessage: (type: 'success' | 'error', text: string) => void` để hiển thị toast ở parent page
- Tự gọi `loadTabData()` khi mount và sau mỗi CRUD action
- Wrap bằng `React.memo()` để tránh re-render khi tab khác active

File `page.tsx` parent:
- Chỉ chứa: tab state, toast state, tab switcher buttons, và render tab component tương ứng
- Dùng conditional render (`{tab === 'time' && <TimeSettingsTab onMessage={showMsg} />}`) hoặc `React.lazy()` + `Suspense`

### Quy tắc bắt buộc

- Giữ nguyên 100% giao diện hiện tại — user không được thấy thay đổi
- Giữ nguyên feature: khôi phục tab từ localStorage
- Giữ nguyên tất cả import/export Excel logic
- Mỗi tab tự import action functions cần thiết từ `./actions`

---

## NHIỆM VỤ 6: FIX TYPESCRIPT VÀ ERROR HANDLING

**Ưu tiên: 🟢 THẤP — Làm cuối cùng**

### 6a. Fix try-catch rỗng

Tìm tất cả `catch (e) {}` hoặc `catch {}` rỗng trong dự án và thêm log:

```typescript
// ❌ TRƯỚC:
try { ... } catch (e) {}

// ✅ SAU:
try { ... } catch (e) { console.error('[tên hàm] error:', e) }
```

Vị trí đã biết:
- `src/app/dashboard/finance/actions.ts`: dòng 167, 231, 267, 321, 360
- `src/app/dashboard/settings/page.tsx`: dòng 47, 52, 57

### 6b. Giảm `as any`

Ưu tiên file `src/app/dashboard/kitchen/KitchenClient.tsx` — tạo proper interface cho `initialData` prop thay vì cast `(initialData as any).teacherMeal`.

---

## KIỂM TRA ĐẦU RA (CHẠY SAU KHI HOÀN THÀNH TẤT CẢ)

1. ✅ `npm run build` phải thành công, không lỗi TypeScript
2. ✅ Tất cả trang dashboard phải load và hoạt động bình thường:
   - `/dashboard/admin` — CRUD báo cáo, import Excel
   - `/dashboard/finance` — xem thống kê, tạo ĐNTT, in phiếu thu
   - `/dashboard/kitchen` — xem tổng suất, 3 tabs, xuất Excel
   - `/dashboard/room` — báo suất đơn + hàng loạt + suất GV
   - `/dashboard/settings` — 4 tabs cài đặt, import/export phòng
   - `/dashboard/group` — duyệt báo cáo nhóm
   - `/dashboard/school` — duyệt cấp trường
   - `/dashboard/reports` — xem báo cáo tổng hợp
3. ✅ Realtime refresh vẫn hoạt động (thay đổi data trên 1 tab → tab khác tự cập nhật)
4. ✅ Phân quyền vẫn đúng (role kitchen chỉ vào được kitchen, admin vào được tất cả, v.v.)
5. ✅ Đăng nhập / đăng xuất hoạt động bình thường
6. ✅ KHÔNG mất bất kỳ chức năng nào
