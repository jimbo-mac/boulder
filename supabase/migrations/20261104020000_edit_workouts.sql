-- Edit a saved workout atomically. Deleting needs no function: delete the
-- workouts row and its run/sets go with it (on delete cascade).
-- security invoker: runs as the caller, so RLS decides which workouts they can touch.

-- Replace a lift workout's date and all of its sets.
-- p_sets has the same shape as log_lift's.
create function public.update_lift(p_workout_id uuid, p_date date, p_sets jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_sets) is distinct from 'array' or jsonb_array_length(p_sets) = 0 then
    raise exception 'A lift workout needs at least one set' using errcode = '22023';
  end if;

  update public.workouts
  set date = p_date
  where id = p_workout_id and type = 'lift';
  if not found then
    raise exception 'Lift workout not found' using errcode = 'P0002';
  end if;

  delete from public.sets where workout_id = p_workout_id;

  insert into public.sets (workout_id, exercise_id, set_order, weight_lb, reps, is_warmup)
  select
    p_workout_id,
    (s.value ->> 'exercise_id')::uuid,
    (s.ordinality - 1)::integer,
    (s.value ->> 'weight_lb')::numeric,
    (s.value ->> 'reps')::integer,
    coalesce((s.value ->> 'is_warmup')::boolean, false)
  from jsonb_array_elements(p_sets) with ordinality as s(value, ordinality);
end;
$$;

revoke execute on function public.update_lift(uuid, date, jsonb) from public, anon;
grant execute on function public.update_lift(uuid, date, jsonb) to authenticated;

-- Replace a run's date, distance, time, and type.
create function public.update_run(
  p_workout_id uuid,
  p_date date,
  p_distance_mi numeric,
  p_duration_s integer,
  p_run_kind text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.workouts
  set date = p_date
  where id = p_workout_id and type = 'run';
  if not found then
    raise exception 'Run not found' using errcode = 'P0002';
  end if;

  update public.runs
  set distance_mi = p_distance_mi, duration_s = p_duration_s, run_kind = p_run_kind
  where workout_id = p_workout_id;
end;
$$;

revoke execute on function public.update_run(uuid, date, numeric, integer, text) from public, anon;
grant execute on function public.update_run(uuid, date, numeric, integer, text) to authenticated;
