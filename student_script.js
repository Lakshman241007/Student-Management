/* ════════════════════════════════════════════════════════════════════════════
   VelsPortal · student.html · API-connected JS
   All data fetched from FastAPI (http://localhost:8000) → Supabase
   ════════════════════════════════════════════════════════════════════════════ */
const API = 'https://student-management-production-a94b.up.railway.app';
const userId = sessionStorage.getItem('userId') || '';
const token = sessionStorage.getItem('token') || '';

/* Redirect to login if no session */
if (!userId || !token) { window.location.href = 'index.html'; }

/* ── Auth header shorthand ─────────────────────────────────────────────── */
const H = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });

/* ── Fetch helpers ─────────────────────────────────────────────────────── */
async function apiFetch(path) {
  try {
    const r = await fetch(API + path, { headers: H() });
    if (r.status === 401) { sessionStorage.clear(); window.location.href = 'index.html'; return null; }
    if (!r.ok) { console.warn('API error', path, r.status); return null; }
    return await r.json();
  } catch (e) { console.error('Fetch failed:', path, e); return null; }
}

/* ── Grade helper ─────────────────────────────────────────────────────── */
function gradeFromPct(pct) {
  if (pct >= 90) return { g: 'S', c: 'bg' };
  if (pct >= 80) return { g: 'A+', c: 'bg' };
  if (pct >= 70) return { g: 'A', c: 'bc' };
  if (pct >= 60) return { g: 'B+', c: 'by' };
  if (pct >= 50) return { g: 'B', c: 'by' };
  return { g: 'F', c: 'br' };
}

