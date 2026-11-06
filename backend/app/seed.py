"""Loads campus data from the problem statement PDF.  Run:  python -m app.seed
Safe to re-run: it wipes and reloads everything (use only on a fresh/demo database).

Anything not given in the PDF is marked capacity_assumed=True or described in `notes`,
and can be corrected by an admin through PATCH /rooms/{id}.
"""
from datetime import date, datetime, time, timedelta

from sqlalchemy import delete

from .database import Base, SessionLocal, engine
from .models import (
    Announcement, AuditLog, Batch, Booking, Building, Report, Room, Student, User,
    booking_batches,
)
from .security import hash_password

CLASS_USES = "extra_class,minor_exam,event"
LAB_USES = "practical"
HALL_USES = "extra_class,minor_exam,event"
LIB_USES = "minor_exam,event"

# (name, floor, type, capacity, assumed, uses, bookable, notes)
IET_ROOMS = [
    # ---- Ground floor
    ("Library", 0, "library", 165, False, LIB_USES, True,
     "Approx. 150-180 students; sometimes used for examinations (PDF)."),
    ("Teachers' Office", 0, "office", 0, False, "", False, "Faculty cabins - not bookable."),
    ("Placement Cell", 0, "office", 0, False, "", False, "Not bookable."),
    ("Director Office", 0, "office", 0, False, "", False, "Not bookable."),
    # ---- First floor: four classrooms named in the text
    ("IET17", 1, "classroom", 75, False, CLASS_USES, True, None),
    ("IET18", 1, "classroom", 75, False, CLASS_USES, True, None),
    ("IET19", 1, "classroom", 75, False, CLASS_USES, True, None),
    ("IET20", 1, "classroom", 75, False, CLASS_USES, True, None),
    # First floor: four labs (text names CSE, ME, ECE, IT labs; blueprint shows IET14/15/16/22).
    ("IET14", 1, "lab", 40, True, LAB_USES, True,
     "ASSUMPTION: CSE Lab. Blueprint shows IET14 but text does not map labs to room numbers."),
    ("IET15", 1, "lab", 40, True, LAB_USES, True, "ASSUMPTION: ME Lab."),
    ("IET16", 1, "lab", 40, True, LAB_USES, True, "ASSUMPTION: ECE Lab."),
    ("IET22", 1, "lab", 40, True, LAB_USES, True, "ASSUMPTION: IT Lab."),
    # ---- Second floor
    ("IET32", 2, "seminar_hall", 200, False, HALL_USES, True, "Seminar Hall, approx. 200 (PDF)."),
    ("IET24", 2, "classroom", 75, False, CLASS_USES, True, None),
    ("IET25", 2, "classroom", 75, False, CLASS_USES, True, None),
    ("IET28", 2, "classroom", 75, False, CLASS_USES, True, None),
    ("IET29", 2, "classroom", 75, False, CLASS_USES, True, None),
    ("IET30", 2, "classroom", 75, False, CLASS_USES, True, None),
    ("IET23", 2, "classroom", 75, True, CLASS_USES, True,
     "ASSUMPTION: appears in the blueprint but not in the text's list of five classrooms."),
]

# Deeksha Bhawan: blueprint LH01-LH07 ground floor, LH08-LH14 first floor.
# Text says LH01-LH12; blueprint also shows LH13 and LH14 - included, flagged in notes.
DEEKSHA_ROOMS = []
for n in range(1, 15):
    floor = 0 if n <= 7 else 1
    note = "Capacity not given in PDF - default assumed, admin can edit."
    if n > 12:
        note += " In blueprint but not in the text (text says LH01-LH12)."
    DEEKSHA_ROOMS.append((f"LH{n:02d}", floor, "classroom", 60, True, CLASS_USES, True, note))

# Branch -> sections.  CSE and AI ML have Sections A and B (~150), others ~75 (PDF).
BRANCHES = {"CSE": ["A", "B"], "AI ML": ["A", "B"], "AI DS": [None], "ECE": [None],
            "ME": [None], "IT": [None]}
BATCH_SIZE = 75  # ~150 split into two sections, ~75 for single-section branches


