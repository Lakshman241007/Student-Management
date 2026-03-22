# VelsPortal — Student Management System

**Built by:** Lakshmana
**AI Tools Used:** Grok (CSS & UI design), Gemini (content writing)
**Stack:** FastAPI · Supabase · Vercel · Railway · Vanilla HTML/CSS/JS

---

## What Is This?

VelsPortal is a full-stack academic management portal built for Vels Institution of Science, Technology & Advanced Studies. It gives students, teachers, and administrators their own dedicated dashboards — all connected to a live database.

Students can check their attendance, marks, CGPA, exam results, and submit OD (On-Duty) requests. Teachers can view all students across Engineering and Arts departments, edit attendance and marks, manage OD approvals, and post notices. Admins get a separate panel to add or remove students and teachers from the system entirely.

---

## The Tech Stack

The frontend is plain HTML, CSS, and JavaScript — no React, no framework, just clean files hosted on Vercel. The backend is a Python FastAPI application running on Railway, which talks to a Supabase PostgreSQL database. JWT tokens handle login sessions so everything stays secure.

---

## How the Whole Thing Was Built

### Where It Started

The project started as a local setup — HTML files and a Python backend running on `localhost:8000`. Everything worked fine on a laptop but the goal was to get it live on the internet so anyone could access it.

### Moving to Railway (Backend)

The first step was getting the FastAPI backend off localhost and onto Railway. Railway is a cloud platform that runs Python apps — you just connect your GitHub repo and it builds automatically.

The first thing we did was create a `railway.toml` file to tell Railway how to start the app:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
```

And a `Procfile` as a backup:

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

The `--host 0.0.0.0` part is important — without it, Railway can't reach the app from outside. `$PORT` is a variable Railway injects automatically.

### The requirements.txt Battle

This is where things got messy. The `requirements.txt` file lists all the Python packages the app needs. Getting the versions right took a few attempts:

- First try: `supabase>=2.0` — too loose, installed a version that conflicted with `httpx`
- Second try: pinned `httpx==0.26.0` — but `supabase==2.3.0` needs `httpx<0.25.0`, so pip refused to build
- Third try: manually pinned all supabase sub-packages — caused even more conflicts
- Final fix: `supabase==2.7.4` — the latest stable version that handles its own dependencies correctly

The final working `requirements.txt`:

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
supabase==2.7.4
python-dotenv==1.0.0
PyJWT==2.8.0
mangum==0.17.0
```

### The mangum Import Fix

`mangum` is a library that wraps FastAPI for serverless environments. We had it imported at the bottom of `main.py` with a bare import — meaning if it failed for any reason, the whole app crashed on startup. We wrapped it in a try/except so Railway doesn't care if it's not needed:

```python
try:
    from mangum import Mangum
    handler = Mangum(app, lifespan="off")
except ImportError:
    pass
```

### Moving to Vercel (Frontend)

Vercel is perfect for static sites — HTML, CSS, and JS files with no build step. You connect your GitHub repo, set the framework to "Other", and it deploys in under a minute.

The `vercel.json` file handles routing. The first version we wrote had a `"builds"` block that broke CSS and JS loading entirely — the page would load as a black screen with nothing on it. The fix was removing the builds block completely and just using rewrites:

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    { "source": "/student", "destination": "/student.html" },
    { "source": "/teacher", "destination": "/teacher.html" }
  ]
}
```

Vercel serves static files perfectly without any build configuration.

### The API URL Problem (The Big One)

Once both Railway and Vercel were live, the site was still broken — pages would flash, redirect endlessly, and show a black screen. The browser console showed an uncaught error on `script.js:65`.

Digging in, we found three separate problems all happening at once:

**Problem 1 — Missing https://**
Every JS file had the Railway URL like this:
```js
const API = 'student-management-production-13fd.up.railway.app';
```
Without `https://`, the browser treats it as a relative path, not a URL. Every API call fails silently, the 401 error handler fires, it clears the session storage, and redirects back to login — over and over. Adding `https://` fixed the loop.

**Problem 2 — Two different Railway URLs**
Some files had the old URL and others had the new one. So even after adding `https://`, some pages were hitting a dead endpoint.

**Problem 3 — Wrong file content**
The biggest issue: `script.js` (which the login page loads) had been accidentally overwritten with the contents of `teacher_script.js`. So when the login page loaded, it immediately tried to run teacher dashboard code — looking for HTML elements like `tAv` and `tName` that don't exist on the login page. This crashed the entire script before the login form even initialized. We had to fully reconstruct the correct login `script.js` from scratch.

### Environment Variables

The backend needs four environment variables to work. These are set in Railway's dashboard under the Variables tab — Railway does NOT read your `.env` file automatically:

```
SUPABASE_URL=your-supabase-project-url
SUPABASE_KEY=your-service-role-key
SECRET_KEY=your-jwt-secret
ALLOWED_ORIGINS=https://your-vercel-url.vercel.app
PORT=8000
```

`ALLOWED_ORIGINS` is the CORS whitelist — if your Vercel URL isn't in here, every API request from the frontend gets blocked by the browser.

---

## Project Structure

```
├── index.html              ← Login page
├── student.html            ← Student dashboard
├── teacher.html            ← Teacher dashboard
├── management.html         ← Admin panel
├── management_login.html   ← Admin login
├── script.js               ← Login page logic
├── student_script.js       ← Student dashboard logic
├── teacher_script.js       ← Teacher dashboard logic
├── style.css               ← Login page styles
├── student_style.css       ← Student styles
├── teacher_style.css       ← Teacher styles
├── main.py                 ← FastAPI backend (all API routes)
├── requirements.txt        ← Python dependencies
├── railway.toml            ← Railway build & start config
├── Procfile                ← Fallback start command
├── vercel.json             ← Vercel routing config
└── .env                    ← Local dev only — DO NOT COMMIT
```

---

## Roles & Access

| Role | ID Format | Default Password |
|------|-----------|-----------------|
| Engineering Student | ENG001 – ENG160 | student@123 |
| Arts Student | ART001 – ART120 | student@123 |
| Teacher | TCH001 – TCH010 | teacher@123 |
| Admin | ADMIN001+ | admin@vels123 |

---

## Database Tables (Supabase)

| Table | Purpose |
|-------|---------|
| `users` | All login credentials and roles |
| `student_personal` | DOB, parents, contact info |
| `student_profile` | Department, semester, roll number |
| `teacher_profile` | Designation, qualifications, subjects |
| `attendance` | Subject-wise conducted/attended counts |
| `internal_marks` | IA1, IA2, IA3, assignment marks |
| `exam_results` | Semester results, grades, CGPA |
| `notices` | Announcements per student |
| `od_requests` | OD request submissions and approvals |
| `admin_users` | Admin login credentials |
| `admin_audit_log` | Tracks every admin action |

---

## Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Add your .env file with the 4 variables listed above

# Start the backend
uvicorn main:app --reload --port 8000

# Open index.html in your browser (use Live Server in VS Code)
```

For local dev, temporarily change `const API` in the JS files to `http://localhost:8000`.

---

**Also where each code (function) i mentioned its procress in command lines**

## Credits

- **CSS & UI Design**     — Grok
- **Content Writing**     — Gemini
- **Backend, deployment** — Lakshman
- **Built & managed by**  — Lakshman