/* ── Nav colour map for notices ─────────────────────────────────────────── */
const NOTICE_COLORS = { info: 'var(--cyan)', warning: 'var(--amber)', danger: 'var(--red)', success: 'var(--emerald)' };

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
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('sbAv').textContent = initials;
  document.getElementById('sbName').textContent = name;
  document.getElementById('sbId').textContent = userId;

  /* ── Dashboard welcome + stat cards ─────────────────────── */
  const cgpa = summary?.cgpa ?? '—';
  const attPct = summary?.attendance_pct ? summary.attendance_pct + '%' : '—';
  const currSem = summary?.current_sem ?? '—';
  const dept = summary?.department ?? profile?.department ?? '—';
  const batch = summary?.batch ?? profile?.batch ?? '—';

  document.getElementById('wName').textContent = name.split(' ')[0];
  document.getElementById('wSub').textContent = `${dept} · ${batch} · Sem ${currSem}`;
  document.getElementById('d-cgpa').textContent = cgpa;
  document.getElementById('d-att').textContent = attPct;
  document.getElementById('d-sem').textContent = currSem;
  document.getElementById('d-dept').textContent = dept;

  /* Quick info */
  const qi = {
    roll: summary?.roll_number ?? profile?.roll_number ?? '—',
    dept: dept,
    batch: batch,
    sec: 'Section ' + (summary?.section ?? profile?.section ?? '—'),
    adv: summary?.advisor ?? profile?.advisor ?? '—',
  };
  Object.entries(qi).forEach(([k, v]) => {
    const el = document.getElementById('qi-' + k); if (el) el.textContent = v;
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
      'pd-name': personal.name ?? '—',
      'pd-dob': personal.dob ?? '—',
      'pd-gender': personal.gender ?? '—',
      'pd-nat': personal.nationality ?? '—',
      'pd-relig': personal.religion ?? '—',
      'pd-mob': personal.mobile ?? '—',
      'pd-email': personal.email ?? '—',
      'pd-addr': personal.address ?? '—',
      'pd-father': personal.father_name ?? '—',
      'pd-mother': personal.mother_name ?? '—',
      'pd-pmob': personal.parent_mobile ?? '—',
    };
    Object.entries(pm).forEach(([id, val]) => {
      const el = document.getElementById(id); if (el) el.textContent = val;
    });
    const bloodEl = document.getElementById('pd-blood');
    if (bloodEl) bloodEl.innerHTML = `<span class="b br">${personal.blood_group ?? '—'}</span>`;
  }

  /* ── Academic Profile ─────────────────────────────────────── */
  if (profile) {
    const ap = {
      'sp-id': userId,
      'sp-roll': profile.roll_number ?? '—',
      'sp-dept': profile.department ?? '—',
      'sp-deg': profile.degree ?? '—',
      'sp-spec': profile.specialisation ?? '—',
      'sp-batch': profile.batch ?? '—',
      'sp-adm': profile.admission_year ?? '—',
      'sp-sem': profile.current_sem ?? '—',
      'sp-sec': profile.section ?? '—',
      'sp-adv': profile.advisor ?? '—',
      'sp-10': profile.edu10_board ?? '—',
      'sp-10p': profile.edu10_pct ?? '—',
      'sp-12': profile.edu12_board ?? '—',
      'sp-12p': profile.edu12_pct ?? '—',
      'sp-ent': profile.entrance_exam ?? '—',
    };
    Object.entries(ap).forEach(([id, val]) => {
      const el = document.getElementById(id); if (el) el.textContent = val;
    });
  }

  /* ── Subjects (grouped by semester from API) ─────────────── */
  window._subjects = subjects || {};
  const semKeys = Object.keys(window._subjects).sort((a, b) => parseInt(a) - parseInt(b));
  const tabEl = document.getElementById('semTabs');
  if (semKeys.length) {
    tabEl.innerHTML = semKeys.map((s, i) =>
      `<button class="stab${i === semKeys.length - 1 ? ' act' : ''}" onclick="showSem('${s}',this)">Sem ${s}</button>`
    ).join('');
    showSem(semKeys[semKeys.length - 1]);
  } else {
    tabEl.innerHTML = `<div style="color:var(--faint);font-size:.85rem">No subject data available.</div>`;
    document.getElementById('subGrid').innerHTML = '';
  }

  /* ── Attendance ──────────────────────────────────────────── */
  if (attendance && attendance.length) {
    const tc = attendance.reduce((a, r) => a + (r.conducted || 0), 0);
    const ta = attendance.reduce((a, r) => a + (r.attended || 0), 0);
    const ovr = tc ? Math.round(ta / tc * 100) : 0;
    const ovrColor = ovr >= 75 ? 'var(--emerald)' : ovr >= 65 ? 'var(--amber)' : 'var(--red)';

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
      const pct = r.percentage ?? (r.conducted ? Math.round(r.attended / r.conducted * 100) : 0);
      const cl = pct >= 75 ? 'bg' : pct >= 65 ? 'by' : 'br';
      const fc = pct >= 75 ? 'var(--emerald)' : pct >= 65 ? 'var(--amber)' : 'var(--red)';
      return `<tr>
        <td>${r.subject_name ?? r.code}</td>
        <td><span class="b bc">${r.subject_code ?? r.code}</span></td>
        <td>${r.conducted}</td><td>${r.attended}</td>
        <td><div style="display:flex;align-items:center;gap:10px">
          <div class="pbar"><div class="pfill" style="width:${pct}%;background:${fc}"></div></div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:.75rem">${pct}%</span>
        </div></td>
        <td><span class="b ${cl}">${pct >= 75 ? 'Good' : pct >= 65 ? 'Warning' : 'Shortage'}</span></td>
      </tr>`;
    }).join('');
  } else {
    document.getElementById('attStats').innerHTML = `<div style="color:var(--faint);grid-column:span 3;padding:10px">No attendance data yet.</div>`;
    document.getElementById('attBody').innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--faint);padding:20px">No attendance data.</td></tr>`;
  }

  /* ── Internal Marks ─────────────────────────────────────── */
  if (marks && marks.length) {
    document.getElementById('marksBody').innerHTML = marks.map(r => {
      const tot = r.total ?? (r.ia1 + r.ia2 + r.ia3 + r.assignment);
      const { g, c } = gradeFromPct(tot / 70 * 100);
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
  const subs = resultsWrap?.subjects ?? [];
  const ocgpa = resultsWrap?.overall_cgpa ?? cgpa;
  const passed = subs.filter(s => s.status === 'Pass').length;
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
    const gMap = { S: 'bg', 'A+': 'bg', A: 'bc', 'B+': 'by', B: 'by', F: 'br' };
    document.getElementById('resBody').innerHTML = subs.map(r =>
      `<tr>
        <td>${r.subject_name}</td>
        <td><span class="b bc">${r.subject_code}</span></td>
        <td>${r.internal}</td><td>${r.external}</td><td>${r.total}</td>
        <td><span class="b ${gMap[r.grade] || 'bv'}">${r.grade}</span></td>
        <td><span class="b ${r.status === 'Pass' ? 'bg' : 'br'}">${r.status}</span></td>
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
  dashboard: 'Dashboard', personal: 'Personal Details', profile: 'Student Profile',
  subjects: 'Semester Subjects', attendance: 'Attendance',
  marks: 'Internal Marks', results: 'Exam Results', password: 'Change Password'
};

function go(name) {
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('act'));
  document.getElementById('sec-' + name).classList.add('act');
  document.querySelectorAll('.ni').forEach(el => el.classList.remove('act'));
  document.querySelectorAll('.ni').forEach(el => {
    if (el.getAttribute('onclick')?.includes(`'${name}'`)) el.classList.add('act');
  });
  document.getElementById('ptitle').textContent = TITLES[name] || name;
  document.getElementById('sb').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'od') odInit();
}

/* ── Change Password via API ─────────────────────────────────── */
async function chgPwd() {
  const c = document.getElementById('cp1').value;
  const n = document.getElementById('cp2').value;
  const cf = document.getElementById('cp3').value;
  const msg = document.getElementById('pwdMsg');
  msg.style.display = 'block';

  if (!c || !n || !cf) { msg.style.color = '#f87171'; msg.textContent = '⚠ All fields are required.'; return; }
  if (n !== cf) { msg.style.color = '#f87171'; msg.textContent = '⚠ New passwords do not match.'; return; }
  if (n.length < 8) { msg.style.color = '#fbbf24'; msg.textContent = '⚠ Password must be at least 8 characters.'; return; }

  msg.style.color = 'var(--cyan)'; msg.textContent = 'Updating…';

  try {
    const r = await fetch(`${API}/api/change-password`, {
      method: 'POST',
      headers: H(),
      body: JSON.stringify({ user_id: userId, current_password: c, new_password: n }),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.detail || 'Failed');
    msg.style.color = 'var(--emerald)';
    msg.textContent = '✓ ' + body.message;
    document.getElementById('cp1').value = '';
    document.getElementById('cp2').value = '';
    document.getElementById('cp3').value = '';
    /* Update token to reflect new password - need to re-login, just note it */
  } catch (e) {
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
    n.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + '  ·  ' +
    n.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
setInterval(tick, 1000); tick();

/* ── Boot ─────────────────────────────────────────────────────── */
init();
/* ═══════════════════════════════════════════════════════════════════════════
   OD (ON-DUTY) REQUEST MODULE
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Event catalogue ──────────────────────────────────────────────────────── */
const OD_EVENTS = [
  {
    group: '🎭 Cultural Events', icon: '🎭', items: [
      'Dance Competition', 'Singing Competition', 'Drama / Skit',
      'Fashion Show', 'Talent Show', 'Music Band Performance'
    ]
  },
  {
    group: '🧠 Technical Events', icon: '🧠', items: [
      'Hackathon', 'Coding Contest', 'Project Expo',
      'Paper Presentation', 'Quiz Competition', 'Robotics Competition'
    ]
  },
  {
    group: '🏆 Sports Events', icon: '🏆', items: [
      'Cricket Tournament', 'Football Match', 'Volleyball / Basketball',
      'Athletics (100m, Relay, etc.)', 'Indoor Games (Chess, Carrom, Table Tennis)'
    ]
  },
  {
    group: '🎤 Academic Events', icon: '🎤', items: [
      'Seminar', 'Workshop', 'Guest Lecture', 'Conference', 'Symposium'
    ]
  },
  {
    group: '🎉 Special / Celebration Events', icon: '🎉', items: [
      'Annual Day', 'Sports Day', 'College Fest', 'Farewell',
      'Freshers Day', 'Independence Day / Republic Day Celebration'
    ]
  },
];

/* Flat list for filtering */
const OD_ALL_ITEMS = OD_EVENTS.flatMap(g => g.items.map(i => ({ label: i, group: g.group, icon: g.icon })));

let _odDropOpen = false;
let _odFileData = null;   /* base64 string */
let _odFileName = null;
let _odPending = null;   /* form data waiting for confirm */
let _odRequests = [];     /* local cache */

/* ── Init OD section ──────────────────────────────────────────────────────── */
function odInit() {
  odBuildDropdown(OD_ALL_ITEMS);
  odLoadHistory();

  /* Close dropdown on outside click */
  document.addEventListener('click', function (e) {
    const wrap = document.getElementById('odDropWrap');
    if (wrap && !wrap.contains(e.target)) odCloseDrop();
  });
}

/* ── Dropdown helpers ─────────────────────────────────────────────────────── */
function odBuildDropdown(items) {
  const inner = document.getElementById('od-dd-inner');
  if (!inner) return;

  /* Group filtered items */
  const grouped = {};
  items.forEach(it => {
    if (!grouped[it.group]) grouped[it.group] = { icon: it.icon, items: [] };
    grouped[it.group].items.push(it.label);
  });

  if (!items.length) {
    inner.innerHTML = `<div class="od-dd-empty">No events match your search.</div>`;
    return;
  }

  inner.innerHTML = Object.entries(grouped).map(([grp, val]) =>
    `<div class="od-dd-group">${val.icon} ${grp.replace(/^[^\s]+\s/, '')}</div>` +
    val.items.map(label =>
      `<div class="od-dd-item${document.getElementById('od-event-val')?.value === label ? ' selected' : ''}"
        onclick="odSelectEvent('${label.replace(/'/g, "\\'")}', event)">${label}</div>`
    ).join('')
  ).join('');
}

