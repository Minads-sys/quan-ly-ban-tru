-- Bước 1: Xóa policy cũ bị lỗi đệ quy
DROP POLICY IF EXISTS "Admin can manage all profiles" ON public.profiles;

-- Bước 2: Tạo policy mới chỉ áp dụng cho UPDATE (sẽ không bị lặp vô hạn nữa)
CREATE POLICY "Admin can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
