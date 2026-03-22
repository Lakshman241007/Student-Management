const API = 'student-management-production-13fd.up.railway.app';
const tId = sessionStorage.getItem('userId') || '';
const token = sessionStorage.getItem('token') || '';
const tName = sessionStorage.getItem('userName') || 'Faculty';

/* Redirect if not logged in */
if (!tId || !token) { window.location.href = 'index.html'; }

const H = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });

/* Cached data */
let ALL_STUDENTS = [];
let ENG_STUDENTS = [];
let ART_STUDENTS = [];
let _attCache = [];
let _marksCache = [];
let _resCache = [];
let _dirFilter = 'all';
let _attFilter = 'all';
let _mrkFilter = 'all';
let _resFilter = 'all';

/* API fetch helper */
async function api(path) {
  try {
    const r = await fetch(API + path, { headers: H() });
    if (r.status === 401) { sessionStorage.clear(); window.location.href = 'index.html'; return null; }
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { console.error('API error:', path, e); return null; }
}

/*Helpers*/
function isEng(uid) { return (uid || '').startsWith('ENG'); }
function deptBadge(uid) {
  return isEng(uid)
    ? `<span class="b beng">ENG</span>`
    : `<span class="b bart">ART</span>`;
}
function avClass(uid) { return isEng(uid) ? 'eng-av' : 'art-av'; }
function gradeT70(tot) {
  const p = tot / 70 * 100;
  if (p >= 90) return { g: 'S', c: 'bg' };
  if (p >= 80) return { g: 'A+', c: 'bg' };
  if (p >= 70) return { g: 'A', c: 'bc' };
  if (p >= 60) return { g: 'B+', c: 'by' };
  if (p >= 50) return { g: 'B', c: 'by' };
  return { g: 'F', c: 'br' };
}
function deptShort(dept) {
  if (!dept) return '—';
  const words = dept.split(' ');
  return words.length <= 3 ? dept : words.slice(0, 3).join(' ') + '…';
}
function spin(id, cols) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:26px;color:var(--faint)">
    <div style="width:26px;height:26px;border:2px solid rgba(167,139,250,.2);border-top-color:var(--violet);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 8px"></div>
    Loading from Supabase…</td></tr>`;
}

/* SIDEBAR IDENTITY */
const tInit = tName.split(' ').filter(w => /^[A-Z]/.test(w)).map(w => w[0]).join('').slice(0, 2) || 'TC';
document.getElementById('tAv').textContent = tInit;
document.getElementById('tName').textContent = tName;
document.getElementById('tId').textContent = tId;
document.getElementById('wName').textContent = tName.split(' ').slice(-1)[0];

/*  LOAD ALL STUDENTS (ENG + ART) */
async function loadAllStudents() {
  if (ALL_STUDENTS.length) return;
  const data = await api('/api/teacher/students?limit=300');
  ALL_STUDENTS = data?.students ?? [];
  ENG_STUDENTS = ALL_STUDENTS.filter(s => isEng(s.user_id));
  ART_STUDENTS = ALL_STUDENTS.filter(s => !isEng(s.user_id));
}

/*  DASHBOARD */
async function loadDashboard() {
  /* Stats */
  const stats = await api('/api/teacher/stats');
  if (stats) {
    document.getElementById('stat-total').textContent = stats.total_students ?? '—';
    document.getElementById('stat-eng').textContent = stats.engineering_students ?? '—';
    document.getElementById('stat-art').textContent = stats.arts_students ?? '—';
    document.getElementById('stat-tch').textContent = stats.total_teachers ?? '—';

  }

  await loadAllStudents();

  /* Mini cards — 9 students mixed ENG+ART */
  const sample = ALL_STUDENTS.slice(0, 9);
  document.getElementById('dash-count').textContent = `Showing 9 of ${ALL_STUDENTS.length} total`;
  document.getElementById('dash-stus').innerHTML = sample.length
    ? sample.map(s => `
        <div class="stu-mini" onclick="openStudent('${s.user_id}')">
          <div class="stu-mini-head">
            <div class="sav-sm ${avClass(s.user_id)}">${(s.name || '?')[0]}</div>
            <div>
              <div class="sn-sm">${s.name || s.user_id}</div>
              <div class="sid-sm">${s.user_id}</div>
            </div>
          </div>
          <div class="tags">
            ${deptBadge(s.user_id)}
            <span class="b bc">Sem ${s.current_sem ?? '—'}</span>
            <span class="b bv">${(s.department || '').split(' ')[0]}</span>
          </div>
        </div>`).join('')
    : `<div style="color:var(--faint);grid-column:span 3;padding:10px">No students loaded. Check API.</div>`;
}

/*  STUDENT DIRECTORY */
async function loadDirectory() {
  if (!ALL_STUDENTS.length) await loadAllStudents();
  renderDir();
}

function setDirFilter(type, btn) {
  _dirFilter = type;
  document.querySelectorAll('#ft-all,#ft-eng,#ft-art').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  renderDir();
}
function filterStus() { renderDir(); }

function renderDir() {
  let list = _dirFilter === 'eng' ? ENG_STUDENTS : _dirFilter === 'art' ? ART_STUDENTS : ALL_STUDENTS;
  const q = (document.getElementById('searchQ')?.value || '').toLowerCase();
  if (q) list = list.filter(s =>
    (s.name || '').toLowerCase().includes(q) ||
    (s.user_id || '').toLowerCase().includes(q) ||
    (s.department || '').toLowerCase().includes(q)
  );
  document.getElementById('dir-count').textContent = `${list.length} students`;
  const el = document.getElementById('stuList');
  if (!list.length) {
    el.innerHTML = `<div style="text-align:center;padding:28px;color:var(--faint)">No students found.</div>`;
    return;
  }
  el.innerHTML = list.map(s => `
    <div class="stu-row" onclick="openStudent('${s.user_id}')">
      <div class="sav ${avClass(s.user_id)}">${(s.name || '?')[0]}</div>
      <div style="flex:1">
        <div class="sn">${s.name || s.user_id}</div>
        <div class="sm">${s.user_id} &nbsp;·&nbsp; ${deptShort(s.department)} &nbsp;·&nbsp; Sem ${s.current_sem ?? '—'} &nbsp;·&nbsp; ${s.degree ?? '—'}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
        ${deptBadge(s.user_id)}
        <span class="b bc" style="font-family:'JetBrains Mono',monospace;font-size:.66rem">${s.roll_number || ''}</span>
      </div>
    </div>`).join('');
}

/* ENGINEERING SECTION */
async function loadEng() {
  if (!ENG_STUDENTS.length) await loadAllStudents();
  document.getElementById('eng-count').textContent = `${ENG_STUDENTS.length} students · Semesters 1–8`;
  renderDeptList('engList', ENG_STUDENTS);
}

/* ARTS SECTION */
async function loadArts() {
  if (!ART_STUDENTS.length) await loadAllStudents();
  document.getElementById('art-count').textContent = `${ART_STUDENTS.length} students · Semesters 1–6`;
  renderDeptList('artList', ART_STUDENTS);
}

function renderDeptList(containerId, list) {
  const el = document.getElementById(containerId);
  if (!list.length) { el.innerHTML = `<div style="color:var(--faint);padding:20px">No data available.</div>`; return; }

  /* Group by semester */
  const bySem = {};
  list.forEach(s => {
    const k = s.current_sem ?? '?';
    (bySem[k] = bySem[k] || []).push(s);
  });

  el.innerHTML = Object.keys(bySem)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map(sem => {
      const students = bySem[sem];
      return `
        <div style="margin-bottom:var(--sp-lg)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">
            <span style="font-size:.85rem;font-weight:800;color:var(--text)">Semester ${sem}</span>
            <span class="b bc">${students.length} students</span>
            <span style="font-size:.75rem;color:var(--faint);margin-left:4px">${students[0]?.department || ''}</span>
          </div>
          ${students.map(s => `
            <div class="stu-row" onclick="openStudent('${s.user_id}')" style="margin-bottom:8px">
              <div class="sav ${avClass(s.user_id)}">${(s.name || '?')[0]}</div>
              <div style="flex:1">
                <div class="sn">${s.name || s.user_id}</div>
                <div class="sm">${s.user_id} &nbsp;·&nbsp; ${deptShort(s.department)} &nbsp;·&nbsp; ${s.degree ?? '—'} &nbsp;·&nbsp; Section ${s.section ?? '—'}</div>
              </div>
              <span class="b bc" style="font-family:'JetBrains Mono',monospace;font-size:.66rem">${s.roll_number || ''}</span>
            </div>`).join('')}
        </div>`;
    }).join('');
}

/* ATTENDANCE */
async function loadAttendance() {
  if (!ALL_STUDENTS.length) await loadAllStudents();
  spin('attBody', 7);

  const sample = ALL_STUDENTS.slice(0, 25);
  const results = await Promise.all(sample.map(s => api(`/api/teacher/students/${s.user_id}`)));
  _attCache = sample.map((s, i) => ({ s, att: results[i]?.attendance || [] }));

  /* Stat cards */
  const pcts = _attCache.map(({ att }) => {
    const tc = att.reduce((a, r) => a + (r.conducted || 0), 0);
    const ta = att.reduce((a, r) => a + (r.attended || 0), 0);
    return tc ? Math.round(ta / tc * 100) : 0;
  });
  document.getElementById('att-tracked').textContent = sample.length;
  document.getElementById('att-avg').textContent = pcts.length ? Math.round(pcts.reduce((a, v) => a + v, 0) / pcts.length) + '%' : '—';
  document.getElementById('att-low').textContent = pcts.filter(p => p < 75).length;

  renderAttTable();
}

function setAttFilter(type, btn) {
  _attFilter = type;
  document.querySelectorAll('#at-all,#at-eng,#at-art').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  renderAttTable();
}

function renderAttTable() {
  let rows = _attCache;
  if (_attFilter === 'eng') rows = rows.filter(r => isEng(r.s.user_id));
  if (_attFilter === 'art') rows = rows.filter(r => !isEng(r.s.user_id));

  if (!rows.length) {
    document.getElementById('attBody').innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--faint)">No data for this filter.</td></tr>`;
    return;
  }
  document.getElementById('attBody').innerHTML = rows.map(({ s, att }) => {
    const tc = att.reduce((a, r) => a + (r.conducted || 0), 0);
    const ta = att.reduce((a, r) => a + (r.attended || 0), 0);
    const pct = tc ? Math.round(ta / tc * 100) : 0;
    const cl = pct >= 85 ? 'bg' : pct >= 75 ? 'by' : 'br';
    const st = pct >= 85 ? 'Good' : pct >= 75 ? 'Average' : 'Shortage';
    const fc = pct >= 85 ? 'var(--emerald)' : pct >= 75 ? 'var(--amber)' : 'var(--red)';
    return `<tr onclick="openStudent('${s.user_id}')" style="cursor:pointer">
      <td><strong style="color:var(--text)">${s.name || s.user_id}</strong></td>
      <td>${deptBadge(s.user_id)} <span style="font-family:'JetBrains Mono',monospace;font-size:.7rem;margin-left:5px">${s.user_id}</span></td>
      <td><span class="b bc">Sem ${s.current_sem ?? '—'}</span></td>
      <td>${tc}</td>
      <td>${ta}</td>
      <td><div style="display:flex;align-items:center;gap:9px">
        <div class="pbar"><div class="pfill" style="width:${pct}%;background:${fc}"></div></div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.75rem">${pct}%</span>
      </div></td>
      <td><span class="b ${cl}">${st}</span></td>
    </tr>`;
  }).join('');
}

