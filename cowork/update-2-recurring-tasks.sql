-- ============================================================
-- Update 2: tasks can repeat every week.
-- Run update-1 first if you haven't.
-- Supabase → SQL Editor → New query → paste all → Run (once).
-- ============================================================

alter table cw_tasks add column if not exists repeat_weekly boolean not null default false;

-- Ticks for weekly tasks are kept per week, so last week's tick doesn't carry over
create table if not exists cw_task_done (
  task_id uuid not null references cw_tasks(id) on delete cascade,
  day     date not null,
  primary key (task_id, day)
);
alter table cw_task_done enable row level security;

-- Weekly tasks are returned once for each matching day in the range
create or replace function cowork_week(p_pin text, p_from date, p_to date) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  return json_build_object(
    'members', (select coalesce(json_agg(m order by m.sort, m.name), '[]') from cw_members m),
    'events',  (select coalesce(json_agg(e order by e.day, e.start_time), '[]') from cw_events e where e.day between p_from and p_to),
    'tasks',   (select coalesce(json_agg(x order by x.at_time nulls last, x.created_at), '[]') from (
                  select t.id, t.day, t.title, t.assignee, t.done, t.created_by, t.created_at, t.at_time, t.notes,
                         false as repeat_weekly, t.day as start_day
                  from cw_tasks t
                  where not t.repeat_weekly and t.day between p_from and p_to
                  union all
                  select t.id, d::date, t.title, t.assignee,
                         exists (select 1 from cw_task_done k where k.task_id = t.id and k.day = d::date),
                         t.created_by, t.created_at, t.at_time, t.notes, true, t.day
                  from cw_tasks t
                  cross join generate_series(p_from, p_to, interval '1 day') d
                  where t.repeat_weekly and d::date >= t.day and extract(dow from d) = extract(dow from t.day)
                ) x)
  );
end $$;

drop function if exists cowork_add_task(text, date, text, text, text, time, text);
create or replace function cowork_add_task(p_pin text, p_day date, p_title text, p_assignee text, p_by text,
                                           p_time time default null, p_notes text default null,
                                           p_repeat boolean default false) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  insert into cw_tasks (day, title, assignee, created_by, at_time, notes, repeat_weekly)
  values (p_day, p_title, p_assignee, p_by, p_time, nullif(btrim(p_notes), ''), coalesce(p_repeat, false));
end $$;

drop function if exists cowork_update_task(text, uuid, date, text, text, time, text);
create or replace function cowork_update_task(p_pin text, p_id uuid, p_day date, p_title text, p_assignee text,
                                              p_time time default null, p_notes text default null,
                                              p_repeat boolean default false) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  -- Editing a weekly task from a later week keeps its earlier weeks, unless the weekday changes
  update cw_tasks set
    day = case when repeat_weekly and coalesce(p_repeat, false) and extract(dow from day) = extract(dow from p_day)
               then least(day, p_day) else p_day end,
    title = p_title, assignee = p_assignee, at_time = p_time, notes = nullif(btrim(p_notes), ''),
    repeat_weekly = coalesce(p_repeat, false)
  where id = p_id;
end $$;

-- Tick one week of a weekly task
create or replace function cowork_set_task_day(p_pin text, p_id uuid, p_day date, p_done boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  if p_done then
    insert into cw_task_done (task_id, day) values (p_id, p_day) on conflict do nothing;
  else
    delete from cw_task_done where task_id = p_id and day = p_day;
  end if;
end $$;