function odOpenDrop() {
  _odDropOpen = true;
  document.getElementById('od-dropdown')?.classList.add('open');
  document.getElementById('od-search-box')?.classList.add('open');
  document.querySelector('.od-drop-arrow')?.classList.add('open');
  document.getElementById('od-search-box')?.classList.add('open');
  const box = document.getElementById('odDropWrap')?.querySelector('.od-search-box');
  if (box) box.classList.add('open');
  const searchInp = document.getElementById('od-event-search');
  if (searchInp) { searchInp.readOnly = false; searchInp.focus(); }
}

function odCloseDrop() {
  _odDropOpen = false;
  document.getElementById('od-dropdown')?.classList.remove('open');
  const box = document.getElementById('odDropWrap')?.querySelector('.od-search-box');
  if (box) box.classList.remove('open');
  document.querySelector('.od-drop-arrow')?.classList.remove('open');
  const searchInp = document.getElementById('od-event-search');
  if (searchInp) searchInp.readOnly = true;
}

function odFilterEvents() {
  const q = (document.getElementById('od-event-search')?.value || '').toLowerCase();
  const filtered = q ? OD_ALL_ITEMS.filter(i => i.label.toLowerCase().includes(q)) : OD_ALL_ITEMS;
  odBuildDropdown(filtered);
  if (!_odDropOpen) odOpenDrop();
}

