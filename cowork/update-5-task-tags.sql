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
