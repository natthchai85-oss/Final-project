-- =============================================================================
-- โครงสร้างตาราง (Database Schema) สำหรับระบบสอบออนไลน์ วิทยาลัยเทคนิคตาก
-- รันไฟล์นี้ใน Supabase Dashboard → SQL Editor → New query → Run
-- เพื่อสร้างตารางทั้งหมดก่อนรันนโยบาย RLS (Row Level Security)
-- =============================================================================

-- 1. ตาราง users (ข้อมูลผู้ใช้งาน)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. ตาราง subjects (รายวิชา)
CREATE TABLE IF NOT EXISTS public.subjects (
    id TEXT PRIMARY KEY, -- เช่น ENG101, MA101
    name TEXT NOT NULL, -- ชื่อรายวิชา
    description TEXT,
    teacher_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. ตาราง enrollments (การลงทะเบียนเรียน)
CREATE TABLE IF NOT EXISTS public.enrollments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    subject_id TEXT REFERENCES public.subjects(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(student_id, subject_id)
);

-- 4. ตาราง exams (ข้อสอบ)
CREATE TABLE IF NOT EXISTS public.exams (
    id TEXT PRIMARY KEY, -- exm_xxx
    subject_id TEXT REFERENCES public.subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    time_limit INTEGER NOT NULL, -- หน่วยเป็นนาที
    scheduled_date TEXT, -- วันที่จัดสอบ (จัดเก็บในรูป text)
    questions JSONB DEFAULT '[]'::jsonb NOT NULL, -- รายการคำถามในข้อสอบ
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. ตาราง attempts (การทำข้อสอบและการส่งคำตอบ)
CREATE TABLE IF NOT EXISTS public.attempts (
    id TEXT PRIMARY KEY, -- att_xxx
    student_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    exam_id TEXT REFERENCES public.exams(id) ON DELETE SET NULL,
    exam_title TEXT NOT NULL,
    subject_id TEXT REFERENCES public.subjects(id) ON DELETE SET NULL,
    answers JSONB DEFAULT '{}'::jsonb NOT NULL,
    score NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    total_points NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    status TEXT NOT NULL, -- เช่น completed, cheated
    exit_count INTEGER DEFAULT 0 NOT NULL,
    cheating_logs JSONB DEFAULT '[]'::jsonb NOT NULL,
    time_spent INTEGER DEFAULT 0 NOT NULL, -- วินาทีที่ใช้สอบ
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    comments TEXT DEFAULT '' NOT NULL,
    graded BOOLEAN DEFAULT TRUE NOT NULL
);

-- 6. ตาราง audit_logs (บันทึกกิจกรรมในระบบ)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    role TEXT,
    action TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    details TEXT
);

-- สร้างดัชนี (Indexes) เพื่อเพิ่มความเร็วในการคิวรีข้อมูล
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_subjects_teacher ON public.subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_subject ON public.enrollments(subject_id);
CREATE INDEX IF NOT EXISTS idx_exams_subject ON public.exams(subject_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON public.attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_exam ON public.attempts(exam_id);
