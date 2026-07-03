// app.js - หัวใจหลักของระบบบริหารจัดการสอบออนไลน์ (SPA Logic Engine)

function refreshIcons(root) {
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons(root ? { root } : undefined);
  }
}

// -------------------------------------------------------------
// 1. สถานะแอปพลิเคชันหลัก (Application State)
// -------------------------------------------------------------
let currentUser = null;
let currentView = 'dashboard';
let activeExam = null;
let examSession = {
  answers: {},
  secondsLeft: 0,
  cheatCount: 0,
  cheatingLogs: [],
  currentQuestionIndex: 0,
  timerInterval: null
};

// -------------------------------------------------------------
// 2. การเริ่มต้นระบบ (Initialization & Routing)
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // สลับธีมเดิมจากหน่วยความจำถ้ามี
  const savedTheme = localStorage.getItem('theme') || 'light-theme';
  let initialTheme = savedTheme;
  if (initialTheme === 'dark') initialTheme = 'dark-theme';
  if (initialTheme === 'light') initialTheme = 'light-theme';
  setTheme(initialTheme);

  // เช็ค URL parameters สำหรับการเข้าร่วมห้องเรียนผ่าน QR Code ลิงก์ตรง
  const urlParams = new URLSearchParams(window.location.search);
  const enrollCode = urlParams.get('enroll');
  if (enrollCode) {
    sessionStorage.setItem('pendingEnrollCode', enrollCode.toUpperCase());
    // ลบ query parameter ออกจาก URL เพื่อความเป็นระเบียบและไม่ลงทะเบียนซ้ำตอนรีเฟรช
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // ตรวจสอบเซสชันผู้ใช้เดิม
  const savedUser = sessionStorage.getItem('currentUser');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showAppShell();
  } else {
    showAuthScreen();
  }

  // ผูกการทำงานปุ่มหลัก
  bindAuthEvents();
  bindShellEvents();
  bindExamEvents();
  bindThemeToggle();

  // เปิดใช้งานระบบป้องกันความปลอดภัยของซอร์สโค้ด
  initializeSecuritySettings();

  refreshIcons(document.getElementById('auth-container'));
});

// -------------------------------------------------------------
// ระบบป้องกันการขโมยโค้ดและการเปิด DevTools (Security Controllers)
// -------------------------------------------------------------
function initializeSecuritySettings() {
  // 1. ป้องกันการคลิกขวา (Context Menu)
  document.addEventListener('contextmenu', (e) => {
    if (!currentUser || currentUser.role !== 'admin') {
      e.preventDefault();
      return false;
    }
  });

  // 2. ป้องกันปุ่มลัดคีย์บอร์ด F12, Ctrl+Shift+I/C/J, Ctrl+U, Ctrl+S
  document.addEventListener('keydown', (e) => {
    if (!currentUser || currentUser.role !== 'admin') {
      const key = e.key ? e.key.toLowerCase() : '';
      const code = e.keyCode || e.which;

      // F12
      if (code === 123 || key === 'f12') {
        e.preventDefault();
        return false;
      }

      // Ctrl + Shift + I/C/J หรือ Ctrl + U หรือ Ctrl + S
      if (e.ctrlKey && (
        (e.shiftKey && (key === 'i' || key === 'j' || key === 'c' || code === 73 || code === 74 || code === 67)) ||
        key === 'u' || code === 85 ||
        key === 's' || code === 83
      )) {
        e.preventDefault();
        return false;
      }
    }
  });

  // 3. ดีบั๊กเกอร์ลูป ป้องกันการใช้คอนโซลตรวจหาค่าตัวแปร
  setInterval(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      try {
        (function() {
          return function(inst) {
            inst.constructor('debugger')();
          };
        })()();
      } catch (err) {
        debugger;
      }
    }
  }, 250);
}

// จัดการการเปลี่ยนธีม
function setTheme(theme) {
  const body = document.getElementById('app-body');

  // ลบธีมเก่าออกทั้งหมด
  body.classList.remove('light-theme', 'dark-theme', 'ocean-theme', 'forest-theme', 'sunset-theme');

  // เพิ่มธีมใหม่
  body.classList.add(theme);
  localStorage.setItem('theme', theme);

  // อัปเดต UI หน้าต่างเลือกธีมให้ตรงกัน
  document.querySelectorAll('.theme-option-card').forEach(card => {
    if (card.getAttribute('data-theme') === theme) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

function bindThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  const modal = document.getElementById('theme-modal-overlay');
  const closeBtn = document.getElementById('close-theme-modal-btn');
  const themeCards = document.querySelectorAll('.theme-option-card');

  if (btn && modal) {
    btn.addEventListener('click', () => {
      modal.style.display = 'flex';
    });

    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }

  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      const theme = card.getAttribute('data-theme');
      setTheme(theme);
    });
  });
}

// -------------------------------------------------------------
// 3. ระบบยืนยันตัวตน (Authentication & Registration Logic)
// -------------------------------------------------------------
let authMode = 'login'; // login หรือ register

function bindAuthEvents() {
  const form = document.getElementById('auth-form');
  const toggleLink = document.getElementById('auth-toggle-link');
  const roleButtons = document.querySelectorAll('#reg-role-group .role-option');

  // เลือกบทบาทในหน้าสมัครสมาชิก
  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      roleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // สลับระหว่างสมัครสมาชิกและเข้าสู่ระบบ
  toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (authMode === 'login') {
      authMode = 'register';
      document.getElementById('auth-subtitle').innerText = 'สร้างบัญชีผู้ใช้งานใหม่ของระบบ';
      document.getElementById('reg-name-group').style.display = 'block';
      document.getElementById('reg-role-group').style.display = 'block';
      document.getElementById('auth-submit-text').innerText = 'สมัครสมาชิก';
      document.getElementById('auth-footer-desc').innerText = 'มีบัญชีผู้ใช้งานอยู่แล้ว?';
      toggleLink.innerText = 'เข้าสู่ระบบที่นี่';
    } else {
      authMode = 'login';
      document.getElementById('auth-subtitle').innerText = 'ระบบบริหารจัดการและจัดสอบออนไลน์อัจฉริยะ';
      document.getElementById('reg-name-group').style.display = 'none';
      document.getElementById('reg-role-group').style.display = 'none';
      document.getElementById('auth-submit-text').innerText = 'เข้าสู่ระบบ';
      document.getElementById('auth-footer-desc').innerText = 'ยังไม่มีบัญชีผู้ใช้งานใช่หรือไม่?';
      toggleLink.innerText = 'สมัครสมาชิกที่นี่';
    }
  });

  // ส่งข้อมูลฟอร์ม
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value.trim();

    if (!username || !password) {
      alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    if (authMode === 'login') {
      try {
        const user = await window.db.authenticate(username, password);
        if (user) {
          currentUser = user;
          sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
          await window.db.addLog(user.id, user.name, user.role, 'เข้าระบบ', 'เข้าสู่ระบบสำเร็จ');
          showAppShell();
          // รีเซ็ตฟอร์ม
          form.reset();
        } else {
          alert('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
        }
      } catch (err) {
        alert(err.message);
      }
    } else {
      try {
        if (!name) {
          alert('กรุณากรอกชื่อ-นามสกุลจริง');
          return;
        }

        const roleElement = document.querySelector('#reg-role-group .role-option.active');
        if (!roleElement) {
          alert('กรุณาเลือกบทบาท');
          return;
        }
        const role = roleElement.getAttribute('data-role');

        // ตรวจชื่อผู้ใช้ซ้ำ (คิวรีเดียว ไม่ดึง users ทั้งตาราง)
        if (await window.db.isUsernameTaken(username)) {
          alert('ชื่อผู้ใช้งานนี้ถูกใช้ไปแล้ว กรุณาเลือกชื่ออื่น');
          return;
        }

        const newUser = await window.db.addUser({
          username,
          password,
          name,
          role
        });

        alert('สมัครสมาชิกเรียบร้อยแล้ว! ระบบกำลังนำท่านเข้าสู่ระบบ');
        currentUser = newUser;
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        showAppShell();
        form.reset();
      } catch (err) {
        let msg = err.message || String(err);
        if (msg.includes('row-level security')) {
          msg += '\n\nกรุณารันไฟล์ supabase-rls.sql ใน Supabase Dashboard → SQL Editor';
        }
        alert('เกิดข้อผิดพลาด: ' + msg);
      }
    }
  });
}

function showAuthScreen() {
  document.getElementById('auth-container').style.display = 'flex';
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('exam-taking-container').style.display = 'none';
  document.getElementById('app-body').classList.remove('in-exam');
}

async function showAppShell() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  document.getElementById('exam-taking-container').style.display = 'none';
  document.getElementById('app-body').classList.remove('in-exam');

  // แสดงผลป้ายผู้ใช้ที่ Header
  document.getElementById('user-badge-name').innerText = currentUser.name;
  const roleBadge = document.getElementById('user-badge-role');
  roleBadge.innerText = currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : (currentUser.role === 'teacher' ? 'คุณครู' : 'นักเรียน');
  roleBadge.className = `badge-role role-${currentUser.role}`;

  // โหลดเมนูข้างและหน้าแรกตามบทบาท
  renderSidebarMenu();
  await switchView('dashboard');

  // ตรวจสอบห้องเรียนที่รอนำเข้า (จาก QR Code ลิงก์ตรง)
  const pendingCode = sessionStorage.getItem('pendingEnrollCode');
  if (pendingCode && currentUser && currentUser.role === 'student') {
    sessionStorage.removeItem('pendingEnrollCode');
    setTimeout(async () => {
      const subject = await window.db.getSubject(pendingCode);
      if (subject) {
        const success = await window.db.enrollStudent(currentUser.id, pendingCode);
        if (success) {
          alert(`ยินดีต้อนรับ! คุณได้เข้าร่วมห้องเรียนรายวิชา "${subject.name}" ผ่าน QR Code สำเร็จแล้ว`);
        } else {
          alert(`คุณได้ลงทะเบียนเรียนวิชา "${subject.name}" ไว้เรียบร้อยแล้ว`);
        }
        await switchView('student_subjects'); // สลับไปหน้าวิชาเรียนเพื่อดูข้อมูล
      } else {
        alert(`ไม่พบรหัสวิชา "${pendingCode}" ในระบบจากการสแกน QR Code`);
      }
    }, 500);
  }
}

function bindShellEvents() {
  // ปุ่มออกจากระบบ
  document.getElementById('logout-btn').addEventListener('click', async () => {
    if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
      await window.db.addLog(currentUser.id, currentUser.name, currentUser.role, 'ออกจากระบบ', 'ออกจากระบบสำเร็จ');
      currentUser = null;
      sessionStorage.removeItem('currentUser');
      showAuthScreen();
    }
  });

  // โลโก้คลิกแล้วกลับหน้า Dashboard
  document.getElementById('logo-home-trigger').addEventListener('click', async () => {
    await switchView('dashboard');
  });
}

// -------------------------------------------------------------
// 4. การจัดการแผงเมนูและจัดเส้นทางการแสดงผล (Routing Views)
// -------------------------------------------------------------
async function renderSidebarMenu() {
  const menuBox = document.getElementById('sidebar-menu-items');
  let html = '';

  if (currentUser.role === 'student') {
    html = `
      <a class="sidebar-link active" data-view="dashboard">
        <i class="lucide-icon" data-lucide="layout-dashboard"></i>
        <span>แดชบอร์ด</span>
      </a>
      <a class="sidebar-link" data-view="student_subjects">
        <i class="lucide-icon" data-lucide="folder-kanban"></i>
        <span>วิชาเรียนของฉัน</span>
      </a>
      <a class="sidebar-link" data-view="student_exams">
        <i class="lucide-icon" data-lucide="file-signature"></i>
        <span>ตารางสอบเข้าเรียน</span>
      </a>
      <a class="sidebar-link" data-view="student_history">
        <i class="lucide-icon" data-lucide="history"></i>
        <span>ประวัติการสอบ</span>
      </a>
    `;
  } else if (currentUser.role === 'teacher') {
    html = `
      <a class="sidebar-link active" data-view="dashboard">
        <i class="lucide-icon" data-lucide="layout-dashboard"></i>
        <span>แดชบอร์ดครู</span>
      </a>
      <a class="sidebar-link" data-view="teacher_subjects">
        <i class="lucide-icon" data-lucide="shapes"></i>
        <span>จัดการรายวิชา</span>
      </a>
      <a class="sidebar-link" data-view="teacher_exams">
        <i class="lucide-icon" data-lucide="pencil-ruler"></i>
        <span>จัดการข้อสอบ</span>
      </a>
      <a class="sidebar-link" data-view="teacher_grading">
        <i class="lucide-icon" data-lucide="check-square"></i>
        <span>ตรวจคะแนน & ผลสอบ</span>
      </a>
      <a class="sidebar-link" data-view="teacher_reports">
        <i class="lucide-icon" data-lucide="bar-chart-3"></i>
        <span>สถิติและรายงานวิเคราะห์</span>
      </a>
    `;
  } else if (currentUser.role === 'admin') {
    html = `
      <a class="sidebar-link active" data-view="dashboard">
        <i class="lucide-icon" data-lucide="layout-dashboard"></i>
        <span>ควบคุมระบบ</span>
      </a>
      <a class="sidebar-link" data-view="admin_users">
        <i class="lucide-icon" data-lucide="users"></i>
        <span>จัดการผู้ใช้งาน</span>
      </a>
      <a class="sidebar-link" data-view="admin_subjects">
        <i class="lucide-icon" data-lucide="folder-open"></i>
        <span>จัดการรายวิชาทั้งหมด</span>
      </a>
      <a class="sidebar-link" data-view="admin_logs">
        <i class="lucide-icon" data-lucide="activity"></i>
        <span>ตรวจสอบระบบ (Logs)</span>
      </a>
      <a class="sidebar-link" data-view="admin_backup">
        <i class="lucide-icon" data-lucide="database"></i>
        <span>สำรอง & กู้คืนข้อมูล</span>
      </a>
    `;
  }

  menuBox.innerHTML = html;
  refreshIcons(menuBox);

  // ผูกเหตุการณ์คลิกลิงก์
  const links = menuBox.querySelectorAll('.sidebar-link');
  links.forEach(link => {
    link.addEventListener('click', async () => {
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      await switchView(link.getAttribute('data-view'));
    });
  });
}

