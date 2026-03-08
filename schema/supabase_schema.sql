-- ============================================================
-- HubClone CRM – Full Schema with Auth + Workspaces
-- Run this ENTIRE file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Drop existing tables cleanly (re-runnable)
drop table if exists activities cascade;
drop table if exists deals cascade;
drop table if exists contacts cascade;
drop table if exists workspace_members cascade;
drop table if exists workspaces cascade;

create extension if not exists "pgcrypto";

-- ─── WORKSPACES ───────────────────────────────────────────────
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  created_at  timestamptz default now()
);

-- ─── WORKSPACE MEMBERS ────────────────────────────────────────
create table workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  role          text default 'member' check (role in ('owner','admin','member')),
  full_name     text,
  created_at    timestamptz default now(),
  unique(workspace_id, user_id)
);

-- ─── CONTACTS ─────────────────────────────────────────────────
create table contacts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  name          text not null,
  company       text,
  email         text,
  phone         text,
  status        text default 'Lead' check (status in ('Lead','Prospect','Customer','Churned')),
  stage         text default 'Discovery',
  value         numeric default 0,
  notes         text,
  avatar        text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── DEALS ────────────────────────────────────────────────────
create table deals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  name          text not null,
  contact_id    uuid references contacts(id) on delete set null,
  value         numeric default 0,
  stage         text default 'Discovery',
  probability   int default 20 check (probability between 0 and 100),
  close_date    date,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── ACTIVITIES ───────────────────────────────────────────────
create table activities (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  type          text default 'note' check (type in ('call','email','meeting','note')),
  text          text not null,
  contact_id    uuid references contacts(id) on delete cascade,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now()
);

-- ─── AUTO-UPDATE updated_at ────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger contacts_updated_at before update on contacts for each row execute procedure update_updated_at();
create trigger deals_updated_at before update on deals for each row execute procedure update_updated_at();

-- ─── ROW LEVEL SECURITY ────────────────────────────────────────
alter table workspaces         enable row level security;
alter table workspace_members  enable row level security;
alter table contacts           enable row level security;
alter table deals              enable row level security;
alter table activities         enable row level security;

-- Helper: is the current user a member of a given workspace?
create or replace function is_workspace_member(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$ language sql security definer;

-- Workspaces policies
create policy "workspace select" on workspaces for select using (is_workspace_member(id));
create policy "workspace insert" on workspaces for insert with check (true);
create policy "workspace update" on workspaces for update using (is_workspace_member(id));

-- Workspace members policies
create policy "members select" on workspace_members for select using (is_workspace_member(workspace_id));
create policy "members insert" on workspace_members for insert with check (true);
create policy "members update" on workspace_members for update using (user_id = auth.uid());
create policy "members delete" on workspace_members for delete using (user_id = auth.uid());

-- Contacts policies
create policy "contacts select" on contacts for select using (is_workspace_member(workspace_id));
create policy "contacts insert" on contacts for insert with check (is_workspace_member(workspace_id));
create policy "contacts update" on contacts for update using (is_workspace_member(workspace_id));
create policy "contacts delete" on contacts for delete using (is_workspace_member(workspace_id));

-- Deals policies
create policy "deals select" on deals for select using (is_workspace_member(workspace_id));
create policy "deals insert" on deals for insert with check (is_workspace_member(workspace_id));
create policy "deals update" on deals for update using (is_workspace_member(workspace_id));
create policy "deals delete" on deals for delete using (is_workspace_member(workspace_id));

-- Activities policies
create policy "activities select" on activities for select using (is_workspace_member(workspace_id));
create policy "activities insert" on activities for insert with check (is_workspace_member(workspace_id));
create policy "activities update" on activities for update using (is_workspace_member(workspace_id));
create policy "activities delete" on activities for delete using (is_workspace_member(workspace_id));
