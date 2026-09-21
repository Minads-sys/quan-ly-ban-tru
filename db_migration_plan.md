# Kế Hoạch Migrate Database: Supabase Cloud → PostgreSQL VPS

> **Dành cho AI đang code dự án ban-tru.**
> **Mục đích**: Chuyển database từ Supabase Cloud sang PostgreSQL local trên VPS để tăng tốc x3000.
> **Giữ nguyên**: Supabase Auth (Cloud) — login/logout/session không đổi.
> **Ưu tiên**: Thực hiện theo thứ tự giai đoạn. Không thay đổi logic nghiệp vụ.

---

## Tổng Quan

```
TRƯỚC:  VPS (Next.js) ──200ms──→ Supabase Cloud DB (Singapore)
SAU:    VPS (Next.js) ──0.07ms──→ PostgreSQL localhost (cùng máy)
```

| Thành phần | Trước | Sau | Thay đổi? |
|---|---|---|---|
| Login/Logout/Session | Supabase Auth Cloud | Supabase Auth Cloud | ❌ Không |
| Middleware phân quyền | Supabase Auth | Supabase Auth | ❌ Không |
| Database queries | `supabase.from()` | `query()` / `queryOne()` / `execute()` | ✅ 17 files |
| Realtime | Supabase WebSocket | Polling 5s | ✅ 2 files |
| UI Components | React | React | ❌ Không |

---

## GIAI ĐOẠN 0: Chuẩn Bị Database Trên VPS (ĐÃ CÓ SẴN SCRIPT)

> [!IMPORTANT]
> **Script `supabase/setup_vps_db.sh` đã được tạo sẵn.** Chạy trên VPS trước khi bắt đầu refactor code.
> User (chủ dự án) sẽ tự chạy script này trên VPS.

Sau khi chạy, database sẽ có:
- **DB name**: `ban_tru_db`
- **DB user**: `usr_ban_tru`
- **DB pass**: `BanTru2026@Secure`
- **Connection**: `postgresql://usr_ban_tru:BanTru2026@Secure@127.0.0.1:5432/ban_tru_db`

---

## GIAI ĐOẠN 1: Cài Package & Tạo DB Module

### Bước 1.1: Cài `pg` package

```bash
npm install pg
npm install -D @types/pg
```

### Bước 1.2: Tạo file mới `src/lib/db.ts`

```typescript
import { Pool, QueryResult } from 'pg'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }
  return pool
}

/** Query trả về mảng rows */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result: QueryResult<T> = await getPool().query(text, params)
  return result.rows
}

/** Query trả về 1 row hoặc null */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] || null
}

/** Insert/Update/Delete, trả về rowCount và rows (nếu có RETURNING) */
export async function execute(
  text: string,
  params?: unknown[]
): Promise<{ rowCount: number; rows: Record<string, unknown>[] }> {
  const result = await getPool().query(text, params)
  return { rowCount: result.rowCount || 0, rows: result.rows }
}
```

### Bước 1.3: Thêm `DATABASE_URL` vào `.env.local` (dev) và `.env.production.example`

```
# Thêm vào .env.local (dev - trỏ tới VPS hoặc local PostgreSQL)
DATABASE_URL=postgresql://usr_ban_tru:BanTru2026@Secure@127.0.0.1:5432/ban_tru_db

# Thêm vào .env.production.example
DATABASE_URL=postgresql://usr_ban_tru:BanTru2026@Secure@127.0.0.1:5432/ban_tru_db
```

---

## GIAI ĐOẠN 2: Refactor DB Queries (17 Files)

### Nguyên tắc chuyển đổi

**Import thay đổi:**
```typescript
// TRƯỚC:
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
const { data } = await supabase.from('settings').select('*')

// SAU:
import { query, queryOne, execute } from '@/lib/db'
const data = await query('SELECT * FROM settings')
```

**Bảng chuyển đổi cú pháp:**

