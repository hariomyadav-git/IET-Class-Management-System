from datetime import datetime

from sqlalchemy import (
    DDL, Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text, event,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# Roles and booking purposes used across the app
ROLES = ("student", "faculty", "admin")
PURPOSES = ("extra_class", "minor_exam", "practical", "event")


class Building(Base):
    __tablename__ = "buildings"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rooms = relationship("Room", back_populates="building")


class Room(Base):
    __tablename__ = "rooms"
    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id"))
    floor: Mapped[int] = mapped_column(Integer)  # 0 = ground
    name: Mapped[str] = mapped_column(String(60))  # e.g. IET19, LH03, Library
    type: Mapped[str] = mapped_column(String(30))  # classroom|lab|seminar_hall|library|office
    capacity: Mapped[int] = mapped_column(Integer, default=0)
    capacity_assumed: Mapped[bool] = mapped_column(Boolean, default=False)
    allowed_uses: Mapped[str] = mapped_column(String(200), default="")  # comma separated PURPOSES
    is_bookable: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    building = relationship("Building", back_populates="rooms")

    @property
    def uses(self) -> list[str]:
        return [u for u in self.allowed_uses.split(",") if u]


class Batch(Base):
    """One group of students: branch + year (+ section for CSE / AI ML)."""
    __tablename__ = "batches"
    id: Mapped[int] = mapped_column(primary_key=True)
    branch: Mapped[str] = mapped_column(String(20))
    year: Mapped[int] = mapped_column(Integer)
    section: Mapped[str | None] = mapped_column(String(5), nullable=True)
    size: Mapped[int] = mapped_column(Integer, default=75)

    @property
    def label(self) -> str:
        s = f"{self.branch} Year {self.year}"
        return f"{s} Sec {self.section}" if self.section else s


class Student(Base):
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(primary_key=True)
    roll_no: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"))
    is_test: Mapped[bool] = mapped_column(Boolean, default=False)
    batch = relationship("Batch")


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(20), default="student")
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id"), nullable=True)
    is_test: Mapped[bool] = mapped_column(Boolean, default=False)
    batch = relationship("Batch")


booking_batches = Table(
    "booking_batches",
    Base.metadata,
    Column("booking_id", ForeignKey("bookings.id"), primary_key=True),
    Column("batch_id", ForeignKey("batches.id"), primary_key=True),
)


class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))
    booked_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(200))
    purpose: Mapped[str] = mapped_column(String(30))
    start_at: Mapped[datetime] = mapped_column(DateTime)  # campus local time (IST), naive
    end_at: Mapped[datetime] = mapped_column(DateTime)
    expected_attendees: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="confirmed")  # confirmed|cancelled
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_test: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    room = relationship("Room")
    user = relationship("User")
    batches = relationship("Batch", secondary=booking_batches)


class Announcement(Base):
    __tablename__ = "announcements"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(30))  # cancellation|reschedule|exam_notice|general
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    is_test: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    author = relationship("User")
    booking = relationship("Booking")


class Report(Base):
    """Student comment / report. Never changes a booking."""
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(20))  # comment|conflict|outdated
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open")  # open|resolved
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    user = relationship("User")


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(40))
    entity: Mapped[str] = mapped_column(String(30))
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actor = relationship("User")


# ---- Database-level protection against double booking (PostgreSQL only) ----
# Even if two people click "Book" at the same instant, Postgres refuses the overlap.
event.listen(
    Base.metadata,
    "before_create",
    DDL("CREATE EXTENSION IF NOT EXISTS btree_gist").execute_if(dialect="postgresql"),
)
event.listen(
    Booking.__table__,
    "after_create",
    DDL(
        "ALTER TABLE bookings ADD CONSTRAINT no_room_overlap "
        "EXCLUDE USING gist (room_id WITH =, tsrange(start_at, end_at) WITH &&) "
        "WHERE (status = 'confirmed')"
    ).execute_if(dialect="postgresql"),
)
