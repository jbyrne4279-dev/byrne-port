-- ============================================================
-- Update 1: a planned time and notes on each task.
-- Supabase → SQL Editor → New query → paste all → Run (once).
-- ============================================================

alter table cw_tasks add column if not exists at_time time;
alter table cw_tasks add column if not exists notes text;
alter table cw_tasks drop constraint if exists cw_tasks_notes_len;
alter table cw_tasks add constraint cw_tasks_notes_len check (notes is null or char_length(notes) <= 500);

-- Tasks come back ordered by their planned time
create or replace function cowork_week(p_pin text, p_from date, p_to date) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  return json_build_object(
    'members', (select coalesce(json_agg(m order by m.sort, m.name), '[]') from cw_members m),
    'events',  (select coalesce(json_agg(e order by e.day, e.start_time), '[]') from cw_events e where e.day between p_from and p_to),
    'tasks',   (select coalesce(json_agg(t order by t.at_time nulls last, t.created_at), '[]') from cw_tasks t where t.day between p_from and p_to)
  );
end $$;

drop function if exists cowork_add_task(text, date, text, text, text);
create or replace function cowork_add_task(p_pin text, p_day date, p_title text, p_assignee text, p_by text,
                                           p_time time default null, p_notes text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  insert into cw_tasks (day, title, assignee, created_by, at_time, notes)
  values (p_day, p_title, p_assignee, p_by, p_time, nullif(btrim(p_notes), ''));
end $$;

create or replace function cowork_update_task(p_pin text, p_id uuid, p_day date, p_title text, p_assignee text,
                                              p_time time default null, p_notes text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  update cw_tasks set day = p_day, title = p_title, assignee = p_assignee, at_time = p_time, notes = nullif(btrim(p_notes), '')
  where id = p_id;
end $$;
