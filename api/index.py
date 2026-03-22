"""
VelsPortal v4  ·  Python + FastAPI Backend
==========================================
Supports:
  • Engineering Dept: 8 sems × 20 students = 160 students (ENG001–ENG160)
  • Arts Dept:        6 sems × 20 students = 120 students (ART001–ART120)
  • Teachers: TCH001–TCH010+
  • Admin:    ADMIN001+ (full CRUD over students & teachers)

Install:
    pip install fastapi uvicorn "supabase>=2.0" python-dotenv PyJWT

Run:
    uvicorn main:app --reload --port 8000

Swagger docs: http://localhost:8000/docs
"""

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from supabase import create_client, Client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
logger = logging.getLogger("eduportal")


#  CONFIG

SUPABASE_URL       = os.getenv("SUPABASE_URL",  "https://your-project.supabase.co")
SUPABASE_KEY       = os.getenv("SUPABASE_KEY",  "your-service-role-key")
SECRET_KEY         = os.getenv("SECRET_KEY",    "change-me-in-production")
ALGORITHM          = "HS256"
TOKEN_EXPIRE_HOURS = 8

_env_origins = os.getenv("ALLOWED_ORIGINS", "")
_base_origins = [o.strip() for o in _env_origins.split(",") if o.strip()]
_live_server_origins = [
    "http://127.0.0.1:5500", "http://localhost:5500",
    "http://127.0.0.1:5501", "http://localhost:5501",
    "http://127.0.0.1:3000", "http://localhost:3000",
    "null",
]
ALLOWED_ORIGINS = list(set(_base_origins + _live_server_origins))

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


#  APP

