const API = 'https://student-management-9ryk.onrender.com';
let role = 'student';

/* ── Preconnect / warm up the API on page load ──────────
   Render free tier "sleeps" — ping it immediately so by
   the time the user clicks Sign In, it's already awake.  */
(function warmUp() {
  fetch(`${API}/api/health`, { method: 'GET' }).catch(() => {});
})();

/* ── Tab switcher ─────────────────────────────────────── */
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

  const btn = document.getElementById('btnLogin');
  btn.className = 'btn-submit ' + (s ? 's-btn' : 't-btn');

  document.querySelectorAll('.form-input').forEach(i => {
    i.className = 'form-input' + (s ? '' : ' t-mode');
  });

  hideErr();

  /* Reset password to hidden on tab switch */
  const fpwd = document.getElementById('fpwd');
  if (fpwd.type === 'text') {
    fpwd.type = 'password';
    document.getElementById('eyeOpen').style.display   = 'block';
    document.getElementById('eyeClosed').style.display = 'none';
  }

  /* Auto-focus user ID field on tab switch */
  uid.focus();
}

/* ── Helpers ──────────────────────────────────────────── */
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
  /* Shake the card */
  const card = document.querySelector('.login-card');
  card.style.animation = 'none';
  requestAnimationFrame(() => {
    card.style.animation = 'shake .4s ease';
  });
  setTimeout(() => card.style.animation = '', 450);
}

/* Highlight a field red to show where the error is */
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
    idle:       { text: 'Sign In →',       disabled: false, opacity: '1'   },
    loading:    { text: 'Signing in…',      disabled: true,  opacity: '.75' },
    success:    { text: '✓  Redirecting…', disabled: true,  opacity: '.9'  },
  };
  const s = map[state] || map.idle;
  btn.textContent    = s.text;
  btn.disabled       = s.disabled;
  btn.style.opacity  = s.opacity;
}

/* ── Input auto-formatting ────────────────────────────── */
document.getElementById('fuid').addEventListener('input', function () {
  /* Uppercase as you type, no spaces */
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


/* ── Password visibility toggle ──────────────────────── */
function togglePwd() {
  const input     = document.getElementById('fpwd');
  const eyeOpen   = document.getElementById('eyeOpen');
  const eyeClosed = document.getElementById('eyeClosed');
  const eyeBtn    = document.getElementById('eyeBtn');

  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';

  eyeOpen.style.display   = isHidden ? 'none'  : 'block';
  eyeClosed.style.display = isHidden ? 'block' : 'none';

  /* Match eye colour to current tab theme */
  eyeBtn.classList.toggle('t-mode', role === 'teacher');
}

/* ── Login via FastAPI ─────────────────────────────────── */
async function login() {
  const uid = document.getElementById('fuid').value.trim().toUpperCase();
  const pwd = document.getElementById('fpwd').value;

  hideErr();

  /* Client-side validation — avoid a round trip for obvious errors */
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

  /* Basic format check — students ENG/ART, teachers TCH */
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
    showErr('That looks like a student ID. Switch to the Student tab.');
    document.getElementById('fuid').focus();
    return;
  }
  if (role === 'student' && isTeacherId) {
    fieldErr('fuid');
    showErr('That looks like a teacher ID. Switch to the Teacher tab.');
    document.getElementById('fuid').focus();
    return;
  }

  setBtn('loading');

  try {
    const res = await fetch(`${API}/api/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user_id: uid, password: pwd, role }),
    });

    if (res.status === 401) {
      /* Highlight both fields red — we don't know which is wrong */
      fieldErr('fuid');
      fieldErr('fpwd');
      /* Clear & reset password field so user retypes cleanly */
      const pwdField = document.getElementById('fpwd');
      pwdField.value = '';
      pwdField.type  = 'password';
      document.getElementById('eyeOpen').style.display   = 'block';
      document.getElementById('eyeClosed').style.display = 'none';
      throw new Error('User ID or Password is incorrect. Please try again.');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Server error (${res.status}). Try again.`);
    }

    const data = await res.json();

    /* Store session */
    sessionStorage.setItem('token',      data.token);
    sessionStorage.setItem('userId',     data.user_id);
    sessionStorage.setItem('role',       data.role);
    sessionStorage.setItem('userName',   data.name);
    sessionStorage.setItem('department', data.department || '');

    setBtn('success');

    /* Small delay so the user sees the "✓ Redirecting" feedback */
    setTimeout(() => {
      window.location.href = role === 'student' ? 'student.html' : 'teacher.html';
    }, 350);

  } catch (e) {
    showErr(e.message);
    setBtn('idle');
    /* Only clear password on auth failure (not on format/validation errors) */
    const pwdField = document.getElementById('fpwd');
    if (pwdField.value) {
      pwdField.value = '';
      pwdField.type  = 'password';
      document.getElementById('eyeOpen').style.display   = 'block';
      document.getElementById('eyeClosed').style.display = 'none';
      pwdField.focus();
    }
  }
}

/* ── Enter key on either field triggers login ─────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});

/* ── Auto-focus user ID on page load ─────────────────── */
window.addEventListener('load', () => {
  document.getElementById('fuid').focus();
});