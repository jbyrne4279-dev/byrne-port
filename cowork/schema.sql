-- ============================================================
-- Co-working calendar (Supabase). SQL Editor → paste all → Run.
-- No accounts: everyone uses the shared passcode. The tables are
-- locked to the public; the page can only use the functions below,
-- and every one of them checks the passcode first.
-- To change the passcode later:  select cowork_set_pin('NEW');
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists cw_secret (id int primary key default 1 check (id = 1), pin_hash text not null);
create table if not exists cw_members (name text primary key, color text not null, sort int not null default 0);
create table if not exists cw_events (
  id uuid primary key default gen_random_uuid(),
  day date not null, start_time time not null, end_time time not null check (end_time > start_time),
  title text not null check (char_length(title) between 1 and 80),
  who text references cw_members(name) on delete set null,          -- null = everyone
  created_by text, created_at timestamptz not null default now()
);
create table if not exists cw_tasks (
  id uuid primary key default gen_random_uuid(),
  day date not null, title text not null check (char_length(title) between 1 and 140),
  assignee text not null references cw_members(name) on delete cascade,
  done boolean not null default false,
  created_by text, created_at timestamptz not null default now()
);

-- Lock the tables: with RLS on and no policies, the public key can't read or write them directly
alter table cw_secret  enable row level security;
alter table cw_members enable row level security;
alter table cw_events  enable row level security;
alter table cw_tasks   enable row level security;

create or replace function cowork_set_pin(p_pin text) returns void language sql security definer set search_path = public, extensions as $$
  insert into cw_secret (id, pin_hash) values (1, crypt(p_pin, gen_salt('bf')))
  on conflict (id) do update set pin_hash = excluded.pin_hash;
$$;
revoke all on function cowork_set_pin(text) from public, anon, authenticated;

create or replace function cw_ok(p_pin text) returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare ok boolean;
begin
  select pin_hash = crypt(p_pin, pin_hash) into ok from cw_secret where id = 1;
  if not coalesce(ok, false) then perform pg_sleep(0.5); end if;   -- slows down guessing
  return coalesce(ok, false);
end $$;

create or replace function cowork_week(p_pin text, p_from date, p_to date) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  return json_build_object(
    'members', (select coalesce(json_agg(m order by m.sort, m.name), '[]') from cw_members m),
    'events',  (select coalesce(json_agg(e order by e.day, e.start_time), '[]') from cw_events e where e.day between p_from and p_to),
    'tasks',   (select coalesce(json_agg(t order by t.created_at), '[]') from cw_tasks t where t.day between p_from and p_to)
  );
end $$;

create or replace function cowork_save_event(p_pin text, p_id uuid, p_day date, p_start time, p_end time, p_title text, p_who text, p_by text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  if p_id is null then
    insert into cw_events (day, start_time, end_time, title, who, created_by) values (p_day, p_start, p_end, p_title, nullif(p_who, ''), p_by);
  else
    update cw_events set day = p_day, start_time = p_start, end_time = p_end, title = p_title, who = nullif(p_who, '') where id = p_id;
  end if;
end $$;

create or replace function cowork_delete_event(p_pin text, p_id uuid) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  delete from cw_events where id = p_id;
end $$;

create or replace function cowork_add_task(p_pin text, p_day date, p_title text, p_assignee text, p_by text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  insert into cw_tasks (day, title, assignee, created_by) values (p_day, p_title, p_assignee, p_by);
end $$;

create or replace function cowork_set_task(p_pin text, p_id uuid, p_done boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  update cw_tasks set done = p_done where id = p_id;
end $$;

create or replace function cowork_delete_task(p_pin text, p_id uuid) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not cw_ok(p_pin) then raise exception 'wrong passcode' using errcode = '28000'; end if;
  delete from cw_tasks where id = p_id;
end $$;

-- ── People on the calendar ──
insert into cw_members (name, color, sort) values
  ('Joe',  '#ff375f', 1),
  ('Ilya', '#0a84ff', 2),
  ('Owen', '#30d158', 3)
on conflict (name) do update set color = excluded.color, sort = excluded.sort;

-- ── The shared passcode: replace YOUR-PASSCODE with the 4 digits before running ──
-- (It's stored scrambled, never in plain text, and it isn't in this public file.)
select cowork_set_pin('YOUR-PASSCODE');