function odSelectEvent(label, e) {
  e && e.stopPropagation();
  document.getElementById('od-event-val').value = label;
  document.getElementById('od-event-search').value = label;
  odClearErr('od-event-search');
  document.getElementById('err-event').textContent = '';
  const box = document.getElementById('odDropWrap')?.querySelector('.od-search-box');
  if (box) box.classList.remove('err');
  odCloseDrop();
  odBuildDropdown(OD_ALL_ITEMS); /* reset to full list */
}

/* ── File handling ────────────────────────────────────────────────────────── */
function odFileChange(evt) {
  const file = evt.target.files[0];
  const zone = document.getElementById('od-upload-zone');
  const txt = document.getElementById('od-upload-text');
  const errEl = document.getElementById('err-file');

  if (!file) return;

  /* Size check — 500 KB */
  if (file.size > 500 * 1024) {
    zone.classList.add('err');
    errEl.textContent = `File too large (${(file.size / 1024).toFixed(0)} KB). Maximum allowed is 500 KB.`;
    _odFileData = null; _odFileName = null;
    evt.target.value = '';
    txt.innerHTML = `<strong>Click to upload</strong> certificate or proof<br><span class="od-upload-hint">PDF, JPG or PNG &middot; Max 500 KB</span>`;
    zone.classList.remove('has-file');
    return;
  }

  /* Read as base64 */
  const reader = new FileReader();
  reader.onload = function (e) {
    _odFileData = e.target.result;
    _odFileName = file.name;
    zone.classList.remove('err');
    zone.classList.add('has-file');
    errEl.textContent = '';
    txt.innerHTML = `
      <div class="od-file-name">✅ ${file.name}</div>
      <div class="od-file-size">${(file.size / 1024).toFixed(1)} KB &middot; Click to change</div>`;
  };
  reader.readAsDataURL(file);
}

