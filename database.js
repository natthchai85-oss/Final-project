// database.js - เชื่อมต่อฐานข้อมูลคลาวด์ Supabase (Real-time Database)

const SUPABASE_URL = 'https://gcnbdgcahtgtipamsatz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Z8nfleX2cVH8xm8njM2yVw_Z-sLFBDE';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  return out;
}

function mapRows(rows) {
  return Array.isArray(rows) ? rows.map(normalizeRow) : [];
}

function toSnakeRow(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const snake = key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
    out[snake] = value;
  }
  return out;
}

class SupabaseDatabase {
  constructor() {
    console.log('Supabase Database Engine Initialized.');
  }

  // -------------------------------------------------------------
  // หมวดหมู่ผู้ใช้งาน (Users API)
  // -------------------------------------------------------------
  async getUsers() {
    const { data, error } = await supabaseClient.from('users').select('*').order('id', { ascending: true });
    if (error) { console.error('getUsers error:', error); return []; }
    return mapRows(data);
  }

  async getUsersByIds(ids) {
    const unique = [...new Set((ids || []).filter(Boolean))];
    if (!unique.length) return [];
    const { data, error } = await supabaseClient.from('users').select('*').in('id', unique);
    if (error) { console.error('getUsersByIds error:', error); return []; }
    return mapRows(data);
  }

  async isUsernameTaken(username) {
    const { data, error } = await supabaseClient.from('users').select('id').ilike('username', username).limit(1);
    if (error) { console.error('isUsernameTaken error:', error); return false; }
    return data && data.length > 0;
  }

  async getUser(userId) {
    const { data, error } = await supabaseClient.from('users').select('*').eq('id', userId).single();
    if (error) { console.error('getUser error:', error); return null; }
    return data ? normalizeRow(data) : null;
  }

  async authenticate(username, password) {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .ilike('username', username)
      .eq('password', password)
      .single();

    if (error || !data) {
      return null;
    }
    if (!data.active) {
      throw new Error('บัญชีนี้ถูกปิดใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ');
    }
    return normalizeRow(data);
  }

  async addUser(user) {
    const id = 'usr_' + Date.now();
    const newUser = { id, active: true, ...user };
    const { data, error } = await supabaseClient.from('users').insert([newUser]).select().single();
    if (error) throw error;

    await this.addLog(newUser.id, newUser.name, newUser.role, 'สมัครสมาชิก', `ลงทะเบียนผู้ใช้งานบทบาท ${newUser.role}`);
    return normalizeRow(data);
  }

  async updateUser(userId, updatedData) {
    const { data, error } = await supabaseClient.from('users').update(toSnakeRow(updatedData)).eq('id', userId).select().single();
    if (error) { console.error('updateUser error:', error); return null; }
    return data ? normalizeRow(data) : null;
  }

  async deleteUser(userId) {
    await supabaseClient.from('users').delete().eq('id', userId);
  }

  // -------------------------------------------------------------
  // หมวดหมู่วิชา (Subjects API)
  // -------------------------------------------------------------
  async getSubjects() {
    const { data, error } = await supabaseClient.from('subjects').select('*');
    if (error) { console.error('getSubjects error:', error); return []; }
    return mapRows(data);
  }

  async getSubject(subjectId) {
    const { data, error } = await supabaseClient.from('subjects').select('*').eq('id', subjectId).single();
    if (error) { console.error('getSubject error:', error); return null; }
    return data ? normalizeRow(data) : null;
  }

  async getSubjectsByTeacher(teacherId) {
    const { data, error } = await supabaseClient.from('subjects').select('*').eq('teacher_id', teacherId);
    if (error) { console.error('getSubjectsByTeacher error:', error); return []; }
    return mapRows(data);
  }

  async addSubject(subject) {
    const row = toSnakeRow(subject);
    const { data, error } = await supabaseClient.from('subjects').insert([row]).select().single();
    if (error) { console.error('addSubject error:', error); throw error; }
    return data ? normalizeRow(data) : null;
  }

  async deleteSubject(subjectId) {
    await supabaseClient.from('subjects').delete().eq('id', subjectId);
  }

  // -------------------------------------------------------------
  // หมวดหมู่การเข้าร่วมชั้นเรียน (Enrollments API)
  // -------------------------------------------------------------
  async getEnrollments() {
    const { data, error } = await supabaseClient.from('enrollments').select('*');
    if (error) { console.error('getEnrollments error:', error); return []; }
    return mapRows(data);
  }

