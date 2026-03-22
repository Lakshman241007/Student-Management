const API = 'https://student-management-production-13fd.up.railway.app';
let role = 'student';

/*
   SERVER WAKE-UP MANAGER
*/
let serverAlive = false;
let wakeListeners = [];
let wakeInterval = null;
let wakeBarVisible = false;
let wakeStart = null;
const PING_EVERY = 2500;

function showWakeBar(msg) {
  const bar = document.getElementById('serverBar');
  if (bar) { bar.style.display = 'block'; wakeBarVisible = true; }
  setWakeMsg(msg);
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
  if (el) el.style.width = Math.min(pct, 100) + '%';
}

async function pingServer() {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${API}/api/health`, { signal: ctrl.signal });
    if (res.ok) return true;
  } catch (_) { }
  return false;
}

function onServerAlive() {
  clearInterval(wakeInterval);
  serverAlive = true;
  setWakeFill(100);
  setWakeMsg('✅ &nbsp;Server is ready!');
  setTimeout(hideWakeBar, 1400);
  wakeListeners.forEach(fn => fn());
  wakeListeners = [];
}

async function startWakeUp() {
  const alive = await pingServer();
  if (alive) { serverAlive = true; return; }

  wakeStart = Date.now();
  showWakeBar('⏳ &nbsp;Server is starting up — this may take up to 2 minutes on first load…');

  wakeInterval = setInterval(async () => {
    const elapsed = Date.now() - wakeStart;
    const pct = Math.min(88, Math.log1p(elapsed / 1000) / Math.log1p(120) * 88);
    setWakeFill(pct);

    if (elapsed > 45000 && elapsed < 47500) {
      setWakeMsg(
        '⏳ &nbsp;Still starting up… &nbsp;' +
        '<button onclick="retryNow()" style="background:rgba(167,139,250,.2);border:1px solid rgba(167,139,250,.4);' +
        'color:#c4b5fd;padding:2px 10px;border-radius:6px;font-size:.72rem;cursor:pointer;font-family:inherit">Retry now</button>'
      );
    }

    const ok = await pingServer();
    if (ok) onServerAlive();
  }, PING_EVERY);
}

async function retryNow() {
  setWakeMsg('⏳ &nbsp;Trying to connect…');
  const ok = await pingServer();
  if (ok) { onServerAlive(); }
  else { setWakeMsg('⏳ &nbsp;Still starting… please wait a little longer.'); }
}

function waitForServer() {
  return new Promise(resolve => {
    if (serverAlive) { resolve(); return; }
    wakeListeners.push(resolve);
    if (!wakeBarVisible) showWakeBar('⏳ &nbsp;Waiting for server — your login will fire automatically…');
  });
}

startWakeUp();

/* 
   TAB SWITCHER
*/
function sw(r) {
  role = r;
  const s = r === 'student';
  document.getElementById('tabS').className = 'rtab ' + (s ? 'active-s' : '');
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

/* 
   HELPERS
*/
function hideErr() {
  const e = document.getElementById('errMsg');
  e.style.display = 'none';
  e.textContent = '';
  clearFieldErr('fuid');
  clearFieldErr('fpwd');
}

function showErr(msg) {
  const e = document.getElementById('errMsg');
  e.textContent = '⚠  ' + msg;
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
    idle:    { text: 'Sign In →',              disabled: false, opacity: '1' },
    loading: { text: 'Signing in…',            disabled: true,  opacity: '.75' },
    waiting: { text: '⏳ Waiting for server…',  disabled: true,  opacity: '.75' },
    success: { text: '✓ Redirecting…',         disabled: true,  opacity: '.9' },
  };
  const s = map[state] || map.idle;
  btn.textContent = s.text;
  btn.disabled = s.disabled;
  btn.style.opacity = s.opacity;
}

function resetPwdField() {
  const p = document.getElementById('fpwd');
  p.value = '';
  p.type = 'password';
  document.getElementById('eyeOpen').style.display = 'block';
  document.getElementById('eyeClosed').style.display = 'none';
}

function resetAllFields() {
  document.getElementById('fuid').value = '';
  resetPwdField();
  clearFieldErr('fuid');
  clearFieldErr('fpwd');
}

/*  Input listeners  */
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

/*  Password toggle  */
function togglePwd() {
  const input   = document.getElementById('fpwd');
  const eyeOpen = document.getElementById('eyeOpen');
  const eyeClosed = document.getElementById('eyeClosed');
  const eyeBtn  = document.getElementById('eyeBtn');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  eyeOpen.style.display   = isHidden ? 'none'  : 'block';
  eyeClosed.style.display = isHidden ? 'block' : 'none';
  eyeBtn.classList.toggle('t-mode', role === 'teacher');
}

/* 
   LOGIN
 */
async function login() {
  const uid = document.getElementById('fuid').value.trim().toUpperCase();
  const pwd = document.getElementById('fpwd').value;

  hideErr();

  if (!uid) {
    fieldErr('fuid'); showErr('Please enter your User ID.');
    document.getElementById('fuid').focus(); return;
  }
  if (!pwd) {
    fieldErr('fpwd'); showErr('Please enter your password.');
    document.getElementById('fpwd').focus(); return;
  }

  const isStudentId = /^(ENG|ART)\d{3}$/i.test(uid);
  const isTeacherId = /^TCH\d{3}$/i.test(uid);

  if (!isStudentId && !isTeacherId) {
    fieldErr('fuid'); showErr('ID format invalid. Use ENG001, ART001, or TCH001.');
    document.getElementById('fuid').focus(); return;
  }
  if (role === 'teacher' && isStudentId) {
    fieldErr('fuid'); showErr('That looks like a student ID — switch to the Student tab.');
    document.getElementById('fuid').focus(); return;
  }
  if (role === 'student' && isTeacherId) {
    fieldErr('fuid'); showErr('That looks like a teacher ID — switch to the Teacher tab.');
    document.getElementById('fuid').focus(); return;
  }

  if (!serverAlive) {
    setBtn('waiting');
    await waitForServer();
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
      fieldErr('fuid'); fieldErr('fpwd');
      resetAllFields();
      throw new Error('Incorrect User ID or Password. Please try again.');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      resetPwdField(); fieldErr('fpwd');
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
    showErr(e.name === 'AbortError' ? 'Request timed out. Please try again.' : e.message);
    setBtn('idle');
    document.getElementById('fuid').focus();
  }
}

document.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
window.addEventListener('load', () => { document.getElementById('fuid').focus(); });