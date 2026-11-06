# API Contract - Smart Campus Classroom Management System

Base URL (local): `http://localhost:8000`   Interactive docs: `http://localhost:8000/docs`

**Rules for the frontend**
- All times are campus local time (IST) as ISO strings WITHOUT timezone, e.g. `2026-11-06T14:00:00`.
- Dates are `YYYY-MM-DD`, times are `HH:MM`.
- Send the login token as header: `Authorization: Bearer <token>`.
- Never decide availability in the frontend. Always ask the API.
- Anything with `"is_test": true` must be shown with a visible **TEST DATA** badge.
- Errors come back as `{"detail": "message"}` (or an object for the 409 conflict, see below).

**Demo accounts (all TEST data, password `demo1234`)**
| Role | Email |
|---|---|
| admin | admin@demo.test |
| faculty | faculty@demo.test |
| student | student@demo.test (batch: CSE Year 2 Sec A) |

**Roles:** `student` (read, comment/report), `faculty` (book, cancel, reschedule own, announce), `admin` (everything, edit rooms, create users).

---

## Auth
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | body `{email, password}` -> `{token, user}` |
| POST | `/auth/signup` | public | body `{email, name, password, batch_id?}` -> creates a STUDENT, returns `{token, user}` |
| GET | `/auth/me` | any | current user `{id,email,name,role,batch_id,batch}` |
| POST | `/admin/users` | admin | body `{email,name,password,role}` |

## Reference data
| Method | Path | Notes |
|---|---|---|
| GET | `/buildings` | `[{id,name,code,notes}]` - IET and Deeksha Bhawan |
| GET | `/batches?branch=&year=` | `[{id,branch,year,section,size,label}]` |
| GET | `/rooms?building_id=&floor=&type=&min_capacity=` | all rooms (floor 0 = ground) |
| PATCH | `/rooms/{id}` | admin. body any of `{capacity,type,allowed_uses[],is_bookable,notes,name}` |

Room object:
```json
{"id":5,"name":"IET19","building_id":1,"building":"IET","floor":1,"type":"classroom",
 "capacity":75,"capacity_assumed":false,"allowed_uses":["extra_class","minor_exam","event"],
 "is_bookable":true,"notes":null}
```
Room `type`: `classroom | lab | seminar_hall | library | office`.
Purposes: `extra_class | minor_exam | practical | event`.
If `capacity_assumed` is true, show "(capacity assumed)" next to it.

## Finding rooms
| Method | Path | Notes |
|---|---|---|
| GET | `/rooms/available?date=&start=&end=` (or `duration_minutes=`), optional `min_capacity, building_id, floor, type, purpose` | `{start_at,end_at,count,rooms[]}` free rooms only |
| GET | `/rooms/status?date=&start=&end=&building_id=` | EVERY room with `is_free` (bool) and `busy_with[]`. **Use this to colour the floor map** (green free / red busy). |
| GET | `/rooms/{id}/schedule?date=` | bookings in that room that day |
| GET | `/recommend/slots?date=&duration_minutes=60&min_capacity=70&building_id=&purpose=` | `[{start_at,end_at,rooms[]}]` suggested start times |
| POST | `/ai/search` | faculty/admin. body `{"query":"room for 70 students tomorrow 2pm for 1 hour"}` -> `{parsed_filters, rooms[], verified_against_bookings:true}`. Returns 503 if the AI key is not configured - hide the AI box gracefully. |

## Bookings
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/bookings` | faculty/admin | see below |
| GET | `/bookings?date=&date_to=&room_id=&batch_id=&building_id=&mine=true&include_cancelled=` | public | list |
| POST | `/bookings/{id}/cancel` | owner/admin | body `{reason?}` - also auto-publishes a cancellation announcement |
| PATCH | `/bookings/{id}` | owner/admin | reschedule. body `{start_at,end_at,room_id?,reason?}` - auto-publishes a reschedule announcement. Same 409 behaviour as create. |

**Create booking** body:
```json
{"room_id":5,"title":"DSA extra class","purpose":"extra_class",
 "start_at":"2026-11-06T10:00:00","end_at":"2026-11-06T11:00:00",
 "expected_attendees":70,"batch_ids":[3],"notes":"optional"}
```
`expected_attendees` is optional - if omitted, the sum of selected batch sizes is used.

Success `201` -> booking object:
```json
{"id":12,"room":{"id":5,"name":"IET19","building":"IET","floor":1},
 "title":"DSA extra class","purpose":"extra_class",
 "start_at":"2026-11-06T10:00:00","end_at":"2026-11-06T11:00:00","status":"confirmed",
 "expected_attendees":70,"booked_by":{"id":2,"name":"Demo Faculty (test)"},
 "batches":[{"id":3,"label":"CSE Year 2 Sec A"}],"notes":null,"is_test":false}
```

**Conflict `409`** - the key UX moment. Show the clash and let the user pick an alternative in one click (re-send POST with the new `room_id`):
```json
{"detail":{"message":"IET19 is already booked at that time",
 "conflicts":[ {booking object} ],
 "alternatives":[ {room object}, {room object} ]}}
```
Other errors: `422` (room too small / not allowed for this purpose / bad times), `403`, `401`.

## Student view
| Method | Path | Notes |
|---|---|---|
| GET | `/me/schedule?date=&date_to=` | logged-in student's own batch. Cancelled items are included (`status:"cancelled"`) - show them struck-through, not hidden. |
| GET | `/batches/{id}/schedule?date=&date_to=&include_cancelled=` | any batch |
| POST | `/reports` | any logged-in user. body `{kind:"comment"\|"conflict"\|"outdated", text, booking_id?}`. Does NOT change any booking. |
| GET | `/reports?status=&booking_id=` | students see their own; faculty/admin see all |
| PATCH | `/reports/{id}` | faculty/admin. body `{status:"open"\|"resolved"}` |

## Announcements and history
| Method | Path | Notes |
|---|---|---|
| GET | `/announcements?batch_id=&kind=&limit=` | `kind`: `cancellation \| reschedule \| exam_notice \| general` |
| POST | `/announcements` | faculty/admin. body `{title, body, kind:"exam_notice"\|"general", booking_id?}` |
| GET | `/audit?entity=booking&entity_id=12` | faculty/admin. Who did what and when, with old/new values. Show as a "History" panel on a booking. |
| GET | `/health` | `{"status":"ok"}` - use to wake the free-tier server |

---

## Suggested pages
1. **Login / Signup**
2. **Find a Room** - filters (building, floor, date, start, end/duration, capacity, type) -> results list + "Book" button; AI search box on top
3. **Floor Map** - IET (3 floors) and Deeksha Bhawan (2 floors) drawn as a simple grid of room boxes, coloured from `/rooms/status`; click a room to see its day schedule
4. **Book form** - handles the 409 by showing alternatives
5. **My Bookings** (faculty) - cancel / reschedule / History panel
6. **Student Schedule** - weekly view for own batch, cancelled shown struck-through, "Report a problem" button per item
7. **Announcements** feed
8. **Admin** - reports inbox, edit room capacity/uses, create faculty accounts
