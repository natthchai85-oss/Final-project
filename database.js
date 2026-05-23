// database.js - ระบบฐานข้อมูลจำลอง (Mock Database & LocalStorage Engine)

const DB_KEY = 'online_exam_db';

// ข้อมูลตั้งต้นสำหรับจำลองระบบหากยังไม่มีข้อมูลใน localStorage
const DEFAULT_DB = {
  users: [
    { id: 'usr_admin', username: 'admin', password: 'admin', name: 'admin', role: 'admin', active: true },
    { id: 'usr_tch1', username: 'teacher1', password: 'password', name: 'ครูสมศรี ศรีสวัสดิ์', role: 'teacher', active: true },
    { id: 'usr_tch2', username: 'teacher2', password: 'password', name: 'ครูอเนก การสอน', role: 'teacher', active: true },
    { id: 'usr_std1', username: 'student1', password: 'password', name: 'นายสมศักดิ์ รักเรียน', role: 'student', active: true },
    { id: 'usr_std2', username: 'student2', password: 'password', name: 'นางสาววิภา ปัญญาดี', role: 'student', active: true },
    { id: 'usr_std3', username: 'student3', password: 'password', name: 'นายมานะ ขยันหมั่นเพียร', role: 'student', active: true },
    { id: 'usr_std4', username: 'student4', password: 'password', name: 'นางสาวสมหญิง จริงใจ', role: 'student', active: true },
    { id: 'usr_std5', username: 'student5', password: 'password', name: 'เด็กหญิงชูใจ ดีเลิศ', role: 'student', active: true }
  ],
  subjects: [
    { id: 'MA101', name: 'คณิตศาสตร์พื้นฐาน (MA101)', description: 'เรียนรู้เกี่ยวกับพีชคณิต เรขาคณิตเบื้องต้น และสมการพื้นฐาน', teacherId: 'usr_tch1' },
    { id: 'SC102', name: 'วิทยาศาสตร์กายภาพ (SC102)', description: 'พื้นฐานเกี่ยวกับฟิสิกส์ เคมี และปรากฏการณ์ธรรมชาติรอบตัว', teacherId: 'usr_tch2' },
    { id: 'TH103', name: 'ภาษาไทยเพื่อการสื่อสาร (TH103)', description: 'หลักการใช้ภาษา การเขียนเรียงความ และการพูดต่อหน้าชุมชน', teacherId: 'usr_tch1' }
  ],
  enrollments: [
    { studentId: 'usr_std1', subjectId: 'MA101' },
    { studentId: 'usr_std1', subjectId: 'SC102' },
    { studentId: 'usr_std2', subjectId: 'MA101' },
    { studentId: 'usr_std2', subjectId: 'SC102' },
    { studentId: 'usr_std2', subjectId: 'TH103' },
    { studentId: 'usr_std3', subjectId: 'MA101' },
    { studentId: 'usr_std3', subjectId: 'TH103' },
    { studentId: 'usr_std4', subjectId: 'SC102' },
    { studentId: 'usr_std5', subjectId: 'TH103' }
  ],
  exams: [
    {
      id: 'exm_001',
      subjectId: 'MA101',
      title: 'สอบปลายภาควิชาคณิตศาสตร์พื้นฐาน',
      description: 'ข้อสอบวัดความรู้บทที่ 1-5 (เรื่องพีชคณิต สมการเชิงเส้น และสถิติเบื้องต้น)',
      timeLimit: 10, // 10 นาที
      scheduledDate: '2026-05-25T09:00',
      active: true,
      questions: [
        {
          id: 'q_ma_1',
          type: 'choice',
          text: 'หากสมการคือ 3x + 7 = 22 ค่าของ x คือข้อใดต่อไปนี้?',
          points: 2,
          options: ['x = 3', 'x = 5', 'x = 7', 'x = 15'],
          correctAnswer: 1 // ตัวเลือกที่ 2 (x = 5)
        },
        {
          id: 'q_ma_2',
          type: 'choice',
          text: 'รูปสามเหลี่ยมมุมฉากที่มีด้านประกอบมุมฉากยาว 3 และ 4 เซนติเมตร จะมีด้านตรงข้ามมุมฉากยาวเท่าใด?',
          points: 2,
          options: ['5 เซนติเมตร', '6 เซนติเมตร', '7 เซนติเมตร', '25 เซนติเมตร'],
          correctAnswer: 0 // ตัวเลือกที่ 1 (5 เซนติเมตร)
        },
        {
          id: 'q_ma_3',
          type: 'choice',
          text: 'ค่าเฉลี่ยเลขคณิตของข้อมูลชุดนี้: 4, 8, 12, 16 คือข้อใด?',
          points: 2,
          options: ['8', '10', '12', '14'],
          correctAnswer: 1 // ตัวเลือกที่ 2 (10)
        },
        {
          id: 'q_ma_4',
          type: 'subjective',
          text: 'จงเขียนอธิบายสั้นๆ เกี่ยวกับ "ทฤษฎีบทพีทาโกรัส" และสูตรที่ใช้คืออะไร?',
          points: 4,
          correctAnswer: 'a^2 + b^2 = c^2 หรือ สมการกำลังสองของด้านตรงข้ามมุมฉากเท่ากับผลบวกของกำลังสองของอีกสองด้าน'
        }
      ]
    },
    {
      id: 'exm_002',
      subjectId: 'SC102',
      title: 'สอบย่อยบทที่ 1: สถานะของสสาร',
      description: 'แบบทดสอบเก็บคะแนนก่อนเรียนเรื่อง ของแข็ง ของเหลว และแก๊ส',
      timeLimit: 5, // 5 นาที
      scheduledDate: '2026-05-20T10:00',
      active: true,
      questions: [
        {
          id: 'q_sc_1',
          type: 'choice',
          text: 'ข้อใดจัดอยู่ในกลุ่ม "ของแข็ง" ทั้งหมด?',
          points: 2.5,
          options: ['น้ำแข็ง, หิน, เหล็ก', 'ไอออน, ไอน้ำ, เกลือ', 'ปรอท, ทองแดง, คาร์บอนไดออกไซด์', 'น้ำปลา, คอนกรีต, ไม้'],
          correctAnswer: 0
        },
        {
          id: 'q_sc_2',
          type: 'choice',
          text: 'กระบวนการเปลี่ยนสถานะจาก "แก๊สกลายเป็นของเหลว" เรียกว่าอะไร?',
          points: 2.5,
          options: ['การควบแน่น (Condensation)', 'การระเหิด (Sublimation)', 'การหลอมเหลว (Melting)', 'การระเหย (Evaporation)'],
          correctAnswer: 0
        },
        {
          id: 'q_sc_3',
          type: 'choice',
          text: 'สสารในข้อใดต่อไปนี้มีรูปร่างและปริมาตรไม่คงที่ เปลี่ยนแปลงไปตามภาชนะที่บรรจุและฟุ้งกระจายได้?',
          points: 2.5,
          options: ['หิน', 'น้ำมันพืช', 'น้ำแข็ง', 'แก๊สออกซิเจน'],
          correctAnswer: 3
        },
        {
          id: 'q_sc_4',
          type: 'choice',
          text: 'น้ำเดือดที่อุณหภูมิเท่าใดในระดับองศาเซลเซียส ณ ความดันบรรยากาศปกติ?',
          points: 2.5,
          options: ['0 องศาเซลเซียส', '50 องศาเซลเซียส', '100 องศาเซลเซียส', '120 องศาเซลเซียส'],
          correctAnswer: 2
        }
      ]
    }
  ],
  attempts: [
    {
      id: 'att_001',
      studentId: 'usr_std2',
      studentName: 'นางสาววิภา ปัญญาดี',
      examId: 'exm_002',
      examTitle: 'สอบย่อยบทที่ 1: สถานะของสสาร',
      subjectId: 'SC102',
      answers: {
        'q_sc_1': '0', // ถูก
        'q_sc_2': '0', // ถูก
        'q_sc_3': '3', // ถูก
        'q_sc_4': '2'  // ถูก
      },
      score: 10,
      totalPoints: 10,
      status: 'completed', // completed, cheated
      exitCount: 0,
      cheatingLogs: [],
      submittedAt: '2026-05-20T10:15:23',
      timeSpent: 120, // 2 นาที
      comments: 'ทำได้ยอดเยี่ยมมาก ตอบถูกครบทุกข้อ!',
      graded: true
    },
    {
      id: 'att_002',
      studentId: 'usr_std1',
      studentName: 'นายสมศักดิ์ รักเรียน',
      examId: 'exm_002',
      examTitle: 'สอบย่อยบทที่ 1: สถานะของสสาร',
      subjectId: 'SC102',
      answers: {
        'q_sc_1': '0', // ถูก (2.5)
        'q_sc_2': '1', // ผิด (0)
        'q_sc_3': '3', // ถูก (2.5)
        'q_sc_4': '1'  // ผิด (0)
      },
      score: 5,
      totalPoints: 10,
      status: 'completed',
      exitCount: 1,
      cheatingLogs: ['ออกนอกหน้าจอเวลา 10:04:12'],
      submittedAt: '2026-05-20T10:18:44',
      timeSpent: 240, // 4 นาที
      comments: 'พยายามทบทวนเรื่องการเปลี่ยนสถานะสสารเพิ่มเติมนะจ๊ะ',
      graded: true
    },
    {
      id: 'att_003',
      studentId: 'usr_std3',
      studentName: 'นายมานะ ขยันหมั่นเพียร',
      examId: 'exm_001',
      examTitle: 'สอบปลายภาควิชาคณิตศาสตร์พื้นฐาน',
      subjectId: 'MA101',
      answers: {
        'q_ma_1': '1', // ถูก (2)
        'q_ma_2': '0', // ถูก (2)
        'q_ma_3': '2', // ผิด (0)
        'q_ma_4': 'คือทฤษฎีที่ใช้ความสัมพันธ์ของสามเหลี่ยมมุมฉาก โดยที่ผลบวกของพื้นที่จัตุรัสบนด้านประกอบมุมฉาก จะเท่ากับพื้นที่จัตุรัสบนด้านตรงข้ามมุมฉาก สูตรคือ a^2 + b^2 = c^2' // รอตรวจอัตนัย
      },
      score: 4, // คะแนนเบื้องต้นจากปรนัย (เต็ม 6 จากปรนัย, ส่วน 4 คะแนนอัตนัยยังไม่ได้ตรวจ)
      totalPoints: 10,
      status: 'completed',
      exitCount: 0,
      cheatingLogs: [],
      submittedAt: '2026-05-21T09:12:00',
      timeSpent: 420, // 7 นาที
      comments: '',
      graded: false // รอครูมาตรวจให้คะแนนข้ออัตนัย
    }
  ],
  auditLogs: [
    { id: 'log_001', userId: 'usr_admin', userName: 'คุณสมภพ ผู้ดูแลระบบ', role: 'admin', action: 'เข้าระบบ', timestamp: '2026-05-21T08:30:15', details: 'ผู้ดูแลระบบเข้าสู่ระบบสำเร็จ' },
    { id: 'log_002', userId: 'usr_tch1', userName: 'ครูสมศรี ศรีสวัสดิ์', role: 'teacher', action: 'สร้างข้อสอบ', timestamp: '2026-05-21T09:00:22', details: 'สร้างข้อสอบปลายภาคคณิตศาสตร์ ในรายวิชา MA101' },
    { id: 'log_003', userId: 'usr_std3', userName: 'นายมานะ ขยันหมั่นเพียร', role: 'student', action: 'เข้าสอบ', timestamp: '2026-05-21T09:05:01', details: 'เริ่มทำข้อสอบปลายภาคคณิตศาสตร์' },
    { id: 'log_004', userId: 'usr_std3', userName: 'นายมานะ ขยันหมั่นเพียร', role: 'student', action: 'ส่งข้อสอบ', timestamp: '2026-05-21T09:12:00', details: 'ส่งข้อสอบปลายภาคคณิตศาสตร์สำเร็จ คะแนนเบื้องต้น (ปรนัย) 4 คะแนน' }
  ]
};

