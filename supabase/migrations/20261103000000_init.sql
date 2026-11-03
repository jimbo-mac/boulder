-- Boulder initial schema. See SPEC.md "Data model".
-- Canonical units: miles, seconds, pounds.

-- workouts -----------------------------------------------------------------
create table public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,          -- the local day it happened, not created_at
  type        text not null check (type in ('run', 'lift')),
  notes       text,
  created_at  timestamptz not null default now()
);
create index workouts_user_date_idx on public.workouts (user_id, date desc);

-- runs (one per run workout) -------------------------------------------------
create table public.runs (
  workout_id   uuid primary key references public.workouts (id) on delete cascade,
  distance_mi  numeric(5, 2) not null check (distance_mi > 0),
  duration_s   integer not null check (duration_s > 0),
  run_kind     text check (run_kind in ('easy', 'long', 'tempo', 'intervals', 'race')),
  avg_hr       integer check (avg_hr > 0),
  rpe          integer check (rpe between 1 and 10)
);

-- exercises (user's lift catalog) --------------------------------------------
create table public.exercises (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name      text not null check (length(btrim(name)) > 0),
  category  text not null check (category in ('squat', 'hinge', 'push', 'pull', 'other'))
);
-- Unique per user, ignoring case ("back squat" = "Back Squat").
create unique index exercises_user_name_key on public.exercises (user_id, lower(name));

-- sets (many per lift workout) -----------------------------------------------
create table public.sets (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete restrict,
  set_order    integer not null check (set_order >= 0),
  weight_lb    numeric(6, 2) not null check (weight_lb >= 0),
  reps         integer not null check (reps > 0),
  is_warmup    boolean not null default false
);
create index sets_workout_idx on public.sets (workout_id, set_order);
create index sets_exercise_idx on public.sets (exercise_id);

-- settings (single row per user, created on first save) ----------------------
create table public.settings (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  goal_race_name    text,
  goal_race_date    date,
  goal_distance_mi  numeric(5, 2) check (goal_distance_mi > 0),
  goal_time_s       integer check (goal_time_s > 0)
);

-- Row-level security ---------------------------------------------------------
-- Only signed-in users, and only their own rows. Child tables check ownership
-- through their parent workout. (select auth.uid()) is evaluated once per query.

alter table public.workouts  enable row level security;
alter table public.runs      enable row level security;
alter table public.exercises enable row level security;
alter table public.sets      enable row level security;
alter table public.settings  enable row level security;

revoke all on public.workouts, public.runs, public.exercises, public.sets, public.settings from anon;

create policy "own workouts" on public.workouts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own exercises" on public.exercises
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own settings" on public.settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "runs of own workouts" on public.runs
  for all to authenticated
  using (exists (
    select 1 from public.workouts w
    where w.id = runs.workout_id and w.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workouts w
    where w.id = runs.workout_id and w.user_id = (select auth.uid())
  ));

-- A set must belong to your workout AND reference your exercise.
create policy "sets of own workouts" on public.sets
  for all to authenticated
  using (exists (
    select 1 from public.workouts w
    where w.id = sets.workout_id and w.user_id = (select auth.uid())
  ))
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = sets.workout_id and w.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.exercises e
      where e.id = sets.exercise_id and e.user_id = (select auth.uid())
    )
  );
