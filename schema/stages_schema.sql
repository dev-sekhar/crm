-- ============================================================
-- HubClone – Deal Stages + Activity Enhancements
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── DEAL STAGES TABLE ───────────────────────────────────────
create table if not exists deal_stages (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  name          text not null,
  description   text,
  color         text default '#888888',
  position      integer not null default 0,   -- display order
  is_won        boolean default false,         -- marks "Closed Won"
  is_lost       boolean default false,         -- marks "Closed Lost"
  is_default    boolean default false,         -- auto-assigned to new deals
  created_at    timestamptz default now(),
  unique(workspace_id, name)
);

-- ─── LINK DEALS TO STAGES ────────────────────────────────────
alter table deals
  add column if not exists stage_id uuid references deal_stages(id) on delete set null;

-- ─── ACTIVITY ENHANCEMENTS ───────────────────────────────────
alter table activities
  add column if not exists activity_at   timestamptz default now(),  -- when it happened
  add column if not exists duration_mins integer,                      -- meeting/call duration
  add column if not exists notes         text,                         -- detailed notes / minutes
  add column if not exists follow_up_action text,                      -- what needs to happen next
  add column if not exists follow_up_date   timestamptz,               -- when follow-up is due
  add column if not exists follow_up_done   boolean default false;     -- completed?

-- ─── SEED DEFAULT STAGES FUNCTION ────────────────────────────
create or replace function seed_default_stages(ws_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into deal_stages (workspace_id, name, description, color, position, is_won, is_lost, is_default)
  values
    (ws_id, 'Lead',        'Initial interest, not yet qualified',          '#888888', 0, false, false, true),
    (ws_id, 'Contacted',   'First contact made, exploring fit',            '#3949ab', 1, false, false, false),
    (ws_id, 'Proposal',    'Proposal or quote sent to prospect',           '#f57f17', 2, false, false, false),
    (ws_id, 'Negotiation', 'Terms being discussed, close is near',         '#ff7a59', 3, false, false, false),
    (ws_id, 'Won',         'Deal closed successfully',                     '#2e7d32', 4, true,  false, false),
    (ws_id, 'Lost',        'Deal lost or prospect went with a competitor', '#c62828', 5, false, true,  false)
  on conflict (workspace_id, name) do nothing;
end;
$$;

grant execute on function seed_default_stages(uuid) to authenticated;

-- ─── UPDATE create_workspace_with_owner to seed stages ───────
create or replace function create_workspace_with_owner(
  ws_name text,
  ws_slug text,
  owner_id uuid,
  owner_name text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace workspaces;
  owner_role_id uuid;
begin
  insert into workspaces (name, slug)
  values (ws_name, ws_slug)
  returning * into new_workspace;

  perform seed_default_roles(new_workspace.id);
  perform seed_default_stages(new_workspace.id);

  select id into owner_role_id
  from roles
  where workspace_id = new_workspace.id and name = 'Owner';

  insert into workspace_members (workspace_id, user_id, role, role_id, full_name)
  values (new_workspace.id, owner_id, 'owner', owner_role_id, owner_name);

  return row_to_json(new_workspace);
end;
$$;

grant execute on function create_workspace_with_owner(text, text, uuid, text) to authenticated;

-- ─── RLS for deal_stages ─────────────────────────────────────
alter table deal_stages enable row level security;

create policy "stages view"
  on deal_stages for select to authenticated
  using (is_workspace_member(workspace_id));

create policy "stages manage"
  on deal_stages for all to authenticated
  using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

-- ─── Seed stages for existing workspaces ─────────────────────
-- Run this to add stages to workspaces created before this migration
-- select seed_default_stages(id) from workspaces;
