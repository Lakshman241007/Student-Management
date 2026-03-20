const API  = 'https://student-management-9ryk.onrender.com';
let   role = 'student';

(function warmUp() {
  fetch(`${API}/api/health`, { method: 'GET' }).catch(() => {});
})();

async function fetchWithRetry(url, options, timeoutMs = 18000, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      const isLast = attempt === retries;
      if (isLast) {
        if (err.name === 'AbortError') {
          throw new Error('Server is waking up — please wait a moment and try again.');
        }
        throw new Error('Could not reach the server. Check your internet and try again.');
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

function sw(r) {
  role = r;
  const s = r === 'student';
  document.getElementById('tabS').className = 'rtab ' + (s  ? 'active-s' : '');
  document.getElementById('tabT').className = 'rtab ' + (!s ? 'active-t' : '');
  document.getElementById('ltitle').innerHTML = s
    ? '<span class="tc">Student</span> Login'
    : '<span class="tv">Teacher</span> Login';
  document.getElementById('lsub').textContent = s
    ? 'Access your academic dashboard'
    : 'Access faculty management panel';
  const uid = document.getElementById('fuid');
  uid.placeholder = s ? 'e.g. ENG001 or ART001' : 'e.g. TCH001';
  document.getElementById('btnLogin').className = 'btn-submit ' + (s ? 's-btn' : 't-btn');
  document.querySelectorAll('.form-input').forEach(i => {
    i.className = 'form-input' + (s ? '' : ' t-mode');
  });
  hideErr();
  resetPwdField();
  uid.focus();
}

function hideErr() {
  const e = document.getElementById('errMsg');
  e.style.display = 'none';
  e.textContent   = '';
  clearFieldErr('fuid');
  clearFieldErr('fpwd');
}

function showErr(msg) {
  const e = document.getElementById('errMsg');
  e.textContent   = '⚠  ' + msg;
  e.style.display = 'block';
  const card = document.querySelector('.login-card');
  card.style.animation = 'none';
  requestAnimationFrame(() => { card.style.animation = 'shake .4s ease'; });
  setTimeout(() => card.style.animation = '', 450);
}

function fieldErr(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('input-error');
}
function clearFieldErr(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('input-error');
}

function setBtn(state) {
  const btn = document.getElementById('btnLogin');
  const map = {
    idle:    { text: 'Sign In →',      disabled: false, opacity: '1'   },
    loading: { text: 'Signing in…',    disabled: true,  opacity: '.75' },
    waking:  { text: 'Waking server…', disabled: true,  opacity: '.75' },
    success: { text: '✓ Redirecting…', disabled: true,  opacity: '.9'  },
  };
  const s = map[state] || map.idle;
  btn.textContent   = s.text;
  btn.disabled      = s.disabled;
  btn.style.opacity = s.opacity;
}

function resetPwdField() {
  const p = document.getElementById('fpwd');
  p.value = '';
  p.type  = 'password';
  document.getElementById('eyeOpen').style.display   = 'block';
  document.getElementById('eyeClosed').style.display = 'none';
}

function resetAllFields() {
  document.getElementById('fuid').value = '';
  resetPwdField();
  clearFieldErr('fuid');
  clearFieldErr('fpwd');
}

document.getElementById('fuid').addEventListener('input', function () {
  const pos = this.selectionStart;
  const val = this.value.toUpperCase().replace(/\s/g, '');
  this.value = val;
  this.setSelectionRange(pos, pos);
  clearFieldErr('fuid');
  hideErr();
});

document.getElementById('fpwd').addEventListener('input', function () {
  clearFieldErr('fpwd');
  hideErr();
});

function togglePwd() {
  const input     = document.getElementById('fpwd');
  const eyeOpen   = document.getElementById('eyeOpen');
  const eyeClosed = document.getElementById('eyeClosed');
  const eyeBtn    = document.getElementById('eyeBtn');
  const isHidden  = input.type === 'password';
  input.type      = isHidden ? 'text' : 'password';
  eyeOpen.style.display   = isHidden ? 'none'  : 'block';
  eyeClosed.style.display = isHidden ? 'block' : 'none';
  eyeBtn.classList.toggle('t-mode', role === 'teacher');
}

async function login() {
  const uid = document.getElementById('fuid').value.trim().toUpperCase();
  const pwd = document.getElementById('fpwd').value;

  hideErr();

  if (!uid) {
    fieldErr('fuid');
    showErr('Please enter your User ID.');
    document.getElementById('fuid').focus();
    return;
  }
  if (!pwd) {
    fieldErr('fpwd');
    showErr('Please enter your password.');
    document.getElementById('fpwd').focus();
    return;
  }

  const isStudentId = /^(ENG|ART)\d{3}$/i.test(uid);
  const isTeacherId = /^TCH\d{3}$/i.test(uid);

  if (!isStudentId && !isTeacherId) {
    fieldErr('fuid');
    showErr('ID format invalid. Use ENG001, ART001, or TCH001.');
    document.getElementById('fuid').focus();
    return;
  }
  if (role === 'teacher' && isStudentId) {
    fieldErr('fuid');
    showErr('That looks like a student ID — switch to the Student tab.');
    document.getElementById('fuid').focus();
    return;
  }
  if (role === 'student' && isTeacherId) {
    fieldErr('fuid');
    showErr('That looks like a teacher ID — switch to the Teacher tab.');
    document.getElementById('fuid').focus();
    return;
  }

  setBtn('loading');
  const wakingTimer = setTimeout(() => setBtn('waking'), 3000);

  try {
    const res = await fetchWithRetry(
      `${API}/api/login`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: uid, password: pwd, role }),
      }
    );

    clearTimeout(wakingTimer);

    if (res.status === 401) {
      fieldErr('fuid');
      fieldErr('fpwd');
      resetAllFields();
      throw new Error('Incorrect User ID or Password. Please try again.');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      resetPwdField();
      fieldErr('fpwd');
      throw new Error(body.detail || `Server error (${res.status}). Please try again.`);
    }

    const data = await res.json();
    sessionStorage.setItem('token',      data.token);
    sessionStorage.setItem('userId',     data.user_id);
    sessionStorage.setItem('role',       data.role);
    sessionStorage.setItem('userName',   data.name);
    sessionStorage.setItem('department', data.department || '');

    setBtn('success');
    setTimeout(() => {
      window.location.href = role === 'student' ? 'student.html' : 'teacher.html';
    }, 350);

  } catch (e) {
    clearTimeout(wakingTimer);
    showErr(e.message);
    setBtn('idle');
    document.getElementById('fuid').focus();
  }
}

document.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
window.addEventListener('load', () => { document.getElementById('fuid').focus(); });