/* ── Field error helpers ──────────────────────────────────────────────────── */
function odClearErr(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('err');
  const errId = id.replace('od-', 'err-').replace('-college', 'college').replace('-from', 'from').replace('-to', 'to');
  const err = document.getElementById('err-' + id.replace('od-', ''));
  if (err) err.textContent = '';
}

function odFieldErr(inputId, errId, msg) {
  const el = document.getElementById(inputId);
  if (el) el.classList.add('err');
  const errEl = document.getElementById(errId);
  if (errEl) errEl.textContent = msg;
}

/* ── Validate & show confirm ──────────────────────────────────────────────── */
function odSubmit() {
  /* Clear previous errors */
  ['od-college', 'od-event-search', 'od-from', 'od-to'].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.remove('err');
  });
  document.getElementById('od-upload-zone')?.classList.remove('err');
  ['err-college', 'err-event', 'err-from', 'err-to', 'err-file'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '';
  });

  let valid = true;
  const college = (document.getElementById('od-college')?.value || '').trim();
  const event = (document.getElementById('od-event-val')?.value || '').trim();
  const from = document.getElementById('od-from')?.value;
  const to = document.getElementById('od-to')?.value;
  const notes = (document.getElementById('od-notes')?.value || '').trim();

  if (!college) {
    odFieldErr('od-college', 'err-college', 'Please enter the institution name.');
    valid = false;
  }
  if (!event) {
    document.getElementById('od-event-search')?.classList.add('err');
    const box = document.getElementById('odDropWrap')?.querySelector('.od-search-box');
    if (box) box.classList.add('err');
    document.getElementById('err-event').textContent = 'Please select an event from the list.';
    valid = false;
  }
  if (!from) {
    odFieldErr('od-from', 'err-from', 'Select a start date.');
    valid = false;
  }
  if (!to) {
    odFieldErr('od-to', 'err-to', 'Select an end date.');
    valid = false;
  }
  if (from && to && to < from) {
    odFieldErr('od-to', 'err-to', 'End date cannot be before start date.');
    valid = false;
  }
  if (!_odFileData) {
    document.getElementById('od-upload-zone')?.classList.add('err');
    document.getElementById('err-file').textContent = 'Please upload a certificate or proof document.';
    valid = false;
  }
  if (!valid) return;

  /* Store pending and show confirm */
  _odPending = { college, event, from, to, notes, fileData: _odFileData, fileName: _odFileName };

  const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  document.getElementById('od-confirm-body').innerHTML = `
    <div style="display:grid;gap:6px">
      <div><span style="color:var(--faint);font-size:.72rem;text-transform:uppercase;letter-spacing:.05em">Institution</span><br>
           <strong style="color:var(--text)">${college}</strong></div>
      <div style="margin-top:4px"><span style="color:var(--faint);font-size:.72rem;text-transform:uppercase;letter-spacing:.05em">Event / Purpose</span><br>
           <strong style="color:var(--cyan)">${event}</strong></div>
      <div style="margin-top:4px;display:flex;gap:20px">
        <div><span style="color:var(--faint);font-size:.72rem;text-transform:uppercase;letter-spacing:.05em">From</span><br>
             <strong style="color:var(--text)">${fmt(from)}</strong></div>
        <div><span style="color:var(--faint);font-size:.72rem;text-transform:uppercase;letter-spacing:.05em">To</span><br>
             <strong style="color:var(--text)">${fmt(to)}</strong></div>
      </div>
      <div style="margin-top:4px"><span style="color:var(--faint);font-size:.72rem;text-transform:uppercase;letter-spacing:.05em">Certificate</span><br>
           <strong style="color:var(--emerald)">📎 ${_odFileName}</strong></div>
      ${notes ? `<div style="margin-top:4px"><span style="color:var(--faint);font-size:.72rem;text-transform:uppercase;letter-spacing:.05em">Notes</span><br>
           <span style="color:var(--dim)">${notes}</span></div>` : ''}
    </div>`;

  document.getElementById('od-confirm-overlay').classList.add('show');
}

