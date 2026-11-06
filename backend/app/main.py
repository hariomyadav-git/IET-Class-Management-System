import os
from datetime import date as date_type, datetime, time as time_type, timedelta
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import ai, services
from .database import Base, engine, get_db
from .models import (
    PURPOSES, Announcement, AuditLog, Batch, Booking, Building, Report, Room, User,
)
from .security import create_token, decode_token, hash_password, verify_password

app = FastAPI(title="Smart Campus Classroom Management System", version="1.0")

origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(engine)


# ------------------------------------------------------------------ auth helpers
bearer = HTTPBearer(auto_error=False)


def current_user(cred: HTTPAuthorizationCredentials | None = Depends(bearer),
                 db: Session = Depends(get_db)) -> User:
    if not cred:
        raise HTTPException(401, "Login required")
    try:
        data = decode_token(cred.credentials)
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = db.get(User, int(data["sub"]))
    if not user:
        raise HTTPException(401, "User not found")
    return user


def require(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, f"Requires role: {' or '.join(roles)}")
        return user
    return dep


# ------------------------------------------------------------------ serializers
def room_out(r: Room) -> dict:
    return {
        "id": r.id, "name": r.name, "building_id": r.building_id,
        "building": r.building.name, "floor": r.floor, "type": r.type,
        "capacity": r.capacity, "capacity_assumed": r.capacity_assumed,
        "allowed_uses": r.uses, "is_bookable": r.is_bookable, "notes": r.notes,
    }


def booking_out(b: Booking) -> dict:
    return {
        "id": b.id,
        "room": {"id": b.room.id, "name": b.room.name, "building": b.room.building.name,
                 "floor": b.room.floor},
        "title": b.title, "purpose": b.purpose,
        "start_at": b.start_at.isoformat(), "end_at": b.end_at.isoformat(),
        "status": b.status, "expected_attendees": b.expected_attendees,
        "booked_by": {"id": b.user.id, "name": b.user.name},
        "batches": [{"id": x.id, "label": x.label} for x in b.batches],
        "notes": b.notes, "is_test": b.is_test,
    }


def announcement_out(a: Announcement) -> dict:
    return {
        "id": a.id, "title": a.title, "body": a.body, "kind": a.kind,
        "booking_id": a.booking_id, "author": a.author.name,
        "created_at": a.created_at.isoformat(), "is_test": a.is_test,
    }


def naive(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None)


# ------------------------------------------------------------------ auth
class LoginIn(BaseModel):
    email: str
    password: str


class SignupIn(BaseModel):
    email: str
    name: str
    password: str = Field(min_length=6)
    batch_id: Optional[int] = None


def user_out(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "role": u.role,
            "batch_id": u.batch_id, "batch": u.batch.label if u.batch else None}


@app.post("/auth/login", tags=["auth"])
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower().strip()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password")
    return {"token": create_token(user.id, user.role), "user": user_out(user)}


@app.post("/auth/signup", tags=["auth"], status_code=201)
def signup(data: SignupIn, db: Session = Depends(get_db)):
    """Self-signup creates STUDENT accounts only. Faculty/admin are created by an admin."""
    email = data.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "Email already registered")
    u = User(email=email, name=data.name, password_hash=hash_password(data.password),
             role="student", batch_id=data.batch_id)
    db.add(u)
    db.commit()
    return {"token": create_token(u.id, u.role), "user": user_out(u)}


@app.get("/auth/me", tags=["auth"])
def me(user: User = Depends(current_user)):
    return user_out(user)


class UserCreateIn(BaseModel):
    email: str
    name: str
    password: str = Field(min_length=6)
    role: str


@app.post("/admin/users", tags=["admin"], status_code=201)
def admin_create_user(data: UserCreateIn, admin: User = Depends(require("admin")),
                      db: Session = Depends(get_db)):
    if data.role not in ("student", "faculty", "admin"):
        raise HTTPException(422, "role must be student, faculty or admin")
    email = data.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "Email already registered")
    u = User(email=email, name=data.name, password_hash=hash_password(data.password), role=data.role)
    db.add(u)
    db.flush()
    services.log_action(db, admin.id, "create_user", "user", u.id, new={"email": email, "role": data.role})
    db.commit()
    return user_out(u)