/*INTERNAL MARKS*/
async function loadMarks() {
  if (!ALL_STUDENTS.length) await loadAllStudents();
  spin('marksBody', 9);

  const sample = ALL_STUDENTS.slice(0, 20);
  const results = await Promise.all(sample.map(s => api(`/api/teacher/students/${s.user_id}`)));
  _marksCache = [];
  sample.forEach((s, i) => (results[i]?.marks || []).forEach(m => _marksCache.push({ s, m })));

  /* Stat cards */
  const totals = _marksCache.map(r => r.m.total ?? 0);
  document.getElementById('mrk-done').textContent = _marksCache.length;
  document.getElementById('mrk-above').textContent = totals.filter(t => t / 70 * 100 >= 60).length;
  document.getElementById('mrk-below').textContent = totals.filter(t => t / 70 * 100 < 60).length;

  renderMarksTable();
}

function setMrkFilter(type, btn) {
  _mrkFilter = type;
  document.querySelectorAll('#mk-all,#mk-eng,#mk-art').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  renderMarksTable();
}

function renderMarksTable() {
  let rows = _marksCache;
  if (_mrkFilter === 'eng') rows = rows.filter(r => isEng(r.s.user_id));
  if (_mrkFilter === 'art') rows = rows.filter(r => !isEng(r.s.user_id));
  if (!rows.length) {
    document.getElementById('marksBody').innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--faint)">No data.</td></tr>`;
    return;
  }
  document.getElementById('marksBody').innerHTML = rows.map(({ s, m }) => {
    const tot = m.total ?? (m.ia1 + m.ia2 + m.ia3 + m.assignment);
    const { g, c } = gradeT70(tot);
    return `<tr onclick="openStudent('${s.user_id}')" style="cursor:pointer">
      <td><strong style="color:var(--text)">${s.name || s.user_id}</strong></td>
      <td>${deptBadge(s.user_id)} <span style="font-family:'JetBrains Mono',monospace;font-size:.7rem;margin-left:5px">${s.user_id}</span></td>
      <td style="max-width:160px;white-space:normal;font-size:.8rem;color:var(--text)">${m.subject_name || m.subject_code}</td>
      <td>${m.ia1}</td><td>${m.ia2}</td><td>${m.ia3}</td><td>${m.assignment}</td>
      <td><strong style="color:var(--text)">${tot}</strong></td>
      <td><span class="b ${c}">${g}</span></td>
    </tr>`;
  }).join('');
}

