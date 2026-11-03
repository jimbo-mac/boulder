-- How an exercise is tracked:
--   'weight' = weight × reps (progress = estimated 1RM)
--   'reps'   = reps only, e.g. pull-ups (progress = reps per set; weight_lb stored as 0)
alter table public.exercises
  add column tracking text not null default 'weight'
  check (tracking in ('weight', 'reps'));

-- Pull-ups were created before this existed; they are tracked by reps.
update public.exercises
set tracking = 'reps'
where lower(name) in ('pull-up', 'pull-ups', 'pullup', 'pullups', 'pull up', 'pull ups');