  async enrollStudent(studentId, subjectId) {
    const { data: existing } = await supabaseClient
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('subject_id', subjectId)
      .single();

    if (existing) return false;

    const { error } = await supabaseClient.from('enrollments').insert([{ student_id: studentId, subject_id: subjectId }]);
    if (error) { console.error('enrollStudent error:', error); return false; }
    return true;
  }

  async getStudentSubjects(studentId) {
    const { data, error } = await supabaseClient
      .from('enrollments')
      .select('subject_id')
      .eq('student_id', studentId);

    if (error || !data || data.length === 0) return [];

    const subjectIds = data.map(e => e.subject_id);
    const { data: subjects, error: subError } = await supabaseClient
      .from('subjects')
      .select('*')
      .in('id', subjectIds);

    if (subError) { console.error('getStudentSubjects error:', subError); return []; }
    return mapRows(subjects);
  }

  async getEnrolledStudents(subjectId) {
    const { data, error } = await supabaseClient
      .from('enrollments')
      .select('student_id')
      .eq('subject_id', subjectId);

    if (error || !data || data.length === 0) return [];

    const studentIds = data.map(e => e.student_id);
    const { data: users, error: userError } = await supabaseClient
      .from('users')
      .select('*')
      .in('id', studentIds);

    if (userError) { console.error('getEnrolledStudents error:', userError); return []; }
    return mapRows(users);
  }

  // -------------------------------------------------------------
  // หมวดหมู่ข้อสอบ (Exams API)
  // -------------------------------------------------------------
  async getExams() {
    const { data, error } = await supabaseClient.from('exams').select('*');
    if (error) { console.error('getExams error:', error); return []; }
    return mapRows(data);
  }

  async getExam(examId) {
    const { data, error } = await supabaseClient.from('exams').select('*').eq('id', examId).single();
    if (error) { console.error('getExam error:', error); return null; }
    return data ? normalizeRow(data) : null;
  }

  async getExamsBySubject(subjectId) {
    const { data, error } = await supabaseClient.from('exams').select('*').eq('subject_id', subjectId);
    if (error) { console.error('getExamsBySubject error:', error); return []; }
    return mapRows(data);
  }

  async addExam(examData) {
    const id = 'exm_' + Date.now();
    const newExam = toSnakeRow({ id, active: true, questions: [], ...examData });
    const { data, error } = await supabaseClient.from('exams').insert([newExam]).select().single();
    if (error) { console.error('addExam error:', error); throw error; }
    return data ? normalizeRow(data) : null;
  }

  async updateExam(examId, examData) {
    const { data, error } = await supabaseClient.from('exams').update(toSnakeRow(examData)).eq('id', examId).select().single();
    if (error) { console.error('updateExam error:', error); return null; }
    return data ? normalizeRow(data) : null;
  }

  async deleteExam(examId) {
    await supabaseClient.from('exams').delete().eq('id', examId);
  }

  // -------------------------------------------------------------
  // หมวดหมู่ความพยายามในการสอบและการให้คะแนน (Exam Attempts API)
  // -------------------------------------------------------------
  async getAttempts() {
    const { data, error } = await supabaseClient.from('attempts').select('*');
    if (error) { console.error('getAttempts error:', error); return []; }
    return mapRows(data);
  }

  async getAttemptsByStudent(studentId) {
    const { data, error } = await supabaseClient.from('attempts').select('*').eq('student_id', studentId);
    if (error) { console.error('getAttemptsByStudent error:', error); return []; }
    return mapRows(data);
  }

  async getAttemptsByExam(examId) {
    const { data, error } = await supabaseClient.from('attempts').select('*').eq('exam_id', examId);
    if (error) { console.error('getAttemptsByExam error:', error); return []; }
    return mapRows(data);
  }

  async getAttempt(attemptId) {
    const { data, error } = await supabaseClient.from('attempts').select('*').eq('id', attemptId).single();
    if (error) { console.error('getAttempt error:', error); return null; }
    return data ? normalizeRow(data) : null;
  }

