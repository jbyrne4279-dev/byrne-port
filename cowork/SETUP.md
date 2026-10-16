# Co-working calendar: setup (about 10 minutes, once)

The page at `josephbyrne.org/cowork` stores everyone's sessions and tasks in a free
Supabase project. Only you do this setup; Ilya and Owen just open the link and type the passcode.

## 1. Create the project
1. Go to https://supabase.com and sign up (free).
2. Click **New project**. Name it `cowork`, set any database password (save it somewhere),
   pick the **London** region, and click **Create new project**. Wait a minute while it sets up.

## 2. Create the tables
1. In the left sidebar open **SQL Editor** → **New query**.
2. Open `cowork/schema.sql` from this repo, copy **all** of it and paste it in.
3. On the last line, replace `YOUR-PASSCODE` with your 4-digit passcode (the same one as /schedule).
4. Click **Run**. It should say "Success".

## 3. Connect the page
1. In the sidebar open **Project Settings** → **API**.
2. Copy the **Project URL** and the **anon public** key.
3. Send both to Claude (or paste them into `cowork.html`):
   ```html
   <meta name="supabase-url" content="https://xxxx.supabase.co">
   <meta name="supabase-anon-key" content="eyJ...">
   ```
   The anon key is meant to be public: the tables are locked, and every action checks the passcode.

## Day-to-day
- Share **josephbyrne.org/cowork** with Ilya and Owen. They type the passcode, tap their name once, and they're in.
- **Lock** (top right) forgets the passcode and name on that phone.
- Change the passcode: SQL Editor → `select cowork_set_pin('1234');`
  (your personal timetable on /schedule uses the same code, so ask Claude to re-lock that too).
- Add or rename people: SQL Editor →
  `insert into cw_members (name, color, sort) values ('Sam', '#ff9f0a', 4);`
