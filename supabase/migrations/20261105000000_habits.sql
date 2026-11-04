-- Habits: yes/no things done on a day, with a weekly goal. The Stretch tab shows
-- the 'stretch' habits (Posture, General); a future Habits tab will show 'habit'.

create table public.habits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('stretch', 'habit')),  -- which tab it lives on
  name         text not null check (length(btrim(name)) > 0),
  weekly_goal  integer not null default 3 check (weekly_goal between 1 and 7),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create unique index habits_user_kind_name_key on public.habits (user_id, kind, lower(name));

-- A row means the habit was done that (local) day; unchecking deletes it.
-- The primary key makes a double-tap harmless.
create table public.habit_checks (
  habit_id  uuid not null references public.habits (id) on delete cascade,
  date      date not null,
  primary key (habit_id, date)
);
create index habit_checks_date_idx on public.habit_checks (date);

alter table public.habits       enable row level security;
alter table public.habit_checks enable row level security;
revoke all on public.habits, public.habit_checks from anon;

create policy "own habits" on public.habits
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "checks of own habits" on public.habit_checks
  for all to authenticated
  using (exists (
    select 1 from public.habits h
    where h.id = habit_checks.habit_id and h.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.habits h
    where h.id = habit_checks.habit_id and h.user_id = (select auth.uid())
  ));

-- The two stretching routines, for every existing account (there is one).
insert into public.habits (user_id, kind, name, weekly_goal, sort_order)
select u.id, r.name_kind, r.name, 3, r.sort_order
from auth.users u
cross join (values ('stretch', 'Posture', 0), ('stretch', 'General', 1)) as r(name_kind, name, sort_order);