  async addAttempt(attemptData) {
    const id = 'att_' + Date.now();
    const examId = attemptData.examId || attemptData.exam_id;
    let graded = true;

    const exam = await this.getExam(examId);
    if (exam && exam.questions) {
      const hasSubjective = exam.questions.some(q => q.type === 'subjective');
      if (hasSubjective) graded = false;
    }

    const newAttempt = toSnakeRow({
      id,
      submittedAt: new Date().toISOString(),
      comments: '',
      graded,
      ...attemptData
    });

    const { data, error } = await supabaseClient.from('attempts').insert([newAttempt]).select().single();
    if (error) { console.error('addAttempt error:', error); throw error; }

    await this.addLog(
      attemptData.studentId,
      attemptData.studentName,
      'student',
      'ส่งข้อสอบ',
      `ส่งกระดาษคำตอบวิชา ${attemptData.examTitle} สถานะ: ${attemptData.status === 'cheated' ? 'ส่งด่วนเนื่องจากทุจริต' : 'เสร็จสมบูรณ์'}, คะแนนดิบ: ${attemptData.score} คะแนน`
    );

    return normalizeRow(data);
  }

  async updateAttemptGrading(attemptId, scoreUpdates, teacherComment) {
    const { data, error } = await supabaseClient
      .from('attempts')
      .update({
        score: scoreUpdates.finalScore,
        comments: teacherComment,
        graded: true
      })
      .eq('id', attemptId)
      .select()
      .single();

    if (error) { console.error('updateAttemptGrading error:', error); return null; }
    return data ? normalizeRow(data) : null;
  }

  // -------------------------------------------------------------
  // หมวดหมู่บันทึกกิจกรรม (Audit Logs API)
  // -------------------------------------------------------------
  async getLogs() {
    const { data, error } = await supabaseClient.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(200);
    if (error) { console.error('getLogs error:', error); return []; }
    return mapRows(data);
  }

  async addLog(userId, userName, role, action, details) {
    const newLog = {
      id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      user_id: userId,
      user_name: userName,
      role: role,
      action: action,
      timestamp: new Date().toISOString(),
      details: details
    };

    // We don't await this so it doesn't block UI flows
    supabaseClient.from('audit_logs').insert([newLog]).then(({ error }) => {
      if (error) console.error('addLog error:', error);
    });

    return newLog;
  }

  // -------------------------------------------------------------
  // หมวดหมู่สำรองและกู้คืนข้อมูล (Backup & Restore API)
  // -------------------------------------------------------------
  async exportBackup() {
    try {
      const [users, subjects, enrollments, exams, attempts, auditLogs] = await Promise.all([
        supabaseClient.from('users').select('*'),
        supabaseClient.from('subjects').select('*'),
        supabaseClient.from('enrollments').select('*'),
        supabaseClient.from('exams').select('*'),
        supabaseClient.from('attempts').select('*'),
        supabaseClient.from('audit_logs').select('*')
      ]);

      const backup = {
        users: users.data || [],
        subjects: subjects.data || [],
        enrollments: enrollments.data || [],
        exams: exams.data || [],
        attempts: attempts.data || [],
        audit_logs: auditLogs.data || []
      };

      return JSON.stringify(backup, null, 2);
    } catch (error) {
      console.error('exportBackup error:', error);
      throw error;
    }
  }

  async importBackup(content) {
    try {
      const backup = JSON.parse(content);
      const tables = ['users', 'subjects', 'exams', 'enrollments', 'attempts', 'audit_logs'];

      for (const table of tables) {
        if (!Array.isArray(backup[table])) {
          console.error(`Import validation error: Table ${table} is not an array`);
          return false;
        }
      }

      // Clear tables in reverse order of dependencies
      const reverseTables = [...tables].reverse();
      for (const table of reverseTables) {
        console.log(`Clearing table ${table}...`);
        const { error: delError } = await supabaseClient.from(table).delete().neq('id', '_non_existent_id_');
        if (delError) {
          console.error(`Error clearing table ${table}:`, delError);
          throw delError;
        }
      }

      // Insert new rows
      for (const table of tables) {
        const rows = backup[table];
        if (rows.length === 0) continue;
        console.log(`Restoring ${rows.length} rows to ${table}...`);
        
        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const { error: insError } = await supabaseClient.from(table).insert(chunk);
          if (insError) {
            console.error(`Error inserting chunk to table ${table}:`, insError);
            throw insError;
          }
        }
      }

      return true;
    } catch (error) {
      console.error('importBackup error:', error);
      return false;
    }
  }
}

// ส่งออกอ็อบเจกต์ db ไปใช้ในระบบ
window.db = new SupabaseDatabase();
