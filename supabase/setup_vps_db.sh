#!/bin/bash
# =============================================
# Setup PostgreSQL Database cho ban-tru trên VPS
# Chạy 1 lần duy nhất trên VPS
# =============================================
set -e

DB_NAME="ban_tru_db"
DB_USER="usr_ban_tru"
DB_PASS="BanTru2026@Secure"

echo "=========================================="
echo "  Setup PostgreSQL cho ban-tru"
echo "=========================================="

# 1. Tạo user và database
echo "[1/4] Tạo database và user..."
sudo -u postgres psql << EOSQL
-- Tạo user (bỏ qua nếu đã tồn tại)
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END \$\$;

-- Tạo database (bỏ qua nếu đã tồn tại)  
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')
\gexec

-- Cấp quyền
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
EOSQL

# 2. Tạo schema (tables, indexes, triggers — KHÔNG có RLS, KHÔNG có auth.users reference)
echo "[2/4] Tạo schema tables..."
PGPASSWORD="${DB_PASS}" psql -h 127.0.0.1 -U ${DB_USER} -d ${DB_NAME} << 'SCHEMA'

-- ============ GROUPS ============
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============ ROOMS ============
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  default_capacity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============ PROFILES ============
-- Không reference auth.users (Auth ở Supabase Cloud)
-- id = Supabase Auth user UUID
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'admin', 'school_approver', 'group_manager', 
    'room_manager', 'class_teacher', 'kitchen',
    'meal_distributor', 'reporter'
  )),
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  class_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============ CLASSES ============
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  default_capacity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_classes_room ON public.classes(room_id);

-- Thêm FK class_id cho profiles (sau khi classes tồn tại)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_class_id_fkey'
  ) THEN
    ALTER TABLE public.profiles 
      ADD CONSTRAINT profiles_class_id_fkey 
      FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============ DAILY_REPORTS ============
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  capacity INTEGER NOT NULL DEFAULT 0,
  absent_count INTEGER NOT NULL DEFAULT 0,
  absent_list JSONB DEFAULT '[]'::jsonb,
  porridge_count INTEGER NOT NULL DEFAULT 0,
  vegetarian_count INTEGER NOT NULL DEFAULT 0,
  salty_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'room_approved', 'school_approved', 'approved', 'rejected'
  )),
  moc1_snapshot JSONB DEFAULT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(room_id, report_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON public.daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_room_date ON public.daily_reports(room_id, report_date);

-- ============ TEACHER_MEAL_REPORTS ============
CREATE TABLE IF NOT EXISTS public.teacher_meal_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL UNIQUE,
  salty_count INTEGER NOT NULL DEFAULT 0,
  porridge_count INTEGER NOT NULL DEFAULT 0,
  vegetarian_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============ SETTINGS ============
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============ PAYMENT_REQUESTS ============
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
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_requests_dates ON public.payment_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);

-- ============ TRIGGERS: auto updated_at ============
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['profiles', 'daily_reports', 'teacher_meal_reports', 'settings', 'payment_requests'])
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_updated_at_' || tbl) THEN
      EXECUTE format('CREATE TRIGGER trg_updated_at_%s BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', tbl, tbl);
    END IF;
  END LOOP;
END $$;

-- ============ PERFORMANCE INDEXES ============
CREATE INDEX IF NOT EXISTS idx_teacher_meal_reports_date ON public.teacher_meal_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_advance_payments_payment_date ON public.advance_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_status_date ON public.daily_reports(status, report_date);
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON public.profiles(id, role);

SCHEMA

# 3. Verify
echo "[3/4] Kiểm tra tables..."
PGPASSWORD="${DB_PASS}" psql -h 127.0.0.1 -U ${DB_USER} -d ${DB_NAME} -c "\dt public.*"

# 4. Hiển thị connection string
echo ""
echo "[4/4] ✅ Setup hoàn tất!"
echo ""
echo "  DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
echo ""
echo "  Thêm dòng trên vào /var/www/ban-tru/.env.production"
echo "=========================================="