| Supabase | PostgreSQL (`@/lib/db`) |
|---|---|
| `.from('t').select('*')` | `query('SELECT * FROM t')` |
| `.from('t').select('a, b').eq('id', val)` | `query('SELECT a, b FROM t WHERE id = $1', [val])` |
| `.from('t').select('*').eq('id', val).single()` | `queryOne('SELECT * FROM t WHERE id = $1', [val])` |
| `.from('t').select('*').eq('id', val).maybeSingle()` | `queryOne('SELECT * FROM t WHERE id = $1', [val])` |
| `.from('t').select('*').in('key', arr)` | `query('SELECT * FROM t WHERE key = ANY($1)', [arr])` |
| `.from('t').select('*').order('name')` | `query('SELECT * FROM t ORDER BY name')` |
| `.from('t').insert({a, b})` | `execute('INSERT INTO t (a, b) VALUES ($1, $2)', [a, b])` |
| `.from('t').update({a}).eq('id', x)` | `execute('UPDATE t SET a = $1 WHERE id = $2', [a, x])` |
| `.from('t').upsert({key, value})` | `execute('INSERT INTO t (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, value])` |
| `.from('t').delete().eq('id', x)` | `execute('DELETE FROM t WHERE id = $1', [x])` |
| `.from('t').select('*, rooms(name)')` | `query('SELECT t.*, r.name as room_name FROM t JOIN rooms r ON r.id = t.room_id')` |

**Xử lý lỗi:**
```typescript
// TRƯỚC:
const { data, error } = await supabase.from('groups').insert({ name })
if (error) return { error: error.message }

// SAU:
try {
  await execute('INSERT INTO groups (name) VALUES ($1)', [name])
} catch (err: any) {
  return { error: err.message }
}
```

### Danh sách 17 files cần sửa (theo thứ tự ưu tiên):

**Nhóm 1 — Đơn giản (1-2 queries mỗi file):**

| # | File | Thay đổi |
|---|---|---|
| 1 | `src/lib/cachedSettings.ts` | 1 query `settings` |
| 2 | `src/lib/supabase/middleware.ts` | 1 query `profiles` (CHỈ phần DB, giữ Auth) |
| 3 | `src/app/(auth)/login/actions.ts` | 1 query `profiles` (CHỈ phần DB, giữ Auth) |
| 4 | `src/app/dashboard/layout.tsx` | 2 queries: `profiles`, `settings` |
| 5 | `src/app/dashboard/admin/page.tsx` | ~2 queries |

**Nhóm 2 — Trung bình (3-8 queries):**

| # | File | Thay đổi |
|---|---|---|
| 6 | `src/app/dashboard/kitchen/actions.ts` | 5 queries (có JOIN) |
| 7 | `src/app/dashboard/kitchen/teacher-actions.ts` | ~3 queries |
| 8 | `src/app/dashboard/room/actions.ts` | ~8 queries |
| 9 | `src/app/dashboard/room/bulk-actions.ts` | ~4 queries |
| 10 | `src/app/dashboard/room/BulkReportForm.tsx` | ~2 queries |
| 11 | `src/app/dashboard/reports/actions.ts` | ~5 queries |
| 12 | `src/app/dashboard/school/actions.ts` | ~8 queries |
| 13 | `src/app/dashboard/admin/actions.ts` | ~6 queries |
| 14 | `src/app/dashboard/distributor/actions.ts` | ~3 queries |

**Nhóm 3 — Phức tạp (10+ queries):**

| # | File | Thay đổi |
|---|---|---|
| 15 | `src/app/dashboard/group/actions.ts` | ~10 queries (nhiều JOIN, phân quyền phức tạp) |
| 16 | `src/app/dashboard/settings/actions.ts` | ~15 queries + tạo user |
| 17 | `src/app/dashboard/finance/actions.ts` | ~10 queries |

> [!WARNING]
> **File `settings/actions.ts` đặc biệt**: Có hàm `createUser()` dùng `supabase.auth.signUp()` — **GIỮA NGUYÊN phần auth**. Chỉ đổi phần insert vào `profiles` sang PostgreSQL.

> [!WARNING]
> **Tất cả `supabase.auth.getUser()` trong actions — GIỮA NGUYÊN.** Chỉ thay các dòng `supabase.from(...)` sang `query()`/`queryOne()`/`execute()`.

---

## GIAI ĐOẠN 3: Thay Realtime Bằng Polling

### File 1: `src/hooks/useRealtimeRefresh.ts`

Thay toàn bộ nội dung bằng:

```typescript
'use client'

import { useEffect, useRef } from 'react'

/**
 * Hook polling thay thế Supabase Realtime.
 * Gọi onRefresh() định kỳ để cập nhật dữ liệu.
 * API giữ nguyên để không cần sửa các component đang dùng.
 */
export function useRealtimeRefresh(
    tables: string[],
    onRefresh: () => void,
    intervalMs = 5000
) {
    const onRefreshRef = useRef(onRefresh)

    useEffect(() => {
        onRefreshRef.current = onRefresh
    }, [onRefresh])

    useEffect(() => {
        if (tables.length === 0) return

        const interval = setInterval(() => {
            onRefreshRef.current()
        }, intervalMs)

        return () => clearInterval(interval)
    }, [tables.length, intervalMs])
}
```

