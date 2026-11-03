-- Save a lift workout (workout row + all its sets) atomically in one round trip.
-- p_sets: JSON array, in order, of
--   { "exercise_id": uuid, "weight_lb": number, "reps": integer, "is_warmup": boolean }
-- security invoker: runs as the caller, so RLS applies (including the check that
-- every exercise belongs to the caller).
create function public.log_lift(p_date date, p_sets jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workout_id uuid;
begin
  if jsonb_typeof(p_sets) is distinct from 'array' or jsonb_array_length(p_sets) = 0 then
    raise exception 'A lift workout needs at least one set' using errcode = '22023';
  end if;

  insert into public.workouts (date, type)
  values (p_date, 'lift')
  returning id into v_workout_id;

  insert into public.sets (workout_id, exercise_id, set_order, weight_lb, reps, is_warmup)
  select
    v_workout_id,
    (s.value ->> 'exercise_id')::uuid,
    (s.ordinality - 1)::integer,
    (s.value ->> 'weight_lb')::numeric,
    (s.value ->> 'reps')::integer,
    coalesce((s.value ->> 'is_warmup')::boolean, false)
  from jsonb_array_elements(p_sets) with ordinality as s(value, ordinality);

  return v_workout_id;
end;
$$;

revoke execute on function public.log_lift(date, jsonb) from public, anon;
grant execute on function public.log_lift(date, jsonb) to authenticated;