/*RESULTS*/
async function loadResults() {
  if (!ALL_STUDENTS.length) await loadAllStudents();
  spin('resBody', 7);

  const sample = ALL_STUDENTS.slice(0, 25);
  const results = await Promise.all(sample.map(s => api(`/api/teacher/students/${s.user_id}`)));
  _resCache = sample.map((s, i) => {
    const resRows = results[i]?.results || [];
    const cgpaVals = resRows.map(r => parseFloat(r.cgpa)).filter(Boolean);
    const overall = cgpaVals.length
      ? (cgpaVals.reduce((a, b) => a + b, 0) / cgpaVals.length).toFixed(2) : 0;
    return { s, wrap: { subjects: resRows, overall_cgpa: overall } };
  });

  /* Stat cards */
  const stats = await api('/api/teacher/stats');
  if (stats) document.getElementById('res-cgpa').textContent = stats.avg_cgpa ?? '—';
  const dists = _resCache.reduce((a, r) => a + (r.wrap.subjects || []).filter(x => x.grade === 'S' || x.grade === 'A+').length, 0);
  const arrears = _resCache.filter(r => (r.wrap.subjects || []).some(x => x.status === 'Fail')).length;
  document.getElementById('res-dist').textContent = dists;
  document.getElementById('res-arrear').textContent = arrears;

  renderResTable();
}

function setResFilter(type, btn) {
  _resFilter = type;
  document.querySelectorAll('#rs-all,#rs-eng,#rs-art').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  renderResTable();
}

function renderResTable() {
  let rows = _resCache;
  if (_resFilter === 'eng') rows = rows.filter(r => isEng(r.s.user_id));
  if (_resFilter === 'art') rows = rows.filter(r => !isEng(r.s.user_id));
  if (!rows.length) {
    document.getElementById('resBody').innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--faint)">No data.</td></tr>`;
    return;
  }
  document.getElementById('resBody').innerHTML = rows.map(({ s, wrap }) => {
    const cgpa = wrap.overall_cgpa ?? 0;
    const cv = parseFloat(cgpa) || 0;
    const gc = cv >= 9 ? 'bg' : cv >= 8 ? 'bc' : 'by';
    const hasArr = (wrap.subjects || []).some(x => x.status === 'Fail');
    return `<tr onclick="openStudent('${s.user_id}')" style="cursor:pointer">
      <td><strong style="color:var(--text)">${s.name || s.user_id}</strong></td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.75rem">${s.user_id}</td>
      <td>${deptBadge(s.user_id)}</td>
      <td style="max-width:180px;white-space:normal;font-size:.8rem">${deptShort(s.department)}</td>
      <td><span class="b bc">Sem ${s.current_sem ?? '—'}</span></td>
      <td><span class="b ${gc}">${cgpa || '—'}</span></td>
      <td><span class="b ${hasArr ? 'br' : 'bg'}">${hasArr ? 'Has Arrear' : 'Clear'}</span></td>
    </tr>`;
  }).join('');
}

/*STUDENT DETAIL MODAL*/
/*STUDENT MODAL — VIEW + EDIT */

let currentUid = null;
let editMode = false;
let _modalData = {};   
let _activeTab = 'personal';

async function openStudent(uid) {
  currentUid = uid;
  editMode = false;
  document.getElementById('stuModal').classList.add('open');
  document.getElementById('modal-name').textContent = uid;
  document.getElementById('modal-meta').textContent = 'Loading…';
  document.getElementById('savebar').style.display = 'none';
  document.getElementById('saveMsg').style.display = 'none';
  document.getElementById('btnToggleEdit').className = 'modal-edit-btn';
  document.getElementById('btnToggleEdit').textContent = '✏️ Edit';

  // Show spinner in all tabs
  ['personal', 'profile', 'attendance', 'marks', 'results'].forEach(t => {
    document.getElementById('tab-' + t).innerHTML =
      `<div style="text-align:center;padding:28px;color:var(--faint)">
        <div style="width:28px;height:28px;border:2px solid rgba(167,139,250,.2);border-top-color:var(--violet);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 10px"></div>
        Loading…</div>`;
  });

  // Switch to personal tab
  switchTab('personal', document.querySelector('.mtab'));

  // Use teacher endpoint — avoids student-only _guard_student 403
  const detail = await api(`/api/teacher/students/${uid}`);
  const personal = detail?.personal || {};
  const profile = detail?.profile || {};
  const att = detail?.attendance || [];
  const marks = detail?.marks || [];
  const resRows = detail?.results || [];
  const cgpaVals = resRows.map(r => parseFloat(r.cgpa)).filter(Boolean);
  const overallCgpa = cgpaVals.length
    ? (cgpaVals.reduce((a, b) => a + b, 0) / cgpaVals.length).toFixed(2) : 0;
  const results = { subjects: resRows, overall_cgpa: overallCgpa };

  _modalData = { personal, profile, att, marks, results };

  const name = ALL_STUDENTS.find(s => s.user_id === uid)?.name || uid;
  document.getElementById('modal-name').innerHTML = `${name} &nbsp;${deptBadge(uid)}`;
  document.getElementById('modal-meta').textContent =
    `${uid}  ·  ${profile?.department || '—'}  ·  Sem ${profile?.current_sem || '—'}  ·  ${profile?.degree || '—'}`;

  renderAllTabs(false);
}

