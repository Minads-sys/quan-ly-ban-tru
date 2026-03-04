-- =============================================
-- GIAI ĐOẠN 2: Database Schema & RLS
-- Chạy trong SQL Editor của Supabase Dashboard
-- =============================================

-- =============================================
-- 1. TẠO BẢNG
-- =============================================

-- Bảng GROUPS (Nhóm/Khối)
CREATE TABLE public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Bảng ROOMS (Phòng/Lớp)
CREATE TABLE public.rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  default_capacity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Bảng PROFILES (Thông tin người dùng, liên kết auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'group_manager', 'room_manager', 'kitchen')),
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Bảng DAILY_REPORTS (Báo cáo suất ăn hàng ngày)
CREATE TABLE public.daily_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  capacity INTEGER NOT NULL DEFAULT 0,
  absent_count INTEGER NOT NULL DEFAULT 0,
  absent_list JSONB DEFAULT '[]'::jsonb,
  porridge_count INTEGER NOT NULL DEFAULT 0,
  vegetarian_count INTEGER NOT NULL DEFAULT 0,
  salty_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Mỗi phòng chỉ có 1 báo cáo/ngày
  UNIQUE(room_id, report_date)
);

-- Index để tối ưu truy vấn theo ngày
CREATE INDEX idx_daily_reports_date ON public.daily_reports(report_date);
CREATE INDEX idx_daily_reports_room_date ON public.daily_reports(room_id, report_date);

-- =============================================
-- 2. TRIGGER: Tự động tạo profile khi user đăng ký
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'room_manager')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 3. TRIGGER: Tự động cập nhật updated_at
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER update_daily_reports_updated_at
  BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 4. BẬT ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. RLS POLICIES
-- =============================================

-- ---- PROFILES ----

-- Mọi user đã đăng nhập đều xem được profiles
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- User chỉ sửa được profile của mình
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- ---- GROUPS ----

-- Mọi user đã đăng nhập đều xem được groups
CREATE POLICY "Authenticated users can view all groups"
  ON public.groups FOR SELECT
  TO authenticated
  USING (true);

-- Chỉ admin mới thêm/sửa/xóa groups
CREATE POLICY "Admin can manage groups"
  ON public.groups FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- ROOMS ----

-- Mọi user đã đăng nhập đều xem được rooms
CREATE POLICY "Authenticated users can view all rooms"
  ON public.rooms FOR SELECT
  TO authenticated
  USING (true);

-- Chỉ admin mới thêm/sửa/xóa rooms
CREATE POLICY "Admin can manage rooms"
  ON public.rooms FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- DAILY_REPORTS ----

-- Mọi user đã đăng nhập đều xem được báo cáo
CREATE POLICY "Authenticated users can view all reports"
  ON public.daily_reports FOR SELECT
  TO authenticated
  USING (true);

-- Room manager: chỉ INSERT báo cáo cho phòng của mình
CREATE POLICY "Room manager can insert own room reports"
  ON public.daily_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'room_manager'
        AND room_id = daily_reports.room_id
    )
  );

-- Room manager: chỉ UPDATE phòng mình VÀ trước 7:00 AM
CREATE POLICY "Room manager can update own room reports before 7AM"
  ON public.daily_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'room_manager'
        AND room_id = daily_reports.room_id
    )
    AND EXTRACT(HOUR FROM CURRENT_TIME) < 7
  );

-- Group manager: có thể UPDATE status (duyệt) các báo cáo trong nhóm mình
CREATE POLICY "Group manager can update reports in their group"
  ON public.daily_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.rooms r ON r.group_id = p.group_id
      WHERE p.id = auth.uid()
        AND p.role = 'group_manager'
        AND r.id = daily_reports.room_id
    )
  );

-- Admin: BYPASS — toàn quyền trên daily_reports (INSERT, UPDATE, DELETE)
CREATE POLICY "Admin has full access to reports"
  ON public.daily_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 6. BẬT REALTIME cho daily_reports
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_reports;

-- =============================================
-- 7. DỮ LIỆU MẪU (Tùy chọn — bỏ comment nếu muốn test)
-- =============================================

/*
-- Tạo nhóm mẫu
INSERT INTO public.groups (name) VALUES
  ('Khối 1'),
  ('Khối 2'),
  ('Khối 3');

-- Tạo phòng mẫu (thay group_id bằng UUID thực)
-- INSERT INTO public.rooms (name, group_id, default_capacity) VALUES
--   ('Lớp 1A', '<khoi-1-uuid>', 35),
--   ('Lớp 1B', '<khoi-1-uuid>', 32),
--   ('Lớp 2A', '<khoi-2-uuid>', 30),
--   ('Lớp 2B', '<khoi-2-uuid>', 33);
*/
