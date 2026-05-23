// database.js - เชื่อมต่อฐานข้อมูลคลาวด์ Supabase (Real-time Database)

const SUPABASE_URL = 'https://gcnbdgcahtgtipamsatz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Z8nfleX2cVH8xm8njM2yVw_Z-sLFBDE';

// สร้างอินสแตนซ์ Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class SupabaseDatabase {
  constructor() {
    console.log('Supabase Database Engine Initialized.');
  }

  // -------------------------------------------------------------
  // หมวดหมู่ผู้ใช้งาน (Users API)
  // -------------------------------------------------------------
  async getUsers() {
    const { data, error } = await supabase.from('users').select('*').order('id', { ascending: true });
    if (error) { console.error('getUsers error:', error); return []; }
    return data;
  }

  async getUser(userId) {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error) { console.error('getUser error:', error); return null; }
    return data;
  }

  async authenticate(username, password) {
    const { data, error } = await supabase
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
    return data;
  }

  async addUser(user) {
    const id = 'usr_' + Date.now();
    const newUser = { id, active: true, ...user };
    const { data, error } = await supabase.from('users').insert([newUser]).select().single();
    if (error) throw error;
    
    await this.addLog(newUser.id, newUser.name, newUser.role, 'สมัครสมาชิก', `ลงทะเบียนผู้ใช้งานบทบาท ${newUser.role}`);
    return data;
  }

  async updateUser(userId, updatedData) {
    const { data, error } = await supabase.from('users').update(updatedData).eq('id', userId).select().single();
    if (error) { console.error('updateUser error:', error); return null; }
    return data;
  }

  async deleteUser(userId) {
    await supabase.from('users').delete().eq('id', userId);
  }

  // -------------------------------------------------------------
  // หมวดหมู่วิชา (Subjects API)
  // -------------------------------------------------------------
  async getSubjects() {
    const { data, error } = await supabase.from('subjects').select('*');
    if (error) { console.error('getSubjects error:', error); return []; }
    return data;
  }

  async getSubject(subjectId) {
    const { data, error } = await supabase.from('subjects').select('*').eq('id', subjectId).single();
    if (error) { console.error('getSubject error:', error); return null; }
    return data;
  }

  async getSubjectsByTeacher(teacherId) {
    const { data, error } = await supabase.from('subjects').select('*').eq('teacher_id', teacherId);
    if (error) { console.error('getSubjectsByTeacher error:', error); return []; }
    return data;
  }

  async addSubject(subject) {
    const { data, error } = await supabase.from('subjects').insert([subject]).select().single();
    if (error) { console.error('addSubject error:', error); return null; }
    return data;
  }

  async deleteSubject(subjectId) {
    await supabase.from('subjects').delete().eq('id', subjectId);
  }

  // -------------------------------------------------------------
  // หมวดหมู่การเข้าร่วมชั้นเรียน (Enrollments API)
  // -------------------------------------------------------------
  async getEnrollments() {
    const { data, error } = await supabase.from('enrollments').select('*');
    if (error) { console.error('getEnrollments error:', error); return []; }
    return data;
  }

  async enrollStudent(studentId, subjectId) {
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('subject_id', subjectId)
      .single();
      
    if (existing) return false;

    const { error } = await supabase.from('enrollments').insert([{ student_id: studentId, subject_id: subjectId }]);
    if (error) { console.error('enrollStudent error:', error); return false; }
    return true;
  }

  async getStudentSubjects(studentId) {
    const { data, error } = await supabase
      .from('enrollments')
      .select('subject_id')
      .eq('student_id', studentId);
      
    if (error || !data || data.length === 0) return [];
    
    const subjectIds = data.map(e => e.subject_id);
    const { data: subjects, error: subError } = await supabase
      .from('subjects')
      .select('*')
      .in('id', subjectIds);
      
    if (subError) { console.error('getStudentSubjects error:', subError); return []; }
    return subjects;
  }

  async getEnrolledStudents(subjectId) {
    const { data, error } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('subject_id', subjectId);
      
    if (error || !data || data.length === 0) return [];
    
    const studentIds = data.map(e => e.student_id);
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .in('id', studentIds);
      
    if (userError) { console.error('getEnrolledStudents error:', userError); return []; }
    return users;
  }

  // -------------------------------------------------------------
  // หมวดหมู่ข้อสอบ (Exams API)
  // -------------------------------------------------------------
  async getExams() {
    const { data, error } = await supabase.from('exams').select('*');
    if (error) { console.error('getExams error:', error); return []; }
    return data;
  }

  async getExam(examId) {
    const { data, error } = await supabase.from('exams').select('*').eq('id', examId).single();
    if (error) { console.error('getExam error:', error); return null; }
    return data;
  }

  async getExamsBySubject(subjectId) {
    const { data, error } = await supabase.from('exams').select('*').eq('subject_id', subjectId);
    if (error) { console.error('getExamsBySubject error:', error); return []; }
    return data;
  }

  async addExam(examData) {
    const id = 'exm_' + Date.now();
    const newExam = { id, active: true, questions: [], ...examData };
    const { data, error } = await supabase.from('exams').insert([newExam]).select().single();
    if (error) { console.error('addExam error:', error); return null; }
    return data;
  }

  async updateExam(examId, examData) {
    const { data, error } = await supabase.from('exams').update(examData).eq('id', examId).select().single();
    if (error) { console.error('updateExam error:', error); return null; }
    return data;
  }

  async deleteExam(examId) {
    await supabase.from('exams').delete().eq('id', examId);
  }

  // -------------------------------------------------------------
  // หมวดหมู่ความพยายามในการสอบและการให้คะแนน (Exam Attempts API)
  // -------------------------------------------------------------
  async getAttempts() {
    const { data, error } = await supabase.from('attempts').select('*');
    if (error) { console.error('getAttempts error:', error); return []; }
    return data;
  }

  async getAttemptsByStudent(studentId) {
    const { data, error } = await supabase.from('attempts').select('*').eq('student_id', studentId);
    if (error) { console.error('getAttemptsByStudent error:', error); return []; }
    return data;
  }

  async getAttemptsByExam(examId) {
    const { data, error } = await supabase.from('attempts').select('*').eq('exam_id', examId);
    if (error) { console.error('getAttemptsByExam error:', error); return []; }
    return data;
  }

  async getAttempt(attemptId) {
    const { data, error } = await supabase.from('attempts').select('*').eq('id', attemptId).single();
    if (error) { console.error('getAttempt error:', error); return null; }
    return data;
  }

  async addAttempt(attemptData) {
    const id = 'att_' + Date.now();
    const newAttempt = {
      id,
      submitted_at: new Date().toISOString(),
      comments: '',
      graded: true,
      ...attemptData
    };

    // ตรวจสอบข้อเขียน
    const exam = await this.getExam(newAttempt.exam_id);
    if (exam && exam.questions) {
      const hasSubjective = exam.questions.some(q => q.type === 'subjective');
      if (hasSubjective) {
        newAttempt.graded = false;
      }
    }

    const { data, error } = await supabase.from('attempts').insert([newAttempt]).select().single();
    if (error) { console.error('addAttempt error:', error); throw error; }

    await this.addLog(
      newAttempt.student_id,
      newAttempt.student_name,
      'student',
      'ส่งข้อสอบ',
      `ส่งกระดาษคำตอบวิชา ${newAttempt.exam_title} สถานะ: ${newAttempt.status === 'cheated' ? 'ส่งด่วนเนื่องจากทุจริต' : 'เสร็จสมบูรณ์'}, คะแนนดิบ: ${newAttempt.score} คะแนน`
    );

    return data;
  }

  async updateAttemptGrading(attemptId, scoreUpdates, teacherComment) {
    const { data, error } = await supabase
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
    return data;
  }

  // -------------------------------------------------------------
  // หมวดหมู่บันทึกกิจกรรม (Audit Logs API)
  // -------------------------------------------------------------
  async getLogs() {
    const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(200);
    if (error) { console.error('getLogs error:', error); return []; }
    return data;
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
    supabase.from('audit_logs').insert([newLog]).then(({error}) => {
      if (error) console.error('addLog error:', error);
    });
    
    return newLog;
  }
}

// ส่งออกอ็อบเจกต์ db ไปใช้ในระบบ
window.db = new SupabaseDatabase();