async function switchView(viewName) {
  currentView = viewName;
  const contentArea = document.getElementById('main-content-view');
  contentArea.innerHTML = '<div class="glass-panel" style="padding:48px;text-align:center;color:var(--text-secondary);">กำลังโหลด...</div>';

  // ซิงค์ปุ่ม Sidebar ให้ไฮไลต์ตรงกับหน้าจอจริง (ในกรณีเปลี่ยนจากตัวคุมอื่น)
  const sidebarLinks = document.querySelectorAll('#sidebar-menu-items .sidebar-link');
  sidebarLinks.forEach(link => {
    if (link.getAttribute('data-view') === viewName) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // ควบคุมการแสดงผลตาม View
  switch (viewName) {
    case 'dashboard':
      await renderDashboard(contentArea);
      break;

    // บทบาทนักเรียน
    case 'student_subjects':
      await renderStudentSubjects(contentArea);
      break;
    case 'student_exams':
      await renderStudentExams(contentArea);
      break;
    case 'student_history':
      await renderStudentHistory(contentArea);
      break;

    // บทบาทคุณครู
    case 'teacher_subjects':
      await renderTeacherSubjects(contentArea);
      break;
    case 'teacher_exams':
      await renderTeacherExams(contentArea);
      break;
    case 'teacher_grading':
      await renderTeacherGrading(contentArea);
      break;
    case 'teacher_reports':
      await renderTeacherReports(contentArea);
      break;

    // บทบาทผู้ดูแลระบบ
    case 'admin_users':
      await renderAdminUsers(contentArea);
      break;
    case 'admin_subjects':
      await renderAdminSubjects(contentArea);
      break;
    case 'admin_logs':
      await renderAdminLogs(contentArea);
      break;
    case 'admin_backup':
      await renderAdminBackup(contentArea);
      break;

    default:
      contentArea.innerHTML = `<h3>กำลังสร้างเพจ: ${viewName}</h3>`;
  }
  refreshIcons(contentArea);
}

// -------------------------------------------------------------
// 5. การเรนเดอร์เนื้อหาหน้า Dashboard ย่อย
// -------------------------------------------------------------
async function renderDashboard(container) {
  if (currentUser.role === 'student') {
    const [enrolls, attempts, exams] = await Promise.all([
      window.db.getStudentSubjects(currentUser.id),
      window.db.getAttemptsByStudent(currentUser.id),
      window.db.getExams()
    ]);
    const pendingExams = exams.filter(ex =>
      enrolls.some(sub => sub.id === ex.subjectId) &&
      !attempts.some(att => att.examId === ex.id) &&
      ex.active
    );

    container.innerHTML = `
      <div class="view-title-container">
        <h2>แดชบอร์ดต้อนรับคุณ, ${currentUser.name} </h2>
        <button class="btn btn-primary" id="dash-enroll-trigger">
          <i class="lucide-icon" data-lucide="plus-circle"></i>
          <span>เข้าร่วมวิชาเรียน</span>
        </button>
      </div>

      <div class="dashboard-grid">
        <article class="stat-card glass-panel">
          <div class="stat-info">
            <h3>วิชาเรียนที่ลงไว้</h3>
            <p>${enrolls.length}</p>
          </div>
          <div class="stat-icon primary">
            <i class="lucide-icon" data-lucide="graduation-cap"></i>
          </div>
        </article>
        
        <article class="stat-card glass-panel">
          <div class="stat-info">
            <h3>ข้อสอบที่รอดำเนินการ</h3>
            <p>${pendingExams.length}</p>
          </div>
          <div class="stat-icon warning">
            <i class="lucide-icon" data-lucide="file-warning"></i>
          </div>
        </article>
        
        <article class="stat-card glass-panel">
          <div class="stat-info">
            <h3>สอบเสร็จแล้ว</h3>
            <p>${attempts.length}</p>
          </div>
          <div class="stat-icon success">
            <i class="lucide-icon" data-lucide="badge-check"></i>
          </div>
        </article>
      </div>

      <div class="card-section">
        <div class="card-section-header">
          <h3><i class="lucide-icon text-gradient" data-lucide="sparkles"></i> ข้อมูลการเรียนล่าสุด</h3>
        </div>
        <div class="glass-panel" style="padding: 24px;">
          <p style="line-height: 1.6; color: var(--text-secondary);">
            ยินดีต้อนรับสู่ระบบห้องสอบออนไลน์อัจฉริยะ คุณสามารถคลิกเข้าสู่เมนู <strong>"ตารางสอบเข้าเรียน"</strong> เพื่อเริ่มทำแบบทดสอบ 
            หรือกดปุ่ม <strong>"เข้าร่วมวิชาเรียน"</strong> ที่ด้านบนเพื่อเพิ่มรหัสวิชาเรียนใหม่ที่ได้รับมอบหมายจากครูผู้สอน!
          </p>
        </div>
      </div>
    `;

    document.getElementById('dash-enroll-trigger').addEventListener('click', openEnrollmentModal);

  } else if (currentUser.role === 'teacher') {
    const [teacherSubjects, exams, enrollments, attempts] = await Promise.all([
      window.db.getSubjectsByTeacher(currentUser.id),
      window.db.getExams(),
      window.db.getEnrollments(),
      window.db.getAttempts()
    ]);
    const teacherExams = exams.filter(ex => teacherSubjects.some(s => s.id === ex.subjectId));
    const subjectIds = new Set(teacherSubjects.map(s => s.id));
    const studentsSet = new Set();
    enrollments.forEach(en => {
      if (subjectIds.has(en.subjectId)) {
        studentsSet.add(en.studentId);
      }
    });
    const submissions = attempts.filter(att => teacherExams.some(ex => ex.id === att.examId));

    container.innerHTML = `
      <div class="view-title-container">
        <h2>กระดานวิเคราะห์ข้อมูลของคุณครู, ${currentUser.name} </h2>
      </div>

      <div class="dashboard-grid">
        <article class="stat-card glass-panel">
          <div class="stat-info">
            <h3>วิชาเรียนที่รับผิดชอบ</h3>
            <p>${teacherSubjects.length}</p>
          </div>
          <div class="stat-icon primary">
            <i class="lucide-icon" data-lucide="book-marked"></i>
          </div>
        </article>
        
        <article class="stat-card glass-panel">
          <div class="stat-info">
            <h3>นักเรียนลงทะเบียน</h3>
            <p>${studentsSet.size}</p>
          </div>
          <div class="stat-icon success">
            <i class="lucide-icon" data-lucide="users-round"></i>
          </div>
        </article>
        
        <article class="stat-card glass-panel">
          <div class="stat-info">
            <h3>ข้อสอบที่เปิดใช้</h3>
            <p>${teacherExams.length}</p>
          </div>
          <div class="stat-icon warning">
            <i class="lucide-icon" data-lucide="clipboard-list"></i>
          </div>
        </article>
        
        <article class="stat-card glass-panel">
          <div class="stat-info">
            <h3>กระดาษคำตอบส่งแล้ว</h3>
            <p>${submissions.length}</p>
          </div>
          <div class="stat-icon danger">
            <i class="lucide-icon" data-lucide="mail-check"></i>
          </div>
        </article>
      </div>

      <div class="card-section">
        <div class="card-section-header">
          <h3><i class="lucide-icon text-gradient" data-lucide="bar-chart-3"></i> แนวคิดสถิติล่าสุด</h3>
        </div>
        <div class="glass-panel" style="padding: 24px; line-height: 1.6; color: var(--text-secondary);">
          <p>
            คุณครูสามารถสร้างและปรับแต่งข้อสอบในเมนู <strong>"จัดการข้อสอบ"</strong> หรือเข้ามาให้คะแนนข้อสอบเขียน/ข้ออัตนัยได้ในแถบ 
            <strong>"ตรวจคะแนน & ผลสอบ"</strong> ข้อมูลการจัดทำคะแนน สถิติการหลุดหน้าจอ และกราฟความก้าวหน้าสามารถเข้าชมได้ในเมนูวิเคราะห์อย่างง่ายดาย
          </p>
        </div>
      </div>
    `;

  } else if (currentUser.role === 'admin') {
    const [users, subjects, exams, logs] = await Promise.all([
      window.db.getUsers(),
      window.db.getSubjects(),
      window.db.getExams(),
      window.db.getLogs()
    ]);
    const totalUsers = users.length;
    const totalSubjects = subjects.length;
    const totalExams = exams.length;
    const totalLogs = logs.length;

    container.innerHTML = `
      <div class="view-title-container">
        <h2>แดชบอร์ดหลักระบบผู้ดูแลระบบสูงสุด </h2>
      </div>

      <div class="dashboard-grid">
        <article class="stat-card glass-panel">
          <div class="stat-info">
            <h3>บัญชีผู้ใช้ระบบ</h3>
            <p>${totalUsers}</p>
          </div>
          <div class="stat-icon primary">
            <i class="lucide-icon" data-lucide="users"></i>
          </div>
        </article>
        
        <article class="stat-card glass-panel">
          <div class="stat-info">
            <h3>วิชาเรียนทั้งหมด</h3>
            <p>${totalSubjects}</p>
          </div>
          <div class="stat-icon success">
            <i class="lucide-icon" data-lucide="folder-heart"></i>
          </div>
        </article>
        
        <article class="stat-card glass-panel">
          <div class="stat-info">
            <h3>ข้อสอบเปิดใช้งาน</h3>
            <p>${totalExams}</p>
          </div>
          <div class="stat-icon warning">
            <i class="lucide-icon" data-lucide="binary"></i>
          </div>
        </article>
        
        <article class="stat-card glass-panel">
          <div class="stat-info">
            <h3>ล็อกความปลอดภัย</h3>
            <p>${totalLogs}</p>
          </div>
          <div class="stat-icon danger">
            <i class="lucide-icon" data-lucide="fingerprint"></i>
          </div>
        </article>
      </div>

      <div class="card-section">
        <div class="card-section-header">
          <h3><i class="lucide-icon text-gradient" data-lucide="shield-check"></i> ตรวจสอบการทำงานของเซิร์ฟเวอร์จำลอง</h3>
        </div>
        <div class="glass-panel" style="padding: 24px; line-height: 1.6; color: var(--text-secondary);">
          <p>
            คุณมีสิทธิ์เต็มที่ในการปรับแต่งและกู้คืนไฟล์ข้อมูลจำลอง รวมถึงการจัดการลบบัญชีผู้ใช้งานที่มีพฤติกรรมไม่เหมาะสม 
            โปรดดูแลการส่งออกข้อมูลและการสำรองไฟล์ JSON เพื่อความปลอดภัยของคะแนนโครงการอย่างสม่ำเสมอ
          </p>
        </div>
      </div>
    `;
  }
}

// -------------------------------------------------------------
// 6. หมวดหมู่นักเรียน - วิชาเรียนของฉัน (Student Subjects Page)
// -------------------------------------------------------------
async function renderStudentSubjects(container) {
  const [enrolls, allExams] = await Promise.all([
    window.db.getStudentSubjects(currentUser.id),
    window.db.getExams()
  ]);
  const teacherIds = [...new Set(enrolls.map(s => s.teacherId).filter(Boolean))];
  const teachers = await window.db.getUsersByIds(teacherIds);
  const teacherMap = new Map(teachers.map(t => [t.id, t]));

  let html = `
    <div class="view-title-container">
      <h2>วิชาเรียนทั้งหมดที่ฉันลงทะเบียนไว้ </h2>
      <button class="btn btn-primary" id="std-subject-enroll-btn">
        <i class="lucide-icon" data-lucide="plus"></i>
        <span>เข้าร่วมรายวิชาใหม่</span>
      </button>
    </div>
  `;

  if (enrolls.length === 0) {
    html += `
      <div class="glass-panel" style="padding: 40px; text-align: center;">
        <i class="lucide-icon text-muted" data-lucide="folder-search" style="font-size: 40px; margin-bottom: 16px; display: inline-block;"></i>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">คุณยังไม่มีวิชาเรียนที่เข้าร่วมในระบบ</p>
        <button class="btn btn-primary" id="std-subject-empty-btn">ป้อนรหัสรายวิชาด่วน</button>
      </div>
    `;
  } else {
    html += `<div class="cards-grid">`;
    for (const sub of enrolls) {
      const teacher = teacherMap.get(sub.teacherId);
      const examsCount = allExams.filter(e => e.subjectId === sub.id).length;
      html += `
        <article class="item-card glass-panel">
          <div class="item-card-header">
            <span class="badge-role role-student" style="font-size: 10px;">รหัสวิชา: ${sub.id}</span>
          </div>
          <h3 class="item-card-title">${sub.name}</h3>
          <p class="item-card-desc">${sub.description}</p>
          <div class="item-card-meta">
            <span>ผู้สอน: ${teacher ? teacher.name : 'ไม่ระบุผู้สอน'}</span>
            <span>ข้อสอบในระบบ: ${examsCount} รายการ</span>
          </div>
        </article>
      `;
    }
    html += `</div>`;
  }

  container.innerHTML = html;

  const bindEnrollBtn = (id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', openEnrollmentModal);
  };
  bindEnrollBtn('std-subject-enroll-btn');
  bindEnrollBtn('std-subject-empty-btn');
}

function openEnrollmentModal() {
  openModal('เข้าร่วมวิชาเรียนหรือห้องสอบ', `
    <div id="enrollment-form-container" style="color: var(--text-primary); font-family: inherit;">
      <form id="enrollment-modal-form" novalidate>
        <div class="form-group" style="text-align: left;">
          <label for="enroll-subject-code" class="form-label" style="font-weight: 600;">กรอกรหัสประจำวิชา (6 ตัวอักษร เช่น MA101, SC102)</label>
          <div style="display: flex; gap: 8px; margin-top: 6px;">
            <input type="text" id="enroll-subject-code" class="form-control" placeholder="ระบุรหัสวิชาที่อาจารย์กำหนด" maxlength="10" required style="text-transform: uppercase; flex: 1; padding: 8px;">
            <button type="button" class="btn btn-secondary" id="enroll-scan-btn" title="สแกน QR Code" style="padding: 0 12px; font-size: 12.5px;">
              <i class="lucide-icon" data-lucide="qr-code" style="vertical-align:middle; margin-right:4px;"></i>สแกน QR
            </button>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; border-top: 1px solid var(--border-glass); padding-top: 16px;">
          <button type="button" class="btn btn-secondary" id="enroll-cancel-btn">ยกเลิก</button>
          <button type="submit" class="btn btn-primary">ยืนยันลงทะเบียน</button>
        </div>
      </form>
    </div>
    
    <div id="enrollment-scanner-container" style="display: none; text-align: center; color: var(--text-primary); font-family: inherit;">
      <p style="font-size:13.5px; color:var(--text-secondary); margin-bottom:12px;">กรุณาหันกล้องไปยังภาพ QR Code ให้ชัดเจน</p>
      <div id="qr-reader" style="width: 100%; max-width: 280px; margin: 0 auto; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-glass);"></div>
      <div style="margin-top: 20px; border-top: 1px solid var(--border-glass); padding-top: 16px;">
        <button type="button" class="btn btn-secondary" id="enroll-scan-close-btn" style="width: 100%;">กลับไปพิมพ์รหัส</button>
      </div>
    </div>
  `);

  refreshIcons(document.getElementById('modal-body-content'));

  const form = document.getElementById('enrollment-modal-form');
  const cancelBtn = document.getElementById('enroll-cancel-btn');
  const scanBtn = document.getElementById('enroll-scan-btn');
  const scanCloseBtn = document.getElementById('enroll-scan-close-btn');
  const formContainer = document.getElementById('enrollment-form-container');
  const scannerContainer = document.getElementById('enrollment-scanner-container');

  cancelBtn.addEventListener('click', closeModal);

  // การผูกระบบกล้องสแกน
  scanBtn.addEventListener('click', async () => {
    // ซ่อนฟอร์มปกติแล้วแสดงกล่องกล้อง
    formContainer.style.display = 'none';
    scannerContainer.style.display = 'block';

    if (!window.Html5Qrcode) {
      alert('ระบบกล้องแสกนยังโหลดไม่สมบูรณ์ กรุณารอ 2-3 วินาทีแล้วลองอีกครั้ง');
      formContainer.style.display = 'block';
      scannerContainer.style.display = 'none';
      return;
    }

    const html5QrCode = new Html5Qrcode("qr-reader");
    window.activeScanner = html5QrCode;

    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 200, height: 200 }
        },
        async (decodedText) => {
          // สแกนเจอข้อมูลสำเร็จ!
          console.log("QR Scan Success:", decodedText);
          
          // สั่งปิดกล้อง
          try {
            await html5QrCode.stop();
          } catch (e) {
            console.warn(e);
          }
          window.activeScanner = null;

          // แปลง URL ลิงก์ตรงเข้าร่วมชั้นเรียน
          let subjectCode = decodedText.trim();
          if (subjectCode.includes('?enroll=')) {
            try {
              const url = new URL(subjectCode);
              const param = url.searchParams.get('enroll');
              if (param) subjectCode = param;
            } catch (e) {}
          } else if (subjectCode.includes('/index.html')) {
            const match = subjectCode.match(/enroll=([^&]+)/);
            if (match && match[1]) subjectCode = match[1];
          }

          document.getElementById('enroll-subject-code').value = subjectCode.toUpperCase();

          // แสดงฟอร์มปกติคืน
          formContainer.style.display = 'block';
          scannerContainer.style.display = 'none';

          // ส่งฟอร์มโดยออโต้
          form.dispatchEvent(new Event('submit'));
        },
        (errorMessage) => {
          // มีการดีเทคตลอดเวลา ลบ log เพื่อเลี่ยง log สแปม
        }
      );
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถเปิดใช้งานกล้องถ่ายภาพได้ กรุณาอนุมัติสิทธิ์กล้องในบราวเซอร์ของคุณ');
      window.activeScanner = null;
      formContainer.style.display = 'block';
      scannerContainer.style.display = 'none';
    }
  });

  scanCloseBtn.addEventListener('click', async () => {
    if (window.activeScanner) {
      try {
        await window.activeScanner.stop();
      } catch (e) {}
      window.activeScanner = null;
    }
    formContainer.style.display = 'block';
    scannerContainer.style.display = 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('enroll-subject-code').value.trim().toUpperCase();
    if (!code) return;

    const subject = await window.db.getSubject(code);
    if (!subject) {
      alert('ไม่พบรหัสวิชานี้ในระบบ โปรดตรวจสอบความถูกต้องของตัวอักษรอีกครั้ง');
      return;
    }

    const success = await window.db.enrollStudent(currentUser.id, code);
    if (success) {
      alert(`ยินดีต้อนรับ! คุณเข้าร่วมห้องเรียนรายวิชา "${subject.name}" สำเร็จ`);
      closeModal();
      await switchView(currentView);
    } else {
      alert('คุณลงทะเบียนเรียนวิชานี้ไว้เรียบร้อยแล้ว ไม่ต้องทำซ้ำ');
    }
  });
}

// -------------------------------------------------------------
// 7. หมวดหมู่นักเรียน - ตารางเข้าสอบ (Student Exam Scheduling)
// -------------------------------------------------------------
async function renderStudentExams(container) {
  const [enrolledSubjects, attempts, exams] = await Promise.all([
    window.db.getStudentSubjects(currentUser.id),
    window.db.getAttemptsByStudent(currentUser.id),
    window.db.getExams()
  ]);
  const subjectMap = new Map(enrolledSubjects.map(s => [s.id, s]));
  const activeExams = exams.filter(ex => subjectMap.has(ex.subjectId));

  let html = `
    <div class="view-title-container">
      <h2>รายการข้อสอบและตารางสอบออนไลน์ </h2>
    </div>
  `;

  if (activeExams.length === 0) {
    html += `
      <div class="glass-panel" style="padding: 40px; text-align: center;">
        <i class="lucide-icon text-muted" data-lucide="clipboard-x" style="font-size: 40px; margin-bottom: 16px; display: inline-block;"></i>
        <p style="color: var(--text-secondary);">ขณะนี้ไม่มีข้อสอบที่มอบหมายถึงคุณ</p>
      </div>
    `;
  } else {
    html += `<div class="cards-grid">`;
    for (const ex of activeExams) {
      const subject = subjectMap.get(ex.subjectId);
      const attempt = attempts.find(a => a.examId === ex.id);

      let badgeHtml = '';
      let footerBtnHtml = '';

      if (attempt) {
        // มีการสอบประวัติแล้ว
        if (attempt.graded) {
          badgeHtml = `<span class="status-badge status-pass">สอบแล้ว (${attempt.score}/${attempt.totalPoints} คะแนน)</span>`;
        } else {
          badgeHtml = `<span class="status-badge status-pending">รอคุณครูให้คะแนนอัตนัย</span>`;
        }
        footerBtnHtml = `
          <button class="btn btn-secondary" onclick="viewAttemptDetails('${attempt.id}')" style="width: 100%;">
            <i class="lucide-icon" data-lucide="eye"></i>
            <span>ดูเฉลย & ผลวิเคราะห์</span>
          </button>
        `;
      } else {
        // ยังไม่ได้สอบ
        if (ex.active) {
          badgeHtml = `<span class="status-badge status-pending">พร้อมสอบออนไลน์</span>`;
          footerBtnHtml = `
            <button class="btn btn-primary" onclick="initiateExam('${ex.id}')" style="width: 100%;">
              <i class="lucide-icon" data-lucide="play-circle"></i>
              <span>เริ่มทำข้อสอบ</span>
            </button>
          `;
        } else {
          badgeHtml = `<span class="status-badge status-fail">ปิดระบบสอบชั่วคราว</span>`;
          footerBtnHtml = `
            <button class="btn btn-secondary" disabled style="width: 100%;">ยังไม่เปิดให้เข้าทำ</button>
          `;
        }
      }

      html += `
        <article class="item-card glass-panel" style="${attempt ? 'border-color: rgba(16, 185, 129, 0.2);' : ''}">
          <div class="item-card-header">
            <span class="badge-role role-student" style="font-size: 10px;">${subject ? subject.name : 'ไม่ทราบวิชา'}</span>
            ${badgeHtml}
          </div>
          <h3 class="item-card-title">${ex.title}</h3>
          <p class="item-card-desc">${ex.description}</p>
          <div class="item-card-meta">
            <span>จำกัดเวลา: <strong>${ex.timeLimit} นาที</strong></span>
            <span>จำนวนคำถาม: ${ex.questions.length} ข้อ</span>
          </div>
          <div class="item-card-footer" style="margin-top: auto;">
            ${footerBtnHtml}
          </div>
        </article>
      `;
    }
    html += `</div>`;
  }

  container.innerHTML = html;
}

