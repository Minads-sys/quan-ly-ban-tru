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
