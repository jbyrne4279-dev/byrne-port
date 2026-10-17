-- ============================================================
-- Update 4: every task carries on each week until someone edits or deletes it.
-- (Already applied to the live project via the Supabase connector.)
-- ============================================================

create or replace function cowork_add_task(p_pin text, p_day date, p_title text, p_assignee text, p_by text,
                                           p_time time default null, p_notes text default null,
                                           p_repeat boolean default true, p_days smallint[] default null,
                                           p_every smallint default 1, p_until date default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  insert into cw_tasks (day, title, assignee, created_by, at_time, notes, repeat_weekly, repeat_days, repeat_every, repeat_until)
  values (p_day, p_title, p_assignee, p_by, p_time, nullif(btrim(p_notes), ''), true,
          coalesce(nullif(p_days, '{}'), array[extract(isodow from p_day)::smallint]),
          least(greatest(coalesce(p_every, 1), 1), 8), null);
end $$;

create or replace function cowork_update_task(p_pin text, p_id uuid, p_day date, p_title text, p_assignee text,
                                              p_time time default null, p_notes text default null,
                                              p_repeat boolean default true, p_days smallint[] default null,
                                              p_every smallint default 1, p_until date default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  update cw_tasks set day = p_day, title = p_title, assignee = p_assignee, at_time = p_time,
    notes = nullif(btrim(p_notes), ''), repeat_weekly = true,
    repeat_days = coalesce(nullif(p_days, '{}'), array[extract(isodow from p_day)::smallint]),
    repeat_every = least(greatest(coalesce(p_every, 1), 1), 8),
    repeat_until = null
  where id = p_id;
end $$;