### File 2: `src/components/features/RealtimeListener.tsx`

Bỏ import `createClient` từ supabase, bỏ `supabase.channel()`. Giữ toast UI:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { ToastContainer, type ToastMessage } from '@/components/ui/Toast'

interface RealtimeListenerProps {
    userRole: string
}

export function RealtimeListener({ userRole }: RealtimeListenerProps) {
    const [toasts, setToasts] = useState<ToastMessage[]>([])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    // Toast notifications giờ được trigger từ các page component
    // thông qua polling refresh (useRealtimeRefresh)
    
    return <ToastContainer toasts={toasts} onRemove={removeToast} />
}
```

---

## GIAI ĐOẠN 4: Cập Nhật Environment

### Thêm vào `.env.production` trên VPS:

```
# PostgreSQL Local (THÊM MỚI)
DATABASE_URL=postgresql://usr_ban_tru:BanTru2026@Secure@127.0.0.1:5432/ban_tru_db
```

### Thêm vào `.env.local` (dev local):

```
# PostgreSQL (kết nối tới VPS qua SSH tunnel hoặc dùng Supabase DB tạm thời khi dev)
DATABASE_URL=postgresql://usr_ban_tru:BanTru2026@Secure@103.200.22.218:5432/ban_tru_db
```

> [!NOTE]
> Khi dev local, có thể dùng SSH tunnel: `ssh -L 5432:127.0.0.1:5432 root@103.200.22.218` rồi kết nối `localhost:5432`.

---

## GIAI ĐOẠN 5: Migration Data (User Tự Chạy Trên VPS)

> [!IMPORTANT]
> Phần này user (chủ dự án) sẽ tự chạy trên VPS sau khi code refactor xong.
> AI không cần thực hiện phần này, chỉ cần đảm bảo code hoạt động với PostgreSQL local.

Script migration data từ Supabase → VPS đã được chuẩn bị riêng.

---

## Checklist Kiểm Tra Sau Khi Hoàn Thành

- [ ] `npm install` — cài `pg` và `@types/pg` thành công
- [ ] `npm run build` — build thành công, không lỗi TypeScript
- [ ] `npm run lint` — pass
- [ ] File `src/lib/db.ts` tồn tại và export `query`, `queryOne`, `execute`
- [ ] Không còn `supabase.from(` trong bất kỳ file nào (trừ comment)
- [ ] Tất cả `supabase.auth.*` vẫn giữ nguyên (KHÔNG thay đổi)
- [ ] `supabase.channel()` không còn trong code
- [ ] `useRealtimeRefresh` dùng polling thay Realtime
- [ ] Login/logout hoạt động
- [ ] Phân quyền route đúng
- [ ] Trang Kitchen hiển thị đúng
- [ ] Báo suất tạo/sửa thành công
- [ ] Reports hiển thị đúng
- [ ] Auto-refresh hoạt động (polling)

---

## Lưu Ý Quan Trọng

> [!CAUTION]
> **KHÔNG thay đổi các file/phần sau:**
> - `src/lib/supabase/client.ts` — vẫn cần cho Auth browser-side
> - `src/lib/supabase/server.ts` — vẫn cần cho Auth server-side  
> - `src/lib/supabase/admin.ts` — vẫn cần cho Auth admin operations
> - `src/lib/session.ts` — đọc cookie, không liên quan DB
> - `src/proxy.ts` — middleware routing
> - Tất cả `supabase.auth.*` calls — giữ nguyên 100%
> - Tất cả UI component files (`.tsx`) — trừ khi chứa `supabase.from()`

> [!NOTE]
> **Xử lý JOIN trong Supabase:**
> Supabase hỗ trợ nested select: `.select('*, rooms(name)')`. Khi chuyển sang SQL, dùng JOIN:
> ```sql
> SELECT dr.*, r.name as room_name, g.name as group_name
> FROM daily_reports dr
> JOIN rooms r ON r.id = dr.room_id
> JOIN groups g ON g.id = r.group_id
> ```
> Lưu ý cấu trúc data trả về sẽ khác (flat object thay vì nested). Cần điều chỉnh code xử lý phía sau cho phù hợp.

> [!NOTE]
> **Rollback:** Giữ nguyên Supabase Cloud database, không xóa. Nếu có vấn đề, revert code về commit trước là xong.
