

Build a React (Vite) frontend for a "Smart Campus Classroom Management System" for Deen Dayal Upadhyaya Gorakhpur University.

The backend already exists and is fully described in API_CONTRACT.md (attached/pasted below). Do NOT re-implement any booking rules in the frontend - always call the API. Read the base URL from the environment variable VITE_API_URL (default http://localhost:8000). Store the login token in memory/localStorage and send it as `Authorization: Bearer <token>`.

Build these pages, mobile-friendly, simple and clean:
1. Login and Signup (student signup only).
2. Find a Room: filters for building, floor, date, start time, end time or duration, minimum capacity, room type. Results from GET /rooms/available. Faculty also get an "Ask in plain English" box calling POST /ai/search (if it returns 503, hide the box).
3. Floor Map: two buildings, IET (ground, first, second floor) and Deeksha Bhawan (ground, first floor). Draw each floor as a grid of room boxes. Colour them green (free) or red (busy) using GET /rooms/status for the chosen date and time window. Click a room to see its schedule for the day (GET /rooms/{id}/schedule). Room placement should loosely follow the blueprint: IET first floor has IET22, 16, 14, 15 on the top row and IET20, 19, 18, 17 below; IET second floor has IET32 (seminar hall), 24, 25 on top and IET30, 29, 28, 23 below; ground floor has Library, Teachers' Office, Placement Cell, Director Office. Deeksha Bhawan ground floor has LH01 to LH07 and first floor LH08 to LH14.
4. Book form (faculty/admin only): room, title, purpose, date, start, end, expected attendees, batches (multi-select from GET /batches). On HTTP 409, show the clashing booking and the `alternatives` list; clicking an alternative re-submits the booking with that room.
5. My Bookings (faculty): list with Cancel (ask for reason) and Reschedule, plus a "History" panel from GET /audit.
6. Student Schedule: week view of GET /me/schedule. Cancelled items shown struck-through with a red "Cancelled" badge. A "Report a problem" button on each item opens a small form that POSTs /reports.
7. Announcements feed from GET /announcements, with badges per kind (cancellation, reschedule, exam_notice, general). Faculty can post exam notices.
8. Admin: reports inbox (resolve button), edit room capacity and allowed uses (PATCH /rooms/{id}), create faculty accounts.

Rules:
- Anything with is_test true must show a visible TEST DATA badge.
- If a room has capacity_assumed true, show "(capacity assumed)".
- Show role-appropriate menus only. Students never see booking or admin controls.
- Handle loading and error states. The backend runs on a free host that can take up to a minute to wake up, so show a friendly "Waking up the server..." message while GET /health is pending.
- Keep the UI simple and reliable rather than fancy.

Demo accounts (password demo1234): admin@demo.test, faculty@demo.test, student@demo.test.
