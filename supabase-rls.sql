-- =============================================================================
-- ตั้งค่า Row Level Security (RLS) สำหรับระบบสอบออนไลน์
-- รันใน Supabase Dashboard → SQL Editor → New query → Run
--
-- แอปใช้ anon key จากเบราว์เซอร์ จึงต้องอนุญาต role "anon" ให้ CRUD ได้
-- (เหมาะกับโปรเจกต์พัฒนา/โรงเรียน — production ควรใช้ Supabase Auth + policy ที่เข้มกว่า)
-- =============================================================================

-- users (สมัครสมาชิก / เข้าสู่ระบบ)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_users_select" ON public.users;
DROP POLICY IF EXISTS "anon_users_insert" ON public.users;
DROP POLICY IF EXISTS "anon_users_update" ON public.users;
DROP POLICY IF EXISTS "anon_users_delete" ON public.users;
CREATE POLICY "anon_users_select" ON public.users FOR SELECT TO anon USING (true);
CREATE POLICY "anon_users_insert" ON public.users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_users_update" ON public.users FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_users_delete" ON public.users FOR DELETE TO anon USING (true);

-- subjects
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_subjects_select" ON public.subjects;
DROP POLICY IF EXISTS "anon_subjects_insert" ON public.subjects;
DROP POLICY IF EXISTS "anon_subjects_update" ON public.subjects;
DROP POLICY IF EXISTS "anon_subjects_delete" ON public.subjects;
CREATE POLICY "anon_subjects_select" ON public.subjects FOR SELECT TO anon USING (true);
CREATE POLICY "anon_subjects_insert" ON public.subjects FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_subjects_update" ON public.subjects FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_subjects_delete" ON public.subjects FOR DELETE TO anon USING (true);

-- enrollments
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_enrollments_select" ON public.enrollments;
DROP POLICY IF EXISTS "anon_enrollments_insert" ON public.enrollments;
DROP POLICY IF EXISTS "anon_enrollments_update" ON public.enrollments;
DROP POLICY IF EXISTS "anon_enrollments_delete" ON public.enrollments;
CREATE POLICY "anon_enrollments_select" ON public.enrollments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_enrollments_insert" ON public.enrollments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_enrollments_update" ON public.enrollments FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_enrollments_delete" ON public.enrollments FOR DELETE TO anon USING (true);

-- exams
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_exams_select" ON public.exams;
DROP POLICY IF EXISTS "anon_exams_insert" ON public.exams;
DROP POLICY IF EXISTS "anon_exams_update" ON public.exams;
DROP POLICY IF EXISTS "anon_exams_delete" ON public.exams;
CREATE POLICY "anon_exams_select" ON public.exams FOR SELECT TO anon USING (true);
CREATE POLICY "anon_exams_insert" ON public.exams FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_exams_update" ON public.exams FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_exams_delete" ON public.exams FOR DELETE TO anon USING (true);

-- attempts
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_attempts_select" ON public.attempts;
DROP POLICY IF EXISTS "anon_attempts_insert" ON public.attempts;
DROP POLICY IF EXISTS "anon_attempts_update" ON public.attempts;
DROP POLICY IF EXISTS "anon_attempts_delete" ON public.attempts;
CREATE POLICY "anon_attempts_select" ON public.attempts FOR SELECT TO anon USING (true);
CREATE POLICY "anon_attempts_insert" ON public.attempts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_attempts_update" ON public.attempts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_attempts_delete" ON public.attempts FOR DELETE TO anon USING (true);

-- audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "anon_audit_logs_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "anon_audit_logs_update" ON public.audit_logs;
DROP POLICY IF EXISTS "anon_audit_logs_delete" ON public.audit_logs;
CREATE POLICY "anon_audit_logs_select" ON public.audit_logs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_audit_logs_insert" ON public.audit_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_audit_logs_update" ON public.audit_logs FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_audit_logs_delete" ON public.audit_logs FOR DELETE TO anon USING (true);