// -------------------------------------------------------------
// 8. หมวดหมู่นักเรียน - ประวัติการสอบ (Student Historical Scores)
// -------------------------------------------------------------
async function renderStudentHistory(container) {
  const attempts = await window.db.getAttemptsByStudent(currentUser.id);

  let html = `
    <div class="view-title-container">
      <h2>ประวัติและสถิติการสอบที่ผ่านของคุณ </h2>
    </div>
  `;

  if (attempts.length === 0) {
    html += `
      <div class="glass-panel" style="padding: 40px; text-align: center;">
        <i class="lucide-icon text-muted" data-lucide="history" style="font-size: 40px; margin-bottom: 16px; display: inline-block;"></i>
        <p style="color: var(--text-secondary);">คุณยังไม่มีประวัติการส่งข้อสอบเข้ามาในขณะนี้</p>
      </div>
    `;
  } else {
    html += `
      <div class="data-table-container glass-panel">
        <table class="data-table">
          <thead>
            <tr>
              <th>ชื่อข้อสอบ / วิชา</th>
              <th>เวลาที่ส่งสอบ</th>
              <th>ใช้เวลาสอบ</th>
              <th>ความประพฤติสลับจอ</th>
              <th>คะแนนรวม</th>
              <th>การประเมิน</th>
              <th>การกระทำ</th>
            </tr>
          </thead>
          <tbody>
    `;

    attempts.forEach(att => {
      const minutes = Math.floor(att.timeSpent / 60);
      const seconds = att.timeSpent % 60;
      const formattedTime = `${minutes} น. ${seconds} วิ.`;

      let cheatLabel = `<span style="color: var(--success); font-weight:600;"><i class="lucide-icon" data-lucide="check" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>ปกติ</span>`;
      if (att.status === 'cheated') {
        cheatLabel = `<span style="color: var(--danger); font-weight:600;"><i class="lucide-icon" data-lucide="alert-triangle" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>ถูกบล็อกทุจริต (${att.exitCount} ครั้ง)</span>`;
      } else if (att.exitCount > 0) {
        cheatLabel = `<span style="color: var(--warning); font-weight:600;">ออกจอ ${att.exitCount} ครั้ง</span>`;
      }

      let scoreLabel = '';
      if (att.graded) {
        const passPercent = (att.score / att.totalPoints) * 100;
        scoreLabel = `<strong style="font-size: 16px; color: ${passPercent >= 50 ? 'var(--success)' : 'var(--danger)'};">${att.score}</strong> / ${att.totalPoints}`;
      } else {
        scoreLabel = `<span style="color: var(--warning); font-size:12px;">รอครูให้คะแนนอัตนัย</span>`;
      }

      html += `
        <tr>
          <td>
            <div style="font-weight: 600;">${att.examTitle}</div>
            <div style="font-size: 11px; color: var(--text-muted);">รหัสวิชา: ${att.subjectId}</div>
          </td>
          <td>${new Date(att.submittedAt).toLocaleString('th-TH')}</td>
          <td>${formattedTime}</td>
          <td>${cheatLabel}</td>
          <td>${scoreLabel}</td>
          <td>
            ${att.comments ? `<span class="status-badge status-pass" title="${att.comments}">ครูมีคำวิจารณ์</span>` : `<span style="color: var(--text-muted); font-size:12px;">ไม่มีหมายเหตุ</span>`}
          </td>
          <td>
            <button class="btn btn-secondary" onclick="viewAttemptDetails('${att.id}')" style="padding: 6px 12px; font-size:12px;">
              <i class="lucide-icon" data-lucide="file-search" style="width: 14px; height:14px;"></i>
              <span>ส่องข้อสอบ</span>
            </button>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = html;
}

// -------------------------------------------------------------
// 9. แสดงผลรายละเอียดผลการสอบ & เฉลยข้อสอบ (Attempt Feedback)
// -------------------------------------------------------------
window.viewAttemptDetails = async function (attemptId) {
  const att = await window.db.getAttempt(attemptId);
  if (!att) return;

  const exam = await window.db.getExam(att.examId);

  let html = `
    <div style="padding: 10px;">
      <!-- แผงบนสรุปคะแนน -->
      <div style="display: flex; gap: 20px; align-items: center; background-color: var(--bg-tertiary); padding: 18px; border-radius: var(--radius-sm); margin-bottom: 24px;">
        <div class="score-circle ${att.graded && (att.score / att.totalPoints >= 0.5) ? 'success' : 'danger'}" style="margin: 0;">
          <span class="score-circle-num">${att.graded ? att.score : '?'}</span>
          <span class="score-circle-label">เต็ม ${att.totalPoints}</span>
        </div>
        <div style="flex: 1; font-size: 14px; line-height: 1.6;">
          <h4 style="font-size: 16px; font-weight: 600;">${att.examTitle}</h4>
          <p style="color: var(--text-secondary);">รหัสประเมินผล: ${att.id}</p>
          <p style="color: var(--text-secondary);">ความประพฤติสลับจอ: <strong style="color: ${att.exitCount > 0 ? 'var(--danger)' : 'var(--success)'};">${att.exitCount} ครั้ง</strong></p>
          ${att.comments ? `<div style="background-color: var(--bg-secondary); padding: 10px; border-radius: 4px; margin-top: 8px; border-left: 3px solid var(--primary); font-style: italic;"><strong>ความเห็นจากผู้เขียนกระดาษ:</strong> ${att.comments}</div>` : ''}
        </div>
      </div>

      <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 12px;"><i class="lucide-icon" data-lucide="eye" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:6px;"></i>รายละเอียดและเฉลยข้อสอบ</h4>
      <div style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
  `;

  if (!exam) {
    html += `<p style="color: var(--text-muted);">ข้อสอบหลักถูกลบไปจากระบบเรียบร้อยแล้ว ไม่สามารถส่องเฉลยได้</p>`;
  } else {
    exam.questions.forEach((q, idx) => {
      const studentAns = att.answers[q.id];
      const isChoice = q.type === 'choice';

      let isCorrect = false;
      let checkIconHtml = '';

      if (isChoice) {
        isCorrect = parseInt(studentAns) === q.correctAnswer;
        checkIconHtml = isCorrect
          ? `<span style="color: var(--success); font-weight:600;"><i class="lucide-icon" data-lucide="check" style="width:14px; height:14px; display:inline-block; margin-right:4px;"></i>ตอบถูก</span>`
          : `<span style="color: var(--danger); font-weight:600;"><i class="lucide-icon" data-lucide="x" style="width:14px; height:14px; display:inline-block; margin-right:4px;"></i>ตอบผิด</span>`;
      } else {
        checkIconHtml = att.graded
          ? `<span style="color: var(--success); font-weight:600;"><i class="lucide-icon" data-lucide="pencil" style="width:14px; height:14px; display:inline-block; margin-right:4px;"></i>ตรวจแล้ว</span>`
          : `<span style="color: var(--warning); font-weight:600;"><i class="lucide-icon" data-lucide="clock" style="width:14px; height:14px; display:inline-block; margin-right:4px;"></i>รอตรวจ</span>`;
      }

      html += `
        <div style="background-color: var(--bg-secondary); border: 1px solid var(--border-glass); padding: 16px; border-radius: var(--radius-sm); margin-bottom: 12px; font-size: 13.5px; line-height: 1.5;">
          <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
            <strong style="color: var(--primary);">คำถามข้อที่ ${idx + 1} (${q.points} คะแนน)</strong>
            ${checkIconHtml}
          </div>
          <p style="margin-bottom: 10px; font-weight: 500;">${q.text}</p>
      `;

      if (isChoice) {
        html += `<ul style="list-style-type: none; padding-left: 0; display:flex; flex-direction:column; gap:6px;">`;
        q.options.forEach((opt, oIdx) => {
          let optionStyle = 'padding: 8px; border-radius: 4px; background-color: var(--bg-tertiary); border: 1px solid transparent;';
          let stateLabel = '';

          if (oIdx === q.correctAnswer) {
            optionStyle += 'background-color: rgba(16, 185, 129, 0.15); border-color: var(--success); color: var(--success); font-weight:500;';
            stateLabel = ' [เฉลยข้อถูก]';
          }
          if (parseInt(studentAns) === oIdx) {
            optionStyle += 'outline: 2px solid var(--primary);';
            stateLabel += ' [คำตอบของคุณ]';
          }

          html += `<li style="${optionStyle}">ตัวเลือกที่ ${oIdx + 1}: ${opt}<strong>${stateLabel}</strong></li>`;
        });
        html += `</ul>`;
      } else {
        html += `
          <div style="margin-top: 10px; background-color: var(--bg-tertiary); padding: 10px; border-radius: 4px;">
            <div style="font-size:11px; color: var(--text-muted);">คำตอบที่คุณเขียนส่ง:</div>
            <p style="margin-top:4px; font-style:italic;">"${studentAns || '(ไม่ได้ระบุคำตอบ)'}"</p>
          </div>
          <div style="margin-top: 6px; background-color: rgba(99, 102, 241, 0.05); padding: 10px; border-radius: 4px; border-left: 3px solid var(--accent-purple);">
            <div style="font-size:11px; color: var(--text-muted);">แนวข้อสอบคำเฉลย:</div>
            <p style="margin-top:4px; font-size:12px; color: var(--text-secondary);">${q.correctAnswer}</p>
          </div>
        `;
      }

      html += `</div>`;
    });
  }

  html += `
      </div>
      <div style="display:flex; justify-content:space-between; margin-top:24px;">
        <button class="btn btn-secondary" onclick="window.print()"><i class="lucide-icon" data-lucide="printer"></i> พิมพ์เอกสารรายงานผล</button>
        <button class="btn btn-primary" onclick="closeModal()">ปิดหน้าต่าง</button>
      </div>
    </div>
  `;

  openModal(`รายงานคะแนนสอบ: ${att.examTitle}`, html);
  refreshIcons(document.getElementById('modal-body-content'));
};

// -------------------------------------------------------------
// 10. คุณครู - จัดการวิชาเรียน (Teacher Subject Management)
// -------------------------------------------------------------
async function renderTeacherSubjects(container) {
  const [subjects, enrollments, exams] = await Promise.all([
    window.db.getSubjectsByTeacher(currentUser.id),
    window.db.getEnrollments(),
    window.db.getExams()
  ]);

  let html = `
    <div class="view-title-container">
      <h2>วิชาเรียนที่คุณครูรับผิดชอบสอน </h2>
      <button class="btn btn-primary" id="tch-add-subject-btn">
        <i class="lucide-icon" data-lucide="plus-circle"></i>
        <span>สร้างวิชาเรียนใหม่</span>
      </button>
    </div>
  `;

  if (subjects.length === 0) {
    html += `
      <div class="glass-panel" style="padding: 40px; text-align: center;">
        <i class="lucide-icon text-muted" data-lucide="folder-plus" style="font-size: 40px; margin-bottom: 16px; display: inline-block;"></i>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">คุณยังไม่มีวิชาเรียนที่สร้างไว้ในระบบ</p>
        <button class="btn btn-primary" id="tch-add-subject-empty">สร้างกลุ่มวิชาแรกด่วน</button>
      </div>
    `;
  } else {
    html += `<div class="cards-grid">`;
    for (const sub of subjects) {
      const studentsCount = enrollments.filter(e => e.subjectId === sub.id).length;
      const examsCount = exams.filter(e => e.subjectId === sub.id).length;

      html += `
        <article class="item-card glass-panel">
          <div class="item-card-header">
            <span class="badge-role role-teacher" style="font-size: 10px;">รหัสห้องเรียน: ${sub.id}</span>
          </div>
          <h3 class="item-card-title">${sub.name}</h3>
          <p class="item-card-desc">${sub.description}</p>
          <div class="item-card-meta">
            <span>นักเรียน: <strong>${studentsCount} คน</strong></span>
            <span>มีข้อสอบ: ${examsCount} ชุด</span>
          </div>
          <div class="item-card-footer" style="margin-top:auto; display:flex; gap:10px;">
            <button class="btn btn-secondary" onclick="showSubjectQrCode('${sub.id}', '${sub.name}')" style="padding: 8px; font-size:12px; flex: 1;">
              <i class="lucide-icon" data-lucide="qr-code" style="width:14px; height:14px;"></i> QR Code
            </button>
            <button class="btn btn-danger" onclick="deleteSubjectByTeacher('${sub.id}', '${sub.name}')" style="padding: 8px; font-size:12px;">
              <i class="lucide-icon" data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
          </div>
        </article>
      `;
    }
    html += `</div>`;
  }

  container.innerHTML = html;

  const bindAddBtn = (id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', openAddSubjectModal);
  };
  bindAddBtn('tch-add-subject-btn');
  bindAddBtn('tch-add-subject-empty');
}

function openAddSubjectModal() {
  openModal('สร้างรายวิชาใหม่', `
    <form id="add-subject-form" novalidate>
      <div class="form-group">
        <label for="sub-code-input" class="form-label">รหัสรายวิชาสะกด (กรุณาระบุ 5-6 ตัวอักษร เช่น MA101, PHY202)</label>
        <input type="text" id="sub-code-input" class="form-control" placeholder="เช่น ENG101" maxlength="10" required style="text-transform: uppercase;">
      </div>
      <div class="form-group">
        <label for="sub-name-input" class="form-label">ชื่อเต็มรายวิชา (ภาษาไทย/อังกฤษ)</label>
        <input type="text" id="sub-name-input" class="form-control" placeholder="เช่น ภาษาอังกฤษเบื้องต้น" required>
      </div>
      <div class="form-group">
        <label for="sub-desc-input" class="form-label">คำอธิบายรายวิชา/สังเขปการสอนสั้นๆ</label>
        <textarea id="sub-desc-input" class="form-control" placeholder="อธิบายวัตถุประสงค์หลักของวิชาเรียน..." style="min-height: 80px;" required></textarea>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
        <button type="button" class="btn btn-secondary" id="sub-cancel-btn">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">สร้างวิชาเรียน</button>
      </div>
    </form>
  `);

  document.getElementById('sub-cancel-btn').addEventListener('click', closeModal);
  const form = document.getElementById('add-subject-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('sub-code-input').value.trim().toUpperCase();
    const name = document.getElementById('sub-name-input').value.trim();
    const description = document.getElementById('sub-desc-input').value.trim();

    if (!id || !name || !description) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง');
      return;
    }

    if (id.length < 3) {
      alert('รหัสรายวิชาสั้นเกินไป ควรมีอย่างน้อย 3 ตัวอักษร');
      return;
    }

    // ตรวจวิชารหัสซ้ำ
    const exists = await window.db.getSubject(id);
    if (exists) {
      alert('รหัสวิชานี้ถูกใช้แล้วในระบบ โปรดตรวจสอบรหัสวิชาที่กำหนดอีกครั้ง');
      return;
    }

    try {
      const created = await window.db.addSubject({
        id,
        name,
        description,
        teacherId: currentUser.id
      });
      if (!created) {
        alert('ไม่สามารถสร้างวิชาได้ กรุณาลองใหม่อีกครั้ง');
        return;
      }

      await window.db.addLog(currentUser.id, currentUser.name, currentUser.role, 'สร้างวิชา', `สร้างรายวิชาใหม่ "${name}" (รหัส: ${id})`);
      alert(`สร้างรายวิชา "${name}" สำเร็จ นักเรียนสามารถใช้รหัส: "${id}" เพื่อเข้าร่วมห้องเรียนนี้ได้ทันที`);
      closeModal();
      await switchView('teacher_subjects');
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + (err.message || err));
    }
  });
}

window.deleteSubjectByTeacher = async function (subjectId, subjectName) {
  if (confirm(`คุณครูต้องการลบวิชา "${subjectName}" ใช่หรือไม่?\nการลบจะล้างข้อมูลห้องสอบ คะแนนทั้งหมดของนร. ในวิชานี้ออกถาวร!`)) {
    await window.db.deleteSubject(subjectId);
    await window.db.addLog(currentUser.id, currentUser.name, currentUser.role, 'ลบวิชา', `ลบวิชาเรียน "${subjectName}" (${subjectId})`);
    alert('ลบรายวิชาเสร็จสิ้น');
    await switchView('teacher_subjects');
  }
};

// -------------------------------------------------------------
// 11. คุณครู - จัดการข้อสอบและระบบสร้างข้อสอบ (Teacher Exam Builder)
// -------------------------------------------------------------
let tempQuestionsList = []; // เก็บคำถามชั่วคราวขณะเปิดฟอร์มสร้างข้อสอบ

async function renderTeacherExams(container) {
  const [teacherSubjects, exams, allAttempts] = await Promise.all([
    window.db.getSubjectsByTeacher(currentUser.id),
    window.db.getExams(),
    window.db.getAttempts()
  ]);
  const subjectMap = new Map(teacherSubjects.map(s => [s.id, s]));
  const teacherExams = exams.filter(ex => subjectMap.has(ex.subjectId));

  let html = `
    <div class="view-title-container">
      <h2>รายการเครื่องมือและคลังข้อสอบ </h2>
      <button class="btn btn-primary" id="tch-create-exam-btn" ${teacherSubjects.length === 0 ? 'disabled' : ''}>
        <i class="lucide-icon" data-lucide="plus-circle"></i>
        <span>สร้างข้อสอบชุดใหม่</span>
      </button>
    </div>
  `;

  if (teacherSubjects.length === 0) {
    html += `
      <div class="glass-panel" style="padding: 32px; text-align: center; border-color: var(--danger-glow);">
        <p style="color: var(--danger); font-weight:600;">คุณจำเป็นต้องเริ่มสร้าง "รายวิชา" ก่อนเป็นอันดับแรก จึงจะเข้าสู่ระบบสร้างข้อสอบชุดเรียนได้!</p>
      </div>
    `;
    container.innerHTML = html;
    return;
  }

  if (teacherExams.length === 0) {
    html += `
      <div class="glass-panel" style="padding: 40px; text-align: center;">
        <i class="lucide-icon text-muted" data-lucide="clipboard-list" style="font-size: 40px; margin-bottom: 16px; display: inline-block;"></i>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">ยังไม่มีชุดข้อสอบถูกตั้งโครงสร้างไว้ในระบบ</p>
        <button class="btn btn-primary" id="tch-create-exam-empty">สร้างแบบประเมินผลชุดแรก</button>
      </div>
    `;
  } else {
    html += `<div class="cards-grid">`;
    for (const ex of teacherExams) {
      const subject = subjectMap.get(ex.subjectId);
      const attemptsCount = allAttempts.filter(a => a.examId === ex.id).length;

      html += `
        <article class="item-card glass-panel" style="${ex.active ? '' : 'opacity: 0.65; border-style:dashed;'}">
          <div class="item-card-header">
            <span class="badge-role role-teacher" style="font-size: 10px;">${subject ? subject.name : 'วิชาเรียนหลัก'}</span>
            <span class="status-badge ${ex.active ? 'status-pass' : 'status-fail'}">${ex.active ? 'เปิดสอบ' : 'ปิดระบบสอบ'}</span>
          </div>
          <h3 class="item-card-title">${ex.title}</h3>
          <p class="item-card-desc">${ex.description}</p>
          <div class="item-card-meta">
            <span>เวลาสอบ: <strong>${ex.timeLimit} นาที</strong></span>
            <span>คำถาม: ${ex.questions.length} ข้อ</span>
          </div>
          <div class="item-card-meta">
            <span>จำนวนผู้ส่งกระดาษแล้ว: <strong>${attemptsCount} แผ่น</strong></span>
          </div>
          <div class="item-card-footer" style="margin-top:auto;">
            <button class="btn btn-secondary" onclick="toggleExamStatus('${ex.id}', ${ex.active})" style="padding:8px; font-size:11.5px; flex: 1;">
              <i class="lucide-icon" data-lucide="${ex.active ? 'lock' : 'unlock'}" style="width:12px; height:12px;"></i> ${ex.active ? 'ปิดสอบ' : 'เปิดสอบ'}
            </button>
            <button class="btn btn-danger" onclick="deleteExamByTeacher('${ex.id}', '${ex.title}')" style="padding:8px; font-size:11.5px;">
              <i class="lucide-icon" data-lucide="trash" style="width:12px; height:12px;"></i>
            </button>
          </div>
        </article>
      `;
    }
    html += `</div>`;
  }

  container.innerHTML = html;

  const bindCreateBtn = (id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', openCreateExamView);
  };
  bindCreateBtn('tch-create-exam-btn');
  bindCreateBtn('tch-create-exam-empty');
}

async function toggleExamStatus(examId, currentStatus) {
  await window.db.updateExam(examId, { active: !currentStatus });
  await switchView('teacher_exams');
}

window.deleteExamByTeacher = async function (examId, examTitle) {
  if (confirm(`คุณครูต้องการลบชุดข้อสอบ "${examTitle}" ใช่หรือไม่?\nข้อมูลการส่งสอบและคะแนนทั้งหมดของนร.จะสูญหายถาวร!`)) {
    await window.db.deleteExam(examId);
    await window.db.addLog(currentUser.id, currentUser.name, currentUser.role, 'ลบข้อสอบ', `ลบข้อสอบชุด "${examTitle}" (${examId})`);
    alert('ลบข้อสอบสำเร็จเรียบร้อย');
    await switchView('teacher_exams');
  }
};

async function openCreateExamView() {
  tempQuestionsList = [
    {
      id: 'temp_q_1',
      type: 'choice',
      text: 'คำถามข้อที่ 1 ปรนัย?',
      points: 2,
      options: ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2', 'ตัวเลือกที่ 3', 'ตัวเลือกที่ 4'],
      correctAnswer: 0
    }
  ];

  const teacherSubjects = await window.db.getSubjectsByTeacher(currentUser.id);
  const contentArea = document.getElementById('main-content-view');

  let subjectOptionsHtml = '';
  teacherSubjects.forEach(s => {
    subjectOptionsHtml += `<option value="${s.id}">${s.name} (${s.id})</option>`;
  });

  contentArea.innerHTML = `
    <div class="view-title-container">
      <h2><i class="lucide-icon" data-lucide="plus-circle" style="vertical-align:middle; margin-right:8px;"></i>สร้างชุดข้อสอบออนไลน์ตัวใหม่</h2>
      <button type="button" class="btn btn-secondary" id="builder-back-btn">ย้อนกลับ</button>
    </div>

    <div class="exam-builder-card glass-panel">
      <form id="builder-main-form" novalidate>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div class="form-group">
            <label for="b-subject-select" class="form-label">เลือกวิชาที่จะจัดสอบ</label>
            <select id="b-subject-select" class="form-control">
              ${subjectOptionsHtml}
            </select>
          </div>
          <div class="form-group">
            <label for="b-title" class="form-label">หัวข้อชื่อแบบทดสอบ</label>
            <input type="text" id="b-title" class="form-control" placeholder="เช่น สอบปลายภาคเทอม 1" required>
          </div>
        </div>

        <div class="form-group">
          <label for="b-desc" class="form-label">คำอธิบาย/ชี้แจงกฎกติกาการสอบ</label>
          <input type="text" id="b-desc" class="form-control" placeholder="เช่น ห้ามเปิดหนังสือ พยายามตอบคำถามทุกข้อ ตรวจจับการทุจริต..." required>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div class="form-group">
            <label for="b-timer" class="form-label">จำกัดระยะเวลา (นาที)</label>
            <input type="number" id="b-timer" class="form-control" value="20" min="1" max="180" required>
          </div>
          <div class="form-group">
            <label for="b-date" class="form-label">กำหนดการสอบเริ่ม (วัน-เวลาเปิดสอบ)</label>
            <input type="datetime-local" id="b-date" class="form-control" value="2026-05-21T09:00" required>
          </div>
        </div>

        <!-- รายการคำถามคำตอบ -->
        <div style="border-top:1px solid var(--border-glass); padding-top:24px; margin-top:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="font-size:16px; font-weight:600;"><i class="lucide-icon" data-lucide="help-circle" style="vertical-align:middle; margin-right:8px;"></i>รายการคำถามที่สร้างขึ้น</h3>
            <div style="display:flex; gap:10px; align-items:center;">
              <button type="button" class="btn btn-primary" id="import-gform-btn" style="padding:6px 12px; font-size:12px; background-color:#673ab7; border-color:#673ab7;">
                <i class="lucide-icon" data-lucide="file-text"></i> นำเข้าจาก Google Form
              </button>
              <button type="button" class="btn btn-secondary" onclick="addNewBuilderQuestion('choice')" style="padding:6px 12px; font-size:12px;">
                <i class="lucide-icon" data-lucide="plus"></i> ปรนัย (หลายตัวเลือก)
              </button>
              <button type="button" class="btn btn-secondary" onclick="addNewBuilderQuestion('subjective')" style="padding:6px 12px; font-size:12px;">
                <i class="lucide-icon" data-lucide="plus"></i> อัตนัย (เขียนคำตอบ)
              </button>
            </div>
          </div>

          <div id="builder-questions-list-holder">
            <!-- จะเขียนข้อมูลฟอร์มคำถามย่อยผ่าน JS -->
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px; border-top:1px solid var(--border-glass); padding-top:24px; margin-top:32px;">
          <button type="button" class="btn btn-secondary" id="builder-cancel-btn">ยกเลิก</button>
          <button type="submit" class="btn btn-primary">บันทึกและเผยแพร่ข้อสอบ</button>
        </div>
      </form>
    </div>
  `;

  renderBuilderQuestions();
  refreshIcons(contentArea);

  const importGFormBtn = document.getElementById('import-gform-btn');
  if (importGFormBtn) {
    importGFormBtn.addEventListener('click', openImportGoogleFormModal);
  }

  const goBackToExams = () => { switchView('teacher_exams'); };
  document.getElementById('builder-back-btn').addEventListener('click', goBackToExams);
  document.getElementById('builder-cancel-btn').addEventListener('click', goBackToExams);

  // ผูกแบบจำลอง Submit ฟอร์ม
  const form = document.getElementById('builder-main-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // โหลดเก็บค่าจากฟอร์มคำถามใน HTML
    saveBuilderFormValuesToMemory();

    const subjectId = document.getElementById('b-subject-select').value;
    const title = document.getElementById('b-title').value.trim();
    const description = document.getElementById('b-desc').value.trim();
    const timeLimit = parseInt(document.getElementById('b-timer').value);
    const scheduledDate = document.getElementById('b-date').value;

    if (!title || !description || isNaN(timeLimit)) {
      alert('กรุณากรอกข้อมูลส่วนหัวข้อสอบให้ครบถ้วนก่อนส่งบันทึก');
      return;
    }

    if (tempQuestionsList.length === 0) {
      alert('คุณต้องเพิ่มคำถามสอบลงในข้อสอบอย่างน้อย 1 ข้อถ้วน!');
      return;
    }

    // ทำการเซฟข้อสอบชุดใหม่ลง Local Database
    await window.db.addExam({
      subjectId,
      title,
      description,
      timeLimit,
      scheduledDate,
      questions: tempQuestionsList
    });

    await window.db.addLog(currentUser.id, currentUser.name, currentUser.role, 'สร้างข้อสอบ', `ครูสร้างข้อสอบใหม่เรื่อง "${title}" วิชา ${subjectId}`);
    alert(`สร้างและจัดระบบเผยแพร่ข้อสอบชุด "${title}" ลงห้องเรียนเสร็จสิ้น!`);
    await switchView('teacher_exams');
  });
}

async function renderBuilderQuestions() {
  const container = document.getElementById('builder-questions-list-holder');
  let html = '';

  tempQuestionsList.forEach((q, idx) => {
    const isChoice = q.type === 'choice';

    html += `
      <div class="question-item" data-id="${q.id}">
        <div class="question-header">
          <span class="question-number">คำถามข้อที่ ${idx + 1} - [ประเภท: ${isChoice ? 'ปรนัย (ตัวเลือก)' : 'อัตนัย (เขียนความ)'}]</span>
          <button type="button" class="remove-question-btn" onclick="removeBuilderQuestion('${q.id}')" title="ลบคำถามข้อนี้">
            <i class="lucide-icon" data-lucide="trash-2"></i>
          </button>
        </div>

        <div style="display:grid; grid-template-columns: 3fr 1fr; gap:16px; margin-bottom:12px;">
          <div>
            <label class="form-label">โจทย์คำถาม</label>
            <input type="text" class="form-control question-text-input" value="${escapeHtml(q.text)}" placeholder="เช่น ข้อใดถูกหลักไวยากรณ์ที่สุด..." required>
          </div>
          <div>
            <label class="form-label">คะแนนเต็มข้อนี้</label>
            <input type="number" class="form-control question-points-input" value="${q.points}" min="0.5" step="0.5" required>
          </div>
        </div>
    `;

    if (isChoice) {
      html += `<div class="choices-container">`;
      q.options.forEach((opt, oIdx) => {
        html += `
          <div class="choice-row">
            <input type="radio" name="correct_ans_temp_${q.id}" class="choice-radio-input" ${oIdx === q.correctAnswer ? 'checked' : ''} value="${oIdx}">
            <input type="text" class="form-control choice-text-input" value="${escapeHtml(opt)}" placeholder="ตัวเลือกช้อยส์ข้อ ${oIdx + 1}" required>
          </div>
        `;
      });
      html += `
          <p style="font-size:11px; color: var(--text-muted); margin-top:8px;">* กรุณาคลิกเลือกปุ่มวงกลมหน้ารายการช้อยส์เพื่อให้ระบบตั้งเป็นข้อคำตอบที่ถูกต้องเฉลยอัตโนมัติ *</p>
        </div>`;
    } else {
      html += `
        <div>
          <label class="form-label">คีย์เวิร์ดเฉลย / คำแนวคำตอบที่ถูกต้อง (ช่วยตรวจสถิติหรือเป็นข้อแนะนำ)</label>
          <input type="text" class="form-control question-subjective-ans-input" value="${escapeHtml(q.correctAnswer)}" placeholder="เช่น ผลบวกคูณความยาว หรือแนวอธิบายคีย์สูตร..." required>
        </div>
      `;
    }

    html += `</div>`;
  });

  container.innerHTML = html;
  refreshIcons(container);
}

window.addNewBuilderQuestion = function (type) {
  saveBuilderFormValuesToMemory(); // เก็บค่าข้อมูลเก่าไว้ก่อน

  const id = 'temp_q_' + Date.now() + '_' + Math.floor(Math.random() * 100);
  const newQ = type === 'choice'
    ? {
      id,
      type: 'choice',
      text: '',
      points: 2,
      options: ['', '', '', ''],
      correctAnswer: 0
    }
    : {
      id,
      type: 'subjective',
      text: '',
      points: 4,
      correctAnswer: ''
    };

  tempQuestionsList.push(newQ);
  renderBuilderQuestions();
};

window.removeBuilderQuestion = function (id) {
  if (tempQuestionsList.length <= 1) {
    alert('จำเป็นต้องมีโจทย์คำถามสอบเหลือไว้อย่างน้อย 1 ข้อขึ้นไป');
    return;
  }
  saveBuilderFormValuesToMemory();
  tempQuestionsList = tempQuestionsList.filter(q => q.id !== id);
  renderBuilderQuestions();
};

function saveBuilderFormValuesToMemory() {
  const items = document.querySelectorAll('#builder-questions-list-holder .question-item');
  items.forEach((item, idx) => {
    const id = item.getAttribute('data-id');
    const qIndex = tempQuestionsList.findIndex(q => q.id === id);
    if (qIndex === -1) return;

    // คำอธิบายโจทย์และคะแนน
    tempQuestionsList[qIndex].text = item.querySelector('.question-text-input').value;
    tempQuestionsList[qIndex].points = parseFloat(item.querySelector('.question-points-input').value) || 1;

    if (tempQuestionsList[qIndex].type === 'choice') {
      // โหลดข้อเขียนช้อยส์
      const optInputs = item.querySelectorAll('.choice-text-input');
      const opts = [];
      optInputs.forEach(inp => opts.push(inp.value));
      tempQuestionsList[qIndex].options = opts;

      // ตรวจสอบเช็คช้อยส์ถูกเฉลย
      const radios = item.querySelectorAll('.choice-radio-input');
      radios.forEach(rad => {
        if (rad.checked) {
          tempQuestionsList[qIndex].correctAnswer = parseInt(rad.value);
        }
      });
    } else {
      // สำหรับอัตนัย
      tempQuestionsList[qIndex].correctAnswer = item.querySelector('.question-subjective-ans-input').value;
    }
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// -------------------------------------------------------------
// 12. คุณครู - ห้องตรวจส่งข้อสอบ (Teacher Attempt Evaluation)
// -------------------------------------------------------------
async function renderTeacherGrading(container) {
  const teacherSubjects = await window.db.getSubjectsByTeacher(currentUser.id);
  const exams = await window.db.getExams();
  const teacherExams = exams.filter(ex => teacherSubjects.some(s => s.id === ex.subjectId));

  const attempts = await window.db.getAttempts();
  const submissions = attempts.filter(att => teacherExams.some(ex => ex.id === att.examId));

  let html = `
    <div class="view-title-container">
      <h2>ตรวจข้อสอบและวิเคราะห์รายแผ่น </h2>
    </div>
  `;

  if (submissions.length === 0) {
    html += `
      <div class="glass-panel" style="padding: 40px; text-align: center;">
        <i class="lucide-icon text-muted" data-lucide="inbox" style="font-size: 40px; margin-bottom: 16px; display: inline-block;"></i>
        <p style="color: var(--text-secondary);">ขณะนี้ยังไม่มีนักเรียนส่งข้อสอบสอบเข้ามาให้ประเมินคะแนน</p>
      </div>
    `;
  } else {
    html += `
      <div class="data-table-container glass-panel">
        <table class="data-table">
          <thead>
            <tr>
              <th>ชื่อนักเรียน</th>
              <th>ชุดข้อสอบ</th>
              <th>สถานะทุจริต</th>
              <th>วันที่ส่งกระดาษ</th>
              <th>คะแนนปัจจุบัน</th>
              <th>สถานะตรวจ</th>
              <th>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
    `;

    submissions.forEach(att => {
      let cheatStyle = 'color: var(--success); font-weight:600;';
      let cheatText = 'ปกติ';

      if (att.status === 'cheated') {
        cheatStyle = 'color: var(--danger); font-weight:600;';
        cheatText = `ทุจริต (หลุดจอ ${att.exitCount} ครั้ง)`;
      } else if (att.exitCount > 0) {
        cheatStyle = 'color: var(--warning); font-weight:600;';
        cheatText = `ออกนอกจอ (${att.exitCount} ครั้ง)`;
      }

      html += `
        <tr>
          <td><strong style="font-size:14px;">${att.studentName}</strong></td>
          <td>
            <div>${att.examTitle}</div>
            <div style="font-size: 11px; color:var(--text-muted);">วิชา: ${att.subjectId}</div>
          </td>
          <td style="${cheatStyle}">${cheatText}</td>
          <td>${new Date(att.submittedAt).toLocaleString('th-TH')}</td>
          <td><strong style="font-size:15px;">${att.score}</strong> / ${att.totalPoints} คะแนน</td>
          <td>
            <span class="status-badge ${att.graded ? 'status-pass' : 'status-pending'}">
              ${att.graded ? 'ตรวจแล้ว' : 'รอครูตรวจข้อเขียน'}
            </span>
          </td>
          <td>
            <button class="btn btn-primary" onclick="openTeacherGradeOverlay('${att.id}')" style="padding: 6px 12px; font-size:12px;">
              <i class="lucide-icon" data-lucide="edit-3" style="width:12px; height:12px;"></i>
              <span>${att.graded ? 'แก้ไขคะแนน' : 'เริ่มให้คะแนน'}</span>
            </button>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = html;
  refreshIcons(container);
}

window.openTeacherGradeOverlay = async function (attemptId) {
  const att = await window.db.getAttempt(attemptId);
  if (!att) return;

  const exam = await window.db.getExam(att.examId);
  if (!exam) {
    alert('ข้อสอบต้นฉบับโดนลบออกไปแล้ว ไม่สามารถดำเนินการให้คะแนนได้');
    return;
  }

  let html = `
    <div style="padding: 10px;">
      <p style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 20px;">
        นักเรียน: <strong>${att.studentName}</strong> | แบบประเมิน: <strong>${att.examTitle}</strong>
      </p>

      <div id="grading-questions-list" style="max-height: 380px; overflow-y:auto; padding-right:8px; margin-bottom:20px;">
  `;

  exam.questions.forEach((q, idx) => {
    const studentAns = att.answers[q.id];
    const isChoice = q.type === 'choice';

    html += `
      <div style="background-color: var(--bg-tertiary); border:1px solid var(--border-glass); padding: 16px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size:13.5px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-weight:600;">
          <span style="color:var(--primary)">คำถามข้อที่ ${idx + 1} (${isChoice ? 'ปรนัย' : 'อัตนัย'} - ${q.points} คะแนน)</span>
    `;

    if (isChoice) {
      const isCorrect = parseInt(studentAns) === q.correctAnswer;
      html += `<span style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'};">${isCorrect ? 'ตอบถูกต้อง (+ ' + q.points + ')' : 'ตอบผิด (+ 0)'}</span>`;
    } else {
      html += `
        <div style="display:flex; align-items:center; gap:8px;">
          <span>ให้คะแนนข้อเขียน:</span>
          <input type="number" class="form-control subjective-input-points" data-qid="${q.id}" data-max="${q.points}" value="${att.graded ? (att.answers[q.id + '_score'] || 0) : 0}" min="0" max="${q.points}" step="0.5" style="width: 70px; padding: 4px 8px; text-align:center;">
          <span>/ ${q.points}</span>
        </div>
      `;
    }

    html += `
        </div>
        <p style="font-weight:500; margin-bottom:10px;">${q.text}</p>
    `;

    if (isChoice) {
      html += `<ul style="list-style-type: none; padding-left:0; font-size:12.5px;">`;
      q.options.forEach((opt, oIdx) => {
        let optStyle = 'padding:6px; border-radius:4px; margin-top:4px;';
        if (oIdx === q.correctAnswer) optStyle += 'background-color: rgba(16, 185, 129, 0.1); color: var(--success);';
        if (parseInt(studentAns) === oIdx) optStyle += 'border:1px solid var(--primary); font-weight:600;';
        html += `<li style="${optStyle}">ตัวเลือก ${oIdx + 1}: ${opt}</li>`;
      });
      html += `</ul>`;
    } else {
      html += `
        <div style="background-color: var(--bg-secondary); padding: 12px; border-radius: 4px; margin-top:8px;">
          <div style="font-size:11px; color: var(--text-muted);">กระดาษเขียนส่งตอบของนักเรียน:</div>
          <p style="margin-top:4px; font-style:italic; font-size:13px; color:var(--text-primary);">"${studentAns || '(เว้นว่างไม่ได้ระบุตอบ)'}"</p>
        </div>
        <div style="background-color: rgba(168, 85, 247, 0.05); padding: 12px; border-radius: 4px; margin-top:6px; border-left: 3px solid var(--accent-purple);">
          <div style="font-size:11px; color: var(--text-muted);">แนวทางคำวิเคราะห์คำตอบคุณครูเขียน:</div>
          <p style="margin-top:4px; font-size:12.5px; color:var(--text-secondary);">${q.correctAnswer}</p>
        </div>
      `;
    }

    html += `</div>`;
  });

  html += `
      </div>

      <!-- หมายเหตุแสดงความคิดเห็น -->
      <div class="form-group">
        <label class="form-label">คำวิจารณ์/หมายเหตุผลการทำข้อสอบของคุณครู</label>
        <input type="text" id="grade-teacher-comment" class="form-control" placeholder="พิมพ์ข้อความที่ต้องการแจ้งให้นักเรียนทราบเมื่ออ่านผลคะแนน..." value="${escapeHtml(att.comments)}">
      </div>

      <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px;">
        <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
        <button class="btn btn-primary" id="save-grading-btn">บันทึกตรวจคะแนนสอบ</button>
      </div>
    </div>
  `;

  openModal(`ตรวจข้อสอบของนักเรียน: ${att.studentName}`, html);

  const saveBtn = document.getElementById('save-grading-btn');
  saveBtn.addEventListener('click', async () => {
    // คำนวณคะแนนรวม
    let finalScore = 0;

    // 1. คะแนนจากข้อปรนัย (คิดแบบเรียลไทม์)
    exam.questions.forEach(q => {
      const studentAns = att.answers[q.id];
      if (q.type === 'choice') {
        if (parseInt(studentAns) === q.correctAnswer) {
          finalScore += q.points;
        }
      } else {
        // 2. โหลดคะแนนจากข้อเขียนอัตนัยที่ระบุใน input
        const scoreInp = document.querySelector(`.subjective-input-points[data-qid="${q.id}"]`);
        const val = parseFloat(scoreInp.value) || 0;
        finalScore += val;
        // เซฟคะแนนเฉพาะข้อนั้นๆ เข้า object answers
        att.answers[q.id + '_score'] = val;
      }
    });

    const comment = document.getElementById('grade-teacher-comment').value.trim();

    await window.db.updateAttemptGrading(attemptId, { finalScore }, comment);
    await window.db.addLog(currentUser.id, currentUser.name, currentUser.role, 'ตรวจคะแนน', `ครูส่งคะแนนตรวจ "${att.examTitle}" ของ ${att.studentName} คะแนนรวม ${finalScore} คะแนน`);

    alert(`ประเมินและให้คะแนน "${att.studentName}" สำเร็จ!`);
    closeModal();
    await switchView('teacher_grading');
  });
};

// -------------------------------------------------------------
// 13. คุณครู - แผงวิเคราะห์และดาวน์โหลดสถิติคะแนน (Reports & Charts)
// -------------------------------------------------------------
async function renderTeacherReports(container) {
  const teacherSubjects = await window.db.getSubjectsByTeacher(currentUser.id);

  let optionsHtml = '';
  teacherSubjects.forEach(s => {
    optionsHtml += `<option value="${s.id}">${s.name}</option>`;
  });

  container.innerHTML = `
    <div class="view-title-container">
      <h2>รายงานสถิติวิเคราะห์และดาวน์โหลดผล </h2>
      ${teacherSubjects.length > 0 ? `
        <button class="btn btn-success" id="report-csv-download">
          <i class="lucide-icon" data-lucide="download"></i>
          <span>ส่งออกเกรดบุ๊ค (CSV)</span>
        </button>
      ` : ''}
    </div>

    ${teacherSubjects.length === 0 ? `
      <div class="glass-panel" style="padding: 40px; text-align: center;">
        <p style="color:var(--text-secondary)">สร้างวิชาสอบเพื่อดูแผงวิจัยสถิติข้อมูล</p>
      </div>
    ` : `
      <div class="glass-panel" style="padding:24px; margin-bottom:32px;">
        <div class="form-group" style="max-width:300px; margin-bottom:0;">
          <label class="form-label">เลือกวิชาเพื่อวิเคราะห์เจาะลึก</label>
          <select id="report-subject-selector" class="form-control">
            ${optionsHtml}
          </select>
        </div>
      </div>

      <div id="reports-analytics-panel">
        <!-- ชาร์ตและข้อมูลความคืบหน้าจะเติมผ่าน JS -->
      </div>
    `}
  `;

  if (teacherSubjects.length > 0) {
    const sel = document.getElementById('report-subject-selector');
    sel.addEventListener('change', () => updateTeacherReportsDashboard(sel.value));

    // โหลดครั้งแรก
    updateTeacherReportsDashboard(sel.value);

    // ดาวน์โหลดไฟล์ CSV
    document.getElementById('report-csv-download').addEventListener('click', () => {
      downloadGradebookCSV(sel.value);
    });
  }
}

async function updateTeacherReportsDashboard(subjectId) {
  const panel = document.getElementById('reports-analytics-panel');
  const subject = await window.db.getSubject(subjectId);
  const exams = await window.db.getExamsBySubject(subjectId);
  const attempts = (await window.db.getAttempts()).filter(a => a.subjectId === subjectId);

  if (attempts.length === 0) {
    panel.innerHTML = `
      <div class="glass-panel" style="padding: 40px; text-align:center;">
        <i class="lucide-icon text-muted" data-lucide="bar-chart" style="font-size:36px; margin-bottom:12px; display:inline-block;"></i>
        <p style="color:var(--text-secondary)">ยังไม่มีนักเรียนร่วมสอบในรายวิชานี้ จึงยังไม่มีสถิติรายงานขึ้น</p>
      </div>
    `;
    return;
  }

  // 1. คำนวณช่วงสถิติคะแนนเบื้องต้น
  let sumScore = 0;
  let maxScore = 0;
  let passCount = 0;
  let cheatCountTotal = 0;

  attempts.forEach(a => {
    sumScore += a.score;
    if (a.score > maxScore) maxScore = a.score;

    // คิดสอบผ่านที่ 50% ขึ้นไป
    const percent = (a.score / a.totalPoints) * 100;
    if (percent >= 50) passCount++;

    cheatCountTotal += a.exitCount;
  });

  const avgScore = (sumScore / attempts.length).toFixed(1);
  const passRate = ((passCount / attempts.length) * 100).toFixed(0);

  // 2. คำนวณช่วงคะแนนเพื่อนำมาจัดทำ Bar Chart (แบ่ง 4 ช่วงความถี่: 0-25%, 26-50%, 51-75%, 76-100%)
  let range1 = 0, range2 = 0, range3 = 0, range4 = 0;
  attempts.forEach(a => {
    const p = (a.score / a.totalPoints) * 100;
    if (p <= 25) range1++;
    else if (p <= 50) range2++;
    else if (p <= 75) range3++;
    else range4++;
  });

  const maxRangeCount = Math.max(range1, range2, range3, range4, 1);

  // ชาร์ทกราฟแท่ง SVG แบบยืดหยุ่นสูงระดับพรีเมียม
  const barChartSvg = `
    <svg viewBox="0 0 400 200" width="100%" height="180px">
      <!-- แกนแนวตั้งและแนวนอน -->
      <line x1="40" y1="10" x2="40" y2="170" stroke="var(--text-muted)" stroke-width="1.5" />
      <line x1="40" y1="170" x2="380" y2="170" stroke="var(--text-muted)" stroke-width="1.5" />
      
      <!-- เส้นบอกแนว -->
      <line x1="40" y1="90" x2="380" y2="90" stroke="var(--border-glass)" stroke-width="1" stroke-dasharray="4,4" />
      <line x1="40" y1="10" x2="380" y2="10" stroke="var(--border-glass)" stroke-width="1" stroke-dasharray="4,4" />
      
      <!-- แท่งความถี่ที่ 1 (0-25%) -->
      <rect class="bar-chart-rect" x="65" y="${170 - (range1 / maxRangeCount) * 150}" width="50" height="${(range1 / maxRangeCount) * 150}" fill="var(--danger)" rx="4"/>
      <text x="90" y="185" fill="var(--text-secondary)" font-size="10" text-anchor="middle">0-25%</text>
      <text x="90" y="${165 - (range1 / maxRangeCount) * 150}" fill="var(--text-primary)" font-size="11" font-weight="bold" text-anchor="middle">${range1} คน</text>

      <!-- แท่งความถี่ที่ 2 (26-50%) -->
      <rect class="bar-chart-rect" x="145" y="${170 - (range2 / maxRangeCount) * 150}" width="50" height="${(range2 / maxRangeCount) * 150}" fill="var(--warning)" rx="4"/>
      <text x="170" y="185" fill="var(--text-secondary)" font-size="10" text-anchor="middle">26-50%</text>
      <text x="170" y="${165 - (range2 / maxRangeCount) * 150}" fill="var(--text-primary)" font-size="11" font-weight="bold" text-anchor="middle">${range2} คน</text>

      <!-- แท่งความถี่ที่ 3 (51-75%) -->
      <rect class="bar-chart-rect" x="225" y="${170 - (range3 / maxRangeCount) * 150}" width="50" height="${(range3 / maxRangeCount) * 150}" fill="var(--primary)" rx="4"/>
      <text x="250" y="185" fill="var(--text-secondary)" font-size="10" text-anchor="middle">51-75%</text>
      <text x="250" y="${165 - (range3 / maxRangeCount) * 150}" fill="var(--text-primary)" font-size="11" font-weight="bold" text-anchor="middle">${range3} คน</text>

      <!-- แท่งความถี่ที่ 4 (76-100%) -->
      <rect class="bar-chart-rect" x="305" y="${170 - (range4 / maxRangeCount) * 150}" width="50" height="${(range4 / maxRangeCount) * 150}" fill="var(--success)" rx="4"/>
      <text x="330" y="185" fill="var(--text-secondary)" font-size="10" text-anchor="middle">76-100%</text>
      <text x="330" y="${165 - (range4 / maxRangeCount) * 150}" fill="var(--text-primary)" font-size="11" font-weight="bold" text-anchor="middle">${range4} คน</text>
    </svg>
  `;

  // 3. กราฟวงกลม SVG เปอร์เซ็นต์สอบผ่าน/ไม่ผ่าน (Pie Chart)
  // สูตร Dasharray: 2 * PI * r = 2 * 3.1415 * 50 = 314
  const strokePass = (passPercentVal) => (passPercentVal / 100) * 314;
  const pieChartSvg = `
    <svg viewBox="0 0 160 160" width="140px" height="140px">
      <!-- พื้นวงกลมสีแดง (ไม่ผ่าน) -->
      <circle cx="80" cy="80" r="50" fill="none" stroke="var(--danger)" stroke-width="20" />
      
      <!-- วงกลมทับส่วนสีเขียว (ผ่าน) -->
      <circle class="pie-segment" cx="80" cy="80" r="50" fill="none" stroke="var(--success)" stroke-width="20" 
              stroke-dasharray="${strokePass(passRate)} 314" stroke-dashoffset="0" transform="rotate(-90 80 80)"/>
      
      <!-- เปอร์เซ็นต์ตรงกลาง -->
      <text x="80" y="85" fill="var(--text-primary)" font-size="16" font-weight="bold" text-anchor="middle">${passRate}%</text>
      <text x="80" y="100" fill="var(--text-muted)" font-size="8" text-anchor="middle">อัตราการผ่าน</text>
    </svg>
  `;

  panel.innerHTML = `
    <!-- สถิติยอดสรุป -->
    <div class="dashboard-grid" style="margin-bottom:24px;">
      <div class="stat-card glass-panel">
        <div class="stat-info">
          <h3>ค่าคะแนนเฉลี่ยกลุ่ม</h3>
          <p>${avgScore} คะแนน</p>
        </div>
        <div class="stat-icon primary"><i class="lucide-icon" data-lucide="calculator"></i></div>
      </div>
      <div class="stat-card glass-panel">
        <div class="stat-info">
          <h3>อัตราสอบผ่านห้อง</h3>
          <p>${passRate}%</p>
        </div>
        <div class="stat-icon success"><i class="lucide-icon" data-lucide="check-circle-2"></i></div>
      </div>
      <div class="stat-card glass-panel">
        <div class="stat-info">
          <h3>คะแนนสูงสุดที่พบ</h3>
          <p>${maxScore} คะแนน</p>
        </div>
        <div class="stat-icon warning"><i class="lucide-icon" data-lucide="crown"></i></div>
      </div>
      <div class="stat-card glass-panel">
        <div class="stat-info">
          <h3>หลุดนอกหน้าจอรวม</h3>
          <p>${cheatCountTotal} ครั้ง</p>
        </div>
        <div class="stat-icon danger"><i class="lucide-icon" data-lucide="shield-alert"></i></div>
      </div>
    </div>

    <!-- ชาร์ตกราฟสรุป -->
    <div class="chart-grid">
      <div class="glass-panel" style="padding:24px; text-align:center;">
        <h4 style="font-size:14px; font-weight:600; margin-bottom:16px;">กราฟแท่งแจกแจงความถี่ย่านคะแนน</h4>
        <div class="svg-chart-container">
          ${barChartSvg}
        </div>
      </div>
      <div class="glass-panel" style="padding:24px; text-align:center;">
        <h4 style="font-size:14px; font-weight:600; margin-bottom:16px;">เปอร์เซ็นต์นักเรียนสอบผ่านเกณฑ์ (50%)</h4>
        <div class="svg-chart-container">
          ${pieChartSvg}
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-color" style="background-color: var(--success);"></span>
              <span>สอบผ่าน (${passRate}%)</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: var(--danger);"></span>
              <span>สอบตก (${100 - passRate}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- รายชื่อผลลัพธ์ของกลุ่มเรียน -->
    <div class="card-section" style="margin-top:32px;">
      <div class="card-section-header">
        <h3>ผลลัพธ์การสอบรายบุคคล (${subject.name})</h3>
      </div>
      <div class="data-table-container glass-panel">
        <table class="data-table">
          <thead>
            <tr>
              <th>ชื่อนักเรียน</th>
              <th>สอบชุดคำถาม</th>
              <th>เวลาทำสอบ</th>
              <th>ความประพฤติสลับจอ</th>
              <th>คะแนนสอบ</th>
              <th>สถานะประเมิน</th>
            </tr>
          </thead>
          <tbody>
            ${attempts.map(att => {
    const min = Math.floor(att.timeSpent / 60);
    const sec = att.timeSpent % 60;
    const percent = (att.score / att.totalPoints) * 100;
    return `
                <tr>
                  <td><strong>${att.studentName}</strong></td>
                  <td>${att.examTitle}</td>
                  <td>${min} น. ${sec} วิ.</td>
                  <td style="color: ${att.exitCount > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:600;">
                    ${att.exitCount > 0 ? `หลุดนอกจอ ${att.exitCount} ครั้ง` : 'ปกติ'}
                  </td>
                  <td><strong>${att.score}</strong> / ${att.totalPoints} คะแนน</td>
                  <td>
                    <span class="status-badge ${percent >= 50 ? 'status-pass' : 'status-fail'}">
                      ${percent >= 50 ? 'สอบผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}
                    </span>
                  </td>
                </tr>
              `;
  }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  refreshIcons(container);
}

async function downloadGradebookCSV(subjectId) {
  const attempts = (await window.db.getAttempts()).filter(a => a.subjectId === subjectId);
  if (attempts.length === 0) {
    alert('ไม่มีข้อมูลผลการเรียนที่สามารถนำออกเป็นไฟล์ CSV ได้ในรายวิชานี้');
    return;
  }

  const subject = await window.db.getSubject(subjectId);

  let csvContent = "\ufeff"; // BOM สำหรับอ่านอักษรไทย Excel ได้
  csvContent += "รหัสนักเรียน,ชื่อนักเรียน,ชุดข้อสอบ,วันที่ส่งกระดาษ,เวลาที่ใช้สอบ (วินาที),ออกนอกหน้าจอ (ครั้ง),สถานะการโกง,คะแนนรวม,คะแนนเต็ม\n";

  attempts.forEach(a => {
    csvContent += `"${a.studentId}","${a.studentName}","${a.examTitle}","${new Date(a.submittedAt).toISOString()}","${a.timeSpent}","${a.exitCount}","${a.status}","${a.score}","${a.totalPoints}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `gradebook_${subject.id}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// -------------------------------------------------------------
// 14. ผู้ดูแลระบบ - จัดการผู้ใช้ทั้งหมดในระบบ (Admin User CRUD)
// -------------------------------------------------------------
async function renderAdminUsers(container) {
  const users = await window.db.getUsers();

  container.innerHTML = `
    <div class="view-title-container">
      <h2>จัดการรายชื่อผู้ใช้เข้าระบบทั้งหมด </h2>
      <button class="btn btn-primary" id="admin-create-user-btn">
        <i class="lucide-icon" data-lucide="plus-circle"></i>
        <span>สร้างผู้ใช้งานระบบใหม่</span>
      </button>
    </div>

    <div class="glass-panel" style="padding:16px; margin-bottom:20px; display:flex; gap:16px;">
      <input type="text" id="admin-user-search-input" class="form-control" placeholder="ค้นหาด้วย ชื่อผู้ใช้ หรือ ชื่อจริง..." style="max-width:320px;">
    </div>

    <div class="data-table-container glass-panel">
      <table class="data-table" id="admin-users-table">
        <thead>
          <tr>
            <th>ชื่อผู้ใช้ (Username)</th>
            <th>ชื่อ-นามสกุลจริง</th>
            <th>บทบาท</th>
            <th>สถานะการใช้</th>
            <th>การตั้งค่าจัดการ</th>
          </tr>
        </thead>
        <tbody id="admin-users-table-body">
          <!-- จะเติมตารางจาก JS -->
        </tbody>
      </table>
    </div>
  `;

  renderAdminUsersTable('');

  // ค้นหาแบบเรียลไทม์
  const search = document.getElementById('admin-user-search-input');
  search.addEventListener('input', () => {
    renderAdminUsersTable(search.value.trim().toLowerCase());
  });

  // สร้างผู้ใช้รายใหม่
  document.getElementById('admin-create-user-btn').addEventListener('click', openAdminCreateUserModal);
}

async function renderAdminUsersTable(filterText) {
  const body = document.getElementById('admin-users-table-body');
  const users = await window.db.getUsers();

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(filterText) ||
    u.name.toLowerCase().includes(filterText)
  );

  let html = '';
  filtered.forEach(u => {
    html += `
      <tr>
        <td><strong>${u.username}</strong></td>
        <td>${u.name}</td>
        <td>
          <span class="badge-role role-${u.role}">
            ${u.role === 'admin' ? 'แอดมิน' : (u.role === 'teacher' ? 'ครู' : 'นักเรียน')}
          </span>
        </td>
        <td>
          <span class="status-badge ${u.active ? 'status-pass' : 'status-fail'}">
            ${u.active ? 'เปิดใช้งาน' : 'ระงับชั่วคราว'}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary" onclick="openAdminEditUserModal('${u.id}')" style="padding:6px 12px; font-size:11.5px;">แก้ไข</button>
            <button class="btn btn-warning" onclick="toggleUserStatus('${u.id}', ${u.active})" style="padding:6px 12px; font-size:11.5px;">${u.active ? 'ระงับ' : 'เปิด'}</button>
            ${u.username === 'admin' ? '' : `<button class="btn btn-danger" onclick="deleteUserByAdmin('${u.id}', '${u.username}')" style="padding:6px; font-size:11.5px;"><i class="lucide-icon" data-lucide="trash-2" style="width:12px; height:12px;"></i></button>`}
          </div>
        </td>
      </tr>
    `;
  });

  body.innerHTML = html;
  refreshIcons(body);
}

window.toggleUserStatus = async function (userId, currentStatus) {
  await window.db.updateUser(userId, { active: !currentStatus });
  renderAdminUsersTable(document.getElementById('admin-user-search-input').value.trim().toLowerCase());
};

window.deleteUserByAdmin = async function (userId, username) {
  if (confirm(`คุณแน่ใจว่าต้องการลบบัญชีผู้ใช้ "${username}" ใช่หรือไม่?\nข้อมูลการเรียน คอร์ส และผลการสอบทั้งหมดของนักเรียนจะหายไปด้วย!`)) {
    await window.db.deleteUser(userId);
    await window.db.addLog(currentUser.id, currentUser.name, currentUser.role, 'ลบผู้ใช้', `แอดมินลบบัญชีผู้ใช้ "${username}" (${userId})`);
    renderAdminUsers(document.getElementById('main-content-view'));
  }
};

function openAdminCreateUserModal() {
  openModal('สร้างบัญชีระบบผู้ใช้ใหม่', `
    <form id="admin-create-user-form" novalidate>
      <div class="form-group">
        <label for="adm-c-role" class="form-label">เลือกบทบาท</label>
        <select id="adm-c-role" class="form-control">
          <option value="student">นักเรียน (Student)</option>
          <option value="teacher">ครูผู้สอน (Teacher)</option>
          <option value="admin">ผู้ดูแลระบบสูงสุด (Admin)</option>
        </select>
      </div>
      <div class="form-group">
        <label for="adm-c-name" class="form-label">ชื่อ-นามสกุลจริง</label>
        <input type="text" id="adm-c-name" class="form-control" placeholder="เช่น ดร.นิเทศ ขยันเรียน" required>
      </div>
      <div class="form-group">
        <label for="adm-c-username" class="form-label">ชื่อล็อกอิน (Username)</label>
        <input type="text" id="adm-c-username" class="form-control" placeholder="ชื่อไอดีล็อกอินภาษาอังกฤษ" required>
      </div>
      <div class="form-group">
        <label for="adm-c-password" class="form-label">รหัสผ่านเริ่มต้น (Password)</label>
        <input type="text" id="adm-c-password" class="form-control" value="password" required>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">สร้างบัญชีผู้ใช้</button>
      </div>
    </form>
  `);

  const form = document.getElementById('admin-create-user-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = document.getElementById('adm-c-role').value;
    const name = document.getElementById('adm-c-name').value.trim();
    const username = document.getElementById('adm-c-username').value.trim();
    const password = document.getElementById('adm-c-password').value;

    if (!name || !username || !password) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง');
      return;
    }

    // เช็ค ID ซ้ำ
    const users = await window.db.getUsers();
    const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      alert('ชื่อ Username นี้ถูกใช้งานแล้ว โปรดเลือกตัวตนไอดีใหม่');
      return;
    }

    await window.db.addUser({
      username,
      password,
      name,
      role
    });

    await window.db.addLog(currentUser.id, currentUser.name, currentUser.role, 'แอดมินสร้างผู้ใช้', `สร้างไอดีล็อกอิน "${username}" บทบาท ${role}`);
    alert(`สร้างบัญชีระบบของ "${name}" สำเร็จพร้อมใช้งาน!`);
    closeModal();
    renderAdminUsers(document.getElementById('main-content-view'));
  });
}

window.openAdminEditUserModal = async function (userId) {
  const u = await window.db.getUser(userId);
  if (!u) return;

  openModal('แก้ไขรายละเอียดบัญชีผู้ใช้งาน', `
    <form id="admin-edit-user-form" novalidate>
      <div class="form-group">
        <label for="adm-e-name" class="form-label">ชื่อ-นามสกุลจริง</label>
        <input type="text" id="adm-e-name" class="form-control" value="${escapeHtml(u.name)}" required>
      </div>
      <div class="form-group">
        <label for="adm-e-username" class="form-label">ชื่อผู้ใช้งานล็อกอิน (ไม่รองรับการแก้ไขโดยตรง)</label>
        <input type="text" id="adm-e-username" class="form-control" value="${escapeHtml(u.username)}" readonly style="opacity:0.6;">
      </div>
      <div class="form-group">
        <label for="adm-e-password" class="form-label">เปลี่ยนรหัสผ่านผู้ใช้</label>
        <input type="text" id="adm-e-password" class="form-control" value="${escapeHtml(u.password)}" required>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">บันทึกข้อมูลแก้ไข</button>
      </div>
    </form>
  `);

  const form = document.getElementById('admin-edit-user-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('adm-e-name').value.trim();
    const password = document.getElementById('adm-e-password').value;

    if (!name || !password) {
      alert('ข้อมูลจำยอมกรอกให้ครบครัน');
      return;
    }

    await window.db.updateUser(userId, { name, password });
    await window.db.addLog(currentUser.id, currentUser.name, currentUser.role, 'แก้ไขข้อมูลผู้ใช้', `แอดมินแก้ไขข้อมูลของ "${u.username}"`);

    alert('บันทึกการแก้ไขข้อมูลผู้เรียนเสร็จสิ้น!');
    closeModal();
    renderAdminUsers(document.getElementById('main-content-view'));
  });
};

