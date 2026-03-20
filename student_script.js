/* ════════════════════════════════════════════════════════════════════════════
   VelsPortal · student.html · API-connected JS
   All data fetched from FastAPI (http://localhost:8000) → Supabase
   ════════════════════════════════════════════════════════════════════════════ */
const API = 'https://student-management-production-a94b.up.railway.app';
const userId = sessionStorage.getItem('userId')   || '';
const token  = sessionStorage.getItem('token')    || '';

/* Redirect to login if no session */
if (!userId || !token) { window.location.href = 'index.html'; }

/* ── Auth header shorthand ─────────────────────────────────────────────── */
const H = () => ({ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` });

/* ── Fetch helpers ─────────────────────────────────────────────────────── */
async function apiFetch(path) {
  try {
    const r = await fetch(API + path, { headers: H() });
    if (r.status === 401) { sessionStorage.clear(); window.location.href='index.html'; return null; }
    if (!r.ok) { console.warn('API error', path, r.status); return null; }
    return await r.json();
  } catch(e) { console.error('Fetch failed:', path, e); return null; }
}

/* ── Grade helper ─────────────────────────────────────────────────────── */
function gradeFromPct(pct) {
  if (pct >= 90) return {g:'S',  c:'bg'};
  if (pct >= 80) return {g:'A+', c:'bg'};
  if (pct >= 70) return {g:'A',  c:'bc'};
  if (pct >= 60) return {g:'B+', c:'by'};
  if (pct >= 50) return {g:'B',  c:'by'};
  return                 {g:'F',  c:'br'};
}

/* ── Nav colour map for notices ─────────────────────────────────────────── */
const NOTICE_COLORS = {info:'var(--cyan)', warning:'var(--amber)', danger:'var(--red)', success:'var(--emerald)'};

/* ═══════════════════════════════════════════════════════════════════════════
   INIT — runs once on page load, pre-fetches everything
   ═══════════════════════════════════════════════════════════════════════════ */
async function init() {
  showLoading(true);

  /* Parallel fetch of all 7 data sources */
  const [summary, personal, profile, subjects, attendance, marks, resultsWrap, notices] = await Promise.all([
    apiFetch(`/api/student/${userId}/summary`),
    apiFetch(`/api/student/${userId}/personal`),
    apiFetch(`/api/student/${userId}/profile`),
    apiFetch(`/api/student/${userId}/subjects`),
    apiFetch(`/api/student/${userId}/attendance`),
    apiFetch(`/api/student/${userId}/marks`),
    apiFetch(`/api/student/${userId}/results`),
    apiFetch(`/api/student/${userId}/notices`),
  ]);

  showLoading(false);

  /* ── Sidebar ─────────────────────────────────────────────── */
  const name = sessionStorage.getItem('userName') || (summary ? summary.user_id : userId);
  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('sbAv').textContent   = initials;
  document.getElementById('sbName').textContent = name;
  document.getElementById('sbId').textContent   = userId;

  /* ── Dashboard welcome + stat cards ─────────────────────── */
  const cgpa    = summary?.cgpa         ?? '—';
  const attPct  = summary?.attendance_pct ? summary.attendance_pct + '%' : '—';
  const currSem = summary?.current_sem  ?? '—';
  const dept    = summary?.department   ?? profile?.department ?? '—';
  const batch   = summary?.batch        ?? profile?.batch      ?? '—';

  document.getElementById('wName').textContent  = name.split(' ')[0];
  document.getElementById('wSub').textContent   = `${dept} · ${batch} · Sem ${currSem}`;
  document.getElementById('d-cgpa').textContent = cgpa;
  document.getElementById('d-att').textContent  = attPct;
  document.getElementById('d-sem').textContent  = currSem;
  document.getElementById('d-dept').textContent = dept;

  /* Quick info */
  const qi = {
    roll:  summary?.roll_number ?? profile?.roll_number ?? '—',
    dept:  dept,
    batch: batch,
    sec:   'Section ' + (summary?.section ?? profile?.section ?? '—'),
    adv:   summary?.advisor ?? profile?.advisor ?? '—',
  };
  Object.entries(qi).forEach(([k,v]) => {
    const el = document.getElementById('qi-'+k); if(el) el.textContent = v;
  });

  /* ── Notices ─────────────────────────────────────────────── */
  const noticeEl = document.getElementById('notices');
  if (notices && notices.length) {
    noticeEl.innerHTML = notices.map(n => {
      const color = NOTICE_COLORS[n.type] || 'var(--cyan)';
      return `<div class="notice" style="border-left-color:${color}">
        <div class="notice-n">${n.title}</div>
        <div class="notice-b">${n.body}</div>
      </div>`;
    }).join('');
  } else {
    noticeEl.innerHTML = `<div style="color:var(--faint);font-size:.85rem;padding:10px 0">No notices at this time.</div>`;
  }

  /* ── Personal Details ─────────────────────────────────────── */
  if (personal) {
    const pm = {
      'pd-name':   personal.name ?? '—',
      'pd-dob':    personal.dob  ?? '—',
      'pd-gender': personal.gender ?? '—',
      'pd-nat':    personal.nationality ?? '—',
      'pd-relig':  personal.religion ?? '—',
      'pd-mob':    personal.mobile  ?? '—',
      'pd-email':  personal.email   ?? '—',
      'pd-addr':   personal.address ?? '—',
      'pd-father': personal.father_name ?? '—',
      'pd-mother': personal.mother_name ?? '—',
      'pd-pmob':   personal.parent_mobile ?? '—',
    };
    Object.entries(pm).forEach(([id,val]) => {
      const el = document.getElementById(id); if(el) el.textContent = val;
    });
    const bloodEl = document.getElementById('pd-blood');
    if (bloodEl) bloodEl.innerHTML = `<span class="b br">${personal.blood_group ?? '—'}</span>`;
  }

  /* ── Academic Profile ─────────────────────────────────────── */
  if (profile) {
    const ap = {
      'sp-id':    userId,
      'sp-roll':  profile.roll_number    ?? '—',
      'sp-dept':  profile.department     ?? '—',
      'sp-deg':   profile.degree         ?? '—',
      'sp-spec':  profile.specialisation ?? '—',
      'sp-batch': profile.batch          ?? '—',
      'sp-adm':   profile.admission_year ?? '—',
      'sp-sem':   profile.current_sem    ?? '—',
      'sp-sec':   profile.section        ?? '—',
      'sp-adv':   profile.advisor        ?? '—',
      'sp-10':    profile.edu10_board    ?? '—',
      'sp-10p':   profile.edu10_pct      ?? '—',
      'sp-12':    profile.edu12_board    ?? '—',
      'sp-12p':   profile.edu12_pct      ?? '—',
      'sp-ent':   profile.entrance_exam  ?? '—',
    };
    Object.entries(ap).forEach(([id,val]) => {
      const el = document.getElementById(id); if(el) el.textContent = val;
    });
  }

  /* ── Subjects (grouped by semester from API) ─────────────── */
  window._subjects = subjects || {};
  const semKeys = Object.keys(window._subjects).sort((a,b) => parseInt(a)-parseInt(b));
  const tabEl   = document.getElementById('semTabs');
  if (semKeys.length) {
    tabEl.innerHTML = semKeys.map((s,i) =>
      `<button class="stab${i===semKeys.length-1?' act':''}" onclick="showSem('${s}',this)">Sem ${s}</button>`
    ).join('');
    showSem(semKeys[semKeys.length-1]);
  } else {
    tabEl.innerHTML = `<div style="color:var(--faint);font-size:.85rem">No subject data available.</div>`;
    document.getElementById('subGrid').innerHTML = '';
  }

  /* ── Attendance ──────────────────────────────────────────── */
  if (attendance && attendance.length) {
    const tc  = attendance.reduce((a,r) => a + (r.conducted||0), 0);
    const ta  = attendance.reduce((a,r) => a + (r.attended||0),  0);
    const ovr = tc ? Math.round(ta/tc*100) : 0;
    const ovrColor = ovr>=75?'var(--emerald)':ovr>=65?'var(--amber)':'var(--red)';

    document.getElementById('attStats').innerHTML = `
      <div class="sc sc-c"><div class="sc-ico ico-c">📊</div><div>
        <span class="sc-num" style="color:${ovrColor}">${ovr}%</span>
        <div class="sc-lbl">Overall Attendance</div></div></div>
      <div class="sc sc-v"><div class="sc-ico ico-v">📚</div><div>
        <span class="sc-num">${tc}</span>
        <div class="sc-lbl">Classes Conducted</div></div></div>
      <div class="sc sc-e"><div class="sc-ico ico-e">✅</div><div>
        <span class="sc-num">${ta}</span>
        <div class="sc-lbl">Classes Attended</div></div></div>`;

    document.getElementById('attBody').innerHTML = attendance.map(r => {
      const pct = r.percentage ?? (r.conducted ? Math.round(r.attended/r.conducted*100) : 0);
      const cl  = pct>=75?'bg':pct>=65?'by':'br';
      const fc  = pct>=75?'var(--emerald)':pct>=65?'var(--amber)':'var(--red)';
      return `<tr>
        <td>${r.subject_name ?? r.code}</td>
        <td><span class="b bc">${r.subject_code ?? r.code}</span></td>
        <td>${r.conducted}</td><td>${r.attended}</td>
        <td><div style="display:flex;align-items:center;gap:10px">
          <div class="pbar"><div class="pfill" style="width:${pct}%;background:${fc}"></div></div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:.75rem">${pct}%</span>
        </div></td>
        <td><span class="b ${cl}">${pct>=75?'Good':pct>=65?'Warning':'Shortage'}</span></td>
      </tr>`;
    }).join('');
  } else {
    document.getElementById('attStats').innerHTML = `<div style="color:var(--faint);grid-column:span 3;padding:10px">No attendance data yet.</div>`;
    document.getElementById('attBody').innerHTML  = `<tr><td colspan="6" style="text-align:center;color:var(--faint);padding:20px">No attendance data.</td></tr>`;
  }

  /* ── Internal Marks ─────────────────────────────────────── */
  if (marks && marks.length) {
    document.getElementById('marksBody').innerHTML = marks.map(r => {
      const tot = r.total ?? (r.ia1+r.ia2+r.ia3+r.assignment);
      const {g,c} = gradeFromPct(tot/70*100);
      return `<tr>
        <td>${r.subject_name}</td>
        <td><span class="b bc">${r.subject_code}</span></td>
        <td>${r.ia1}</td><td>${r.ia2}</td><td>${r.ia3}</td>
        <td>${r.assignment}</td>
        <td><strong style="color:var(--text)">${tot}</strong></td>
        <td><span class="b ${c}">${g}</span></td>
      </tr>`;
    }).join('');
  } else {
    document.getElementById('marksBody').innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--faint);padding:20px">No marks data.</td></tr>`;
  }

  /* ── Exam Results ────────────────────────────────────────── */
  const subs    = resultsWrap?.subjects ?? [];
  const ocgpa   = resultsWrap?.overall_cgpa ?? cgpa;
  const passed  = subs.filter(s => s.status === 'Pass').length;
  const arrears = subs.filter(s => s.status !== 'Pass').length;

  document.getElementById('resStats').innerHTML = `
    <div class="sc sc-c"><div class="sc-ico ico-c">🎓</div><div>
      <span class="sc-num">${ocgpa}</span><div class="sc-lbl">CGPA</div></div></div>
    <div class="sc sc-e"><div class="sc-ico ico-e">✅</div><div>
      <span class="sc-num" style="background:var(--ge);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${passed}</span>
      <div class="sc-lbl">Subjects Passed</div></div></div>
    <div class="sc sc-v"><div class="sc-ico ico-v">⚠️</div><div>
      <span class="sc-num" style="background:var(--gv);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${arrears}</span>
      <div class="sc-lbl">Arrears</div></div></div>`;

  if (subs.length) {
    const gMap = {S:'bg','A+':'bg',A:'bc','B+':'by',B:'by',F:'br'};
    document.getElementById('resBody').innerHTML = subs.map(r =>
      `<tr>
        <td>${r.subject_name}</td>
        <td><span class="b bc">${r.subject_code}</span></td>
        <td>${r.internal}</td><td>${r.external}</td><td>${r.total}</td>
        <td><span class="b ${gMap[r.grade]||'bv'}">${r.grade}</span></td>
        <td><span class="b ${r.status==='Pass'?'bg':'br'}">${r.status}</span></td>
      </tr>`
    ).join('');
  } else {
    document.getElementById('resBody').innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--faint);padding:20px">No results data yet.</td></tr>`;
  }
}

