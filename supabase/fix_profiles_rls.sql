-- Bảng PROFILES (Thông tin người dùng, liên kết auth.users)
-- Thêm policy cho Admin cập nhật hồ sơ người dùng

-- Admin có thể quản lý profiles (để gán phòng/nhóm)
CREATE POLICY "Admin can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
