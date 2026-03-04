-- =============================================
-- SETTINGS TABLE & USER MANAGEMENT
-- Chạy trong SQL Editor của Supabase Dashboard
-- =============================================

-- Bảng CÀI ĐẶT HỆ THỐNG
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ==================================================
-- 4 mốc thời gian cấu hình cho hệ thống chốt suất
-- ==================================================
-- Timeline trong 1 ngày:
--   moc2_close (07:00) -> moc1_open (07:00) -> moc1_close (16:00) -> moc2_open (23:59) -> [midnight] -> moc2_close (07:00)
--
-- Giải thích:
--   moc1_open  = Giờ mở form Mốc 1 (báo suất cho NGÀY MAI)
--   moc1_close = Giờ chốt Mốc 1 (bếp đi chợ dựa trên snapshot)
--   moc2_open  = Giờ mở form Mốc 2 (bổ sung/sửa bữa NGÀY HÔM NAY)  
--   moc2_close = Giờ chốt Mốc 2 (khóa hoàn toàn)

INSERT INTO public.settings (key, value, description) VALUES
  ('moc1_open',  '07:00', 'Giờ mở form Mốc 1 (báo suất cho ngày mai)'),
  ('moc1_close', '16:00', 'Giờ chốt Mốc 1 — Bếp đi chợ'),
  ('moc2_open',  '23:59', 'Giờ mở form Mốc 2 (bổ sung sáng ngày ăn)'),
  ('moc2_close', '07:00', 'Giờ chốt Mốc 2 — Khóa hoàn toàn'),
  ('deadline_no_limit', 'false', 'Tắt giới hạn thời gian (true = không giới hạn)')
ON CONFLICT (key) DO NOTHING;

-- Xóa settings cũ nếu có
DELETE FROM public.settings WHERE key IN ('deadline_time', 'deadline_1_time', 'deadline_2_time');

-- ==================================================
-- Thêm cột moc1_snapshot vào daily_reports
-- ==================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='daily_reports' AND column_name='moc1_snapshot') 
  THEN
    ALTER TABLE public.daily_reports ADD COLUMN moc1_snapshot JSONB DEFAULT NULL;
    COMMENT ON COLUMN public.daily_reports.moc1_snapshot IS 
      'Snapshot số liệu tại thời điểm chốt Mốc 1 (cho bếp đi chợ)';
  END IF;
END $$;

-- Bật RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Mọi user đã đăng nhập đều đọc được settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view settings' AND tablename = 'settings') THEN
    CREATE POLICY "Authenticated users can view settings"
      ON public.settings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Chỉ admin mới sửa được settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage settings' AND tablename = 'settings') THEN
    CREATE POLICY "Admin can manage settings"
      ON public.settings FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;
