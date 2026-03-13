-- =============================================
-- MIGRATION: Thêm tầng Lớp học & Quy trình duyệt 3 cấp
-- Chạy trong SQL Editor của Supabase Dashboard
-- =============================================

-- 1. Tạo bảng CLASSES (Lớp học)
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  default_capacity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS idx_classes_room ON public.classes(room_id);

-- RLS cho classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all classes"
  ON public.classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage classes"
  ON public.classes FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Sửa profiles: thêm role mới, thêm class_id
-- Xóa constraint cũ
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Thêm constraint mới
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'school_approver', 'group_manager', 'room_manager', 'class_teacher', 'kitchen'));

-- Thêm cột class_id
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

-- 3. Sửa daily_reports: thêm class_id, sửa status
-- Thêm class_id
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;

-- Xóa constraint status cũ
ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_status_check;

-- Thêm constraint status mới (thêm room_approved, school_approved)
ALTER TABLE public.daily_reports ADD CONSTRAINT daily_reports_status_check
  CHECK (status IN ('draft', 'submitted', 'room_approved', 'school_approved', 'rejected'));

-- 4. RLS policies mới cho daily_reports

-- Class teacher: INSERT/UPDATE báo cáo cho lớp mình
DROP POLICY IF EXISTS "Room manager can insert own room reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Room manager can update own room reports before 7AM" ON public.daily_reports;

CREATE POLICY "Class teacher can insert own class reports"
  ON public.daily_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'class_teacher'
        AND class_id = daily_reports.class_id
    )
  );

CREATE POLICY "Class teacher can update own class reports"
  ON public.daily_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'class_teacher'
        AND class_id = daily_reports.class_id
    )
  );

-- Room manager: UPDATE báo cáo trong phòng mình (Duyệt)
CREATE POLICY "Room manager can update reports in their room"
  ON public.daily_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.classes c ON c.room_id = p.room_id
      WHERE p.id = auth.uid()
        AND p.role = 'room_manager'
        AND c.id = daily_reports.class_id
    )
  );

-- School approver: UPDATE tất cả reports (Duyệt cấp trường)
CREATE POLICY "School approver can update all reports"
  ON public.daily_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'school_approver'
    )
  );

-- Realtime cho classes
ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;
