-- ============================================================
-- Update 3: repeating tasks pick which days, how often, and until when.
-- Includes update 2, so it's fine whether or not you ran that one.
-- Run update-1 first if you haven't.
-- Supabase → SQL Editor → New query → paste all → Run (once).
-- ============================================================

alter table cw_tasks add column if not exists repeat_weekly boolean not null default false;
alter table cw_tasks add column if not exists repeat_days smallint[];      -- 1 = Mon … 7 = Sun
alter table cw_tasks add column if not exists repeat_every smallint not null default 1;  -- every N weeks
alter table cw_tasks add column if not exists repeat_until date;

create table if not exists cw_task_done (
  task_id uuid not null references cw_tasks(id) on delete cascade,
  day     date not null,
  primary key (task_id, day)
);
alter table cw_task_done enable row level security;

-- Repeating tasks come back once per matching day in the range
create or replace function cowork_week(p_pin text, p_from date, p_to date) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  return json_build_object(
    'members', (select coalesce(json_agg(m order by m.sort, m.name), '[]') from cw_members m),
    'events',  (select coalesce(json_agg(e order by e.day, e.start_time), '[]') from cw_events e where e.day between p_from and p_to),
    'tasks',   (select coalesce(json_agg(x order by x.at_time nulls last, x.created_at), '[]') from (
                  select t.id, t.day, t.title, t.assignee, t.done, t.created_by, t.created_at, t.at_time, t.notes,
                         false as repeat_weekly, t.day as start_day, null::smallint[] as repeat_days, 1::smallint as repeat_every, null::date as repeat_until
                  from cw_tasks t
                  where not t.repeat_weekly and t.day between p_from and p_to
                  union all
                  select t.id, d::date, t.title, t.assignee,
                         exists (select 1 from cw_task_done k where k.task_id = t.id and k.day = d::date),
                         t.created_by, t.created_at, t.at_time, t.notes, true, t.day,
                         coalesce(t.repeat_days, array[extract(isodow from t.day)::smallint]), t.repeat_every, t.repeat_until
                  from cw_tasks t
                  cross join generate_series(p_from, p_to, interval '1 day') d
                  where t.repeat_weekly
                    and d::date >= t.day
                    and (t.repeat_until is null or d::date <= t.repeat_until)
                    and extract(isodow from d)::smallint = any (coalesce(t.repeat_days, array[extract(isodow from t.day)::smallint]))
                    and ((date_trunc('week', d)::date - date_trunc('week', t.day)::date) / 7) % greatest(t.repeat_every, 1) = 0
                ) x)
  );
end $$;

drop function if exists cowork_add_task(text, date, text, text, text, time, text);
drop function if exists cowork_add_task(text, date, text, text, text, time, text, boolean);
create or replace function cowork_add_task(p_pin text, p_day date, p_title text, p_assignee text, p_by text,
                                           p_time time default null, p_notes text default null,
                                           p_repeat boolean default false, p_days smallint[] default null,
                                           p_every smallint default 1, p_until date default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  insert into cw_tasks (day, title, assignee, created_by, at_time, notes, repeat_weekly, repeat_days, repeat_every, repeat_until)
  values (p_day, p_title, p_assignee, p_by, p_time, nullif(btrim(p_notes), ''), coalesce(p_repeat, false),
          case when p_repeat then p_days end, least(greatest(coalesce(p_every, 1), 1), 8), case when p_repeat then p_until end);
end $$;

drop function if exists cowork_update_task(text, uuid, date, text, text, time, text);
drop function if exists cowork_update_task(text, uuid, date, text, text, time, text, boolean);
create or replace function cowork_update_task(p_pin text, p_id uuid, p_day date, p_title text, p_assignee text,
                                              p_time time default null, p_notes text default null,
                                              p_repeat boolean default false, p_days smallint[] default null,
                                              p_every smallint default 1, p_until date default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  update cw_tasks set day = p_day, title = p_title, assignee = p_assignee, at_time = p_time,
    notes = nullif(btrim(p_notes), ''), repeat_weekly = coalesce(p_repeat, false),
    repeat_days = case when p_repeat then p_days end,
    repeat_every = least(greatest(coalesce(p_every, 1), 1), 8),
    repeat_until = case when p_repeat then p_until end
  where id = p_id;
end $$;

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