/*Render all tab content*/
function renderAllTabs(editing) {
  renderPersonalTab(editing);
  renderProfileTab(editing);
  renderAttTab(editing);
  renderMarksTab(editing);
  renderResultsTab();
}

/*PERSONAL TAB*/
function renderPersonalTab(editing) {
  const p = _modalData.personal || {};
  const f = (id, val) => editing
    ? `<input class="edit-field" id="${id}" value="${(val || '').replace(/"/g, '&quot;')}">`
    : `<span style="font-size:.85rem;color:var(--text)">${val || '—'}</span>`;

  const cgpa = _modalData.results?.overall_cgpa ?? '—';
  const att = _modalData.att || [];
  const tc = att.reduce((a, r) => a + (r.conducted || 0), 0);
  const ta = att.reduce((a, r) => a + (r.attended || 0), 0);
  const pct = tc ? Math.round(ta / tc * 100) : 0;
  const attC = pct >= 75 ? 'var(--emerald)' : pct >= 65 ? 'var(--amber)' : 'var(--red)';
  const pass = (_modalData.results?.subjects || []).filter(s => s.status === 'Pass').length;

  document.getElementById('tab-personal').innerHTML = `
    <!-- Performance summary (always read-only) -->
    <div class="modal-section" style="margin-bottom:var(--sp-md)">
      <div class="modal-sec-title">Performance Summary</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        <div style="background:var(--surf3);border:1px solid var(--border);border-radius:13px;padding:16px;text-align:center">
          <div style="font-size:1.7rem;font-weight:800;background:var(--gc);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${cgpa}</div>
          <div style="font-size:.65rem;color:var(--faint);text-transform:uppercase;margin-top:4px">CGPA</div>
        </div>
        <div style="background:var(--surf3);border:1px solid var(--border);border-radius:13px;padding:16px;text-align:center">
          <div style="font-size:1.7rem;font-weight:800;color:${attC}">${pct}%</div>
          <div style="font-size:.65rem;color:var(--faint);text-transform:uppercase;margin-top:4px">Attendance</div>
        </div>
        <div style="background:var(--surf3);border:1px solid var(--border);border-radius:13px;padding:16px;text-align:center">
          <div style="font-size:1.7rem;font-weight:800;background:var(--ge);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${pass}</div>
          <div style="font-size:.65rem;color:var(--faint);text-transform:uppercase;margin-top:4px">Passed</div>
        </div>
      </div>
    </div>
    <!-- Personal fields -->
    <div class="modal-section">
      <div class="modal-sec-title">Personal Information ${editing ? '<span style="color:var(--emerald);font-size:.7rem;margin-left:8px">● Editing</span>' : ''}</div>
      <div class="g2" style="gap:0">
        <div>
          <div class="erow"><div class="elbl">Date of Birth</div><div class="eval">${f('e_dob', p.dob)}</div></div>
          <div class="erow"><div class="elbl">Gender</div>       <div class="eval">${f('e_gender', p.gender)}</div></div>
          <div class="erow"><div class="elbl">Blood Group</div>  <div class="eval">${f('e_blood', p.blood_group)}</div></div>
          <div class="erow"><div class="elbl">Mobile</div>       <div class="eval">${f('e_mobile', p.mobile)}</div></div>
          <div class="erow"><div class="elbl">Email</div>        <div class="eval">${f('e_email', p.email)}</div></div>
          <div class="erow"><div class="elbl">Nationality</div>  <div class="eval">${f('e_nat', p.nationality)}</div></div>
        </div>
        <div>
          <div class="erow"><div class="elbl">Father's Name</div> <div class="eval">${f('e_father', p.father_name)}</div></div>
          <div class="erow"><div class="elbl">Mother's Name</div> <div class="eval">${f('e_mother', p.mother_name)}</div></div>
          <div class="erow"><div class="elbl">Parent Mobile</div> <div class="eval">${f('e_pmob', p.parent_mobile)}</div></div>
          <div class="erow"><div class="elbl">Religion</div>      <div class="eval">${f('e_relig', p.religion)}</div></div>
          <div class="erow"><div class="elbl">Address</div>       <div class="eval">${f('e_addr', p.address)}</div></div>
        </div>
      </div>
    </div>`;
}

/*PROFILE TAB*/
function renderProfileTab(editing) {
  const p = _modalData.profile || {};
  const f = (id, val) => editing
    ? `<input class="edit-field" id="${id}" value="${(val || '').replace(/"/g, '&quot;')}">`
    : `<span style="font-size:.85rem;color:var(--text)">${val || '—'}</span>`;

  document.getElementById('tab-profile').innerHTML = `
    <div class="modal-section">
      <div class="modal-sec-title">Academic Profile ${editing ? '<span style="color:var(--emerald);font-size:.7rem;margin-left:8px">● Editing</span>' : ''}</div>
      <div class="g2" style="gap:0">
        <div>
          <div class="erow"><div class="elbl">Roll Number</div>    <div class="eval">${f('ep_roll', p.roll_number)}</div></div>
          <div class="erow"><div class="elbl">Department</div>     <div class="eval">${f('ep_dept', p.department)}</div></div>
          <div class="erow"><div class="elbl">Degree</div>         <div class="eval">${f('ep_deg', p.degree)}</div></div>
          <div class="erow"><div class="elbl">Specialisation</div> <div class="eval">${f('ep_spec', p.specialisation)}</div></div>
          <div class="erow"><div class="elbl">Batch</div>          <div class="eval">${f('ep_batch', p.batch)}</div></div>
          <div class="erow"><div class="elbl">Admission Year</div> <div class="eval">${f('ep_adm', p.admission_year)}</div></div>
          <div class="erow"><div class="elbl">Current Semester</div><div class="eval">${f('ep_sem', p.current_sem)}</div></div>
        </div>
        <div>
          <div class="erow"><div class="elbl">Section</div>        <div class="eval">${f('ep_sec', p.section)}</div></div>
          <div class="erow"><div class="elbl">Advisor</div>        <div class="eval">${f('ep_adv', p.advisor)}</div></div>
          <div class="erow"><div class="elbl">10th Board</div>     <div class="eval">${f('ep_b10', p.edu10_board)}</div></div>
          <div class="erow"><div class="elbl">10th %</div>         <div class="eval">${f('ep_p10', p.edu10_pct)}</div></div>
          <div class="erow"><div class="elbl">12th Board</div>     <div class="eval">${f('ep_b12', p.edu12_board)}</div></div>
          <div class="erow"><div class="elbl">12th %</div>         <div class="eval">${f('ep_p12', p.edu12_pct)}</div></div>
          <div class="erow"><div class="elbl">Entrance Exam</div>  <div class="eval">${f('ep_ent', p.entrance_exam)}</div></div>
        </div>
      </div>
    </div>`;
}