// -------------------------------------------------------------
// 15. ผู้ดูแลระบบ - จัดการวิชาเรียนทั้งหมดในระบบ (Admin Subject Controls)
// -------------------------------------------------------------
async function renderAdminSubjects(container) {
  const [subjects, enrollments, exams] = await Promise.all([
    window.db.getSubjects(),
    window.db.getEnrollments(),
    window.db.getExams()
  ]);
  const teachers = await window.db.getUsersByIds([...new Set(subjects.map(s => s.teacherId).filter(Boolean))]);
  const teacherMap = new Map(teachers.map(t => [t.id, t]));

  let rowsHtml = '';
  for (const s of subjects) {
    const teacher = teacherMap.get(s.teacherId);
    const stdCount = enrollments.filter(e => e.subjectId === s.id).length;
    const exCount = exams.filter(e => e.subjectId === s.id).length;
    rowsHtml += `
      <tr>
        <td><strong>${s.id}</strong></td>
        <td>${s.name}</td>
        <td>${teacher ? teacher.name : 'ไม่มีอาจารย์คุม'}</td>
        <td><strong>${stdCount}</strong> คน</td>
        <td><strong>${exCount}</strong> ชุด</td>
        <td>
          <button class="btn btn-danger" onclick="deleteSubjectByAdmin('${s.id}', '${escapeHtml(s.name)}')" style="padding:6px 12px; font-size:12px;">
            <i class="lucide-icon" data-lucide="trash-2" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>ลบกลุ่มวิชา
          </button>
        </td>
      </tr>
    `;
  }

  container.innerHTML = `
    <div class="view-title-container">
      <h2>จัดการรายวิชาสอบทั้งหมดขององค์กร </h2>
    </div>

    <div class="data-table-container glass-panel">
      <table class="data-table">
        <thead>
          <tr>
            <th>รหัสรายวิชา</th>
            <th>ชื่อกลุ่มรายวิชา</th>
            <th>ผู้สอนผู้จัดโครงสร้าง</th>
            <th>ยอดนักเรียนลงเรียน</th>
            <th>ชุดข้อสอบที่มี</th>
            <th>การกระทำ</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
  refreshIcons(container);
}

window.deleteSubjectByAdmin = async function (subjectId, subjectName) {
  if (confirm(`ผู้ดูแลระบบต้องการลบวิชา "${subjectName}" ใช่หรือไม่?\nการลบจะล้างข้อมูลวิชา ข้อสอบ และคะแนนของนร. ออกทั้งหมดและไม่สามารถกู้คืนได้!`)) {
    await window.db.deleteSubject(subjectId);
    await window.db.addLog(currentUser.id, currentUser.name, currentUser.role, 'ลบวิชาโดยแอดมิน', `แอดมินลบรายวิชา "${subjectName}" (${subjectId})`);
    alert('ลบรายวิชาสำเร็จ');
    renderAdminSubjects(document.getElementById('main-content-view'));
  }
};

// -------------------------------------------------------------
// 16. ผู้ดูแลระบบ - ล็อกความประพฤติระบบและประวัติการสอบ (System logs / Audit Trail)
// -------------------------------------------------------------
async function renderAdminLogs(container) {
  const logs = await window.db.getLogs();

  container.innerHTML = `
    <div class="view-title-container">
      <h2>บันทึกระบบและความประพฤติผู้ใช้ (Audit Logs) </h2>
    </div>

    <div class="data-table-container glass-panel">
      <table class="data-table">
        <thead>
          <tr>
            <th>วัน-เวลาเกิดเหตุ</th>
            <th>ผู้สร้างประวัติ</th>
            <th>การกระทำหลัก</th>
            <th>คำอธิบายรายละเอียดเพิ่มเติม</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(l => {
    return `
              <tr>
                <td><small>${new Date(l.timestamp).toLocaleString('th-TH')}</small></td>
                <td>
                  <strong>${l.userName}</strong>
                  <div style="font-size:11px;" class="badge-role role-${l.role}">${l.role}</div>
                </td>
                <td><strong style="color:var(--primary);">${l.action}</strong></td>
                <td><span class="log-row-details">${l.details}</span></td>
              </tr>
            `;
  }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// -------------------------------------------------------------
// 17. ผู้ดูแลระบบ - สำรองและนำเข้ากู้ข้อมูลระบบ (Backup & Restore System)
// -------------------------------------------------------------
async function renderAdminBackup(container) {
  container.innerHTML = `
    <div class="view-title-container">
      <h2>ระบบสำรองและนำเข้ากู้ข้อมูลจำลอง (Backup & Restore) </h2>
    </div>

    <div class="dashboard-grid">
      <!-- ส่วนส่งออกข้อมูลสำรอง -->
      <div class="glass-panel" style="padding:32px;">
        <div style="font-size:32px; color:var(--primary); margin-bottom:16px;">
          <i class="lucide-icon" data-lucide="download-cloud"></i>
        </div>
        <h3 style="font-size:18px; font-weight:600; margin-bottom:12px;">ส่งออกข้อมูลสำรอง (Backup)</h3>
        <p style="color:var(--text-secondary); font-size:13.5px; line-height:1.6; margin-bottom:24px;">
          คลิกดาวน์โหลดข้อมูลทั้งหมดของเซิร์ฟเวอร์จำลองออกเป็นไฟล์สกุล <strong>.json</strong> 
          ประกอบด้วยประวัติผู้ใช้ทั้งหมด ข้อมูลสอบ รหัสรายวิชา สถิติคะแนน และล็อกความประพฤติกิจกรรม
        </p>
        <button class="btn btn-primary" id="backup-download-btn" style="width:100%;">
          <i class="lucide-icon" data-lucide="download"></i> ดาวน์โหลดไฟล์สำรองข้อมูล JSON
        </button>
      </div>

      <!-- ส่วนกู้คืนข้อมูลสำรอง -->
      <div class="glass-panel" style="padding:32px;">
        <div style="font-size:32px; color:var(--warning); margin-bottom:16px;">
          <i class="lucide-icon" data-lucide="upload-cloud"></i>
        </div>
        <h3 style="font-size:18px; font-weight:600; margin-bottom:12px;">นำเข้ากู้คืนระบบ (Restore)</h3>
        <p style="color:var(--text-secondary); font-size:13.5px; line-height:1.6; margin-bottom:24px;">
          อัปโหลดไฟล์สำรองข้อมูลสกุล <strong>.json</strong> ที่เคยดาวน์โหลดสำรองไว้ 
          การเขียนนำเข้าจะ <strong>ทำการเขียนข้อมูลทับข้อมูลเซสชันปัจจุบันทั้งหมดทันที</strong> โปรดตรวจสอบความถูกต้องของโครงสร้างไฟล์
        </p>
        <div class="form-group" style="margin-bottom:16px;">
          <input type="file" id="backup-upload-input" class="form-control" accept=".json" style="padding:8px 12px;">
        </div>
        <button class="btn btn-warning" id="backup-restore-btn" style="width:100%;">
          <i class="lucide-icon" data-lucide="refresh-cw"></i> ตรวจสอบและดำเนินการกู้คืนระบบ
        </button>
      </div>
    </div>
  `;

  // บัญญัติการดาวน์โหลด
  document.getElementById('backup-download-btn').addEventListener('click', async () => {
    const data = await window.db.exportBackup();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `exam_system_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // บัญญัติการกู้คืน
  document.getElementById('backup-restore-btn').addEventListener('click', () => {
    const fileInput = document.getElementById('backup-upload-input');
    if (fileInput.files.length === 0) {
      alert('กรุณาเลือกไฟล์สำรองข้อมูลสกุล JSON (.json) ก่อนคลิกดำเนินการกู้คืน');
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      const content = e.target.result;
      const success = await window.db.importBackup(content);
      if (success) {
        await window.db.addLog(currentUser.id, currentUser.name, currentUser.role, 'กู้คืนระบบ', 'นำเข้าและกู้คืนไฟล์ Database JSON ประสบความสำเร็จ');
        alert('การนำเข้ากู้ข้อมูลเสร็จสมบูรณ์เรียบร้อย! ระบบจะทำการรีโหลดสิทธิ์และการจำลองใหม่');
        showAppShell();
      } else {
        alert('รูปแบบไฟล์ JSON ที่อัปโหลดไม่ถูกต้อง กรุณาอัปโหลดไฟล์สำรองข้อมูลระบบสอบออนไลน์ที่สมบูรณ์เท่านั้น');
      }
    };
    reader.readAsText(file);
  });
}

// -------------------------------------------------------------
// 18. ระบบสอบและการป้องกันการทุจริตแบบเรียลไทม์ (Exam Engine)
// -------------------------------------------------------------
window.initiateExam = async function (examId) {
  const exam = await window.db.getExam(examId);
  if (!exam) return;

  if (confirm(`คุณต้องการเริ่มทำข้อสอบออนไลน์ในชุด "${exam.title}" หรือไม่?\n\n** ข้อบังคับและระเบียบความปลอดภัย **\n1. ระบบจะบังคับล็อคหน้าจอของท่านให้อยู่ในโหมดเต็มหน้าจอ (Fullscreen)\n2. ห้ามสลับแท็บ ย่อบราวเซอร์ หรือเปิดแอปฯ อื่นโดยเด็ดขาด\n3. อนุญาตให้ออกนอกหน้าจอได้ไม่เกิน 2 ครั้ง ครั้งที่ 3 ระบบจะทำการระงับและส่งกระดาษคำตอบทันที!`)) {
    // เซ็ตสถานะการสอบ
    activeExam = exam;

    // รีเซ็ตตัวแปรเซสชันทำข้อสอบ
    examSession = {
      answers: {},
      secondsLeft: exam.timeLimit * 60,
      cheatCount: 0,
      cheatingLogs: [],
      currentQuestionIndex: 0,
      timerInterval: null
    };

    // เข้าควบคุม UI สลับบอดี้
    document.getElementById('app-shell').style.display = 'none';
    document.getElementById('exam-taking-container').style.display = 'flex';
    document.getElementById('app-body').classList.add('in-exam');

    // โหลดรายละเอียดหัวข้อบาร์
    document.getElementById('exam-title-display').innerText = exam.title;
    document.getElementById('exam-desc-display').innerText = exam.description;
    document.getElementById('exam-student-name').innerText = currentUser.name;
    document.getElementById('exam-total-questions').innerText = exam.questions.length;
    document.getElementById('exam-cheat-count').innerText = '0';

    // บังคับขอโหมดเต็มหน้าจอ (Fullscreen)
    enterFullscreenMode();

    // เริ่มระบบตั้งนาฬิกาถอยหลังและตรวจจับทุจริต
    startExamTimer();

    // หน่วงเวลาเล็กน้อยให้เบราว์เซอร์เข้าสู่โหมด Fullscreen ให้เสร็จก่อน 
    // เพื่อป้องกันบั๊กที่ทำให้ระบบมองว่าสลับจอตอนเข้าครั้งแรก
    setTimeout(() => {
      if (activeExam) {
        enableAntiCheatDetectors();
      }
    }, 1500);

    // โหลดข้อคำถามแรกและวาดปุ่มข้าง
    renderExamQuestion(0);
    renderExamQuestionsNavigationGrid();
  }
};

function enterFullscreenMode() {
  try {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen();
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) {
      docEl.msRequestFullscreen();
    }
  } catch (err) {
    console.warn("บราวเซอร์ไม่รองรับ API บังคับ Fullscreen อัตโนมัติ:", err);
  }
}

function startExamTimer() {
  const timerNums = document.getElementById('timer-nums');
  const timerWidget = document.getElementById('exam-timer-display');

  // ล้างลูปเก่าถ้าตกค้าง
  if (examSession.timerInterval) clearInterval(examSession.timerInterval);

  const updateTimerString = () => {
    if (examSession.secondsLeft <= 0) {
      clearInterval(examSession.timerInterval);
      alert('หมดเวลาสอบแล้ว! ระบบจะทำการส่งกระดาษคำตอบของคุณโดยอัตโนมัติ');
      submitExamSheetDirectly('completed');
      return;
    }

    examSession.secondsLeft--;

    // ตั้งค่าเตือนกระพริบหากเวลาเหลือน้อยกว่า 1 นาที (60 วินาที)
    if (examSession.secondsLeft < 60) {
      timerWidget.classList.add('timer-low');
    } else {
      timerWidget.classList.remove('timer-low');
    }

    const hr = Math.floor(examSession.secondsLeft / 3600);
    const min = Math.floor((examSession.secondsLeft % 3600) / 60);
    const sec = examSession.secondsLeft % 60;

    const pad = (n) => n.toString().padStart(2, '0');
    timerNums.innerText = `${pad(hr)}:${pad(min)}:${pad(sec)}`;
  };

  updateTimerString();
  examSession.timerInterval = setInterval(updateTimerString, 1000);
}

async function renderExamQuestionsNavigationGrid() {
  const grid = document.getElementById('questions-navigation-grid');
  let html = '';

  activeExam.questions.forEach((q, idx) => {
    const isAnswered = examSession.answers[q.id] !== undefined && examSession.answers[q.id] !== '';
    let btnClass = 'question-nav-btn';

    if (idx === examSession.currentQuestionIndex) btnClass += ' active';
    else if (isAnswered) btnClass += ' answered';

    html += `<button type="button" class="${btnClass}" onclick="renderExamQuestion(${idx})">${idx + 1}</button>`;
  });

  grid.innerHTML = html;
}

async function renderExamQuestion(index) {
  examSession.currentQuestionIndex = index;

  // นำทางปุ่มวิทยานิพนธ์ข้างล่างซิงค์
  document.getElementById('exam-current-index-num').innerText = index + 1;
  document.getElementById('exam-total-index-num').innerText = activeExam.questions.length;

  const q = activeExam.questions[index];
  const box = document.getElementById('current-question-box');

  const savedAns = examSession.answers[q.id] || '';
  const isChoice = q.type === 'choice';

  let qBodyHtml = `
    <div class="question-title">ข้อที่ ${index + 1}: ${escapeHtml(q.text)}</div>
  `;

  if (isChoice) {
    qBodyHtml += `<div class="exam-choices-list">`;
    q.options.forEach((opt, oIdx) => {
      const isSelected = savedAns === oIdx.toString();
      qBodyHtml += `
        <label class="exam-choice-option ${isSelected ? 'selected' : ''}" data-index="${oIdx}">
          <input type="radio" name="exam_q_radio" value="${oIdx}" ${isSelected ? 'checked' : ''} onclick="saveStudentAnswerMemory('${q.id}', '${oIdx}')">
          <span class="exam-choice-label">ตัวเลือกที่ ${oIdx + 1}: &nbsp; ${escapeHtml(opt)}</span>
        </label>
      `;
    });
    qBodyHtml += `</div>`;
  } else {
    qBodyHtml += `
      <div class="form-group">
        <label class="form-label">เขียนคำอธิบายคำตอบของคุณลงในกล่องข้อความด้านล่าง:</label>
        <textarea class="subjective-textarea" placeholder="พิมพ์อธิบายแนวข้อสอบ คำตอบ..." id="exam-subj-textarea" oninput="saveStudentAnswerMemory('${q.id}', this.value)">${escapeHtml(savedAns)}</textarea>
      </div>
    `;
  }

  box.innerHTML = qBodyHtml;

  // ควบคุมปุ่ม ก่อนหน้า / ถัดไป
  document.getElementById('exam-prev-btn').disabled = index === 0;

  const nextBtn = document.getElementById('exam-next-btn');
  if (index === activeExam.questions.length - 1) {
    nextBtn.innerHTML = `<span>ส่งกระดาษคำตอบ</span> <i class="lucide-icon" data-lucide="send"></i>`;
  } else {
    nextBtn.innerHTML = `<span>ข้อถัดไป</span> <i class="lucide-icon" data-lucide="chevron-right"></i>`;
  }

  refreshIcons(document.getElementById('current-question-box'));

  // ซิงค์สเกลข้างปุ่ม
  renderExamQuestionsNavigationGrid();
}

window.saveStudentAnswerMemory = function (questionId, value) {
  examSession.answers[questionId] = value;

  // ไฮไลต์กรอบในกรณีข้อช้อยส์เพื่อ UX พรีเมียม
  const options = document.querySelectorAll('.exam-choice-option');
  options.forEach(opt => {
    if (opt.getAttribute('data-index') === value) {
      opt.classList.add('selected');
    } else {
      opt.classList.remove('selected');
    }
  });

  // ซิงค์การระบายเลขนำทาง
  renderExamQuestionsNavigationGrid();
};

function bindExamEvents() {
  // ปุ่มก่อนหน้า
  document.getElementById('exam-prev-btn').addEventListener('click', () => {
    if (examSession.currentQuestionIndex > 0) {
      renderExamQuestion(examSession.currentQuestionIndex - 1);
    }
  });

  // ปุ่มถัดไป/ส่งข้อสอบ
  document.getElementById('exam-next-btn').addEventListener('click', () => {
    if (examSession.currentQuestionIndex < activeExam.questions.length - 1) {
      renderExamQuestion(examSession.currentQuestionIndex + 1);
    } else {
      confirmAndSubmitExam();
    }
  });

  // ปุ่มแถบส่งคำตอบหลักที่ Sidebar
  document.getElementById('exam-submit-trigger').addEventListener('click', confirmAndSubmitExam);

  // ปุ่มยอมรับโหมดเตือน
  document.getElementById('resume-exam-btn').addEventListener('click', () => {
    document.getElementById('anti-cheat-warning-overlay').style.display = 'none';
    enterFullscreenMode();

    // หน่วงเวลาก่อนเริ่มจับทุจริตใหม่หลังกลับสู่ Fullscreen
    setTimeout(() => {
      if (activeExam) enableAntiCheatDetectors();
    }, 1500);
  });

  // ปุ่มกดยืนยันการทุจริตออกห้อง
  document.getElementById('exit-cheated-exam-btn').addEventListener('click', async () => {
    document.getElementById('anti-cheat-terminated-overlay').style.display = 'none';
    cleanupExamSession();
    await switchView('dashboard');
  });
}

function confirmAndSubmitExam() {
  // นับจำนวนข้อยังไม่ได้ทำ
  let unanswered = 0;
  activeExam.questions.forEach(q => {
    if (examSession.answers[q.id] === undefined || examSession.answers[q.id] === '') {
      unanswered++;
    }
  });

  let msg = 'คุณแน่ใจว่าต้องการส่งกระดาษคำตอบของคุณตอนนี้ใช่หรือไม่?';
  if (unanswered > 0) {
    msg = `คุณมีข้อสอบที่ยังไม่ตอบอีกจำนวน ${unanswered} ข้อ!\nยืนยันจะส่งกระดาษคำตอบของคุณอยู่ใช่หรือไม่?`;
  }

  if (confirm(msg)) {
    submitExamSheetDirectly('completed');
  }
}

async function submitExamSheetDirectly(status) {
  // ปิดตัวนับและฟังก์ชันการตรวจ
  clearInterval(examSession.timerInterval);
  disableAntiCheatDetectors();

  let finalScore = 0;
  let totalPoints = 0;

  // คลี่คำนวณคะแนนเบื้องต้น (เฉพาะปรนัย)
  activeExam.questions.forEach(q => {
    totalPoints += q.points;
    const ans = examSession.answers[q.id];

    if (q.type === 'choice') {
      if (parseInt(ans) === q.correctAnswer) {
        finalScore += q.points;
      }
    }
  });

  // หาเวลาที่ใช้ไปทั้งหมด
  const timeLimitSeconds = activeExam.timeLimit * 60;
  const timeSpent = timeLimitSeconds - examSession.secondsLeft;

  // ส่งบันทึกคะแนนเข้า DB
  await window.db.addAttempt({
    studentId: currentUser.id,
    studentName: currentUser.name,
    examId: activeExam.id,
    examTitle: activeExam.title,
    subjectId: activeExam.subjectId,
    answers: examSession.answers,
    score: finalScore,
    totalPoints,
    status, // completed หรือ cheated
    exitCount: examSession.cheatCount,
    cheatingLogs: examSession.cheatingLogs,
    timeSpent: timeSpent > 0 ? timeSpent : 1
  });

  // ล้างการสกรีนคุม
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => { });
  }

  cleanupExamSession();

  if (status === 'cheated') {
    // โชว์หน้าโดนทุจริตบอยคอต
    document.getElementById('anti-cheat-terminated-overlay').style.display = 'flex';
  } else {
    alert(`ส่งข้อสอบวิชา "${activeExam.title}" เรียบร้อยแล้ว!\nระบบทำการคำนวณคะแนนปรนัยของท่านอัตโนมัติแล้ว`);
    await switchView('student_exams');
  }
}

function cleanupExamSession() {
  activeExam = null;
  document.getElementById('exam-taking-container').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  document.getElementById('app-body').classList.remove('in-exam');
}

// -------------------------------------------------------------
// 19. ระบบตรวจจับการทุจริตและการสลับจอแบบล้ำสมัย (Anti-Cheat Engine)
// -------------------------------------------------------------
function enableAntiCheatDetectors() {
  window.addEventListener('blur', handleAntiCheatInfraction);
  document.addEventListener('visibilitychange', handleAntiCheatVisibility);
}

function disableAntiCheatDetectors() {
  window.removeEventListener('blur', handleAntiCheatInfraction);
  document.removeEventListener('visibilitychange', handleAntiCheatVisibility);
}

function handleAntiCheatVisibility() {
  if (document.hidden && activeExam) {
    handleAntiCheatInfraction();
  }
}

function handleAntiCheatInfraction() {
  if (!activeExam) return;
  // ป้องกันการแจ้งเตือนซ้ำซ้อนในขณะที่หน้าต่างเตือนแสดงอยู่แล้ว
  const warningOverlay = document.getElementById('anti-cheat-warning-overlay');
  if (warningOverlay && warningOverlay.style.display === 'flex') return;

  // บันทึกความผิดพลาด
  examSession.cheatCount++;
  const timestamp = new Date().toLocaleTimeString('th-TH');
  examSession.cheatingLogs.push(`ตรวจพบการสลับหน้าต่าง ณ เวลา ${timestamp}`);

  // อัปเดตสถิติตัวนับบนหน้าจอสอบ
  document.getElementById('exam-cheat-count').innerText = examSession.cheatCount;

  // เล่นเสียงแจ้งเตือนความผิดพลาด (Synthesizer Beep เสียงระทึก)
  playBeepWarningSound();

  if (examSession.cheatCount >= 3) {
    // ทุจริตเกิน 2 ครั้ง ครั้งที่ 3 ส่งกระดาษอัตโนมัติ
    submitExamSheetDirectly('cheated');
  } else {
    // ปิดการตรวจจับชั่วคราวขณะแสดงหน้าเตือน ป้องกันการรันซ้อน
    disableAntiCheatDetectors();
    // แจ้งเตือนบอร์ด overlay สกรีนเตือนสีแดงกักกั้น
    document.getElementById('anti-cheat-warn-count').innerText = examSession.cheatCount;
    document.getElementById('anti-cheat-warning-overlay').style.display = 'flex';
  }
}

// เล่นเสียงแจ้งเตือนโดยใช้ Web Audio API สังเคราะห์คลื่นเสียงไม่ต้องโหลดไฟล์
function playBeepWarningSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // สร้าง 2 Oscillator (เสียงสองความถี่ซ้อนขัดความหูเพื่อให้รู้สึกเตือนภัย)
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(440, audioCtx.currentTime); // โน้ต A4
    osc1.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5); // สไลด์เสียงสูงขึ้น

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(450, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6); // เฟดเสียงเงียบ

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + 0.65);
    osc2.stop(audioCtx.currentTime + 0.65);
  } catch (err) {
    console.warn("ไม่สามารถส่งสัญญาณเสียงบี๊บเตือน (ติด Autoplay block):", err);
  }
}

// -------------------------------------------------------------
// 19. ระบบนำเข้าข้อสอบจาก Google Form (Google Form Importer Logic)
// -------------------------------------------------------------
function parseGoogleFormHtml(html) {
  const regex = /FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\])\s*;/;
  const match = regex.exec(html);
  if (!match) {
    throw new Error('ไม่พบโครงสร้างข้อมูลข้อสอบ (FB_PUBLIC_LOAD_DATA_) ใน HTML นี้ กรุณาตรวจสอบว่าเป็นซอร์สโค้ดหน้า Google Form ที่ถูกต้อง');
  }
  
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch (err) {
    throw new Error('ไม่สามารถวิเคราะห์ข้อมูลแบบฟอร์มได้ กรุณาลองใหม่อีกครั้ง');
  }

  const items = data[1] && data[1][1];
  if (!Array.isArray(items)) {
    throw new Error('ไม่พบรายการคำถามในแบบฟอร์มนี้');
  }

  const questions = [];
  let counter = 0;

  for (const item of items) {
    const questionText = item[1];
    const typeId = item[3];
    
    if (!questionText || typeId === undefined) continue;

    // ข้ามประเภทที่ไม่ใช่คำถามสอบ เช่น ส่วนแยกหน้า (Section Header), วิดีโอ, ภาพประกอบ
    if (typeId === 9 || typeId === 10 || typeId === 6 || typeId === 8) {
      continue;
    }

    counter++;
    const qId = 'gform_q_' + Date.now() + '_' + counter;

    if (typeId === 2 || typeId === 3 || typeId === 4) {
      // ตัวเลือก (ปรนัย)
      const optionsContainer = item[4] && item[4][0];
      const rawOptions = optionsContainer && optionsContainer[1];
      const options = [];
      if (Array.isArray(rawOptions)) {
        for (const opt of rawOptions) {
          if (opt && opt[0] !== undefined && opt[0] !== null) {
            options.push(String(opt[0]));
          }
        }
      }

      if (options.length > 0) {
        questions.push({
          id: qId,
          type: 'choice',
          text: questionText,
          points: 2, // กำหนดคะแนนเริ่มต้น
          options: options,
          correctAnswer: 0 // ดัชนีเฉลยเริ่มต้น (ตัวเลือกแรก) ครูแก้ไขทีหลังได้
        });
      }
    } else {
      // เขียนตอบ (อัตนัย)
      questions.push({
        id: qId,
        type: 'subjective',
        text: questionText,
        points: 4, // กำหนดคะแนนเริ่มต้น
        correctAnswer: '' // ครูตั้งค่าคำเฉลยเพิ่มทีหลัง
      });
    }
  }

  return questions;
}

function openImportGoogleFormModal() {
  const modalHtml = `
    <div class="gform-import-modal-body" style="color: var(--text-primary); font-family: inherit;">
      <div style="margin-bottom: 16px;">
        <p style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.5; text-align: left;">
          นำเข้าคำถามจาก Google Form โดยระบบจะดึงคำถามและตัวเลือกทั้งหมดมาแปลงเป็นข้อสอบในระบบนี้โดยอัตโนมัติ
        </p>
      </div>
      
      <!-- แท็บระบุช่องทางนำเข้า -->
      <div class="form-group" style="margin-bottom: 20px; text-align: left;">
        <label class="form-label" style="font-weight:600;">เลือกวิธีนำเข้า</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;">
          <button type="button" class="btn btn-primary" id="gform-tab-url" style="padding: 8px; font-size:12.5px;">
            <i class="lucide-icon" data-lucide="link" style="vertical-align:middle; margin-right:4px;"></i>นำเข้าผ่าน URL ลิงก์
          </button>
          <button type="button" class="btn btn-secondary" id="gform-tab-html" style="padding: 8px; font-size:12.5px;">
            <i class="lucide-icon" data-lucide="code" style="vertical-align:middle; margin-right:4px;"></i>วางโค้ด HTML (หน้าซอร์ส)
          </button>
        </div>
      </div>

      <!-- ส่วนป้อน URL -->
      <div id="gform-url-section" class="form-group" style="text-align: left;">
        <label for="gform-url-input" class="form-label">ลิงก์ Google Form (หน้าเว็บที่ใช้ทำข้อสอบ)</label>
        <input type="url" id="gform-url-input" class="form-control" placeholder="https://docs.google.com/forms/d/e/.../viewform" style="width: 100%;">
        <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 6px; line-height: 1.4;">
          * หมายเหตุ: ต้องใช้ลิงก์ที่เป็นหน้าทำข้อสอบจริง (ลงท้ายด้วย <code>/viewform</code>) เท่านั้น
        </p>
      </div>

      <!-- ส่วนป้อน HTML -->
      <div id="gform-html-section" class="form-group" style="display: none; text-align: left;">
        <label for="gform-html-input" class="form-label">ซอร์สโค้ด HTML ของ Google Form</label>
        <textarea id="gform-html-input" class="form-control" placeholder="วางซอร์สโค้ด HTML ที่คัดลอกมาที่นี่..." style="min-height: 120px; font-family: monospace; font-size: 11px;"></textarea>
        <div style="background-color: rgba(99, 102, 241, 0.05); padding: 12px; border-radius: var(--radius-sm); margin-top: 10px; border: 1px solid rgba(99, 102, 241, 0.1);">
          <h4 style="font-size:12px; font-weight:600; margin-bottom:4px; color: var(--primary);">วิธีคัดลอกโค้ด HTML:</h4>
          <ol style="font-size: 11px; color: var(--text-secondary); padding-left: 18px; margin-bottom: 0; line-height: 1.5;">
            <li>เปิดลิงก์ Google Form ในบราวเซอร์</li>
            <li>กดปุ่ม <code>Ctrl + U</code> (หรือคลิกขวาแล้วเลือก "ดูซอร์สโค้ดของหน้า" / "View Page Source")</li>
            <li>กด <code>Ctrl + A</code> เพื่อเลือกโค้ดทั้งหมด และกด <code>Ctrl + C</code> เพื่อคัดลอก</li>
            <li>นำมาวางลงในช่องข้อความด้านบนนี้</li>
          </ol>
        </div>
      </div>

      <div id="gform-import-loading" style="display: none; align-items: center; justify-content: center; gap: 8px; margin: 16px 0; color: var(--primary); font-size: 13px;">
        <i class="lucide-icon spin-animation" data-lucide="loader" style="width:16px; height:16px;"></i> <span>กำลังดึงข้อมูลและแปลงข้อสอบ กรุณารอสักครู่...</span>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; border-top: 1px solid var(--border-glass); padding-top: 16px;">
        <button type="button" class="btn btn-secondary" id="gform-cancel-btn">ยกเลิก</button>
        <button type="button" class="btn btn-primary" id="gform-submit-btn" style="background-color:#673ab7; border-color:#673ab7;">นำเข้าข้อสอบ</button>
      </div>
    </div>
  `;

  openModal('นำเข้าข้อสอบจาก Google Form', modalHtml);
  refreshIcons(document.getElementById('modal-body-content'));

  const tabUrl = document.getElementById('gform-tab-url');
  const tabHtml = document.getElementById('gform-tab-html');
  const secUrl = document.getElementById('gform-url-section');
  const secHtml = document.getElementById('gform-html-section');
  const cancelBtn = document.getElementById('gform-cancel-btn');
  const submitBtn = document.getElementById('gform-submit-btn');
  const loadingDiv = document.getElementById('gform-import-loading');

  let currentMethod = 'url'; // 'url' or 'html'

  tabUrl.addEventListener('click', () => {
    tabUrl.classList.add('btn-primary');
    tabUrl.classList.remove('btn-secondary');
    tabHtml.classList.add('btn-secondary');
    tabHtml.classList.remove('btn-primary');
    secUrl.style.display = 'block';
    secHtml.style.display = 'none';
    currentMethod = 'url';
  });

  tabHtml.addEventListener('click', () => {
    tabHtml.classList.add('btn-primary');
    tabHtml.classList.remove('btn-secondary');
    tabUrl.classList.add('btn-secondary');
    tabUrl.classList.remove('btn-primary');
    secUrl.style.display = 'none';
    secHtml.style.display = 'block';
    currentMethod = 'html';
  });

  cancelBtn.addEventListener('click', closeModal);

  submitBtn.addEventListener('click', async () => {
    let htmlContent = '';
    
    if (currentMethod === 'url') {
      const url = document.getElementById('gform-url-input').value.trim();
      if (!url) {
        alert('กรุณากรอกลิงก์ Google Form');
        return;
      }
      
      if (!url.includes('docs.google.com/forms')) {
        alert('ลิงก์ที่ระบุไม่ถูกต้อง กรุณาใช้ลิงก์จาก Google Forms เช่น https://docs.google.com/forms/d/e/.../viewform');
        return;
      }

      submitBtn.disabled = true;
      loadingDiv.style.display = 'flex';

      let success = false;

      // 1. ลองใช้ corsproxy.io ก่อน (เร็วและเสถียรกว่า)
      try {
        console.log('Attempting import via corsproxy.io...');
        const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error('CORSProxy.io returned non-ok status');
        htmlContent = await response.text();
        success = true;
      } catch (err) {
        console.warn('corsproxy.io failed, trying fallback allorigins.win...', err);
      }

      // 2. ถ้าวิธีแรกไม่สำเร็จ ให้ลองใช้ allorigins.win
      if (!success) {
        try {
          console.log('Attempting import via allorigins.win...');
          const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
          if (!response.ok) throw new Error('AllOrigins returned non-ok status');
          const json = await response.json();
          htmlContent = json.contents;
          success = true;
        } catch (err) {
          console.warn('allorigins.win failed too', err);
        }
      }

      if (!success) {
        alert('เกิดข้อผิดพลาดในการโหลดหน้าเว็บผ่าน Proxy (CORS / Network Error)\n\nระบบไม่สามารถดาวน์โหลดผ่านเซิร์ฟเวอร์กลางได้เนื่องจากข้อจำกัดการเชื่อมต่ออินเทอร์เน็ต\n\nแนะนำให้เลือกวิธีที่ 2 "วางโค้ด HTML" แทน เพื่อหลีกเลี่ยงข้อจำกัดการดาวน์โหลดข้อมูลครับ');
        submitBtn.disabled = false;
        loadingDiv.style.display = 'none';
        return;
      }
    } else {
      htmlContent = document.getElementById('gform-html-input').value.trim();
      if (!htmlContent) {
        alert('กรุณาวางโค้ด HTML ซอร์สโค้ดของ Google Form');
        return;
      }
    }

    try {
      const parsedQuestions = parseGoogleFormHtml(htmlContent);
      if (parsedQuestions.length === 0) {
        alert('ไม่พบคำถามที่เหมาะสมสำหรับนำเข้าในหน้านี้ กรุณาตรวจสอบซอร์สโค้ดแบบฟอร์มอีกครั้ง');
        submitBtn.disabled = false;
        loadingDiv.style.display = 'none';
        return;
      }

      saveBuilderFormValuesToMemory();
      tempQuestionsList = tempQuestionsList.concat(parsedQuestions);
      
      // ดึงหัวข้อและรายละเอียดมาป้อนให้อัตโนมัติ (ถ้ามี)
      const titleMatch = htmlContent.match(/<meta property="og:title" content="(.*?)"/);
      if (titleMatch && titleMatch[1]) {
        const titleInput = document.getElementById('b-title');
        if (titleInput && !titleInput.value.trim()) {
          titleInput.value = titleMatch[1];
        }
      }

      const descMatch = htmlContent.match(/<meta property="og:description" content="(.*?)"/);
      if (descMatch && descMatch[1]) {
        const descInput = document.getElementById('b-desc');
        if (descInput && !descInput.value.trim()) {
          descInput.value = descMatch[1];
        }
      }

      renderBuilderQuestions();
      refreshIcons(document.getElementById('main-content-view'));
      
      closeModal();
      alert(`นำเข้าคำถามสำเร็จทั้งหมด ${parsedQuestions.length} ข้อ!\n\n* เพื่อความปลอดภัย Google Form จะไม่มีข้อมูลเฉลยส่งมายังหน้าเว็บสาธารณะ กรุณาตั้งค่าเฉลยที่ถูกต้องของข้อสอบประเภทปรนัย (ตัวเลือก) แต่ละข้อในโปรแกรมแก้ไขด้านล่างนี้ด้วยครับ`);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการแปลงข้อมูล: ' + err.message);
      submitBtn.disabled = false;
      loadingDiv.style.display = 'none';
    }
  });
}

// ตัวแปรเก็บกล้องที่กำลังสแกนแบบสากล
window.activeScanner = null;

// -------------------------------------------------------------
// 20. ระบบโมดอลหลักป๊อปอัปสากล (Modal Controllers)
// -------------------------------------------------------------
function openModal(title, bodyHtml) {
  document.getElementById('modal-title-text').innerText = title;
  document.getElementById('modal-body-content').innerHTML = bodyHtml;
  document.getElementById('global-modal-overlay').style.display = 'flex';

  // ผูกตัวกระตุ้นปิด Modal
  document.getElementById('modal-close-trigger').addEventListener('click', closeModal);
}

function closeModal() {
  if (window.activeScanner) {
    try {
      window.activeScanner.stop().catch(err => console.warn(err));
    } catch (err) {
      console.warn(err);
    }
    window.activeScanner = null;
  }
  document.getElementById('global-modal-overlay').style.display = 'none';
  document.getElementById('modal-body-content').innerHTML = '';
}

// -------------------------------------------------------------
// 21. ฟังก์ชันแสดง QR Code และลิงก์เข้าร่วมชั้นเรียนสำหรับคุณครู
// -------------------------------------------------------------
window.showSubjectQrCode = function(subjectId, subjectName) {
  const enrollUrl = window.location.origin + window.location.pathname + '?enroll=' + encodeURIComponent(subjectId);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(enrollUrl)}`;
  
  const modalHtml = `
    <div style="text-align: center; color: var(--text-primary); padding: 10px 0; font-family: inherit;">
      <p style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5;">
        ให้นักเรียนสแกน QR Code นี้เพื่อเข้าร่วมชั้นเรียนวิชา <strong>${escapeHtml(subjectName)}</strong> (รหัส: ${escapeHtml(subjectId)})
      </p>
      
      <div style="background-color: white; padding: 15px; display: inline-block; border-radius: var(--radius-md); box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin-bottom: 20px;">
        <img src="${qrUrl}" style="display: block; width: 200px; height: 200px;" alt="QR Code เข้าร่วมชั้นเรียน">
      </div>
      
      <div class="form-group" style="margin-top: 10px; text-align: left;">
        <label class="form-label" style="font-weight: 600;">ลิงก์เข้าร่วมชั้นเรียนโดยตรง:</label>
        <div style="display: flex; gap: 8px; margin-top: 6px;">
          <input type="text" class="form-control" id="enroll-link-input" value="${enrollUrl}" readonly style="flex: 1; font-size: 11.5px; background: rgba(255,255,255,0.05); padding: 8px;">
          <button class="btn btn-primary" id="copy-enroll-link-btn" style="padding: 0 16px; font-size: 12px;">
            <i class="lucide-icon" data-lucide="copy" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i>คัดลอก
          </button>
        </div>
      </div>
      
      <div style="margin-top: 24px; border-top: 1px solid var(--border-glass); padding-top: 16px; display: flex; justify-content: flex-end;">
        <button class="btn btn-secondary" onclick="closeModal()">ปิดหน้าต่าง</button>
      </div>
    </div>
  `;
  
  openModal(`QR Code เข้าเรียน: ${subjectName}`, modalHtml);
  refreshIcons(document.getElementById('modal-body-content'));
  
  document.getElementById('copy-enroll-link-btn').addEventListener('click', () => {
    const input = document.getElementById('enroll-link-input');
    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value).then(() => {
      alert('คัดลอกลิงก์เข้าร่วมชั้นเรียนสำเร็จแล้ว!');
    }).catch(err => {
      console.error('Failed to copy', err);
    });
  });
}