// ฟังก์ชันหลักในการจัดการฐานข้อมูลผ่าน LocalStorage
class LocalDatabase {
  constructor() {
    this.init();
  }

  // อ่านและเริ่มต้นฐานข้อมูล
  init() {
    if (!localStorage.getItem(DB_KEY)) {
      this.save(DEFAULT_DB);
    }
  }

  // อ่านข้อมูลทั้งหมด
  get() {
    try {
      const data = localStorage.getItem(DB_KEY);
      return JSON.parse(data) || DEFAULT_DB;
    } catch (e) {
      console.error('เกิดข้อผิดพลาดในการโหลด Database:', e);
      return DEFAULT_DB;
    }
  }

  // เซฟข้อมูลทับตัวแปรหลัก
  save(data) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('เกิดข้อผิดพลาดในการบันทึก Database:', e);
      return false;
    }
  }

  // รีเซ็ตฐานข้อมูลเป็นค่าเริ่มต้น
  reset() {
    this.save(DEFAULT_DB);
    return DEFAULT_DB;
  }

  // -------------------------------------------------------------
  // หมวดหมู่ผู้ใช้งาน (Users API)
  // -------------------------------------------------------------
  getUsers() {
    return this.get().users || [];
  }

  getUser(userId) {
    return this.getUsers().find(u => u.id === userId);
  }

  authenticate(username, password) {
    const users = this.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (user && !user.active) {
      throw new Error('บัญชีนี้ถูกปิดใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ');
    }
    return user;
  }

  addUser(user) {
    const db = this.get();
    const id = 'usr_' + Date.now();
    const newUser = { id, active: true, ...user };
    db.users.push(newUser);
    this.save(db);
    this.addLog(newUser.id, newUser.name, newUser.role, 'สมัครสมาชิก', `ลงทะเบียนผู้ใช้งานบทบาท ${newUser.role}`);
    return newUser;
  }

  updateUser(userId, updatedData) {
    const db = this.get();
    const idx = db.users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      db.users[idx] = { ...db.users[idx], ...updatedData };
      this.save(db);
      return db.users[idx];
    }
    return null;
  }

  deleteUser(userId) {
    const db = this.get();
    db.users = db.users.filter(u => u.id !== userId);
    db.enrollments = db.enrollments.filter(e => e.studentId !== userId);
    db.attempts = db.attempts.filter(a => a.studentId !== userId);
    this.save(db);
  }

  // -------------------------------------------------------------
  // หมวดหมู่วิชา (Subjects API)
  // -------------------------------------------------------------
  getSubjects() {
    return this.get().subjects || [];
  }

  getSubject(subjectId) {
    return this.getSubjects().find(s => s.id === subjectId);
  }

  getSubjectsByTeacher(teacherId) {
    return this.getSubjects().filter(s => s.teacherId === teacherId);
  }

  addSubject(subject) {
    const db = this.get();
    // คีย์รหัสวิชาแบบสุ่ม 6 ตัวถ้าไม่ได้ส่งมา หรือเช็คความซ้ำซ้อน
    const newSubject = { ...subject };
    db.subjects.push(newSubject);
    this.save(db);
    return newSubject;
  }

  deleteSubject(subjectId) {
    const db = this.get();
    db.subjects = db.subjects.filter(s => s.id !== subjectId);
    db.enrollments = db.enrollments.filter(e => e.subjectId !== subjectId);
    db.exams = db.exams.filter(ex => ex.subjectId !== subjectId);
    db.attempts = db.attempts.filter(at => at.subjectId !== subjectId);
    this.save(db);
  }

  // -------------------------------------------------------------
  // หมวดหมู่การเข้าร่วมชั้นเรียน (Enrollments API)
  // -------------------------------------------------------------
  getEnrollments() {
    return this.get().enrollments || [];
  }

  enrollStudent(studentId, subjectId) {
    const db = this.get();
    const exists = db.enrollments.some(e => e.studentId === studentId && e.subjectId === subjectId);
    if (exists) return false;

    db.enrollments.push({ studentId, subjectId });
    this.save(db);
    return true;
  }

  getStudentSubjects(studentId) {
    const enrolls = this.getEnrollments().filter(e => e.studentId === studentId);
    const subjects = this.getSubjects();
    return subjects.filter(s => enrolls.some(e => e.subjectId === s.id));
  }

  getEnrolledStudents(subjectId) {
    const enrolls = this.getEnrollments().filter(e => e.subjectId === subjectId);
    const users = this.getUsers();
    return users.filter(u => enrolls.some(e => e.studentId === u.id));
  }

  // -------------------------------------------------------------
  // หมวดหมู่ข้อสอบ (Exams API)
  // -------------------------------------------------------------
  getExams() {
    return this.get().exams || [];
  }

  getExam(examId) {
    return this.getExams().find(ex => ex.id === examId);
  }

  getExamsBySubject(subjectId) {
    return this.getExams().filter(ex => ex.subjectId === subjectId);
  }

  addExam(examData) {
    const db = this.get();
    const id = 'exm_' + Date.now();
    const newExam = { id, active: true, questions: [], ...examData };
    db.exams.push(newExam);
    this.save(db);
    return newExam;
  }

  updateExam(examId, examData) {
    const db = this.get();
    const idx = db.exams.findIndex(ex => ex.id === examId);
    if (idx !== -1) {
      db.exams[idx] = { ...db.exams[idx], ...examData };
      this.save(db);
      return db.exams[idx];
    }
    return null;
  }

  deleteExam(examId) {
    const db = this.get();
    db.exams = db.exams.filter(ex => ex.id !== examId);
    db.attempts = db.attempts.filter(at => at.examId !== examId);
    this.save(db);
  }

  // -------------------------------------------------------------
  // หมวดหมู่ความพยายามในการสอบและการให้คะแนน (Exam Attempts API)
  // -------------------------------------------------------------
  getAttempts() {
    return this.get().attempts || [];
  }

  getAttemptsByStudent(studentId) {
    return this.getAttempts().filter(a => a.studentId === studentId);
  }

  getAttemptsByExam(examId) {
    return this.getAttempts().filter(a => a.examId === examId);
  }

  getAttempt(attemptId) {
    return this.getAttempts().find(a => a.id === attemptId);
  }

  addAttempt(attemptData) {
    const db = this.get();
    const id = 'att_' + Date.now();
    const newAttempt = {
      id,
      submittedAt: new Date().toISOString(),
      comments: '',
      graded: true, // ตั้งค่าเริ่มต้น แล้วตรวจหาอัตนัยเพื่อเปลี่ยนเป็น false
      ...attemptData
    };

    // ตรวจสอบว่ามีคำถามอัตนัย (subjective) หรือไม่
    const exam = db.exams.find(ex => ex.id === newAttempt.examId);
    if (exam) {
      const hasSubjective = exam.questions.some(q => q.type === 'subjective');
      if (hasSubjective) {
        newAttempt.graded = false; // ถ้ามีข้อเขียน ให้รอครูมาตรวจก่อน
      }
    }

    db.attempts.push(newAttempt);
    this.save(db);

    this.addLog(
      newAttempt.studentId,
      newAttempt.studentName,
      'student',
      'ส่งข้อสอบ',
      `ส่งกระดาษคำตอบวิชา ${newAttempt.examTitle} สถานะ: ${newAttempt.status === 'cheated' ? 'ส่งด่วนเนื่องจากทุจริต' : 'เสร็จสมบูรณ์'}, คะแนนดิบ: ${newAttempt.score} คะแนน`
    );

    return newAttempt;
  }

  updateAttemptGrading(attemptId, scoreUpdates, teacherComment) {
    const db = this.get();
    const idx = db.attempts.findIndex(a => a.id === attemptId);
    if (idx !== -1) {
      db.attempts[idx].score = scoreUpdates.finalScore;
      db.attempts[idx].comments = teacherComment;
      db.attempts[idx].graded = true;
      this.save(db);
      return db.attempts[idx];
    }
    return null;
  }

  // -------------------------------------------------------------
  // หมวดหมู่บันทึกกิจกรรม (Audit Logs API)
  // -------------------------------------------------------------
  getLogs() {
    return this.get().auditLogs || [];
  }

  addLog(userId, userName, role, action, details) {
    const db = this.get();
    const newLog = {
      id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      userId,
      userName,
      role,
      action,
      timestamp: new Date().toISOString(),
      details
    };
    db.auditLogs.unshift(newLog); // เพิ่มในแถวแรกสุด
    // ลิมิตขนาดของ log ไม่เกิน 200 รายการเพื่อไม่ให้ LocalStorage เต็มเกินไป
    if (db.auditLogs.length > 200) {
      db.auditLogs = db.auditLogs.slice(0, 200);
    }
    this.save(db);
    return newLog;
  }

  // -------------------------------------------------------------
  // ระบบนำเข้า / ส่งออกข้อมูลสำรอง (Backup & Restore)
  // -------------------------------------------------------------
  exportBackup() {
    return JSON.stringify(this.get(), null, 2);
  }

  importBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.users && data.subjects && data.exams && data.attempts) {
        this.save(data);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
}

// ส่งออกอ็อบเจกต์ db ไปใช้ในระบบ
window.db = new LocalDatabase();
console.log('Online Exam Database Initialized.');
