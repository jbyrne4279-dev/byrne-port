-- ============================================================
-- Update 5: a tag on each task (Meeting, Important, Deadline).
-- (Already applied to the live project via the Supabase connector.)
-- cowork_week also returns t.tag; add/update take p_tag.
-- ============================================================
alter table cw_tasks add column if not exists tag text;
alter table cw_tasks add constraint cw_tasks_tag_len check (tag is null or char_length(tag) <= 30);
-- Function bodies: see the live definitions of cowork_week, cowork_add_task(…, p_tag) and cowork_update_task(…, p_tag).