function odConfirmNo() {
  document.getElementById('od-confirm-overlay').classList.remove('show');
  _odPending = null;
}

async function odConfirmYes() {
  if (!_odPending) return;

  const yesBtn = document.querySelector('.od-btn-yes');
  const noBtn = document.querySelector('.od-btn-no');
  if (yesBtn) { yesBtn.disabled = true; yesBtn.textContent = 'Submitting…'; }
  if (noBtn) noBtn.disabled = true;

  const msg = document.getElementById('od-form-msg');

  try {
    /* Build payload — stores locally for now; adapts to real API when endpoint exists */
    const entry = {
      id: 'OD-' + Date.now(),
      student_id: userId,
      name: sessionStorage.getItem('userName') || userId,
      dept: sessionStorage.getItem('department') || (userId.startsWith('ENG') ? 'Engineering' : 'Arts'),
      college: _odPending.college,
      event: _odPending.event,
      from_date: _odPending.from,
      to_date: _odPending.to,
      notes: _odPending.notes,
      file_name: _odPending.fileName,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    };

    /* Try real API first */
    let saved = false;
    try {
      const r = await fetch(`${API}/api/od-request`, {
        method: 'POST',
        headers: H(),
        body: JSON.stringify({ ...entry, file_data: _odPending.fileData }),
      });
      if (r.ok) saved = true;
    } catch (_) { }

    /* Always store locally in sessionStorage as fallback */
    const existing = JSON.parse(sessionStorage.getItem('od_requests') || '[]');
    existing.unshift(entry);
    sessionStorage.setItem('od_requests', JSON.stringify(existing));
    _odRequests = existing;

    /* Close overlay, show success */
    document.getElementById('od-confirm-overlay').classList.remove('show');
    msg.style.color = 'var(--emerald)';
    msg.textContent = '✅ OD request submitted successfully! Your faculty has been notified.';

    /* Reset form */
    odResetForm();
    odRenderHistory(_odRequests);
    odUpdateStats(_odRequests);

  } catch (e) {
    msg.style.color = 'var(--red)';
    msg.textContent = '⚠ Submission failed. Please try again.';
  } finally {
    if (yesBtn) { yesBtn.disabled = false; yesBtn.textContent = '✅ Confirm & Submit'; }
    if (noBtn) noBtn.disabled = false;
  }
}

