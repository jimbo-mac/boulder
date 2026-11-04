-- Habits tab: user-managed check-off habits with daily streaks, plus screen time
-- (minutes per day). Builds on 20261105000000_habits.sql.

-- How a habit is recorded:
--   'check'   = done or not each day (a habit_checks row means done)
--   'minutes' = an amount each day, e.g. screen time (habit_checks.minutes)
alter table public.habits
  add column tracking text not null default 'check' check (tracking in ('check', 'minutes')),
  -- Archived habits are hidden from Log and Progress; their history is kept.
  add column archived_at timestamptz;

-- Names only need to be unique among habits still in use, so an archived
-- habit's name can be reused.
drop index public.habits_user_kind_name_key;
create unique index habits_user_kind_name_key
  on public.habits (user_id, kind, lower(name))
  where archived_at is null;

-- Minutes for 'minutes' habits (null for check-offs). Under 24 hours.
alter table public.habit_checks
  add column minutes integer check (minutes between 0 and 1439);

-- Screen time, for every existing account (there is one).
insert into public.habits (user_id, kind, name, tracking, sort_order)
select u.id, 'habit', 'Screen time', 'minutes', 1000
from auth.users u;