# ------------------------------------------------------------------ reference data
@app.get("/buildings", tags=["reference"])
def buildings(db: Session = Depends(get_db)):
    return [{"id": b.id, "name": b.name, "code": b.code, "notes": b.notes}
            for b in db.scalars(select(Building).order_by(Building.id))]


@app.get("/batches", tags=["reference"])
def batches(branch: Optional[str] = None, year: Optional[int] = None, db: Session = Depends(get_db)):
    q = select(Batch).order_by(Batch.branch, Batch.year, Batch.section)
    if branch:
        q = q.where(Batch.branch == branch)
    if year:
        q = q.where(Batch.year == year)
    return [{"id": b.id, "branch": b.branch, "year": b.year, "section": b.section,
             "size": b.size, "label": b.label} for b in db.scalars(q)]


@app.get("/rooms", tags=["rooms"])
def list_rooms(building_id: Optional[int] = None, floor: Optional[int] = None,
               type: Optional[str] = None, min_capacity: int = 0,
               db: Session = Depends(get_db)):
    q = select(Room).where(Room.capacity >= min_capacity).order_by(Room.building_id, Room.floor, Room.name)
    if building_id:
        q = q.where(Room.building_id == building_id)
    if floor is not None:
        q = q.where(Room.floor == floor)
    if type:
        q = q.where(Room.type == type)
    return [room_out(r) for r in db.scalars(q)]


class RoomUpdateIn(BaseModel):
    capacity: Optional[int] = None
    type: Optional[str] = None
    allowed_uses: Optional[list[str]] = None
    is_bookable: Optional[bool] = None
    notes: Optional[str] = None
    name: Optional[str] = None


@app.patch("/rooms/{room_id}", tags=["admin"])
def update_room(room_id: int, data: RoomUpdateIn, admin: User = Depends(require("admin")),
                db: Session = Depends(get_db)):
    """Room data not given in the problem statement is admin-editable."""
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    old = room_out(room)
    if data.capacity is not None:
        room.capacity = data.capacity
        room.capacity_assumed = False
    if data.type is not None:
        room.type = data.type
    if data.allowed_uses is not None:
        room.allowed_uses = ",".join(data.allowed_uses)
    if data.is_bookable is not None:
        room.is_bookable = data.is_bookable
    if data.notes is not None:
        room.notes = data.notes
    if data.name is not None:
        room.name = data.name
    services.log_action(db, admin.id, "update_room", "room", room.id, old=old, new=room_out(room))
    db.commit()
    return room_out(room)


# ------------------------------------------------------------------ availability
def window(day: date_type, start: time_type, end: time_type) -> tuple[datetime, datetime]:
    s, e = datetime.combine(day, start), datetime.combine(day, end)
    if e <= s:
        raise HTTPException(422, "end must be after start")
    return s, e


@app.get("/rooms/available", tags=["rooms"])
def available_rooms(date: date_type, start: time_type, end: Optional[time_type] = None,
                    duration_minutes: Optional[int] = None, min_capacity: int = 0,
                    building_id: Optional[int] = None, floor: Optional[int] = None,
                    type: Optional[str] = None, purpose: Optional[str] = None,
                    db: Session = Depends(get_db)):
    """Free rooms for a date + time window. Give either `end` or `duration_minutes`."""
    if end is None:
        if not duration_minutes:
            raise HTTPException(422, "Provide end or duration_minutes")
        end_dt = datetime.combine(date, start) + timedelta(minutes=duration_minutes)
        if end_dt.date() != date:
            raise HTTPException(422, "Booking must end on the same day")
        end = end_dt.time()
    s, e = window(date, start, end)
    rooms = services.free_rooms(db, s, e, min_capacity=min_capacity, building_id=building_id,
                                floor=floor, room_type=type, purpose=purpose)
    rooms.sort(key=lambda r: (r.building_id, r.floor, r.name))
    return {"start_at": s.isoformat(), "end_at": e.isoformat(), "count": len(rooms),
            "rooms": [room_out(r) for r in rooms]}