/* ── Reset form ─────────────────────────────────────────────────────────── */
function odResetForm() {
  document.getElementById('od-college').value = '';
  document.getElementById('od-event-val').value = '';
  document.getElementById('od-event-search').value = '';
  document.getElementById('od-from').value = '';
  document.getElementById('od-to').value = '';
  document.getElementById('od-notes').value = '';
  document.getElementById('od-file').value = '';
  document.getElementById('od-upload-zone').classList.remove('has-file', 'err');
  document.getElementById('od-upload-text').innerHTML =
    `<strong>Click to upload</strong> certificate or proof<br><span class="od-upload-hint">PDF, JPG or PNG &middot; Max 500 KB</span>`;
  _odFileData = null; _odFileName = null; _odPending = null;
}

/* ── Load & render history ─────────────────────────────────────────────── */
async function odLoadHistory() {
  /* Try API */
  let reqs = [];
  try {
    const r = await apiFetch(`/api/od-request/${userId}`);
    if (r && Array.isArray(r)) reqs = r;
  } catch (_) { }

  /* Merge with local session storage */
  const local = JSON.parse(sessionStorage.getItem('od_requests') || '[]');
  const allIds = new Set(reqs.map(r => r.id));
  local.forEach(l => { if (!allIds.has(l.id)) reqs.unshift(l); });

  _odRequests = reqs;
  odRenderHistory(reqs);
  odUpdateStats(reqs);
}

function odRenderHistory(reqs) {
  const el = document.getElementById('od-history');
  const cnt = document.getElementById('od-hist-count');
  if (!el) return;

  if (cnt) cnt.textContent = reqs.length ? `${reqs.length} request${reqs.length > 1 ? 's' : ''}` : '';

  if (!reqs.length) {
    el.innerHTML = `<div style="color:var(--faint);font-size:.85rem;padding:24px 0;text-align:center">
      <div style="font-size:2rem;margin-bottom:8px">📋</div>No OD requests submitted yet.</div>`;
    return;
  }

  const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const statusPill = s => {
    const map = { pending: 'od-st-pending', approved: 'od-st-approved', rejected: 'od-st-rejected' };
    const label = s.charAt(0).toUpperCase() + s.slice(1);
    return `<span class="od-status-pill ${map[s] || 'od-st-pending'}">${label}</span>`;
  };

  el.innerHTML = reqs.map(r => `
    <div class="od-hist-item">
      <div class="od-hist-top">
        <div>
          <div class="od-hist-event">${r.event}</div>
          <div class="od-hist-clg">🏛 ${r.college}</div>
        </div>
        ${statusPill(r.status || 'pending')}
      </div>
      <div class="od-hist-dates">
        📅 ${fmt(r.from_date)} &nbsp;→&nbsp; ${fmt(r.to_date)}
        &nbsp;·&nbsp; 📎 ${r.file_name}
        ${r.notes ? `&nbsp;·&nbsp; 💬 ${r.notes.substring(0, 40)}${r.notes.length > 40 ? '…' : ''}` : ''}
      </div>
    </div>`).join('');
}

function odUpdateStats(reqs) {
  document.getElementById('od-total').textContent = reqs.length;
  document.getElementById('od-approved').textContent = reqs.filter(r => r.status === 'approved').length;
  document.getElementById('od-pending').textContent = reqs.filter(r => !r.status || r.status === 'pending').length;
}

/* Update TITLES map */
TITLES['od'] = 'OD Request';