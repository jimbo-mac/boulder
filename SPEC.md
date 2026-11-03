# Boulder — Spec

> *One must imagine Sisyphus happy.*

A lightweight personal web app for logging running and weightlifting workouts, built around **visualizing improvement over time**. The boulder goes a little higher each time.

## Goals

- Logging a workout takes **under 30 seconds** on a phone (logged mid-session at the gym).
- The Progress dashboard works well on both phone and desktop.
- Progress is obvious at a glance: every core metric has a trend chart.
- Single user (me). No social features, no coaching, no plans.
- Free to host and run.

## Non-goals (v1)

- Importing from Strava/Garmin (v2 candidate)
- GPS tracking, maps, splits per lap
- Workout programming/templates
- Multi-user or sharing

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React + TypeScript (strict) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Data + auth | Supabase (Postgres + email one-time-code auth; sign-ups disabled) |
| Tests | Vitest (+ React Testing Library for components) |
| Hosting | Vercel (auto-deploy from `main`) |
| Install | PWA (manifest + service worker) so it lives on my phone's home screen |

---

## Data model

```
workouts
  id            uuid, pk
  user_id       uuid, fk -> auth.users
  date          date            -- the day it happened (not created_at)
  type          'run' | 'lift'
  notes         text, nullable
  created_at    timestamptz

runs                            -- one per run workout
  workout_id    uuid, pk, fk -> workouts (cascade delete)
  distance_mi   numeric(5,2)
  duration_s    integer         -- total seconds
  run_kind      'base' | 'long' | 'recovery' | 'speed'   -- required

exercises                       -- user's lift catalog
  id            uuid, pk
  user_id       uuid
  name          text            -- e.g. "Back Squat"; unique per user
  category      'squat' | 'hinge' | 'push' | 'pull' | 'other'

sets                            -- many per lift workout
  id            uuid, pk
  workout_id    uuid, fk -> workouts (cascade delete)
  exercise_id   uuid, fk -> exercises
  set_order     integer
  weight_lb     numeric(6,2)
  reps          integer
  is_warmup     boolean default false
```

- Row-level security on every table: `user_id = auth.uid()` (child tables via their parent workout).
- Units: miles and pounds stored as above; a settings toggle for km/kg is v2.

### Auth decisions
- Sign in by emailed one-time code (`signInWithOtp` + `verifyOtp`), not a magic link: a link opens in the phone browser, whose session isn't shared with the installed home-screen PWA on iOS.
- Single user: sign-ups are disabled in Supabase and the app never creates accounts (`shouldCreateUser: false`). The one account was created in the Supabase dashboard.

### Settings (single row per user)

```
settings
  user_id           uuid, pk
  goal_race_name    text, nullable   -- e.g. "Spring Half"
  goal_race_date    date, nullable
  goal_distance_mi  numeric, nullable  -- 13.1
  goal_time_s       integer, nullable
```

---

## Derived metrics (pure functions in `src/lib/metrics.ts`, fully unit-tested)

| Metric | Formula |
|---|---|
| Pace | `duration_s / distance_mi` → shown as `m:ss /mi` |
| Estimated 1RM (Epley) | `weight × (1 + reps / 30)`; if `reps === 1`, return `weight` |
| Set volume | `weight × reps` (exclude warm-ups) |
| Weekly mileage | sum of `distance_mi` per ISO week (Mon start) |
| Race prediction (Riegel) | `T2 = T1 × (D2 / D1)^1.06` — there is no "race" run type, so slice 4 must decide which run supplies T1/D1 |
| Goal pace | `goal_time_s / goal_distance_mi` |

Edge cases to test: zero/negative inputs rejected, reps > 12 flagged as low-confidence for 1RM, weeks with no workouts show as 0 (not missing).

---

## Screens

Navigation: bottom tab bar on phones, top tabs on desktop; current screen lives in the URL hash (`#/log`, `#/progress`, …) so back/forward work. No routing library.


1. **Log** (default on mobile)
   - Toggle: Run / Lift
   - Run: date (default today), distance, duration, type (Base / Long / Recovery / Speed). Live average pace shown as you type. Kept deliberately minimal — no HR, RPE, or notes.
   - Duration is one numeric-keypad field that formats as you type (`4530` → `45:30`, `10500` → `1:05:00`); iOS numeric keypads have no colon.
   - Lift: date, then add exercises → add sets (weight × reps). "Repeat last set" button. Exercise picker with type-ahead + create new.
2. **Progress** (default on desktop)
   - Running tab: weekly mileage (bar), pace over time (line, filterable by run kind), long-run distance (line), goal-pace reference line + predicted race time card
   - Lifting tab: est. 1RM per exercise (line, exercise selector), weekly volume (bar), PR list
   - Time range selector: 4w / 12w / 6m / 1y / all
3. **History** — reverse-chronological list; tap to edit/delete.
4. **Settings** — goal race, sign out, export all data as JSON.

### PR detection
A set is a PR if its est. 1RM exceeds every prior set for that exercise. A run is a PR if it's the fastest pace among runs within ±5% of its distance. PRs get a marker on charts.

---

## Build order (vertical slices — each one deployable)

1. **Scaffold** — Vite/React/TS/Tailwind, Vitest, lint, Vercel deploy of a hello-world page.
2. **Auth + DB** — Supabase project, schema migration, RLS, email-code sign-in.
3. **Runs end-to-end** — log form → saved → History list → weekly mileage chart.
4. **Run trends** — pace chart, long-run chart, goal settings, goal-pace line, Riegel prediction.
5. **Lifts end-to-end** — exercise catalog, set logging, est. 1RM chart.
6. **Lift trends** — weekly volume, PR detection + markers.
7. **PWA + polish** — manifest, icons (the boulder), offline-friendly shell, edit/delete, JSON export.

## v2 ideas
- Strava/Garmin CSV import
- km/kg toggle
- Offline logging queue that syncs when back online
- Bodyweight tracking
- Logo boulder rises up the hill as stats improve