def reset(db):
    for table in (booking_batches,):
        db.execute(delete(table))
    for model in (Report, Announcement, AuditLog, Booking, Student, User, Room, Batch, Building):
        db.execute(delete(model))
    db.commit()


def run():
    Base.metadata.create_all(engine)
    db = SessionLocal()
    reset(db)

    iet = Building(name="IET", code="IET",
                   notes="Institute of Engineering and Technology - 3 floors (ground, first, second).")
    dk = Building(name="Deeksha Bhawan", code="DB",
                  notes="Separate building, approx. 100 m from IET.")
    db.add_all([iet, dk])
    db.flush()

    for b, rooms in ((iet, IET_ROOMS), (dk, DEEKSHA_ROOMS)):
        for name, floor, rtype, cap, assumed, uses, bookable, notes in rooms:
            db.add(Room(building_id=b.id, name=name, floor=floor, type=rtype, capacity=cap,
                        capacity_assumed=assumed, allowed_uses=uses, is_bookable=bookable,
                        notes=notes))

    batches = []
    for branch, sections in BRANCHES.items():
        for year in (1, 2, 3, 4):
            for sec in sections:
                batch = Batch(branch=branch, year=year, section=sec, size=BATCH_SIZE)
                db.add(batch)
                batches.append(batch)
    db.flush()

    # Sample students (the real student list was not supplied) - all flagged is_test
    for batch in batches:
        tag = batch.branch.replace(" ", "") + str(batch.year) + (batch.section or "")
        for i in range(1, batch.size + 1):
            db.add(Student(roll_no=f"TEST-{tag}-{i:03d}", name=f"Test Student {tag}-{i:03d}",
                           batch_id=batch.id, is_test=True))

    cse_2a = next(b for b in batches if (b.branch, b.year, b.section) == ("CSE", 2, "A"))
    cse_2b = next(b for b in batches if (b.branch, b.year, b.section) == ("CSE", 2, "B"))
    me_3 = next(b for b in batches if (b.branch, b.year) == ("ME", 3))

    admin = User(email="admin@demo.test", name="Demo Admin (test)", role="admin",
                 password_hash=hash_password("demo1234"), is_test=True)
    faculty = User(email="faculty@demo.test", name="Demo Faculty (test)", role="faculty",
                   password_hash=hash_password("demo1234"), is_test=True)
    student = User(email="student@demo.test", name="Demo Student CSE-2A (test)", role="student",
                   batch_id=cse_2a.id, password_hash=hash_password("demo1234"), is_test=True)
    db.add_all([admin, faculty, student])
    db.flush()

    # A few clearly-labelled TEST bookings for tomorrow, so the demo has something to clash with
    rooms = {r.name: r for r in db.query(Room).all()}
    tomorrow = date.today() + timedelta(days=1)

    def at(h, m=0):
        return datetime.combine(tomorrow, time(h, m))

    tests = [
        ("[TEST] DSA extra class", "IET19", "extra_class", at(10), at(11), [cse_2a]),
        ("[TEST] Minor exam - CSE 2nd year", "IET32", "minor_exam", at(14), at(16), [cse_2a, cse_2b]),
        ("[TEST] ME practical", "IET15", "practical", at(11), at(13), [me_3]),
        ("[TEST] Guest lecture", "LH03", "event", at(10), at(12), []),
    ]
    for title, room, purpose, s, e, bl in tests:
        db.add(Booking(room_id=rooms[room].id, booked_by=faculty.id, title=title, purpose=purpose,
                       start_at=s, end_at=e, batches=bl, is_test=True,
                       expected_attendees=None if bl else 60,
                       notes="TEST DATA - created by seed script"))
    db.add(Announcement(title="[TEST] Welcome to the Smart Campus system",
                        body="This is a test announcement created by the seed script.",
                        kind="general", author_id=admin.id, is_test=True))
    db.commit()
    db.close()
    print("Seed complete: 2 buildings,", len(IET_ROOMS) + len(DEEKSHA_ROOMS), "rooms,",
          len(batches), "batches, sample students and demo users loaded.")


if __name__ == "__main__":
    run()
