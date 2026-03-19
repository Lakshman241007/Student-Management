  const API = 'https://student-management-9ryk.onrender.com';
  let role  = 'student';

  /* ── Tab switcher ─────────────────────────────────── */
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
    document.getElementById('fuid').placeholder = s ? 'e.g. ENG001 or ART001' : 'e.g. TCH001';
    const btn = document.getElementById('btnLogin');
    btn.className = 'btn-submit ' + (s ? 's-btn' : 't-btn');
    document.querySelectorAll('.form-input').forEach(i => {
      i.className = 'form-input' + (s ? '' : ' t-mode');
    });
    document.getElementById('errMsg').style.display = 'none';
  }

  /* ── Login via FastAPI ─────────────────────────────── */
  async function login() {
    const uid = document.getElementById('fuid').value.trim().toUpperCase();
    const pwd = document.getElementById('fpwd').value.trim();
    const err = document.getElementById('errMsg');
    const btn = document.getElementById('btnLogin');

    if (!uid || !pwd) {
      err.textContent = '⚠  Please enter both User ID and password.';
      err.style.display = 'block'; return;
    }

    btn.textContent  = 'Signing in…';
    btn.disabled     = true;
    btn.style.opacity = '.75';
    err.style.display = 'none';

    try {
      const res = await fetch(`${API}/api/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: uid, password: pwd, role: role }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Invalid credentials');
      }

      const data = await res.json();
      /* Store everything needed by dashboard pages */
      sessionStorage.setItem('token',      data.token);
      sessionStorage.setItem('userId',     data.user_id);
      sessionStorage.setItem('role',       data.role);
      sessionStorage.setItem('userName',   data.name);
      sessionStorage.setItem('department', data.department || '');

      btn.textContent = '✓  Redirecting…';
      setTimeout(() => {
        window.location.href = role === 'student' ? 'student.html' : 'teacher.html';
      }, 500);

    } catch (e) {
      err.textContent = '⚠  ' + e.message;
      err.style.display = 'block';
      btn.textContent  = 'Sign In →';
      btn.disabled     = false;
      btn.style.opacity = '1';
      const card = document.querySelector('.login-card');
      card.style.animation = 'shake .4s ease';
      setTimeout(() => card.style.animation = '', 450);
    }
  }

  document.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });