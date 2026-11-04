-- Habits logged with ✓ / ✗: a miss is recorded explicitly, not just left blank.

-- 'yesno' = like 'check', but each day is marked done (✓) or missed (✗).
alter table public.habits drop constraint habits_tracking_check;
alter table public.habits
  add constraint habits_tracking_check check (tracking in ('check', 'yesno', 'minutes'));

-- false = marked missed (✗). Every existing row is a done day.
alter table public.habit_checks
  add column done boolean not null default true;