@app.get("/rooms/status", tags=["rooms"])
def rooms_status(date: date_type, start: time_type, end: time_type,
                 building_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Every room with free/busy for a window. Use this to colour the floor-plan map."""
    s, e = window(date, start, end)
    q = select(Room).order_by(Room.building_id, Room.floor, Room.name)
    if building_id:
        q = q.where(Room.building_id == building_id)
    out = []
    for r in db.scalars(q):
        clash = services.overlapping_bookings(db, r.id, s, e)
        item = room_out(r)
        item["is_free"] = r.is_bookable and not clash
        item["busy_with"] = [{"id": b.id, "title": b.title, "start_at": b.start_at.isoformat(),
                              "end_at": b.end_at.isoformat(), "is_test": b.is_test} for b in clash]
        out.append(item)
    return out


@app.get("/rooms/{room_id}/schedule", tags=["rooms"])
def room_schedule(room_id: int, date: date_type, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    s = datetime.combine(date, time_type(0))
    q = select(Booking).where(Booking.room_id == room_id, Booking.start_at >= s,
                              Booking.start_at < s + timedelta(days=1),
                              Booking.status == "confirmed").order_by(Booking.start_at)
    return {"room": room_out(room), "date": date.isoformat(),
            "bookings": [booking_out(b) for b in db.scalars(q)]}


@app.get("/recommend/slots", tags=["intelligent assistance"])
def recommend_slots(date: date_type, duration_minutes: int = 60, min_capacity: int = 0,
                    building_id: Optional[int] = None, purpose: Optional[str] = None,
                    db: Session = Depends(get_db)):
    """Algorithmic time-slot suggestions, verified against real bookings."""
    slots = services.recommend_slots(db, datetime.combine(date, time_type(0)), duration_minutes,
                                     min_capacity, building_id=building_id, purpose=purpose)
    return [{"start_at": s["start_at"].isoformat(), "end_at": s["end_at"].isoformat(),
             "rooms": [room_out(r) for r in s["rooms"]]} for s in slots]


# ------------------------------------------------------------------ bookings
class BookingIn(BaseModel):
    room_id: int
    title: str = Field(min_length=2, max_length=200)
    purpose: str
    start_at: datetime
    end_at: datetime
    expected_attendees: Optional[int] = None
    batch_ids: list[int] = []
    notes: Optional[str] = None


def validate_booking(db: Session, room: Room, purpose: str, start: datetime, end: datetime,
                     needed: int, exclude_id: int | None = None) -> None:
    if purpose not in PURPOSES:
        raise HTTPException(422, f"purpose must be one of {list(PURPOSES)}")
    if end <= start:
        raise HTTPException(422, "end_at must be after start_at")
    if start.date() != end.date():
        raise HTTPException(422, "A booking must start and end on the same day")
    if not room.is_bookable:
        raise HTTPException(422, f"{room.name} cannot be booked")
    if purpose not in room.uses:
        raise HTTPException(422, f"{room.name} is not permitted for '{purpose}' "
                                 f"(allowed: {room.uses})")
    if needed > room.capacity:
        raise HTTPException(422, f"{room.name} holds {room.capacity}, but {needed} are expected")
    clashes = services.overlapping_bookings(db, room.id, start, end, exclude_id)
    if clashes:
        alts = services.suggest_alternatives(db, room, start, end, needed, purpose, exclude_id)
        raise HTTPException(409, {
            "message": f"{room.name} is already booked at that time",
            "conflicts": [booking_out(b) for b in clashes],
            "alternatives": [room_out(r) for r in alts],
        })


@app.post("/bookings", tags=["bookings"], status_code=201)
def create_booking(data: BookingIn, user: User = Depends(require("faculty", "admin")),
                   db: Session = Depends(get_db)):
    room = db.get(Room, data.room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    start, end = naive(data.start_at), naive(data.end_at)
    batch_list = list(db.scalars(select(Batch).where(Batch.id.in_(data.batch_ids)))) if data.batch_ids else []
    if len(batch_list) != len(set(data.batch_ids)):
        raise HTTPException(422, "Unknown batch_id")
    needed = services.needed_capacity(db, data.expected_attendees, data.batch_ids)
    validate_booking(db, room, data.purpose, start, end, needed)
    b = Booking(room_id=room.id, booked_by=user.id, title=data.title, purpose=data.purpose,
                start_at=start, end_at=end, expected_attendees=data.expected_attendees,
                notes=data.notes, batches=batch_list)
    db.add(b)
    try:
        db.flush()
    except IntegrityError:  # database exclusion constraint caught a race
        db.rollback()
        raise HTTPException(409, {"message": "Someone just booked this room", "conflicts": [],
                                  "alternatives": []})
    services.log_action(db, user.id, "create_booking", "booking", b.id, new=booking_out(b))
    db.commit()
    return booking_out(b)


@app.get("/bookings", tags=["bookings"])
def list_bookings(date: Optional[date_type] = None, date_to: Optional[date_type] = None,
                  room_id: Optional[int] = None, batch_id: Optional[int] = None,
                  building_id: Optional[int] = None, mine: bool = False,
                  include_cancelled: bool = False, db: Session = Depends(get_db),
                  cred: HTTPAuthorizationCredentials | None = Depends(bearer)):
    q = select(Booking).order_by(Booking.start_at)
    if not include_cancelled:
        q = q.where(Booking.status == "confirmed")
    if date:
        q = q.where(Booking.start_at >= datetime.combine(date, time_type(0)))
        last = date_to or date
        q = q.where(Booking.start_at < datetime.combine(last, time_type(0)) + timedelta(days=1))
    if room_id:
        q = q.where(Booking.room_id == room_id)
    if building_id:
        q = q.join(Room).where(Room.building_id == building_id)
    if batch_id:
        q = q.where(Booking.batches.any(Batch.id == batch_id))
    if mine:
        if not cred:
            raise HTTPException(401, "Login required")
        q = q.where(Booking.booked_by == int(decode_token(cred.credentials)["sub"]))
    return [booking_out(b) for b in db.scalars(q)]


def get_owned_booking(db: Session, booking_id: int, user: User) -> Booking:
    b = db.get(Booking, booking_id)
    if not b:
        raise HTTPException(404, "Booking not found")
    if user.role != "admin" and b.booked_by != user.id:
        raise HTTPException(403, "Only the person who booked it, or an admin, can change this booking")
    return b


class CancelIn(BaseModel):
    reason: Optional[str] = None


@app.post("/bookings/{booking_id}/cancel", tags=["bookings"])
def cancel_booking(booking_id: int, data: CancelIn, user: User = Depends(require("faculty", "admin")),
                   db: Session = Depends(get_db)):
    b = get_owned_booking(db, booking_id, user)
    if b.status == "cancelled":
        raise HTTPException(409, "Already cancelled")
    old = booking_out(b)
    b.status = "cancelled"
    b.updated_at = datetime.utcnow()
    reason = data.reason or "No reason given"
    db.add(Announcement(
        title=f"Cancelled: {b.title}",
        body=f"{b.title} in {b.room.name} on {b.start_at:%d %b %Y, %H:%M}-{b.end_at:%H:%M} "
             f"has been cancelled. Reason: {reason}",
        kind="cancellation", booking_id=b.id, author_id=user.id, is_test=b.is_test))
    services.log_action(db, user.id, "cancel_booking", "booking", b.id, old=old,
                        new={"status": "cancelled", "reason": reason})
    db.commit()
    return booking_out(b)


class RescheduleIn(BaseModel):
    start_at: datetime
    end_at: datetime
    room_id: Optional[int] = None
    reason: Optional[str] = None


@app.patch("/bookings/{booking_id}", tags=["bookings"])
def reschedule_booking(booking_id: int, data: RescheduleIn,
                       user: User = Depends(require("faculty", "admin")),
                       db: Session = Depends(get_db)):
    b = get_owned_booking(db, booking_id, user)
    if b.status == "cancelled":
        raise HTTPException(409, "Cannot reschedule a cancelled booking")
    room = db.get(Room, data.room_id) if data.room_id else b.room
    if not room:
        raise HTTPException(404, "Room not found")
    start, end = naive(data.start_at), naive(data.end_at)
    needed = services.needed_capacity(db, b.expected_attendees, [x.id for x in b.batches])
    validate_booking(db, room, b.purpose, start, end, needed, exclude_id=b.id)
    old = booking_out(b)
    b.room_id, b.start_at, b.end_at, b.updated_at = room.id, start, end, datetime.utcnow()
    db.flush()
    db.refresh(b)
    db.add(Announcement(
        title=f"Rescheduled: {b.title}",
        body=f"{b.title} has moved from {old['room']['name']} "
             f"({old['start_at']} to {old['end_at']}) to {room.name} "
             f"({start:%d %b %Y, %H:%M}-{end:%H:%M}). Reason: {data.reason or 'not given'}",
        kind="reschedule", booking_id=b.id, author_id=user.id, is_test=b.is_test))
    services.log_action(db, user.id, "reschedule_booking", "booking", b.id, old=old, new=booking_out(b))
    db.commit()
    return booking_out(b)


# ------------------------------------------------------------------ student schedule
@app.get("/batches/{batch_id}/schedule", tags=["student"])
def batch_schedule(batch_id: int, date: date_type, date_to: Optional[date_type] = None,
                   include_cancelled: bool = True, db: Session = Depends(get_db)):
    """Read-only schedule for a batch (cancelled items stay visible so nobody misses the notice)."""
    batch = db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found")
    last = date_to or date
    q = select(Booking).where(
        Booking.batches.any(Batch.id == batch_id),
        Booking.start_at >= datetime.combine(date, time_type(0)),
        Booking.start_at < datetime.combine(last, time_type(0)) + timedelta(days=1),
    ).order_by(Booking.start_at)
    if not include_cancelled:
        q = q.where(Booking.status == "confirmed")
    return {"batch": {"id": batch.id, "label": batch.label},
            "bookings": [booking_out(b) for b in db.scalars(q)]}


@app.get("/me/schedule", tags=["student"])
def my_schedule(date: date_type, date_to: Optional[date_type] = None,
                user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not user.batch_id:
        raise HTTPException(422, "Your account has no batch set")
    return batch_schedule(user.batch_id, date, date_to, True, db)


# ------------------------------------------------------------------ announcements
@app.get("/announcements", tags=["announcements"])
def announcements(batch_id: Optional[int] = None, kind: Optional[str] = None,
                  limit: int = 50, db: Session = Depends(get_db)):
    q = select(Announcement).order_by(Announcement.created_at.desc()).limit(limit)
    if kind:
        q = q.where(Announcement.kind == kind)
    items = list(db.scalars(q))
    if batch_id:  # keep general notices + those linked to bookings of that batch
        items = [a for a in items
                 if a.booking_id is None or any(x.id == batch_id for x in a.booking.batches)]
    return [announcement_out(a) for a in items]


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    body: str
    kind: str = "general"  # exam_notice | general
    booking_id: Optional[int] = None


@app.post("/announcements", tags=["announcements"], status_code=201)
def create_announcement(data: AnnouncementIn, user: User = Depends(require("faculty", "admin")),
                        db: Session = Depends(get_db)):
    if data.kind not in ("exam_notice", "general"):
        raise HTTPException(422, "kind must be exam_notice or general")
    if data.booking_id and not db.get(Booking, data.booking_id):
        raise HTTPException(404, "Booking not found")
    a = Announcement(title=data.title, body=data.body, kind=data.kind,
                     booking_id=data.booking_id, author_id=user.id)
    db.add(a)
    db.flush()
    services.log_action(db, user.id, "create_announcement", "announcement", a.id, new=announcement_out(a))
    db.commit()
    return announcement_out(a)


# ------------------------------------------------------------------ student reports
class ReportIn(BaseModel):
    kind: str  # comment | conflict | outdated
    text: str = Field(min_length=3)
    booking_id: Optional[int] = None


def report_out(r: Report) -> dict:
    return {"id": r.id, "booking_id": r.booking_id, "kind": r.kind, "text": r.text,
            "status": r.status, "user": r.user.name, "created_at": r.created_at.isoformat()}


@app.post("/reports", tags=["student"], status_code=201)
def create_report(data: ReportIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Students flag wrong/outdated info. This never edits a booking."""
    if data.kind not in ("comment", "conflict", "outdated"):
        raise HTTPException(422, "kind must be comment, conflict or outdated")
    if data.booking_id and not db.get(Booking, data.booking_id):
        raise HTTPException(404, "Booking not found")
    r = Report(user_id=user.id, kind=data.kind, text=data.text, booking_id=data.booking_id)
    db.add(r)
    db.flush()
    services.log_action(db, user.id, "create_report", "report", r.id, new=report_out(r))
    db.commit()
    return report_out(r)


@app.get("/reports", tags=["student"])
def list_reports(status: Optional[str] = None, booking_id: Optional[int] = None,
                 user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(Report).order_by(Report.created_at.desc())
    if user.role == "student":  # students only see their own
        q = q.where(Report.user_id == user.id)
    if status:
        q = q.where(Report.status == status)
    if booking_id:
        q = q.where(Report.booking_id == booking_id)
    return [report_out(r) for r in db.scalars(q)]


class ReportStatusIn(BaseModel):
    status: str  # open | resolved


@app.patch("/reports/{report_id}", tags=["student"])
def update_report(report_id: int, data: ReportStatusIn,
                  user: User = Depends(require("faculty", "admin")), db: Session = Depends(get_db)):
    r = db.get(Report, report_id)
    if not r:
        raise HTTPException(404, "Report not found")
    if data.status not in ("open", "resolved"):
        raise HTTPException(422, "status must be open or resolved")
    old = r.status
    r.status = data.status
    services.log_action(db, user.id, "update_report", "report", r.id, old={"status": old},
                        new={"status": data.status})
    db.commit()
    return report_out(r)


# ------------------------------------------------------------------ audit log
@app.get("/audit", tags=["admin"])
def audit(entity: Optional[str] = None, entity_id: Optional[int] = None, limit: int = 100,
          user: User = Depends(require("faculty", "admin")), db: Session = Depends(get_db)):
    """History of who did what. Faculty and admins can read it; nobody can edit it."""
    q = select(AuditLog).order_by(AuditLog.at.desc()).limit(limit)
    if entity:
        q = q.where(AuditLog.entity == entity)
    if entity_id:
        q = q.where(AuditLog.entity_id == entity_id)
    return [{"id": a.id, "at": a.at.isoformat(), "actor": a.actor.name if a.actor else None,
             "action": a.action, "entity": a.entity, "entity_id": a.entity_id,
             "old_value": a.old_value, "new_value": a.new_value} for a in db.scalars(q)]


# ------------------------------------------------------------------ AI natural-language search
class AISearchIn(BaseModel):
    query: str = Field(min_length=3)


@app.post("/ai/search", tags=["intelligent assistance"])
def ai_search(data: AISearchIn, user: User = Depends(require("faculty", "admin")),
              db: Session = Depends(get_db)):
    """'A room for 70 students tomorrow 2pm for 1 hour' -> filters -> verified free rooms."""
    today = datetime.now().date().isoformat()
    try:
        f = ai.parse_request(data.query, today)
    except ai.AIUnavailable as e:
        raise HTTPException(503, str(e))
    try:
        day = date_type.fromisoformat(f["date"])
        start = time_type.fromisoformat(f["start_time"])
        if f.get("end_time"):
            end = time_type.fromisoformat(f["end_time"])
        else:
            end = (datetime.combine(day, start) + timedelta(minutes=f.get("duration_minutes") or 60)).time()
    except (KeyError, TypeError, ValueError):
        return {"parsed_filters": f, "rooms": [],
                "message": "I could not work out the date and time. Please mention both."}
    building_id = None
    if f.get("building"):
        b = db.scalar(select(Building).where(Building.name.ilike(f"%{f['building']}%")))
        building_id = b.id if b else None
    s, e = window(day, start, end)
    rooms = services.free_rooms(db, s, e, min_capacity=f.get("min_capacity") or 0,
                                building_id=building_id, floor=f.get("floor"),
                                room_type=f.get("room_type"), purpose=f.get("purpose"))
    rooms.sort(key=lambda r: (r.capacity - (f.get("min_capacity") or 0), r.building_id, r.name))
    return {"parsed_filters": f, "start_at": s.isoformat(), "end_at": e.isoformat(),
            "verified_against_bookings": True, "count": len(rooms),
            "rooms": [room_out(r) for r in rooms[:10]]}


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
