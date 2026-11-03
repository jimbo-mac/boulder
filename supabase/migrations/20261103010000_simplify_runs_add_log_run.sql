-- Simplify runs to what the app logs: distance, duration, and a required type.
-- Safe to run: no runs existed when this was written.

alter table public.runs drop column avg_hr;
alter table public.runs drop column rpe;

alter table public.runs drop constraint runs_run_kind_check;
alter table public.runs
  alter column run_kind set not null,
  add constraint runs_run_kind_check check (run_kind in ('base', 'long', 'recovery', 'speed'));

-- Save a run (workout row + run row) atomically in one round trip.
-- security invoker: runs as the caller, so RLS and the auth.uid() defaults apply.
create function public.log_run(
  p_date date,
  p_distance_mi numeric,
  p_duration_s integer,
  p_run_kind text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workout_id uuid;
begin
  insert into public.workouts (date, type)
  values (p_date, 'run')
  returning id into v_workout_id;

  insert into public.runs (workout_id, distance_mi, duration_s, run_kind)
  values (v_workout_id, p_distance_mi, p_duration_s, p_run_kind);

  return v_workout_id;
end;
$$;

revoke execute on function public.log_run(date, numeric, integer, text) from public, anon;
grant execute on function public.log_run(date, numeric, integer, text) to authenticated;