/*ATTENDANCE TAB*/
function renderAttTab(editing) {
  const rows = _modalData.att || [];
  if (!rows.length) {
    document.getElementById('tab-attendance').innerHTML =
      `<div style="text-align:center;padding:28px;color:var(--faint)">No attendance data.</div>`;
    return;
  }
  const header = editing
    ? `<tr><th>Subject</th><th>Code</th><th>Conducted</th><th>Attended</th><th>%</th></tr>`
    : `<tr><th>Subject</th><th>Code</th><th>Conducted</th><th>Attended</th><th>%</th><th>Status</th></tr>`;

  const trows = rows.map((r, i) => {
    const pct = r.conducted ? Math.round(r.attended / r.conducted * 100) : 0;
    const cl = pct >= 75 ? 'bg' : pct >= 65 ? 'by' : 'br';
    const fc = pct >= 75 ? 'var(--emerald)' : pct >= 65 ? 'var(--amber)' : 'var(--red)';
    if (editing) {
      return `<tr>
        <td style="max-width:150px;white-space:normal;font-size:.8rem">${r.subject_name}</td>
        <td><span class="b bc" style="font-size:.66rem">${r.subject_code}</span></td>
        <td><input class="num-input" id="att_c_${i}" data-code="${r.subject_code}" value="${r.conducted}" min="0" type="number"></td>
        <td><input class="num-input" id="att_a_${i}" data-code="${r.subject_code}" value="${r.attended}"  min="0" type="number"></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:.78rem">${pct}%</td>
      </tr>`;
    } else {
      return `<tr>
        <td style="max-width:150px;white-space:normal;font-size:.8rem">${r.subject_name}</td>
        <td><span class="b bc" style="font-size:.66rem">${r.subject_code}</span></td>
        <td>${r.conducted}</td><td>${r.attended}</td>
        <td><div style="display:flex;align-items:center;gap:8px">
          <div class="pbar" style="width:70px"><div class="pfill" style="width:${pct}%;background:${fc}"></div></div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:.74rem">${pct}%</span>
        </div></td>
        <td><span class="b ${cl}">${pct >= 75 ? 'Good' : pct >= 65 ? 'Warning' : 'Shortage'}</span></td>
      </tr>`;
    }
  }).join('');

  document.getElementById('tab-attendance').innerHTML = `
    <div class="modal-section">
      <div class="modal-sec-title">Attendance ${editing ? '<span style="color:var(--emerald);font-size:.7rem;margin-left:8px">● Edit conducted & attended values</span>' : ''}</div>
      <div class="tw"><table><thead>${header}</thead><tbody>${trows}</tbody></table></div>
    </div>`;
}

/*MARKS TAB*/
function renderMarksTab(editing) {
  const rows = _modalData.marks || [];
  if (!rows.length) {
    document.getElementById('tab-marks').innerHTML =
      `<div style="text-align:center;padding:28px;color:var(--faint)">No marks data.</div>`;
    return;
  }

  const trows = rows.map((m, i) => {
    const tot = m.total ?? (m.ia1 + m.ia2 + m.ia3 + m.assignment);
    const { g, c } = gradeT70(tot);
    if (editing) {
      return `<tr>
        <td style="max-width:140px;white-space:normal;font-size:.78rem">${m.subject_name}</td>
        <td><span class="b bv" style="font-size:.66rem">${m.subject_code}</span></td>
        <td><input class="num-input" id="mk_i1_${i}" data-code="${m.subject_code}" value="${m.ia1}" min="0" max="20" type="number"></td>
        <td><input class="num-input" id="mk_i2_${i}" data-code="${m.subject_code}" value="${m.ia2}" min="0" max="20" type="number"></td>
        <td><input class="num-input" id="mk_i3_${i}" data-code="${m.subject_code}" value="${m.ia3}" min="0" max="20" type="number"></td>
        <td><input class="num-input" id="mk_as_${i}" data-code="${m.subject_code}" value="${m.assignment}" min="0" max="10" type="number"></td>
        <td><strong style="color:var(--text)">${tot}</strong></td>
        <td><span class="b ${c}">${g}</span></td>
      </tr>`;
    } else {
      return `<tr>
        <td style="max-width:140px;white-space:normal;font-size:.78rem">${m.subject_name}</td>
        <td><span class="b bv" style="font-size:.66rem">${m.subject_code}</span></td>
        <td>${m.ia1}</td><td>${m.ia2}</td><td>${m.ia3}</td><td>${m.assignment}</td>
        <td><strong style="color:var(--text)">${tot}</strong></td>
        <td><span class="b ${c}">${g}</span></td>
      </tr>`;
    }
  }).join('');

  document.getElementById('tab-marks').innerHTML = `
    <div class="modal-section">
      <div class="modal-sec-title">Internal Marks ${editing ? '<span style="color:var(--emerald);font-size:.7rem;margin-left:8px">● Edit IA1/IA2/IA3/Assignment (max 20/20/20/10)</span>' : ''}</div>
      <div class="tw"><table>
        <thead><tr><th>Subject</th><th>Code</th><th>IA1</th><th>IA2</th><th>IA3</th><th>Assign</th><th>Total</th><th>Grade</th></tr></thead>
        <tbody>${trows}</tbody>
      </table></div>
    </div>`;
}

