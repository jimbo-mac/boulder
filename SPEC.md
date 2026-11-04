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
  tracking      'weight' | 'reps', default 'weight'  -- reps = reps only (pull-ups): no weight box, weight_lb stored as 0, progress = most reps in a set

sets                            -- many per lift workout
  id            uuid, pk
  workout_id    uuid, fk -> workouts (cascade delete)
  exercise_id   uuid, fk -> exercises
  set_order     integer
  weight_lb     numeric(6,2)
  reps          integer
  is_warmup     boolean default false

habits                          -- yes/no daily habits with a weekly goal
  id            uuid, pk
  user_id       uuid
  kind          'stretch' | 'habit'   -- Log > Stretch or Log > Habits
  name          text            -- unique per user + kind among habits in use; Stretch has Posture, General
  tracking      'check' | 'minutes', default 'check'  -- minutes = an amount per day (Screen time, built in)
  archived_at   timestamptz, nullable  -- hidden from Log/Progress; history kept
  weekly_goal   integer 1–7, default 3
  sort_order    integer

habit_checks                    -- a row = done (or logged) that local day; unchecking/clearing deletes it
  habit_id      uuid, fk -> habits (cascade delete)
  date          date
  minutes       integer 0–1439, nullable  -- minutes habits only
  primary key (habit_id, date)
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
| Estimated 1RM (Epley) | `weight × (1 + reps / 30)`; if `reps === 1`, return `weight`. Chart point per day = best working set (warm-ups and 0 lb bodyweight sets excluded); a confident estimate (≤ 12 reps) beats a higher low-confidence one, which is drawn hollow |
| Set volume | `weight × reps` (exclude warm-ups) |
| Pace trend | per run type: each run's pace + trailing 5-run average (distance-weighted: Σtime ÷ Σdistance). Change in range = pace of first k runs − last k, k = min(5, ⌊n/2⌋); positive = faster |
| Weekly mileage | sum of `distance_mi` per ISO week (Mon start) |
| Race prediction (Riegel) | `T2 = T1 × (D2 / D1)^1.06` — T1/D1 come from the **best effort in the last 8 weeks**: the run of ≥ 3 mi (any type) whose prediction is fastest. Independent of the Progress range selector. |
| Goal pace | `goal_time_s / goal_distance_mi` |

Edge cases to test: zero/negative inputs rejected, reps > 12 flagged as low-confidence for 1RM, weeks with no workouts show as 0 (not missing).

---

## Screens

Navigation (Log, Progress, History, Settings): bottom tab bar on phones, top tabs on desktop; current screen lives in the URL hash (`#/log`, `#/progress`, …) so back/forward work. No routing library.


1. **Log** (default on mobile)
   - Toggle: Run / Lift / Stretch / Habits
   - Run: date (default today), distance, duration, type (Base / Long / Recovery / Speed). Live average pace shown as you type. Kept deliberately minimal — no HR, RPE, or notes.
   - Duration is one numeric-keypad field that formats as you type (`4530` → `45:30`, `10500` → `1:05:00`); iOS numeric keypads have no colon.
   - Lift: date, then add exercises → add sets (weight × reps, warm-up toggle). "Repeat last set" (copies weight/reps/warm-up) and "+ Empty set" buttons. Exercise picker with type-ahead, common-lift suggestions until added, and create new (pick a category). Bodyweight = 0 lb.
   - The in-progress lift workout is saved to the device (localStorage) after every change, so closing the tab mid-workout loses nothing; Log reopens on Lift when a draft exists. Saving uses `log_lift()` (workout + all sets in one transaction). Fully blank set rows are skipped; half-filled rows block saving with a message.
   - Stretch: two routines, Posture and General (fixed for now), each a yes/no per day with a weekly goal (days per week, set in Settings). No streaks.
     - Two big toggles act on the selected day (default today): one tap checks it off and saves immediately; tap again to undo. Each shows "N of goal this week" (Monday-start week).
     - Month calendar (Monday first) with two small dots per day — Posture left (blue), General right (orange), hollow when not done — plus a legend and "This month: N days" per routine. Tap a past day to select it and check off something forgotten; future days are disabled.
     - Not shown in History; Progress has a read-only Stretching view.
   - Habits: check-off habits the user adds in Settings, plus built-in Screen time. Same selected-day + month calendar as Stretch (each day shows ✓ when all check-offs are done, else "done/total").
     - Check-offs: one full-width toggle per habit for the selected day, showing its daily streak ("N days in a row"). Streak = consecutive days ending today; an unchecked today doesn't break it (runs through yesterday). Uses all history.
     - Screen time: one hours:minutes field (`215` → `2:15`, minutes < 60, under 24h) with Save, and Clear for a logged day. Trend only, no limit.
