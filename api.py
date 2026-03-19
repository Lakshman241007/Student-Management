"""
VelsPortal v3  ·  Python + FastAPI Backend
==========================================
Supports:
  • Engineering Dept: 8 sems × 20 students = 160 students (ENG001–ENG160)
  • Arts Dept:        6 sems × 20 students = 120 students (ART001–ART120)
  • Teachers: 10 (TCH001–TCH010)

Install:
    pip install fastapi uvicorn "supabase>=2.0" python-dotenv PyJWT

Run:
    uvicorn api:app --reload --port 8000

Swagger docs: http://localhost:8000/docs
"""

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from supabase import create_client, Client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
logger = logging.getLogger("eduportal")

# ─────────────────────────────────────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────────────────────────────────────
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

# ─────────────────────────────────────────────────────────────────────────────
#  APP
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="VelsPortal API",
    version="3.0",
    description="Academic Management System — Engineering (8 sem) + Arts (6 sem)",
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


# ─────────────────────────────────────────────────────────────────────────────
#  PYDANTIC SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    user_id:  str
    password: str
    role:     str

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

# ── NEW: Edit schemas for teacher to update student data ─────────────────────
class EditPersonalRequest(BaseModel):
    """Teacher can update any field in student_personal table."""
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
    """Teacher can update any field in student_profile table."""
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
    """Teacher updates attendance for one subject row."""
    subject_code: str
    conducted:    int
    attended:     int
    semester:     Optional[str] = None

class EditMarksRequest(BaseModel):
    """Teacher updates marks for one subject row."""
    subject_code: str
    ia1:          int
    ia2:          int
    ia3:          int
    assignment:   int
    semester:     Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────────────────────────────────────
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
    if payload.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")


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


# ─────────────────────────────────────────────────────────────────────────────
#  AUTH
# ─────────────────────────────────────────────────────────────────────────────
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


@app.post("/api/change-password", tags=["Auth"])
async def change_password(req: ChangePasswordRequest, payload: dict = Depends(verify_token)):
    uid = req.user_id.strip().upper()
    if payload["user_id"] != uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    user = _safe_single(
        supabase.table("users").select("password").eq("user_id", uid)
    )
    if not user or user.get("password") != req.current_password:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    supabase.table("users").update({"password": req.new_password}).eq("user_id", uid).execute()
    logger.info(f"Password changed for {uid}")
    return {"message": "Password updated successfully"}


# ─────────────────────────────────────────────────────────────────────────────
#  STUDENT READ
# ─────────────────────────────────────────────────────────────────────────────
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


# ─────────────────────────────────────────────────────────────────────────────
#  TEACHER READ
# ─────────────────────────────────────────────────────────────────────────────
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
    limit:      int           = Query(50, ge=1, le=300),
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


# ─────────────────────────────────────────────────────────────────────────────
#  TEACHER WRITE — existing
# ─────────────────────────────────────────────────────────────────────────────
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


# ─────────────────────────────────────────────────────────────────────────────
#  TEACHER WRITE — NEW: Edit student personal & profile details
# ─────────────────────────────────────────────────────────────────────────────
@app.put("/api/teacher/edit/personal/{user_id}", tags=["Teacher - Edit"])
async def edit_personal(
    user_id: str,
    req:     EditPersonalRequest,
    payload: dict = Depends(verify_token),
):
    """
    Teacher updates a student's personal details.
    Only non-None fields are written — so sending just mobile
    will only update mobile, leaving everything else untouched.
    """
    _require_teacher(payload)
    uid = user_id.strip().upper()

    # Build update dict — only include fields that were actually sent
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    try:
        supabase.table("student_personal").update(update_data).eq("user_id", uid).execute()
        logger.info(f"Personal updated for {uid}: {list(update_data.keys())}")
        return {"message": "Personal details updated", "updated_fields": list(update_data.keys())}
    except Exception as e:
        logger.error(f"Edit personal error {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update personal details")


@app.put("/api/teacher/edit/profile/{user_id}", tags=["Teacher - Edit"])
async def edit_profile(
    user_id: str,
    req:     EditProfileRequest,
    payload: dict = Depends(verify_token),
):
    """
    Teacher updates a student's academic profile.
    Also syncs department to the users table if changed.
    """
    _require_teacher(payload)
    uid = user_id.strip().upper()

    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    try:
        supabase.table("student_profile").update(update_data).eq("user_id", uid).execute()
        # If department was changed, keep users table in sync too
        if "department" in update_data:
            supabase.table("users").update({"department": update_data["department"]}).eq("user_id", uid).execute()
        logger.info(f"Profile updated for {uid}: {list(update_data.keys())}")
        return {"message": "Academic profile updated", "updated_fields": list(update_data.keys())}
    except Exception as e:
        logger.error(f"Edit profile error {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update academic profile")


@app.put("/api/teacher/edit/attendance/{user_id}", tags=["Teacher - Edit"])
async def edit_attendance(
    user_id: str,
    req:     EditAttendanceRequest,
    payload: dict = Depends(verify_token),
):
    """Teacher edits attendance for a specific subject."""
    _require_teacher(payload)
    uid = user_id.strip().upper()

    if req.attended > req.conducted:
        raise HTTPException(status_code=400, detail="Attended cannot exceed conducted classes")

    update_data = {
        "conducted":  req.conducted,
        "attended":   req.attended,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if req.semester:
        update_data["semester"] = req.semester

    try:
        supabase.table("attendance").update(update_data)\
            .eq("user_id", uid)\
            .eq("subject_code", req.subject_code)\
            .execute()
        logger.info(f"Attendance edited for {uid} / {req.subject_code}")
        return {"message": "Attendance updated successfully"}
    except Exception as e:
        logger.error(f"Edit attendance error {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update attendance")


@app.put("/api/teacher/edit/marks/{user_id}", tags=["Teacher - Edit"])
async def edit_marks(
    user_id: str,
    req:     EditMarksRequest,
    payload: dict = Depends(verify_token),
):
    """Teacher edits internal marks for a specific subject."""
    _require_teacher(payload)
    uid = user_id.strip().upper()

    # Validate ranges
    if not (0 <= req.ia1 <= 20):
        raise HTTPException(status_code=400, detail="IA1 must be between 0 and 20")
    if not (0 <= req.ia2 <= 20):
        raise HTTPException(status_code=400, detail="IA2 must be between 0 and 20")
    if not (0 <= req.ia3 <= 20):
        raise HTTPException(status_code=400, detail="IA3 must be between 0 and 20")
    if not (0 <= req.assignment <= 10):
        raise HTTPException(status_code=400, detail="Assignment must be between 0 and 10")

    total = req.ia1 + req.ia2 + req.ia3 + req.assignment
    update_data = {
        "ia1": req.ia1, "ia2": req.ia2, "ia3": req.ia3,
        "assignment": req.assignment, "total": total,
    }
    if req.semester:
        update_data["semester"] = req.semester

    try:
        supabase.table("internal_marks").update(update_data)\
            .eq("user_id", uid)\
            .eq("subject_code", req.subject_code)\
            .execute()
        logger.info(f"Marks edited for {uid} / {req.subject_code} total={total}")
        return {"message": "Marks updated successfully", "total": total}
    except Exception as e:
        logger.error(f"Edit marks error {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update marks")


# ─────────────────────────────────────────────────────────────────────────────
#  UTILITY
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Utility"])
async def health():
    return {
        "status":    "ok",
        "version":   "3.1",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/semesters", tags=["Utility"])
async def get_semesters():
    return {
        "engineering": [str(i) for i in range(1, 9)],
        "arts":        [str(i) for i in range(1, 7)],
    }