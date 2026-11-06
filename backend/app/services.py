"""Core scheduling rules. All availability decisions are made HERE, from the bookings table.
The AI layer only proposes filters; it never decides whether a room is free."""
import json
from datetime import datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AuditLog, Batch, Booking, Room


def overlapping_bookings(db: Session, room_id: int, start: datetime, end: datetime,
                         exclude_id: int | None = None) -> list[Booking]:
    """Two bookings clash when: new.start < existing.end AND new.end > existing.start."""
    q = select(Booking).where(
        Booking.room_id == room_id,
        Booking.status == "confirmed",
        Booking.start_at < end,
        Booking.end_at > start,
    )
    if exclude_id:
        q = q.where(Booking.id != exclude_id)
    return list(db.scalars(q))


def busy_room_ids(db: Session, start: datetime, end: datetime, exclude_id: int | None = None) -> set[int]:
    q = select(Booking.room_id).where(
        Booking.status == "confirmed", Booking.start_at < end, Booking.end_at > start
    )
    if exclude_id:
        q = q.where(Booking.id != exclude_id)
    return set(db.scalars(q))


def free_rooms(db: Session, start: datetime, end: datetime, *, min_capacity: int = 0,
               building_id: int | None = None, floor: int | None = None,
               room_type: str | None = None, purpose: str | None = None,
               exclude_booking_id: int | None = None) -> list[Room]:
    q = select(Room).where(Room.is_bookable == True, Room.capacity >= min_capacity)  # noqa: E712
    if building_id:
        q = q.where(Room.building_id == building_id)
    if floor is not None:
        q = q.where(Room.floor == floor)
    if room_type:
        q = q.where(Room.type == room_type)
    busy = busy_room_ids(db, start, end, exclude_booking_id)
    rooms = [r for r in db.scalars(q) if r.id not in busy]
    if purpose:
        rooms = [r for r in rooms if purpose in r.uses]
    return rooms


def rank_alternatives(rooms: list[Room], target: Room, needed: int) -> list[Room]:
    """Prefer same building, then same floor, then same type, then tightest capacity fit."""
    return sorted(
        rooms,
        key=lambda r: (
            r.building_id != target.building_id,
            r.floor != target.floor,
            r.type != target.type,
            r.capacity - needed,
            r.name,
        ),
    )


def suggest_alternatives(db: Session, target: Room, start: datetime, end: datetime,
                         needed: int, purpose: str, exclude_booking_id: int | None = None,
                         limit: int = 5) -> list[Room]:
    candidates = free_rooms(db, start, end, min_capacity=needed, purpose=purpose,
                            exclude_booking_id=exclude_booking_id)
    candidates = [r for r in candidates if r.id != target.id]
    return rank_alternatives(candidates, target, needed)[:limit]


def recommend_slots(db: Session, day: datetime, duration_min: int, needed: int, *,
                    building_id: int | None = None, purpose: str | None = None,
                    day_start: int = 9, day_end: int = 18, step_min: int = 30,
                    limit: int = 8) -> list[dict]:
    """Scan the day in steps; return start times where at least one suitable room is free."""
    out = []
    cur = datetime.combine(day.date(), time(day_start))
    last = datetime.combine(day.date(), time(day_end))
    dur = timedelta(minutes=duration_min)
    while cur + dur <= last and len(out) < limit:
        rooms = free_rooms(db, cur, cur + dur, min_capacity=needed,
                           building_id=building_id, purpose=purpose)
        if rooms:
            rooms.sort(key=lambda r: (r.capacity - needed, r.building_id, r.name))
            out.append({"start_at": cur, "end_at": cur + dur, "rooms": rooms[:3]})
        cur += timedelta(minutes=step_min)
    return out


def log_action(db: Session, actor_id: int | None, action: str, entity: str,
               entity_id: int | None, old=None, new=None) -> None:
    db.add(AuditLog(
        actor_id=actor_id, action=action, entity=entity, entity_id=entity_id,
        old_value=json.dumps(old, default=str) if old is not None else None,
        new_value=json.dumps(new, default=str) if new is not None else None,
    ))


def needed_capacity(db: Session, expected: int | None, batch_ids: list[int]) -> int:
    if expected:
        return expected
    if batch_ids:
        sizes = db.scalars(select(Batch.size).where(Batch.id.in_(batch_ids)))
        return sum(sizes)
    return 0