2. **Progress** (default on desktop)
   - Running tab: weekly mileage (bar) with this-week / weekly-avg / total tiles; pace over time per run type (dots per run + 5-run average line, normal y-axis (lower = faster), "current" and "change in range" figures), long-run distance (line), goal-pace reference line + predicted race time card, PR markers on the pace and long-run charts, recent run PRs list
   - Lifting tab: est. 1RM per exercise (line, exercise selector), weekly volume for the selected exercise (bar; reps-only exercises show total reps per week), recent PRs list
   - Stretching tab: read-only, one card per routine. Figures: this week (N of goal), week streak, goal met (N of M weeks in range). Week grid: a column per Monday-start week, a row per weekday, a filled square per day done (hollow = not done, blank = future), and under each week ✓ met / – missed / · in progress.
     - Week streak = weeks in a row the goal was met, counting back from this week; this week counts only once met (otherwise the streak runs through last week). Uses all history, not the range.
     - "Goal met" counts finished weeks in the range, plus this week once met. Past weeks are judged against the current goal (goal changes aren't stored).
   - Habits tab (4 options sit 2×2 on phones): Screen time card — average per logged day in range, change vs the same number of days just before, days logged, and a daily bar chart with a trailing 7-day average line (lower = better). One card per check-off habit — current streak, best streak, days done in range, and the week grid with days done under each week.
   - Time range selector: 1w / 1m / 3m, default 1m (whole Mon–Sun weeks: 1, 4, 13). Kept short while there is little data; 6m / 1y / All can come back later. PRs are always judged against all history.
3. **History** — reverse-chronological list of runs and lifts (lifts show exercises, working sets, volume). Tap a workout to edit it (`#/history/<id>`) in the same form it was logged with, or delete it (with a confirm). Edits are atomic (`update_lift` / `update_run`) and never touch the on-device lift draft. After saving a new workout, the "Saved" message links straight to its edit screen.
4. **Settings** — goal race (optional name + date; distance via 5K / 10K / Half / Marathon presets or custom; goal time), habits (add, rename, remove = archive with a confirm; Screen time is built in and not listed), weekly stretching goals (− / + per routine, 1–7 days, saves on tap), sign out, export all data as JSON.
   - Progress shows a goal card above the range selector: goal time + pace, predicted time + pace, gap, days to go, and which run the prediction used.

### PR detection
PRs are judged per day against **all** earlier history (not just the selected range), and the first-ever session of an exercise (or first run of a kind) is a baseline, not a PR. Ties are not PRs.
- **Weighted lifts:** a day is a PR if its best est. 1RM beats every earlier day's for that exercise. Warm-ups, 0 lb sets, and low-confidence sets (> 12 reps) don't count.
- **Reps-only lifts** (pull-ups): a day is a PR if its most reps in one working set beats every earlier day.
- **Long runs:** a PR is the longest distance among all earlier long runs.
- **Base / Recovery / Speed runs:** a PR is the fastest pace among earlier runs of the same type within ±5% of its distance (at least one such run must exist).

PRs get a marker on charts and appear in a recent-PRs list.

---

## Build order (vertical slices — each one deployable)

1. **Scaffold** — Vite/React/TS/Tailwind, Vitest, lint, Vercel deploy of a hello-world page.
2. **Auth + DB** — Supabase project, schema migration, RLS, email-code sign-in.
3. **Runs end-to-end** — log form → saved → History list → weekly mileage chart.
4. **Run trends** — pace chart (done in slice 3), long-run chart, goal settings, goal-pace line, Riegel prediction.
5. **Lifts end-to-end** — exercise catalog, set logging, est. 1RM chart.
   - **5b. Edit/delete** (moved up from slice 7 after a workout was saved too early) — edit/delete from History, "Edit" link after saving.
6. **Lift trends** — weekly volume, PR detection + markers (lifts and runs).
   - **6b. Stretching** — Stretch option on Log, habits tables, weekly goals in Settings.
   - **6c. Habits** — Habits option on Log and Progress, daily streaks, screen time, habit management in Settings.
7. **PWA + polish** — manifest, icons (the boulder), offline-friendly shell, JSON export.

## v2 ideas
- Strava/Garmin CSV import
- km/kg toggle
- Offline logging queue that syncs when back online
- Bodyweight tracking
- Logo boulder rises up the hill as stats improve