app = FastAPI(
    title="VelsPortal API",
    version="4.0",
    description="Academic Management System — Engineering + Arts + Admin Panel",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


# 
#  PYDANTIC SCHEMAS
# 
class LoginRequest(BaseModel):
    user_id:  str
    password: str
    role:     str

class AdminLoginRequest(BaseModel):
    admin_id: str
    password: str

class ChangePasswordRequest(BaseModel):
    user_id:          str
    current_password: str
    new_password:     str

class AttendanceUpdateRequest(BaseModel):
    subject_code: str
    conducted:    int
    attended:     int
    semester:     Optional[str] = None

class MarksUpdateRequest(BaseModel):
    subject_code: str
    ia1:          int
    ia2:          int
    ia3:          int
    assignment:   int
    semester:     Optional[str] = None

class NoticeCreateRequest(BaseModel):
    user_id: str
    title:   str
    body:    str
    type:    Optional[str] = "info"

# Edit schemas for teacher to update student data
class EditPersonalRequest(BaseModel):
    name:           Optional[str] = None
    dob:            Optional[str] = None
    gender:         Optional[str] = None
    blood_group:    Optional[str] = None
    nationality:    Optional[str] = None
    religion:       Optional[str] = None
    mobile:         Optional[str] = None
    email:          Optional[str] = None
    address:        Optional[str] = None
    father_name:    Optional[str] = None
    mother_name:    Optional[str] = None
    parent_mobile:  Optional[str] = None

class EditProfileRequest(BaseModel):
    roll_number:    Optional[str] = None
    department:     Optional[str] = None
    degree:         Optional[str] = None
    specialisation: Optional[str] = None
    batch:          Optional[str] = None
    admission_year: Optional[str] = None
    current_sem:    Optional[str] = None
    section:        Optional[str] = None
    advisor:        Optional[str] = None
    edu10_board:    Optional[str] = None
    edu10_pct:      Optional[str] = None
    edu12_board:    Optional[str] = None
    edu12_pct:      Optional[str] = None
    entrance_exam:  Optional[str] = None

class EditAttendanceRequest(BaseModel):
    subject_code: str
    conducted:    int
    attended:     int
    semester:     Optional[str] = None

class EditMarksRequest(BaseModel):
    subject_code: str
    ia1:          int
    ia2:          int
    ia3:          int
    assignment:   int
    semester:     Optional[str] = None

# NEW: Admin schemas 
class AddStudentRequest(BaseModel):
    """Admin adds a brand-new student (users + student_personal + student_profile)."""
    user_id:        str
    password:       str
    name:           str
    role:           str = "student"
    # personal
    mobile:         Optional[str] = None
    email:          Optional[str] = None
    dob:            Optional[str] = None
    gender:         Optional[str] = None
    blood_group:    Optional[str] = None
    nationality:    Optional[str] = None
    religion:       Optional[str] = None
    address:        Optional[str] = None
    father_name:    Optional[str] = None
    mother_name:    Optional[str] = None
    parent_mobile:  Optional[str] = None
    # profile
    department:     Optional[str] = None
    degree:         Optional[str] = None
    specialisation: Optional[str] = None
    batch:          Optional[str] = None
    admission_year: Optional[int] = None
    current_sem:    Optional[int] = None
    roll_number:    Optional[str] = None
    section:        Optional[str] = None
    advisor:        Optional[str] = None
    edu10_board:    Optional[str] = None
    edu10_pct:      Optional[float] = None
    edu12_board:    Optional[str] = None
    edu12_pct:      Optional[float] = None
    entrance_exam:  Optional[str] = None

class AddTeacherRequest(BaseModel):
    """Admin adds a brand-new teacher (users + teacher_profile)."""
    user_id:        str
    password:       str
    name:           str
    role:           str = "teacher"
    mobile:         Optional[str] = None
    email:          Optional[str] = None
    dob:            Optional[str] = None
    gender:         Optional[str] = None
    blood_group:    Optional[str] = None
    department:     Optional[str] = None
    designation:    Optional[str] = None
    qualification:  Optional[str] = None
    experience:     Optional[int] = None
    subjects:       Optional[str] = None
    employee_id:    Optional[str] = None
    joining_year:   Optional[int] = None
    category:       Optional[str] = None

class EditTeacherRequest(BaseModel):
    """Admin edits a teacher's profile fields."""
    name:           Optional[str] = None
    mobile:         Optional[str] = None
    email:          Optional[str] = None
    department:     Optional[str] = None
    designation:    Optional[str] = None
    qualification:  Optional[str] = None
    experience:     Optional[int] = None
    subjects:       Optional[str] = None
    employee_id:    Optional[str] = None
    joining_year:   Optional[int] = None
    category:       Optional[str] = None
    dob:            Optional[str] = None
    gender:         Optional[str] = None
    blood_group:    Optional[str] = None

class AdminChangePasswordRequest(BaseModel):
    admin_id:         str
    current_password: str
    new_password:     str


# OD (On-Duty) Request schemas 
class ODRequest(BaseModel):
    """Student submits an OD request."""
    id:           Optional[str] = None
    student_id:   str
    name:         str
    dept:         Optional[str] = None
    college:      str
    event:        str
    from_date:    str           # YYYY-MM-DD
    to_date:      str           # YYYY-MM-DD
    notes:        Optional[str] = None
    file_name:    Optional[str] = None
    file_data:    Optional[str] = None   # base64 — stored separately / not in DB

class ODActionRequest(BaseModel):
    """Teacher approves or rejects an OD request."""
    remarks: Optional[str] = None



#  HELPERS

def create_token(data: dict) -> str:
    payload = {
        **data,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    try:
        return jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired — please login again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _require_teacher(payload: dict):
    if payload.get("role") not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teacher/Admin access required")


def _require_admin(payload: dict):
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _guard_student(payload: dict, user_id: str):
    if payload["role"] == "student" and payload["user_id"] != user_id.upper():
        raise HTTPException(status_code=403, detail="Access denied")


def _safe_single(query) -> dict | None:
    try:
        result = query.single().execute()
        return result.data
    except Exception:
        return None


def _safe_query(query) -> list:
    try:
        result = query.execute()
        return result.data or []
    except Exception as e:
        logger.error(f"Query error: {e}")
        return []


def _audit(admin_id: str, action: str, target_type: str = None,
           target_id: str = None, details: dict = None, ip: str = None):
    """Write one row to admin_audit_log — fire-and-forget, never raises."""
    try:
        supabase.table("admin_audit_log").insert({
            "admin_id":    admin_id,
            "action":      action,
            "target_type": target_type,
            "target_id":   target_id,
            "details":     details or {},
            "ip_address":  ip,
        }).execute()
    except Exception as e:
        logger.warning(f"Audit log failed: {e}")



#  AUTH

@app.post("/api/login", tags=["Auth"])
async def login(req: LoginRequest):
    uid = req.user_id.strip().upper()
    user = _safe_single(
        supabase.table("users")
        .select("user_id, password, role, name, department")
        .eq("user_id", uid)
        .eq("role", req.role.lower())
    )
    if not user or user.get("password") != req.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token({
        "user_id":    uid,
        "role":       user["role"],
        "name":       user["name"],
        "department": user.get("department") or "",
    })
    return {
        "token":      token,
        "user_id":    uid,
        "name":       user["name"],
        "role":       user["role"],
        "department": user.get("department") or "",
    }


@app.post("/api/admin/login", tags=["Admin"])
async def admin_login(req: AdminLoginRequest, request: Request):
    """
    Dedicated admin login — checks admin_users table (not users table).
    Returns a JWT with role='admin'.
    """
    aid = req.admin_id.strip().upper()
    admin = _safe_single(
        supabase.table("admin_users")
        .select("admin_id, password, name, email, is_active")
        .eq("admin_id", aid)
    )
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid Admin ID or Password")
    if not admin.get("is_active", True):
        raise HTTPException(status_code=403, detail="Admin account is disabled")
    if admin.get("password") != req.password:
        raise HTTPException(status_code=401, detail="Invalid Admin ID or Password")

    # Update last_login and login_count
    try:
        supabase.table("admin_users").update({
            "last_login":  datetime.now(timezone.utc).isoformat(),
            "login_count": (admin.get("login_count") or 0) + 1,
        }).eq("admin_id", aid).execute()
    except Exception:
        pass

    ip = request.client.host if request.client else None
    _audit(aid, "LOGIN", details={"name": admin["name"]}, ip=ip)

    token = create_token({"user_id": aid, "role": "admin", "name": admin["name"]})
    return {
        "token":    token,
        "admin_id": aid,
        "name":     admin["name"],
        "role":     "admin",
    }


@app.post("/api/change-password", tags=["Auth"])
async def change_password(req: ChangePasswordRequest, payload: dict = Depends(verify_token)):
    uid = req.user_id.strip().upper()
    if payload["user_id"] != uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    user = _safe_single(supabase.table("users").select("password").eq("user_id", uid))
    if not user or user.get("password") != req.current_password:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    supabase.table("users").update({"password": req.new_password}).eq("user_id", uid).execute()
    logger.info(f"Password changed for {uid}")
    return {"message": "Password updated successfully"}



#  STUDENT READ

@app.get("/api/student/{user_id}/summary", tags=["Student"])
async def get_summary(user_id: str, payload: dict = Depends(verify_token)):
    _guard_student(payload, user_id)
    uid = user_id.upper()
    profile  = _safe_single(supabase.table("student_profile").select("*").eq("user_id", uid)) or {}
    att_rows = _safe_query(supabase.table("attendance").select("conducted,attended").eq("user_id", uid))
    res_rows = _safe_query(supabase.table("exam_results").select("cgpa").eq("user_id", uid))
    total_c  = sum(r.get("conducted", 0) for r in att_rows)
    total_a  = sum(r.get("attended",  0) for r in att_rows)
    att_pct  = round(total_a / total_c * 100, 1) if total_c else 0.0
    cgpa_vals = [float(r["cgpa"]) for r in res_rows if r.get("cgpa")]
    avg_cgpa  = round(sum(cgpa_vals) / len(cgpa_vals), 2) if cgpa_vals else 0.0
    return {
        "user_id":         uid,
        "current_sem":     profile.get("current_sem", "—"),
        "department":      profile.get("department",  "—"),
        "batch":           profile.get("batch",       "—"),
        "roll_number":     profile.get("roll_number", "—"),
        "section":         profile.get("section",     "—"),
        "advisor":         profile.get("advisor",     "—"),
        "cgpa":            avg_cgpa,
        "attendance_pct":  att_pct,
        "total_conducted": total_c,
        "total_attended":  total_a,
    }


@app.get("/api/student/{user_id}/personal", tags=["Student"])
async def get_personal(user_id: str, payload: dict = Depends(verify_token)):
    _guard_student(payload, user_id)
    return _safe_single(supabase.table("student_personal").select("*").eq("user_id", user_id.upper())) or {}


@app.get("/api/student/{user_id}/profile", tags=["Student"])
async def get_profile(user_id: str, payload: dict = Depends(verify_token)):
    _guard_student(payload, user_id)
    return _safe_single(supabase.table("student_profile").select("*").eq("user_id", user_id.upper())) or {}


@app.get("/api/student/{user_id}/subjects", tags=["Student"])
async def get_subjects(
    user_id:  str,
    semester: Optional[str] = Query(None),
    payload:  dict = Depends(verify_token),
):
    _guard_student(payload, user_id)
    q = supabase.table("subjects").select("*").eq("user_id", user_id.upper())
    if semester:
        q = q.eq("semester", semester)
    rows = _safe_query(q.order("semester"))
    grouped: dict = {}
    for row in rows:
        grouped.setdefault(row["semester"], []).append(row)
    return grouped


@app.get("/api/student/{user_id}/attendance", tags=["Student"])
async def get_attendance(
    user_id:  str,
    semester: Optional[str] = Query(None),
    payload:  dict = Depends(verify_token),
):
    _guard_student(payload, user_id)
    q = supabase.table("attendance").select("*").eq("user_id", user_id.upper())
    if semester:
        q = q.eq("semester", semester)
    rows = _safe_query(q)
    for r in rows:
        cond = r.get("conducted", 0)
        att  = r.get("attended",  0)
        r["percentage"] = round(att / cond * 100, 1) if cond else 0.0
    return rows


@app.get("/api/student/{user_id}/marks", tags=["Student"])
async def get_marks(
    user_id:  str,
    semester: Optional[str] = Query(None),
    payload:  dict = Depends(verify_token),
):
    _guard_student(payload, user_id)
    q = supabase.table("internal_marks").select("*").eq("user_id", user_id.upper())
    if semester:
        q = q.eq("semester", semester)
    return _safe_query(q)


@app.get("/api/student/{user_id}/results", tags=["Student"])
async def get_results(
    user_id:  str,
    semester: Optional[str] = Query(None),
    payload:  dict = Depends(verify_token),
):
    _guard_student(payload, user_id)
    q = supabase.table("exam_results").select("*").eq("user_id", user_id.upper())
    if semester:
        q = q.eq("semester", semester)
    rows = _safe_query(q)
    all_cgpa = _safe_query(supabase.table("exam_results").select("cgpa").eq("user_id", user_id.upper()))
    vals = [float(r["cgpa"]) for r in all_cgpa if r.get("cgpa")]
    overall_cgpa = round(sum(vals) / len(vals), 2) if vals else 0.0
    return {"subjects": rows, "overall_cgpa": overall_cgpa}


@app.get("/api/student/{user_id}/notices", tags=["Student"])
async def get_notices(user_id: str, payload: dict = Depends(verify_token)):
    _guard_student(payload, user_id)
    return _safe_query(
        supabase.table("notices").select("*").eq("user_id", user_id.upper())
        .order("created_at", desc=True).limit(10)
    )


#  TEACHER READ

@app.get("/api/teacher/profile/{teacher_id}", tags=["Teacher"])
async def get_teacher_profile(teacher_id: str, payload: dict = Depends(verify_token)):
    tid = teacher_id.upper()
    if payload["role"] == "teacher" and payload["user_id"] != tid:
        raise HTTPException(status_code=403, detail="Access denied")
    return _safe_single(supabase.table("teacher_profile").select("*").eq("user_id", tid)) or {}


@app.get("/api/teacher/students", tags=["Teacher"])
async def get_all_students(
    department: Optional[str] = Query(None),
    semester:   Optional[str] = Query(None),
    dept_type:  Optional[str] = Query(None),
    search:     Optional[str] = Query(None),
    limit:      int           = Query(50, ge=1, le=400),
    offset:     int           = Query(0,  ge=0),
    payload:    dict          = Depends(verify_token),
):
    _require_teacher(payload)
    q = (
        supabase.table("student_profile")
        .select("user_id, roll_number, department, degree, current_sem, batch, section, advisor")
        .order("user_id")
        .range(offset, offset + limit - 1)
    )
    if department: q = q.eq("department", department)
    if semester:   q = q.eq("current_sem", semester)
    rows = _safe_query(q)

    uids = [r["user_id"] for r in rows]
    if uids:
        user_rows = _safe_query(supabase.table("users").select("user_id, name").in_("user_id", uids))
        name_map = {u["user_id"]: u["name"] for u in user_rows}
        for r in rows:
            r["name"] = name_map.get(r["user_id"], "")

    if search:
        sl = search.lower()
        rows = [r for r in rows if sl in r.get("name","").lower() or sl in r.get("user_id","").lower()]
    if dept_type:
        prefix = "ENG" if dept_type.lower() == "eng" else "ART"
        rows = [r for r in rows if r.get("user_id","").startswith(prefix)]

    return {"total": len(rows), "students": rows}


@app.get("/api/teacher/students/{user_id}", tags=["Teacher"])
async def get_student_detail(user_id: str, payload: dict = Depends(verify_token)):
    _require_teacher(payload)
    uid = user_id.upper()
    return {
        "personal":   _safe_single(supabase.table("student_personal").select("*").eq("user_id", uid)) or {},
        "profile":    _safe_single(supabase.table("student_profile").select("*").eq("user_id", uid)) or {},
        "attendance": _safe_query(supabase.table("attendance").select("*").eq("user_id", uid)),
        "marks":      _safe_query(supabase.table("internal_marks").select("*").eq("user_id", uid)),
        "results":    _safe_query(supabase.table("exam_results").select("*").eq("user_id", uid)),
    }


@app.get("/api/teacher/stats", tags=["Teacher"])
async def get_teacher_stats(payload: dict = Depends(verify_token)):
    _require_teacher(payload)
    total_students = len(_safe_query(supabase.table("users").select("user_id").eq("role", "student")))
    total_teachers = len(_safe_query(supabase.table("users").select("user_id").eq("role", "teacher")))
    eng_count      = len(_safe_query(supabase.table("users").select("user_id").eq("role","student").like("user_id","ENG%")))
    art_count      = len(_safe_query(supabase.table("users").select("user_id").eq("role","student").like("user_id","ART%")))
    att_rows = _safe_query(supabase.table("attendance").select("conducted,attended"))
    total_c  = sum(r.get("conducted", 0) for r in att_rows)
    total_a  = sum(r.get("attended",  0) for r in att_rows)
    avg_att  = round(total_a / total_c * 100, 1) if total_c else 0.0
    res_rows  = _safe_query(supabase.table("exam_results").select("cgpa"))
    cgpa_vals = [float(r["cgpa"]) for r in res_rows if r.get("cgpa")]
    avg_cgpa  = round(sum(cgpa_vals) / len(cgpa_vals), 2) if cgpa_vals else 0.0
    return {
        "total_students":       total_students,
        "engineering_students": eng_count,
        "arts_students":        art_count,
        "total_teachers":       total_teachers,
        "avg_attendance_pct":   avg_att,
        "avg_cgpa":             avg_cgpa,
    }


@app.get("/api/teacher/departments", tags=["Teacher"])
async def get_departments(payload: dict = Depends(verify_token)):
    _require_teacher(payload)
    rows = _safe_query(supabase.table("student_profile").select("department"))
    from collections import Counter
    counts = Counter(r["department"] for r in rows if r.get("department"))
    return [{"department": d, "count": c} for d, c in sorted(counts.items())]



#  TEACHER WRITE

@app.put("/api/teacher/attendance/{user_id}", tags=["Teacher"])
async def update_attendance(
    user_id: str, req: AttendanceUpdateRequest, payload: dict = Depends(verify_token)
):
    _require_teacher(payload)
    uid = user_id.upper()
    data = {"conducted": req.conducted, "attended": req.attended,
            "updated_at": datetime.now(timezone.utc).isoformat()}
    if req.semester: data["semester"] = req.semester
    supabase.table("attendance").update(data).eq("user_id", uid).eq("subject_code", req.subject_code).execute()
    return {"message": "Attendance updated"}


@app.put("/api/teacher/marks/{user_id}", tags=["Teacher"])
async def update_marks(
    user_id: str, req: MarksUpdateRequest, payload: dict = Depends(verify_token)
):
    _require_teacher(payload)
    uid   = user_id.upper()
    total = req.ia1 + req.ia2 + req.ia3 + req.assignment
    data  = {"ia1": req.ia1, "ia2": req.ia2, "ia3": req.ia3,
             "assignment": req.assignment, "total": total}
    if req.semester: data["semester"] = req.semester
    supabase.table("internal_marks").update(data).eq("user_id", uid).eq("subject_code", req.subject_code).execute()
    return {"message": "Marks updated", "total": total}


@app.post("/api/teacher/notice", tags=["Teacher"])
async def create_notice(req: NoticeCreateRequest, payload: dict = Depends(verify_token)):
    _require_teacher(payload)
    supabase.table("notices").insert({
        "user_id": req.user_id.upper(), "title": req.title,
        "body": req.body, "type": req.type,
    }).execute()
    return {"message": "Notice created"}


@app.delete("/api/teacher/notice/{notice_id}", tags=["Teacher"])
async def delete_notice(notice_id: int, payload: dict = Depends(verify_token)):
    _require_teacher(payload)
    supabase.table("notices").delete().eq("id", notice_id).execute()
    return {"message": "Notice deleted"}



#  TEACHER WRITE — Edit student personal & profile details

@app.put("/api/teacher/edit/personal/{user_id}", tags=["Teacher - Edit"])
async def edit_personal(
    user_id: str,
    req:     EditPersonalRequest,
    payload: dict = Depends(verify_token),
):
    _require_teacher(payload)
    uid = user_id.strip().upper()
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")
    try:
        # Sync name to users table if provided
        if "name" in update_data:
            supabase.table("users").update({"name": update_data["name"]}).eq("user_id", uid).execute()
        personal_data = {k: v for k, v in update_data.items() if k != "name"}
        if personal_data:
            upsert_data = {"user_id": uid, **personal_data}
            supabase.table("student_personal").upsert(upsert_data, on_conflict="user_id").execute()
        logger.info(f"Personal upserted for {uid}: {list(update_data.keys())}")
        return {"message": "Personal details updated", "updated_fields": list(update_data.keys())}
    except Exception as e:
        logger.error(f"Edit personal error {uid}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update personal details: {str(e)}")


@app.put("/api/teacher/edit/profile/{user_id}", tags=["Teacher - Edit"])
async def edit_profile(
    user_id: str,
    req:     EditProfileRequest,
    payload: dict = Depends(verify_token),
):
    _require_teacher(payload)
    uid = user_id.strip().upper()
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")
    try:
        upsert_data = {"user_id": uid, **update_data}
        supabase.table("student_profile").upsert(upsert_data, on_conflict="user_id").execute()
        if "department" in update_data:
            supabase.table("users").update({"department": update_data["department"]}).eq("user_id", uid).execute()
        logger.info(f"Profile upserted for {uid}: {list(update_data.keys())}")
        return {"message": "Academic profile updated", "updated_fields": list(update_data.keys())}
    except Exception as e:
        logger.error(f"Edit profile error {uid}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update academic profile: {str(e)}")


@app.put("/api/teacher/edit/attendance/{user_id}", tags=["Teacher - Edit"])
async def edit_attendance(
    user_id: str,
    req:     EditAttendanceRequest,
    payload: dict = Depends(verify_token),
):
    _require_teacher(payload)
    uid = user_id.strip().upper()
    if req.attended > req.conducted:
        raise HTTPException(status_code=400, detail="Attended cannot exceed conducted classes")
    update_data = {"conducted": req.conducted, "attended": req.attended,
                   "updated_at": datetime.now(timezone.utc).isoformat()}
    if req.semester:
        update_data["semester"] = req.semester
    try:
        supabase.table("attendance").update(update_data)\
            .eq("user_id", uid).eq("subject_code", req.subject_code).execute()
        return {"message": "Attendance updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to update attendance")


@app.put("/api/teacher/edit/marks/{user_id}", tags=["Teacher - Edit"])
async def edit_marks(
    user_id: str,
    req:     EditMarksRequest,
    payload: dict = Depends(verify_token),
):
    _require_teacher(payload)
    uid = user_id.strip().upper()
    if not (0 <= req.ia1 <= 20): raise HTTPException(400, "IA1 must be 0–20")
    if not (0 <= req.ia2 <= 20): raise HTTPException(400, "IA2 must be 0–20")
    if not (0 <= req.ia3 <= 20): raise HTTPException(400, "IA3 must be 0–20")
    if not (0 <= req.assignment <= 10): raise HTTPException(400, "Assignment must be 0–10")
    total = req.ia1 + req.ia2 + req.ia3 + req.assignment
    update_data = {"ia1": req.ia1, "ia2": req.ia2, "ia3": req.ia3,
                   "assignment": req.assignment, "total": total}
    if req.semester:
        update_data["semester"] = req.semester
    try:
        supabase.table("internal_marks").update(update_data)\
            .eq("user_id", uid).eq("subject_code", req.subject_code).execute()
        return {"message": "Marks updated successfully", "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to update marks")



#  ADMIN — READ

@app.get("/api/admin/teachers", tags=["Admin"])
async def admin_get_teachers(payload: dict = Depends(verify_token)):
    """Return all teachers with their profile data."""
    _require_admin(payload)
    users = _safe_query(
        supabase.table("users").select("user_id, name, department").eq("role", "teacher").order("user_id")
    )
    uids = [u["user_id"] for u in users]
    profiles = {}
    if uids:
        prof_rows = _safe_query(supabase.table("teacher_profile").select("*").in_("user_id", uids))
        profiles = {p["user_id"]: p for p in prof_rows}
    for u in users:
        p = profiles.get(u["user_id"], {})
        u.update({
            "designation":   p.get("designation"),
            "qualification": p.get("qualification"),
            "experience":    p.get("experience"),
            "subjects":      p.get("subjects"),
            "employee_id":   p.get("employee_id"),
            "joining_year":  p.get("joining_year"),
            "category":      p.get("category"),
            "mobile":        p.get("mobile"),
            "email":         p.get("email"),
        })
    return {"total": len(users), "teachers": users}


@app.get("/api/admin/stats", tags=["Admin"])
async def admin_stats(payload: dict = Depends(verify_token)):
    """Admin-level stats (same as teacher stats but with admin role check)."""
    _require_admin(payload)
    total_students = len(_safe_query(supabase.table("users").select("user_id").eq("role", "student")))
    total_teachers = len(_safe_query(supabase.table("users").select("user_id").eq("role", "teacher")))
    eng_count      = len(_safe_query(supabase.table("users").select("user_id").eq("role","student").like("user_id","ENG%")))
    art_count      = len(_safe_query(supabase.table("users").select("user_id").eq("role","student").like("user_id","ART%")))
    return {
        "total_students":       total_students,
        "engineering_students": eng_count,
        "arts_students":        art_count,
        "total_teachers":       total_teachers,
    }


@app.get("/api/admin/audit-log", tags=["Admin"])
async def admin_audit(
    limit:  int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    payload: dict = Depends(verify_token),
):
    """Return admin audit log entries (newest first)."""
    _require_admin(payload)
    rows = _safe_query(
        supabase.table("admin_audit_log")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    return {"total": len(rows), "logs": rows}



#  ADMIN — WRITE: ADD STUDENT

@app.post("/api/admin/add-student", tags=["Admin"])
async def admin_add_student(req: AddStudentRequest, request: Request, payload: dict = Depends(verify_token)):
    """
    Admin creates a new student:
      1. Insert into users table
      2. Upsert into student_personal
      3. Upsert into student_profile
    """
    _require_admin(payload)
    uid = req.user_id.strip().upper()

    # Check duplicate
    existing = _safe_single(supabase.table("users").select("user_id").eq("user_id", uid))
    if existing:
        raise HTTPException(status_code=409, detail=f"User ID {uid} already exists")

    try:
        # 1. users
        supabase.table("users").insert({
            "user_id":    uid,
            "password":   req.password,
            "role":       "student",
            "name":       req.name,
            "department": req.department or "",
        }).execute()

        # 2. student_personal
        personal = {k: v for k, v in {
            "user_id":      uid,
            "mobile":       req.mobile,
            "email":        req.email,
            "dob":          req.dob,
            "gender":       req.gender,
            "blood_group":  req.blood_group,
            "nationality":  req.nationality,
            "religion":     req.religion,
            "address":      req.address,
            "father_name":  req.father_name,
            "mother_name":  req.mother_name,
            "parent_mobile": req.parent_mobile,
        }.items() if v is not None}
        if len(personal) > 1:  # more than just user_id
            supabase.table("student_personal").upsert(personal, on_conflict="user_id").execute()

        # 3. student_profile
        profile = {k: v for k, v in {
            "user_id":       uid,
            "department":    req.department,
            "degree":        req.degree,
            "specialisation": req.specialisation,
            "batch":         req.batch,
            "admission_year": str(req.admission_year) if req.admission_year else None,
            "current_sem":   str(req.current_sem) if req.current_sem else None,
            "roll_number":   req.roll_number,
            "section":       req.section,
            "advisor":       req.advisor,
            "edu10_board":   req.edu10_board,
            "edu10_pct":     str(req.edu10_pct) if req.edu10_pct else None,
            "edu12_board":   req.edu12_board,
            "edu12_pct":     str(req.edu12_pct) if req.edu12_pct else None,
            "entrance_exam": req.entrance_exam,
        }.items() if v is not None}
        if len(profile) > 1:
            supabase.table("student_profile").upsert(profile, on_conflict="user_id").execute()

        ip = request.client.host if request.client else None
        _audit(payload["user_id"], "ADD_STUDENT", "student", uid,
               {"name": req.name, "department": req.department}, ip)
        logger.info(f"Admin {payload['user_id']} added student {uid}")
        return {"message": f"Student {uid} ({req.name}) added successfully", "user_id": uid}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add student error: {e}")
        # Rollback users row if profile insert failed
        try: supabase.table("users").delete().eq("user_id", uid).execute()
        except: pass
        raise HTTPException(status_code=500, detail=f"Failed to add student: {str(e)}")



#  ADMIN — WRITE: ADD TEACHER

@app.post("/api/admin/add-teacher", tags=["Admin"])
async def admin_add_teacher(req: AddTeacherRequest, request: Request, payload: dict = Depends(verify_token)):
    """
    Admin creates a new teacher:
      1. Insert into users table
      2. Upsert into teacher_profile
    """
    _require_admin(payload)
    uid = req.user_id.strip().upper()

    existing = _safe_single(supabase.table("users").select("user_id").eq("user_id", uid))
    if existing:
        raise HTTPException(status_code=409, detail=f"User ID {uid} already exists")

    try:
        supabase.table("users").insert({
            "user_id":    uid,
            "password":   req.password,
            "role":       "teacher",
            "name":       req.name,
            "department": req.department or "",
        }).execute()

        prof = {k: v for k, v in {
            "user_id":      uid,
            "department":   req.department,
            "designation":  req.designation,
            "qualification": req.qualification,
            "experience":   req.experience,
            "subjects":     req.subjects,
            "employee_id":  req.employee_id,
            "joining_year": req.joining_year,
            "category":     req.category,
            "mobile":       req.mobile,
            "email":        req.email,
            "dob":          req.dob,
            "gender":       req.gender,
            "blood_group":  req.blood_group,
        }.items() if v is not None}
        if len(prof) > 1:
            supabase.table("teacher_profile").upsert(prof, on_conflict="user_id").execute()

        ip = request.client.host if request.client else None
        _audit(payload["user_id"], "ADD_TEACHER", "teacher", uid,
               {"name": req.name, "department": req.department}, ip)
        logger.info(f"Admin {payload['user_id']} added teacher {uid}")
        return {"message": f"Teacher {uid} ({req.name}) added successfully", "user_id": uid}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add teacher error: {e}")
        try: supabase.table("users").delete().eq("user_id", uid).execute()
        except: pass
        raise HTTPException(status_code=500, detail=f"Failed to add teacher: {str(e)}")



#  ADMIN — WRITE: EDIT STUDENT

@app.put("/api/admin/student/{user_id}", tags=["Admin"])
async def admin_edit_student(
    user_id: str, req: EditPersonalRequest, request: Request, payload: dict = Depends(verify_token)
):
    """Admin edits a student's personal fields + name."""
    _require_admin(payload)
    uid = user_id.strip().upper()
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(400, "No fields provided")
    try:
        if "name" in update_data:
            supabase.table("users").update({"name": update_data.pop("name")}).eq("user_id", uid).execute()
        if update_data:
            supabase.table("student_personal").upsert({"user_id": uid, **update_data}, on_conflict="user_id").execute()
        ip = request.client.host if request.client else None
        _audit(payload["user_id"], "EDIT_STUDENT", "student", uid, {"fields": list(update_data.keys())}, ip)
        return {"message": "Student updated", "user_id": uid}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")



#  ADMIN — WRITE: DELETE STUDENT

@app.delete("/api/admin/student/{user_id}", tags=["Admin"])
async def admin_delete_student(user_id: str, request: Request, payload: dict = Depends(verify_token)):
    """
    Admin deletes a student and ALL related data:
      users, student_personal, student_profile, attendance, internal_marks, exam_results, notices
    """
    _require_admin(payload)
    uid = user_id.strip().upper()
    try:
        for table in ["notices","exam_results","internal_marks","attendance","student_profile","student_personal","users"]:
            supabase.table(table).delete().eq("user_id", uid).execute()
        ip = request.client.host if request.client else None
        _audit(payload["user_id"], "DELETE_STUDENT", "student", uid, {}, ip)
        logger.info(f"Admin {payload['user_id']} deleted student {uid}")
        return {"message": f"Student {uid} and all related data deleted"}
    except Exception as e:
        logger.error(f"Delete student error {uid}: {e}")
        raise HTTPException(500, f"Failed to delete student: {str(e)}")



#  ADMIN — WRITE: EDIT TEACHER

@app.put("/api/admin/teacher/{user_id}", tags=["Admin"])
async def admin_edit_teacher(
    user_id: str, req: EditTeacherRequest, request: Request, payload: dict = Depends(verify_token)
):
    """Admin edits a teacher's profile."""
    _require_admin(payload)
    uid = user_id.strip().upper()
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(400, "No fields provided")
    try:
        if "name" in update_data:
            supabase.table("users").update({"name": update_data["name"]}).eq("user_id", uid).execute()
        if "department" in update_data:
            supabase.table("users").update({"department": update_data["department"]}).eq("user_id", uid).execute()
        prof_data = {k: v for k, v in update_data.items() if k not in ("name",)}
        if prof_data:
            supabase.table("teacher_profile").upsert({"user_id": uid, **prof_data}, on_conflict="user_id").execute()
        ip = request.client.host if request.client else None
        _audit(payload["user_id"], "EDIT_TEACHER", "teacher", uid, {"fields": list(update_data.keys())}, ip)
        return {"message": "Teacher updated", "user_id": uid}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")



#  ADMIN — WRITE: DELETE TEACHER

@app.delete("/api/admin/teacher/{user_id}", tags=["Admin"])
async def admin_delete_teacher(user_id: str, request: Request, payload: dict = Depends(verify_token)):
    """Admin deletes a teacher from users + teacher_profile."""
    _require_admin(payload)
    uid = user_id.strip().upper()
    try:
        supabase.table("teacher_profile").delete().eq("user_id", uid).execute()
        supabase.table("users").delete().eq("user_id", uid).execute()
        ip = request.client.host if request.client else None
        _audit(payload["user_id"], "DELETE_TEACHER", "teacher", uid, {}, ip)
        logger.info(f"Admin {payload['user_id']} deleted teacher {uid}")
        return {"message": f"Teacher {uid} deleted"}
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")




#  OD (ON-DUTY) REQUESTS


@app.post("/api/od-request", tags=["OD"])
async def submit_od_request(req: ODRequest, payload: dict = Depends(verify_token)):
    """
    Student submits an OD request.
    - Stores in `od_requests` table (file_data is NOT stored in DB — only file_name).
    - Routes to the correct department teacher automatically based on student_id prefix.
    Supabase table required:
        od_requests (id, student_id, name, dept, college, event, from_date, to_date,
                     notes, file_name, status, submitted_at, reviewed_at, reviewed_by, remarks)
    """
    uid = payload["user_id"]
    # Only the student themselves can submit
    if payload["role"] == "student" and uid != req.student_id.upper():
        raise HTTPException(status_code=403, detail="Cannot submit on behalf of another student")

    import uuid
    record = {
        "id":           req.id or f"OD-{uuid.uuid4().hex[:10].upper()}",
        "student_id":   req.student_id.upper(),
        "name":         req.name,
        "dept":         req.dept or ("Engineering" if req.student_id.upper().startswith("ENG") else "Arts"),
        "college":      req.college,
        "event":        req.event,
        "from_date":    req.from_date,
        "to_date":      req.to_date,
        "notes":        req.notes or "",
        "file_name":    req.file_name or "",
        "status":       "pending",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        supabase.table("od_requests").insert(record).execute()
        logger.info(f"OD request submitted by {uid}: {record['id']}")
        return {"message": "OD request submitted successfully", "id": record["id"]}
    except Exception as e:
        logger.error(f"OD submit error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit OD request: {str(e)}")


@app.get("/api/od-request/{student_id}", tags=["OD"])
async def get_student_od_requests(student_id: str, payload: dict = Depends(verify_token)):
    """
    Returns all OD requests for a given student.
    Students can only fetch their own; teachers/admins can fetch any.
    """
    uid = student_id.strip().upper()
    if payload["role"] == "student" and payload["user_id"] != uid:
        raise HTTPException(status_code=403, detail="Access denied")

    rows = _safe_query(
        supabase.table("od_requests")
        .select("*")
        .eq("student_id", uid)
        .order("submitted_at", desc=True)
    )
    return rows


@app.get("/api/od-requests", tags=["OD"])
async def get_all_od_requests(
    dept: Optional[str] = Query(None, description="Filter by dept: eng or art"),
    status: Optional[str] = Query(None, description="Filter by status: pending / approved / rejected"),
    payload: dict = Depends(verify_token)
):
    """
    Teacher/Admin fetches all OD requests (optionally filtered by dept and/or status).
    Engineering teachers automatically receive only ENG student requests,
    Arts teachers receive only ART student requests (based on their own department in token).
    """
    _require_teacher(payload)

    query = supabase.table("od_requests").select("*").order("submitted_at", desc=True)

    # Auto-filter by teacher's own department if not admin
    if payload.get("role") == "teacher":
        teacher_dept = (payload.get("department") or "").lower()
        if "eng" in teacher_dept:
            query = query.ilike("student_id", "ENG%")
        elif "art" in teacher_dept:
            query = query.ilike("student_id", "ART%")

    # Additional manual filters from query params
    if dept:
        if dept.lower() == "eng":
            query = query.ilike("student_id", "ENG%")
        elif dept.lower() == "art":
            query = query.ilike("student_id", "ART%")
    if status:
        query = query.eq("status", status.lower())

    rows = _safe_query(query)
    return rows


@app.post("/api/od-request/{od_id}/approved", tags=["OD"])
async def approve_od_request(od_id: str, payload: dict = Depends(verify_token)):
    """Teacher approves an OD request."""
    _require_teacher(payload)
    return _od_action(od_id, "approved", payload["user_id"])


@app.post("/api/od-request/{od_id}/rejected", tags=["OD"])
async def reject_od_request(od_id: str, payload: dict = Depends(verify_token)):
    """Teacher rejects an OD request."""
    _require_teacher(payload)
    return _od_action(od_id, "rejected", payload["user_id"])


def _od_action(od_id: str, status: str, reviewed_by: str) -> dict:
    """Shared helper: update OD request status."""
    try:
        result = supabase.table("od_requests").update({
            "status":      status,
            "reviewed_by": reviewed_by,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", od_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail=f"OD request {od_id} not found")

        logger.info(f"OD {od_id} {status} by {reviewed_by}")
        return {"message": f"OD request {status}", "id": od_id, "status": status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OD action error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update OD request: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
#  UTILITY
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Utility"])
async def health():
    return {
        "status":    "ok",
        "version":   "4.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/semesters", tags=["Utility"])
async def get_semesters():
    return {
        "engineering": [str(i) for i in range(1, 9)],
        "arts":        [str(i) for i in range(1, 7)],
    }


# ── Vercel serverless handler ──
from mangum import Mangum
handler = Mangum(app, lifespan='off')