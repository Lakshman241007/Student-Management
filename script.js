const API  = 'https://student-management-9ryk.onrender.com';
let   role = 'student';

/* ══════════════════════════════════════════════════════
   SERVER WAKE-UP MANAGER
   Pings /api/health every 2s on page load.
   Shows a bottom bar with progress.
   Once server is alive → bar disappears silently.
   If login is attempted while server is still sleeping →
   waits for it to wake then submits automatically.
══════════════════════════════════════════════════════ */
let serverAlive    = false;
let wakeListeners  = [];   // callbacks to fire once server is up
let wakeProgress   = 0;
let wakeInterval   = null;
let wakeBarVisible = false;
const WAKE_TIMEOUT = 60000; // give up after 60s
const PING_EVERY   = 2000;

function showWakeBar(msg) {
  const bar = document.getElementById('serverBar');
  if (bar) { bar.style.display = 'block'; wakeBarVisible = true; }
  setWakeMsg(msg || '⏳ &nbsp;Server is starting up, please wait…');
}
function hideWakeBar() {
  const bar = document.getElementById('serverBar');
  if (bar) { bar.style.display = 'none'; wakeBarVisible = false; }
}
function setWakeMsg(msg) {
  const el = document.getElementById('serverBarText');
  if (el) el.innerHTML = msg;
}
function setWakeFill(pct) {
  const el = document.getElementById('serverBarFill');
  if (el) el.style.width = Math.min(pct, 98) + '%';
}

async function pingServer() {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${API}/api/health`, { signal: ctrl.signal });
    if (res.ok) return true;
  } catch (_) {}
  return false;
}

async function startWakeUp() {
  /* Quick first ping */
  const alive = await pingServer();
  if (alive) {
    serverAlive = true;
    return; /* Server already awake — nothing to show */
  }

  /* Server is sleeping — show bar and keep pinging */
  showWakeBar('⏳ &nbsp;Server is starting up, please wait…');
  const startTime = Date.now();

  wakeInterval = setInterval(async () => {
    const elapsed = Date.now() - startTime;
    wakeProgress  = Math.min((elapsed / WAKE_TIMEOUT) * 100, 95);
    setWakeFill(wakeProgress);

    if (elapsed > WAKE_TIMEOUT) {
      clearInterval(wakeInterval);
      setWakeMsg('⚠ &nbsp;Server taking too long. Try refreshing the page.');
      return;
    }

    const ok = await pingServer();
    if (ok) {
      clearInterval(wakeInterval);
      serverAlive = true;
      setWakeFill(100);
      setWakeMsg('✅ &nbsp;Server is ready!');
      setTimeout(hideWakeBar, 1200);

      /* Fire any login attempts that were queued */
      wakeListeners.forEach(fn => fn());
      wakeListeners = [];
    }
  }, PING_EVERY);
}

/* Wait for server to be alive, or resolve immediately if already up */
function waitForServer() {
  return new Promise(resolve => {
    if (serverAlive) { resolve(); return; }
    wakeListeners.push(resolve);
    /* Make sure wake-up bar is visible if not already */
    if (!wakeBarVisible) showWakeBar('⏳ &nbsp;Waiting for server to wake up…');
  });
}

/* Start pinging immediately on page load */
startWakeUp();

/* ══════════════════════════════════════════════════════
   TAB SWITCHER
══════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
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
    idle:    { text: 'Sign In →',         disabled: false, opacity: '1'   },
    loading: { text: 'Signing in…',       disabled: true,  opacity: '.75' },
    waiting: { text: 'Waiting for server…', disabled: true, opacity: '.75' },
    success: { text: '✓ Redirecting…',    disabled: true,  opacity: '.9'  },
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

/* ── Input listeners ─────────────────────────────── */
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

/* ── Password visibility toggle ─────────────────── */
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

/* ══════════════════════════════════════════════════════
   LOGIN
══════════════════════════════════════════════════════ */
async function login() {
  const uid = document.getElementById('fuid').value.trim().toUpperCase();
  const pwd = document.getElementById('fpwd').value;

  hideErr();

  /* Client-side validation — no network needed */
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

  /* If server is still waking up, queue the login */
  if (!serverAlive) {
    setBtn('waiting');
    showWakeBar('⏳ &nbsp;Server is waking up — your login will submit automatically…');
    await waitForServer();
    /* Server is now alive — proceed */
    hideErr();
  }

  setBtn('loading');

  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 15000);

    const res = await fetch(`${API}/api/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user_id: uid, password: pwd, role }),
      signal:  ctrl.signal,
    });

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
    showErr(
      e.name === 'AbortError'
        ? 'Request timed out. Please try again.'
        : e.message
    );
    setBtn('idle');
    document.getElementById('fuid').focus();
  }
}

document.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
window.addEventListener('load',      () => { document.getElementById('fuid').focus(); });