/*RESULTS TAB (read-only always)*/
function renderResultsTab() {
  const wrap = _modalData.results || {};
  const subs = wrap.subjects || [];
  if (!subs.length) {
    document.getElementById('tab-results').innerHTML =
      `<div style="text-align:center;padding:28px;color:var(--faint)">No results data yet.</div>`;
    return;
  }
  const gMap = { S: 'bg', 'A+': 'bg', A: 'bc', 'B+': 'by', B: 'by', F: 'br' };
  document.getElementById('tab-results').innerHTML = `
    <div class="modal-section">
      <div class="modal-sec-title">Exam Results &nbsp;<span style="color:var(--faint);font-size:.72rem">(read-only)</span></div>
      <div class="tw"><table>
        <thead><tr><th>Subject</th><th>Code</th><th>Internal</th><th>External</th><th>Total</th><th>Grade</th><th>Status</th></tr></thead>
        <tbody>${subs.map(r => `<tr>
          <td style="max-width:160px;white-space:normal;font-size:.8rem">${r.subject_name}</td>
          <td><span class="b bc" style="font-size:.66rem">${r.subject_code}</span></td>
          <td>${r.internal}</td><td>${r.external}</td><td>${r.total}</td>
          <td><span class="b ${gMap[r.grade] || 'bv'}">${r.grade}</span></td>
          <td><span class="b ${r.status === 'Pass' ? 'bg' : 'br'}">${r.status}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
}

/*EDIT MODE TOGGLE*/
function toggleEditMode() {
  editMode = !editMode;
  const btn = document.getElementById('btnToggleEdit');
  const bar = document.getElementById('savebar');
  btn.textContent = editMode ? '👁 View Mode' : '✏️ Edit';
  btn.className = 'modal-edit-btn' + (editMode ? ' active' : '');
  bar.style.display = editMode ? 'flex' : 'none';
  hideSaveMsg();
  renderAllTabs(editMode);
  // Re-activate current tab
  document.getElementById('tab-' + _activeTab).classList.add('act');
}

function cancelEdit() {
  editMode = false;
  document.getElementById('btnToggleEdit').textContent = '✏️ Edit';
  document.getElementById('btnToggleEdit').className = 'modal-edit-btn';
  document.getElementById('savebar').style.display = 'none';
  hideSaveMsg();
  renderAllTabs(false);
  document.getElementById('tab-' + _activeTab).classList.add('act');
}

/*TAB SWITCHER*/
function switchTab(name, btn) {
  _activeTab = name;
  document.querySelectorAll('.mtab').forEach(b => b.classList.remove('act'));
  if (btn) btn.classList.add('act');
  document.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('act'));
  document.getElementById('tab-' + name).classList.add('act');
}

/*SAVE — dispatches to correct endpoint*/
async function saveCurrentTab() {
  const btn = document.querySelector('.sbtn-save');
  btn.textContent = 'Saving…'; btn.disabled = true;
  hideSaveMsg();

  try {
    switch (_activeTab) {
      case 'personal': await savePersonal(); break;
      case 'profile': await saveProfile(); break;
      case 'attendance': await saveAttendance(); break;
      case 'marks': await saveMarks(); break;
      default: showSaveMsg('Nothing to save on this tab.', 'warn');
    }
  } catch (e) {
    showSaveMsg('Error: ' + e.message, 'error');
  }

  btn.textContent = '💾 Save Changes'; btn.disabled = false;
}

