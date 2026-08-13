-- 1. Profiles: activation flag used by the admin console and the login guard
alter table public.profiles
  add column if not exists is_active boolean not null default true;


-- 2. Timer logs: close duplicate running sessions
with ranked as (
  select
    id,
    row_number() over (partition by user_id order by start_time desc) as rn
  from public.timer_logs
  where status = 'RUNNING'
)
update public.timer_logs as t
set
  end_time = least(
    date_trunc('day', t.start_time) + interval '1 day' - interval '1 millisecond',
    now()
  ),
  status = 'PAUSED',
  reason = coalesce(t.reason, 'Duplicate session closed')
from ranked as r
where t.id = r.id
  and r.rn > 1;


-- 3. Enforce a single running session per patient
create unique index if not exists timer_logs_one_running_per_user
  on public.timer_logs (user_id)
  where status = 'RUNNING';


-- 4. Reject inverted ranges from manual entry
alter table public.timer_logs
  drop constraint if exists timer_logs_end_after_start;

alter table public.timer_logs
  add constraint timer_logs_end_after_start
  check (end_time is null or end_time > start_time)
  not valid;


-- 5. Indexes for the range queries the dashboards run
create index if not exists timer_logs_user_start_idx
  on public.timer_logs (user_id, start_time desc);

create index if not exists assignments_dentist_idx
  on public.assignments (dentist_id);

create index if not exists assignments_patient_idx
  on public.assignments (patient_id);


-- 6. Row level security
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = auth.uid()
      and (p.role = 'admin' or p.email ilike '%admin%')
  );
$$;

-- Assignments: administrators manage them, dentists and patients read their own.
drop policy if exists "Admins can manage assignments" on public.assignments;
drop policy if exists "Admins manage assignments" on public.assignments;
drop policy if exists "Dentists read own assignments" on public.assignments;
drop policy if exists "Patients read own assignments" on public.assignments;

create policy "Admins manage assignments"
  on public.assignments
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Dentists read own assignments"
  on public.assignments
  for select
  using (dentist_id = auth.uid());

create policy "Patients read own assignments"
  on public.assignments
  for select
  using (patient_id = auth.uid());

-- Profiles: dentists read the patients linked to them, admins read and edit all.
drop policy if exists "Dentists read assigned patient profiles" on public.profiles;
drop policy if exists "Admins read all profiles" on public.profiles;
drop policy if exists "Admins update profiles" on public.profiles;

create policy "Dentists read assigned patient profiles"
  on public.profiles
  for select
  using (
    exists (
      select 1
      from public.assignments as a
      where a.dentist_id = auth.uid()
        and a.patient_id = profiles.id
    )
  );

create policy "Admins read all profiles"
  on public.profiles
  for select
  using (public.is_admin());

create policy "Admins update profiles"
  on public.profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());