/* ── Show/hide loading overlay ─────────────────────────────── */
function showLoading(show) {
  let el = document.getElementById('loadingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loadingOverlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(5,8,16,.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    el.innerHTML = `<div style="text-align:center;color:#eef2ff">
      <div style="width:44px;height:44px;border:3px solid rgba(56,189,248,.2);border-top-color:#38bdf8;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px"></div>
      <div style="font-size:.875rem;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif">Loading your data…</div>
    </div>`;
    const style = document.createElement('style');
    style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

/* ── Semester subjects ─────────────────────────────────────── */
function showSem(sem, btn) {
  document.querySelectorAll('.stab').forEach(t => t.classList.remove('act'));
  if (btn) btn.classList.add('act');
  const subs = (window._subjects || {})[sem] || [];
  document.getElementById('semLbl').textContent = '— Semester ' + sem;
  if (subs.length) {
    document.getElementById('subGrid').innerHTML = subs.map(s => `
      <div class="subcard">
        <div class="scode">${s.code}</div>
        <div class="sname">${s.name}</div>
        <div class="scred">Credits: <span>${s.credits}</span></div>
      </div>`).join('');
  } else {
    document.getElementById('subGrid').innerHTML = `<div style="color:var(--faint);font-size:.85rem;grid-column:span 3">No subjects found for Sem ${sem}.</div>`;
  }
}

/* ── Navigation ─────────────────────────────────────────────── */
const TITLES = {
  dashboard:'Dashboard', personal:'Personal Details', profile:'Student Profile',
  subjects:'Semester Subjects', attendance:'Attendance',
  marks:'Internal Marks', results:'Exam Results', password:'Change Password'
};

function go(name) {
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('act'));
  document.getElementById('sec-'+name).classList.add('act');
  document.querySelectorAll('.ni').forEach(el => el.classList.remove('act'));
  document.querySelectorAll('.ni').forEach(el => {
    if (el.getAttribute('onclick')?.includes(`'${name}'`)) el.classList.add('act');
  });
  document.getElementById('ptitle').textContent = TITLES[name] || name;
  document.getElementById('sb').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Change Password via API ─────────────────────────────────── */
async function chgPwd() {
  const c   = document.getElementById('cp1').value;
  const n   = document.getElementById('cp2').value;
  const cf  = document.getElementById('cp3').value;
  const msg = document.getElementById('pwdMsg');
  msg.style.display = 'block';

  if (!c||!n||!cf)  { msg.style.color='#f87171'; msg.textContent='⚠ All fields are required.'; return; }
  if (n !== cf)      { msg.style.color='#f87171'; msg.textContent='⚠ New passwords do not match.'; return; }
  if (n.length < 8)  { msg.style.color='#fbbf24'; msg.textContent='⚠ Password must be at least 8 characters.'; return; }

  msg.style.color = 'var(--cyan)'; msg.textContent = 'Updating…';

  try {
    const r = await fetch(`${API}/api/change-password`, {
      method:  'POST',
      headers: H(),
      body:    JSON.stringify({ user_id: userId, current_password: c, new_password: n }),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.detail || 'Failed');
    msg.style.color    = 'var(--emerald)';
    msg.textContent    = '✓ ' + body.message;
    document.getElementById('cp1').value = '';
    document.getElementById('cp2').value = '';
    document.getElementById('cp3').value = '';
    /* Update token to reflect new password - need to re-login, just note it */
  } catch(e) {
    msg.style.color = '#f87171'; msg.textContent = '⚠ ' + e.message;
  }
}

/* ── Sign out ────────────────────────────────────────────────── */
function signOut() { sessionStorage.clear(); window.location.href = 'index.html'; }

/* ── Clock ───────────────────────────────────────────────────── */
function tick() {
  const n = new Date();
  const el = document.getElementById('tbadge');
  if (el) el.textContent =
    n.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) + '  ·  ' +
    n.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}
setInterval(tick, 1000); tick();

/* ── Boot ─────────────────────────────────────────────────────── */
init();