/*Save personal*/
async function savePersonal() {
  const body = {
    dob: gv('e_dob'),
    gender: gv('e_gender'),
    blood_group: gv('e_blood'),
    mobile: gv('e_mobile'),
    email: gv('e_email'),
    nationality: gv('e_nat'),
    father_name: gv('e_father'),
    mother_name: gv('e_mother'),
    parent_mobile: gv('e_pmob'),
    religion: gv('e_relig'),
    address: gv('e_addr'),
  };
  // Remove nulls
  Object.keys(body).forEach(k => { if (!body[k]) delete body[k]; });

  const r = await fetch(`${API}/api/teacher/edit/personal/${currentUid}`, {
    method: 'PUT', headers: H(), body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || `HTTP ${r.status} — check API key is service role`);

  // Update local cache
  Object.assign(_modalData.personal, body);
  showSaveMsg('✓ Personal details saved to Supabase!', 'ok');
  renderPersonalTab(true);
}

/* Save profile */
async function saveProfile() {
  const body = {
    roll_number: gv('ep_roll'),
    department: gv('ep_dept'),
    degree: gv('ep_deg'),
    specialisation: gv('ep_spec'),
    batch: gv('ep_batch'),
    admission_year: gv('ep_adm'),
    current_sem: gv('ep_sem'),
    section: gv('ep_sec'),
    advisor: gv('ep_adv'),
    edu10_board: gv('ep_b10'),
    edu10_pct: gv('ep_p10'),
    edu12_board: gv('ep_b12'),
    edu12_pct: gv('ep_p12'),
    entrance_exam: gv('ep_ent'),
  };
  Object.keys(body).forEach(k => { if (!body[k]) delete body[k]; });

  const r = await fetch(`${API}/api/teacher/edit/profile/${currentUid}`, {
    method: 'PUT', headers: H(), body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || `HTTP ${r.status} — check API key is service role`);

  Object.assign(_modalData.profile, body);
  // Update modal header meta
  document.getElementById('modal-meta').textContent =
    `${currentUid}  ·  ${_modalData.profile.department || '—'}  ·  Sem ${_modalData.profile.current_sem || '—'}  ·  ${_modalData.profile.degree || '—'}`;
  showSaveMsg('✓ Academic profile saved to Supabase!', 'ok');
  renderProfileTab(true);
}

/*Save attendance*/
async function saveAttendance() {
  const rows = _modalData.att || [];
  const errors = [];
  let saved = 0;

  for (let i = 0; i < rows.length; i++) {
    const c = parseInt(document.getElementById(`att_c_${i}`)?.value ?? rows[i].conducted);
    const a = parseInt(document.getElementById(`att_a_${i}`)?.value ?? rows[i].attended);
    if (a > c) { errors.push(`${rows[i].subject_code}: attended > conducted`); continue; }

    const r = await fetch(`${API}/api/teacher/edit/attendance/${currentUid}`, {
      method: 'PUT', headers: H(),
      body: JSON.stringify({ subject_code: rows[i].subject_code, conducted: c, attended: a, semester: rows[i].semester || null })
    });
    if (r.ok) {
      rows[i].conducted = c; rows[i].attended = a; saved++;
    } else {
      const j = await r.json();
      errors.push(j.detail || rows[i].subject_code);
    }
  }

  if (errors.length) {
    showSaveMsg(`Saved ${saved}, errors: ${errors.join(', ')}`, 'warn');
  } else {
    showSaveMsg(`✓ Attendance updated for all ${saved} subjects!`, 'ok');
  }
  renderAttTab(true);
}

/*Save marks*/
async function saveMarks() {
  const rows = _modalData.marks || [];
  const errors = [];
  let saved = 0;

  for (let i = 0; i < rows.length; i++) {
    const ia1 = parseInt(document.getElementById(`mk_i1_${i}`)?.value ?? rows[i].ia1);
    const ia2 = parseInt(document.getElementById(`mk_i2_${i}`)?.value ?? rows[i].ia2);
    const ia3 = parseInt(document.getElementById(`mk_i3_${i}`)?.value ?? rows[i].ia3);
    const asgn = parseInt(document.getElementById(`mk_as_${i}`)?.value ?? rows[i].assignment);

    const r = await fetch(`${API}/api/teacher/edit/marks/${currentUid}`, {
      method: 'PUT', headers: H(),
      body: JSON.stringify({ subject_code: rows[i].subject_code, ia1, ia2, ia3, assignment: asgn, semester: rows[i].semester || null })
    });
    if (r.ok) {
      const j = await r.json();
      rows[i].ia1 = ia1; rows[i].ia2 = ia2; rows[i].ia3 = ia3;
      rows[i].assignment = asgn; rows[i].total = j.total;
      saved++;
    } else {
      const j = await r.json().catch(() => ({}));
      errors.push(j.detail || rows[i].subject_code);
    }
  }

  if (errors.length) {
    showSaveMsg(`Saved ${saved}, errors: ${errors.join(', ')}`, 'warn');
  } else {
    showSaveMsg(`✓ Marks updated for all ${saved} subjects!`, 'ok');
  }
  renderMarksTab(true);
}

/*Helpers*/
function gv(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : null;
}

function showSaveMsg(msg, type) {
  const el = document.getElementById('saveMsg');
  const styles = {
    ok: 'background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.25);color:#34d399',
    warn: 'background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);color:#fbbf24',
    error: 'background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);color:#f87171',
  };
  el.style.cssText = `display:block;padding:10px 16px;border-radius:10px;margin-bottom:14px;font-size:.83rem;font-weight:600;${styles[type] || styles.ok}`;
  el.textContent = msg;
  // Auto-hide
  setTimeout(() => hideSaveMsg(), 5000);
}

function hideSaveMsg() {
  document.getElementById('saveMsg').style.display = 'none';
}

function closeModal() {
  document.getElementById('stuModal').classList.remove('open');
  editMode = false;
  currentUid = null;
  _modalData = {};
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/*NAVIGATION*/
const TITLES = {
  dashboard: 'Faculty Dashboard', students: 'Student Directory',
  eng: 'Engineering Department', arts: 'Arts Department',
  attendance: 'Attendance Management', marks: 'Internal Marks', results: 'Results Overview'
};
const LOADERS = {
  dashboard: loadDashboard,
  students: loadDirectory,
  eng: loadEng,
  arts: loadArts,
  attendance: loadAttendance,
  marks: loadMarks,
  results: loadResults,
};
const _loaded = {};

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
  if (!_loaded[name] && LOADERS[name]) { _loaded[name] = true; LOADERS[name](); }
  if (name === 'od-requests') loadOdRequests();
}

function signOut() { sessionStorage.clear(); window.location.href = 'index.html'; }

/* Clock */
function tick() {
  const n = new Date();
  const el = document.getElementById('tbadge');
  if (el) el.textContent = n.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + '  ·  ' + n.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
setInterval(tick, 1000); tick();

/* Boot */
_loaded['dashboard'] = true;
loadDashboard();
/*OD REQUEST MANAGEMENT — TEACHER SIDE */

let _odAllReqs = [];
let _odTFilter = 'all';
const tDept = (tId || '').startsWith('TCH') ? sessionStorage.getItem('department') || '' : '';

/* ── Load OD requests for this teacher's dept ─────────────────────────────── */
async function loadOdRequests() {
  let reqs = [];

  /* Try real API */
  try {
    const r = await api('/api/od-requests');
    if (r && Array.isArray(r)) reqs = r;
  } catch (_) { }

  /* Also check all students' session storage (demo mode — same browser) */
  try {
    const local = JSON.parse(sessionStorage.getItem('od_requests') || '[]');
    const existing = new Set(reqs.map(x => x.id));
    local.forEach(l => { if (!existing.has(l.id)) reqs.unshift(l); });
  } catch (_) { }

  /* Filter by teacher's department */
  const teacherDept = sessionStorage.getItem('department') || '';
  if (teacherDept.toLowerCase().includes('eng')) {
    reqs = reqs.filter(r => (r.student_id || r.dept || '').toString().toLowerCase().includes('eng') ||
      (r.dept || '').toLowerCase().includes('eng'));
  } else if (teacherDept.toLowerCase().includes('art')) {
    reqs = reqs.filter(r => (r.student_id || r.dept || '').toString().toLowerCase().includes('art') ||
      (r.dept || '').toLowerCase().includes('art'));
  }

  _odAllReqs = reqs;
  odUpdateTeacherStats(reqs);
  odRenderTeacherList(reqs);
  odUpdateBadge(reqs);
}

function odUpdateBadge(reqs) {
  const pending = reqs.filter(r => !r.status || r.status === 'pending').length;
  const badge = document.getElementById('od-badge');
  if (!badge) return;
  if (pending > 0) {
    badge.style.display = 'inline';
    badge.textContent = pending;
  } else {
    badge.style.display = 'none';
  }
  /* Notification banner */
  const banner = document.getElementById('od-notif-banner');
  const txt = document.getElementById('od-notif-text');
  if (banner && txt) {
    if (pending > 0) {
      banner.style.display = 'flex';
      txt.textContent = `${pending} OD request${pending > 1 ? 's' : ''} waiting for your review.`;
    } else {
      banner.style.display = 'none';
    }
  }
}

function odUpdateTeacherStats(reqs) {
  document.getElementById('od-t-total').textContent = reqs.length;
  document.getElementById('od-t-pending').textContent = reqs.filter(r => !r.status || r.status === 'pending').length;
  document.getElementById('od-t-approved').textContent = reqs.filter(r => r.status === 'approved').length;
}

function setOdFilter(f, btn) {
  _odTFilter = f;
  document.querySelectorAll('[id^="odf-"]').forEach(b => b.classList.remove('act'));
  if (btn) btn.classList.add('act');
  let filtered = _odAllReqs;
  if (f === 'pending') filtered = _odAllReqs.filter(r => !r.status || r.status === 'pending');
  else if (f === 'eng') filtered = _odAllReqs.filter(r => (r.student_id || '').startsWith('ENG') || (r.dept || '').toLowerCase().includes('eng'));
  else if (f === 'art') filtered = _odAllReqs.filter(r => (r.student_id || '').startsWith('ART') || (r.dept || '').toLowerCase().includes('art'));
  odRenderTeacherList(filtered);
}

function odRenderTeacherList(reqs) {
  const el = document.getElementById('od-request-list');
  if (!el) return;

  if (!reqs.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--faint)">
      <div style="font-size:2rem;margin-bottom:10px">📋</div>No OD requests found.</div>`;
    return;
  }

  const fmt = d => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch (_) { return d; }
  };

  el.innerHTML = reqs.map((r, idx) => {
    const isPending = !r.status || r.status === 'pending';
    const deptBadge = (r.student_id || '').startsWith('ENG') || (r.dept || '').toLowerCase().includes('eng')
      ? `<span class="b beng">ENG</span>` : `<span class="b bart">ART</span>`;
    const statusHtml = isPending
      ? `<span style="background:rgba(251,191,36,.12);color:var(--amber);border:1px solid rgba(251,191,36,.3);font-size:.68rem;font-weight:700;padding:3px 9px;border-radius:20px;text-transform:uppercase">⏳ Pending</span>`
      : r.status === 'approved'
        ? `<span style="background:rgba(52,211,153,.12);color:var(--emerald);border:1px solid rgba(52,211,153,.3);font-size:.68rem;font-weight:700;padding:3px 9px;border-radius:20px;text-transform:uppercase">✅ Approved</span>`
        : `<span style="background:rgba(248,113,113,.12);color:var(--red);border:1px solid rgba(248,113,113,.3);font-size:.68rem;font-weight:700;padding:3px 9px;border-radius:20px;text-transform:uppercase">❌ Rejected</span>`;

    return `
    <div style="background:var(--surf2);border:1px solid var(--border);border-radius:14px;padding:18px 20px;margin-bottom:14px;transition:border-color .2s" id="od-card-${idx}">
      <!-- Top row: student info + status -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--violet),var(--cyan));display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:800;color:#fff;flex-shrink:0">
            ${(r.name || r.student_id || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style="font-size:.9rem;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px">
              ${r.name || r.student_id} ${deptBadge}
            </div>
            <div style="font-size:.75rem;color:var(--faint);margin-top:2px">${r.student_id || '—'}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
          ${statusHtml}
          <span style="font-size:.72rem;color:var(--faint)">${r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}</span>
        </div>
      </div>

      <!-- Details grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:var(--surf3);border-radius:10px;padding:14px;margin-bottom:${isPending ? '14px' : '0'}">
        <div>
          <div style="font-size:.65rem;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Institution</div>
          <div style="font-size:.84rem;font-weight:600;color:var(--text)">🏛 ${r.college}</div>
        </div>
        <div>
          <div style="font-size:.65rem;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Event / Purpose</div>
          <div style="font-size:.84rem;font-weight:600;color:var(--cyan)">🎯 ${r.event}</div>
        </div>
        <div>
          <div style="font-size:.65rem;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Duration</div>
          <div style="font-size:.82rem;color:var(--dim)">📅 ${fmt(r.from_date)} → ${fmt(r.to_date)}</div>
        </div>
        <div>
          <div style="font-size:.65rem;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Certificate</div>
          <div style="font-size:.82rem;color:var(--emerald)">📎 ${r.file_name || 'Attached'}</div>
        </div>
        ${r.notes ? `<div style="grid-column:span 2">
          <div style="font-size:.65rem;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Notes</div>
          <div style="font-size:.82rem;color:var(--dim)">💬 ${r.notes}</div>
        </div>` : ''}
      </div>

      <!-- Action buttons (pending only) -->
      ${isPending ? `
      <div style="display:flex;gap:10px;margin-top:14px">
        <button onclick="odAction('${r.id}',${idx},'approved')"
          style="flex:1;padding:10px;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.3);border-radius:10px;color:var(--emerald);font-family:'Plus Jakarta Sans',sans-serif;font-size:.84rem;font-weight:700;cursor:pointer;transition:background .2s"
          onmouseover="this.style.background='rgba(52,211,153,.2)'" onmouseout="this.style.background='rgba(52,211,153,.12)'">
          ✅ Approve OD
        </button>
        <button onclick="odAction('${r.id}',${idx},'rejected')"
          style="flex:1;padding:10px;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);border-radius:10px;color:var(--red);font-family:'Plus Jakarta Sans',sans-serif;font-size:.84rem;font-weight:700;cursor:pointer;transition:background .2s"
          onmouseover="this.style.background='rgba(248,113,113,.18)'" onmouseout="this.style.background='rgba(248,113,113,.08)'">
          ❌ Reject
        </button>
      </div>` : ''}
    </div>`;
  }).join('');
}

async function odAction(id, idx, action) {
  /* Try API */
  try {
    await fetch(`${API}/api/od-request/${id}/${action}`, { method: 'POST', headers: H() });
  } catch (_) { }


  const local = JSON.parse(sessionStorage.getItem('od_requests') || '[]');
  local.forEach(r => { if (r.id === id) r.status = action; });
  sessionStorage.setItem('od_requests', JSON.stringify(local));

  _odAllReqs.forEach(r => { if (r.id === id) r.status = action; });
  odUpdateTeacherStats(_odAllReqs);
  odUpdateBadge(_odAllReqs);

  let filtered = _odAllReqs;
  if (_odTFilter === 'pending') filtered = _odAllReqs.filter(r => !r.status || r.status === 'pending');
  else if (_odTFilter === 'eng') filtered = _odAllReqs.filter(r => (r.student_id || '').startsWith('ENG'));
  else if (_odTFilter === 'art') filtered = _odAllReqs.filter(r => (r.student_id || '').startsWith('ART'));
  odRenderTeacherList(filtered);
}


if (typeof TITLES !== 'undefined') TITLES['od-requests'] = 'OD Requests';


setTimeout(loadOdRequests, 1500);