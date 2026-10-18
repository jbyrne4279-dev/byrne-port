-- ============================================================
-- Update 5: a tag on each task (Meeting, Important, Deadline).
-- (Already applied to the live project via the Supabase connector.)
-- cowork_week also returns t.tag; add/update take p_tag.
-- ============================================================
alter table cw_tasks add column if not exists tag text;
alter table cw_tasks add constraint cw_tasks_tag_len check (tag is null or char_length(tag) <= 30);
-- Function bodies: see the live definitions of cowork_week, cowork_add_task(…, p_tag) and cowork_update_task(…, p_tag).

-- Update 6: tasks have a finish time (also applied live). add/update take p_end; cowork_week returns t.end_time.
alter table cw_tasks add column if not exists end_time time;

-- Update 7 (applied live): old sessions copied into tasks; tasks may be for Everyone (assignee null).
-- cw_events is kept as a backup but no longer shown.
alter table cw_tasks alter column assignee drop not null;
-- insert into cw_tasks (day, title, assignee, done, created_by, created_at, at_time, end_time, repeat_weekly)
-- select day, left(title, 140), who, false, created_by, created_at, start_time,
--        case when end_time > start_time then end_time end, false from cw_events;

-- Update 8 (applied live): tasks may carry their own colour; cowork_week returns t.color.
-- Joe's timetable was copied into cw_tasks as weekly tasks (rows not stored in this public repo).
alter table cw_tasks add column if not exists color text;

-- Update 9 (applied live): cowork_add_task / cowork_update_task take p_color (a #rrggbb colour, or null for automatic).

-- Update 10 (applied live): meeting replies. Table cw_rsvp(task_id, day, member, status yes|no),
-- function cowork_rsvp(p_pin, p_id, p_day, p_who, p_status), and cowork_week also returns 'rsvps'.

-- Update 11 (applied live):
-- * Old copies of cowork_add_task / cowork_update_task renamed to zz_old_* so only the newest
--   version answers (several versions made saves fail with "300 ambiguous").
-- * Remaining one-off tasks (the converted sessions) set to repeat weekly on their original weekday.
update cw_tasks set repeat_weekly = true, repeat_days = array[extract(isodow from day)::smallint], repeat_every = 1, repeat_until = null
where not repeat_weekly;

-- Update 12 (applied live): cowork_alarms(p_pin, p_who, p_day default today in UK time) returns
-- [{time:'HH:MM', label:'End: X · Start: Y'}] for an Apple Shortcut to create Clock alarms.

-- Update 13 (applied live): delete one date of a repeating task.
-- Table cw_task_skip(task_id, day); function cowork_skip_task(p_pin, p_id, p_day);
-- cowork_week and cowork_alarms leave skipped dates out.
