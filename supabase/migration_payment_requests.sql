-- =========================================================================
-- MIGRATION: Bảng PAYMENT_REQUESTS (Giấy Đề Nghị Thanh Toán)
-- Chạy trong SQL Editor của Supabase Dashboard (Bản chuẩn an toàn 100%, không dùng lệnh DROP)
-- =========================================================================

-- 1. Tạo bảng PAYMENT_REQUESTS
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_code TEXT NOT NULL UNIQUE,
  title TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  meal_type TEXT NOT NULL DEFAULT 'all' CHECK (meal_type IN ('all', 'student', 'teacher')),
  student_meal_count INTEGER NOT NULL DEFAULT 0,
  student_meal_amount NUMERIC NOT NULL DEFAULT 0,
  teacher_meal_count INTEGER NOT NULL DEFAULT 0,
  teacher_meal_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at DATE,
  payment_method TEXT DEFAULT 'bank' CHECK (payment_method IN ('bank', 'cash', 'other')),
  voucher_id UUID REFERENCES public.advance_payments(id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Index tối ưu tìm kiếm theo kỳ và trạng thái
CREATE INDEX IF NOT EXISTS idx_payment_requests_dates ON public.payment_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_code ON public.payment_requests(request_code);

-- 3. Hàm cập nhật thời gian updated_at
CREATE OR REPLACE FUNCTION public.update_payment_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger kiểm tra tồn tại trước khi tạo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_payment_requests_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_payment_requests_updated_at
      BEFORE UPDATE ON public.payment_requests
      FOR EACH ROW EXECUTE FUNCTION public.update_payment_requests_updated_at();
  END IF;
END $$;

-- 4. Bật Row Level Security (RLS)
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- 5. Phân quyền bảo mật (RLS Policies)
DO $$
BEGIN
  -- Mọi user đã đăng nhập đều xem được
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view payment requests' AND tablename = 'payment_requests'
  ) THEN
    CREATE POLICY "Authenticated users can view payment requests"
      ON public.payment_requests FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- Admin có quyền thêm, sửa, xóa
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage payment requests' AND tablename = 'payment_requests'
  ) THEN
    CREATE POLICY "Admin can manage payment requests"
      ON public.payment_requests FOR ALL
      TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- 6. Bật Realtime cập nhật tức thì
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'payment_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_requests;
  END IF;
END $$;
