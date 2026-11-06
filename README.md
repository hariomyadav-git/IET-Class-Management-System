# Smart Campus Classroom Management System

Backend for DDUGU (IET + Deeksha Bhawan) - room discovery, booking, conflict prevention,
alternative-room suggestions, announcements, student reports and an audit log.

Stack: FastAPI (Python), SQLAlchemy, PostgreSQL (SQLite for quick local tests), Gemini for natural-language search.

## Key design idea
The **database decides** if a room is free. AI only turns a sentence into filters; every
suggestion is re-checked against the bookings table. Double-booking is also blocked inside
PostgreSQL itself with an exclusion constraint, so two simultaneous clicks cannot both succeed.

## Run locally (5 minutes)
```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# optional: use Postgres (Neon/Supabase) instead of the default local SQLite file
# export DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
# optional: AI search
# export GEMINI_API_KEY="your-key"

python -m app.seed                # loads rooms, batches, test students, demo users, test bookings
uvicorn app.main:app --reload     # API at http://localhost:8000 , docs at /docs
```
Demo logins (TEST data, password `demo1234`): admin@demo.test, faculty@demo.test, student@demo.test

## Environment variables
| Name | Purpose |
|---|---|
| DATABASE_URL | Postgres connection string (default: local SQLite file `campus.db`) |
| SECRET_KEY | Signs login tokens. Set a long random value in production |
| GEMINI_API_KEY | Enables `/ai/search`. Without it that endpoint returns 503 |
| GEMINI_MODEL | Optional, default `gemini-2.5-flash` |
| CORS_ORIGINS | Comma-separated frontend URLs (default `*`) |

## Deploy (free tiers - check current limits)
1. **Database:** create a free Postgres on Neon or Supabase, copy the connection string.
2. **Backend on Render:** New Web Service from the GitHub repo, root directory `backend`,
   build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`,
   add env vars above. Run `python -m app.seed` once (Render shell, or locally with the Neon `DATABASE_URL`).
3. **Frontend on Vercel:** import the frontend repo, set `VITE_API_URL` to the Render URL.
   The free Render server sleeps when idle - open `/health` a minute before any demo.

## Data notes (what came from the PDF and what was assumed)
- Rooms of both buildings come from the blueprint and text. Capacities for labs and Deeksha Bhawan rooms
  were not given, so they are marked `capacity_assumed` and are admin-editable (`PATCH /rooms/{id}`).
- The text lists LH01-LH12 but the blueprint shows LH01-LH14; all 14 are loaded.
- The blueprint's IET14/15/16/22 are treated as the CSE/ME/ECE/IT labs (assumption, editable).
- The real student list was not supplied; sample students are generated and flagged `is_test`.
- All demo bookings, users and announcements are flagged `is_test` and titled `[TEST]`.

See `API_CONTRACT.md` for every endpoint.
