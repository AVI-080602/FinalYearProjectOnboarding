# Sensory Navigator (Team TE 19)

Sensory-aware wayfinding for Melbourne CBD. The app routes neurodivergent and
sensory-sensitive commuters by sensory load instead of travel time, using City
of Melbourne open data and OpenStreetMap. No logins, no signups, no personal
data.

## Repository layout

```
OnboardingProject/
├── sensory-navigator/          backend: engine + data pipeline (Python)
│   ├── app/
│   │   ├── config.py           datasets, CBD bounds, density bands, defaults
│   │   ├── db.py               SQLAlchemy models (3NF, per the DMP)
│   │   ├── ingest/             data pipeline (fetch_static, fetch_live, build_profiles)
│   │   ├── graph/              OSM walk graph build + sensory layer join
│   │   └── sli/                Sensory Load Index engine + router + forecast
├── frontend/                   Next.js 16 + TypeScript + Tailwind (App Router)
├── Onboarding Presentation Slides.pptx   acceptance criteria (source of truth)
├── Onboarding requirements.docx          epics, user stories, DoD
└── schema.sql                            database DDL (Lucid-importable)
```

The Data Management Plan and design diagrams are kept in the team's shared
drive, not in the repo.

## Tech stack

- Engine and data pipeline: Python (pandas, SQLAlchemy, OSMnx, NetworkX, scipy)
- Database: SQLite for local dev; PostgreSQL-compatible schema (set DATABASE_URL to switch)
- API: FastAPI wrapper around the engine (sensory-navigator/app/api)
- Frontend: Next.js 16 + TypeScript + Tailwind + react-leaflet
- Data: City of Melbourne Open Data (CC BY 4.0) + OpenStreetMap (ODbL)

## Getting started

Prerequisites: Python 3.12+ (3.14 tested), Node 22+ (for the frontend).

```bash
git clone https://github.com/AVI-080602/FinalYearProjectOnboarding.git
cd FinalYearProjectOnboarding/sensory-navigator
pip install -r requirements.txt              # runtime (API + engine)
pip install -r requirements-pipeline.txt     # + graph tools (only if rebuilding the graph)
```

### Database: hosted (default for the team)

The team database is hosted PostgreSQL (Neon, Sydney). Get the `.env` file from
the team chat, place it at `sensory-navigator/.env`, and you are connected: no
data pipeline to run. The compact routing graph ships in the repo
(`data/graph_compact.npz`), so most teammates need no graph build at all.

Rebuilding the graph (data engineer, once per iteration):

```bash
python -m app.graph.build_graph       # OSM walk graph + sensory layer join
python -m app.graph.compact           # compile the compact runtime graph
```

One machine runs the data pipeline against the hosted DB (the data engineer).
Do not run ingest scripts against the shared database unless you are that person:

```bash
python -m app.ingest.fetch_live       # live pedestrian counts (only new rows are sent)
python -m app.ingest.build_profiles   # daily: refresh forecast profiles
python -m app.ingest.fetch_static     # per iteration: refuges + sensory sources
```

### Database: fully local (fallback)

Without a `.env` the app uses local SQLite. Run all four commands above
(static, live, profiles, then graph) to build your own copy from open data.

Smoke test (routes Southern Cross to Parliament three ways):

```bash
python -c "
from app.sli.engine import SensoryEngine
from app import config as C
e = SensoryEngine(); e.refresh_live()
for r in e.route((-37.8183, 144.9526), (-37.8110, 144.9730), C.DEFAULT_WEIGHTS, e.live_by_sensor, C.DEFAULT_THRESHOLD):
    print(r['label'], r['minutes'], 'min', r['sli'], r['band'])
"
```

The database (`sensory.db`) and graph artifacts (`data/`) are not committed:
they are large and fully regenerable with the commands above.

### Backend API

```bash
cd sensory-navigator
python -m uvicorn app.api.server:app --port 8000 --reload
```

Endpoints: `GET /api/status`, `POST /api/routes`, `GET /api/refuges`,
`GET /api/forecast/{sensor}`, `GET /api/sensors`,
`POST /api/suggestions` + `GET /api/suggestions?status=pending` (review queue).
Interactive docs at http://localhost:8000/docs. No auth by design.

`POST /api/routes` takes an optional `depart_in_min` (0-180). Each route comes
back with `congestion`: the stretches predicted to be congested at the moment
the walker reaches them (US 1.2), plus `congested_m` and a `recommended` flag
on the lowest personalised-load option. Congestion needs `hourly_profile` rows;
without them the forecast degrades to current live readings.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000 (expects the API on :8000)
```

Quality tooling: `npm run lint` (ESLint), `npm run format` (Prettier),
TypeScript checked on build.

## Hosting

- Database: Neon PostgreSQL (Sydney), already live.
- Backend API: Render web service, configured by `render.yaml` at the repo
  root. Needs two dashboard env vars: `DATABASE_URL` (the Neon string) and
  `ALLOWED_ORIGINS` (the Vercel frontend URL). The prebuilt graph artifacts
  in `sensory-navigator/data/` are committed so deploys need no graph build.
- Frontend: Vercel, import the repo with root directory `frontend` and set
  `NEXT_PUBLIC_API_URL` to the Render service URL.
- Free-tier note: the Render service sleeps after ~15 min idle; the first
  request after that takes a minute or two while the engine reloads. Hit
  `/api/status` once before a demo to warm it.

## Team workflow

- Branch from `main` per feature: `feature/<short-name>` (e.g. `feature/route-planner-ui`)
- Meaningful commit messages; reference the user story where relevant (e.g. `US 1.1: route comparison cards`)
- Peer review before merging to `main`; no direct pushes to `main` once the team is active
- Test against the acceptance criteria in the presentation deck before marking a story done

## Project rules

- Acceptance criteria source of truth: the TE 19 presentation deck. Epics and DoD: Onboarding requirements.docx.
- Hard constraint: no logins or signups anywhere in the app. Personalisation is device-local only.
- Persona: Freddy.

## Data licensing

Data: City of Melbourne Open Data, licensed CC BY 4.0.
Map data: (c) OpenStreetMap contributors, licensed ODbL.
Attribution must remain visible in the app and in published documents.
