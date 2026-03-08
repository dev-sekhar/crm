-- ============================================================
-- HubClone RBAC – Roles & Permissions System
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── ROLES TABLE ─────────────────────────────────────────────
-- Stores both default and custom roles per workspace
create table if not exists roles (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  name          text not null,
  description   text,
  is_default    boolean default false,  -- true = built-in, can't be deleted
  created_at    timestamptz default now(),
  unique(workspace_id, name)
);

-- ─── PERMISSIONS TABLE ────────────────────────────────────────
-- Each row = one permission granted to a role
-- resource: contacts | deals | activities | team | reports
-- action:   view | create | edit_own | edit_any | delete_own | delete_any
create table if not exists role_permissions (
  id          uuid primary key default gen_random_uuid(),
  role_id     uuid references roles(id) on delete cascade,
  resource    text not null,
  action      text not null,
  unique(role_id, resource, action)
);

-- ─── LINK MEMBERS TO ROLES ────────────────────────────────────
-- Add role_id to workspace_members (keep old role column for fallback)
alter table workspace_members
  add column if not exists role_id uuid references roles(id) on delete set null;

-- ─── SEED DEFAULT ROLES FUNCTION ─────────────────────────────
-- Called when a workspace is created to seed the 5 default roles
create or replace function seed_default_roles(ws_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_role_id       uuid;
  admin_role_id       uuid;
  sales_rep_role_id   uuid;
  support_role_id     uuid;
  viewer_role_id      uuid;
begin
  -- Insert default roles (no RETURNING — fetch IDs separately below)
  insert into roles (workspace_id, name, description, is_default) values
    (ws_id, 'Owner',         'Full control over workspace, billing and team',     true),
    (ws_id, 'Admin',         'Manage team members, roles and all CRM data',       true),
    (ws_id, 'Sales Rep',     'Manage own pipeline, view team contacts and deals', true),
    (ws_id, 'Support Agent', 'View contacts, log activities, no deal access',     true),
    (ws_id, 'Viewer',        'Read-only access to all CRM data',                  true);

  -- Fetch role IDs
  select id into owner_role_id   from roles where workspace_id = ws_id and name = 'Owner';
  select id into admin_role_id   from roles where workspace_id = ws_id and name = 'Admin';
  select id into sales_rep_role_id from roles where workspace_id = ws_id and name = 'Sales Rep';
  select id into support_role_id from roles where workspace_id = ws_id and name = 'Support Agent';
  select id into viewer_role_id  from roles where workspace_id = ws_id and name = 'Viewer';

  -- Owner: everything
  insert into role_permissions (role_id, resource, action) values
    (owner_role_id, 'contacts',   'view'),
    (owner_role_id, 'contacts',   'create'),
    (owner_role_id, 'contacts',   'edit_any'),
    (owner_role_id, 'contacts',   'delete_any'),
    (owner_role_id, 'deals',      'view'),
    (owner_role_id, 'deals',      'create'),
    (owner_role_id, 'deals',      'edit_any'),
    (owner_role_id, 'deals',      'delete_any'),
    (owner_role_id, 'activities', 'view'),
    (owner_role_id, 'activities', 'create'),
    (owner_role_id, 'activities', 'edit_any'),
    (owner_role_id, 'activities', 'delete_any'),
    (owner_role_id, 'team',       'view'),
    (owner_role_id, 'team',       'invite'),
    (owner_role_id, 'team',       'remove'),
    (owner_role_id, 'team',       'manage_roles'),
    (owner_role_id, 'reports',    'view');

  -- Admin: all CRM + team management, no billing
  insert into role_permissions (role_id, resource, action) values
    (admin_role_id, 'contacts',   'view'),
    (admin_role_id, 'contacts',   'create'),
    (admin_role_id, 'contacts',   'edit_any'),
    (admin_role_id, 'contacts',   'delete_any'),
    (admin_role_id, 'deals',      'view'),
    (admin_role_id, 'deals',      'create'),
    (admin_role_id, 'deals',      'edit_any'),
    (admin_role_id, 'deals',      'delete_any'),
    (admin_role_id, 'activities', 'view'),
    (admin_role_id, 'activities', 'create'),
    (admin_role_id, 'activities', 'edit_any'),
    (admin_role_id, 'activities', 'delete_any'),
    (admin_role_id, 'team',       'view'),
    (admin_role_id, 'team',       'invite'),
    (admin_role_id, 'team',       'remove'),
    (admin_role_id, 'reports',    'view');

  -- Sales Rep: own contacts/deals, view others
  insert into role_permissions (role_id, resource, action) values
    (sales_rep_role_id, 'contacts',   'view'),
    (sales_rep_role_id, 'contacts',   'create'),
    (sales_rep_role_id, 'contacts',   'edit_own'),
    (sales_rep_role_id, 'contacts',   'delete_own'),
    (sales_rep_role_id, 'deals',      'view'),
    (sales_rep_role_id, 'deals',      'create'),
    (sales_rep_role_id, 'deals',      'edit_own'),
    (sales_rep_role_id, 'deals',      'delete_own'),
    (sales_rep_role_id, 'activities', 'view'),
    (sales_rep_role_id, 'activities', 'create'),
    (sales_rep_role_id, 'activities', 'edit_own'),
    (sales_rep_role_id, 'reports',    'view');

  -- Support Agent: contacts + activities only
  insert into role_permissions (role_id, resource, action) values
    (support_role_id, 'contacts',   'view'),
    (support_role_id, 'contacts',   'create'),
    (support_role_id, 'contacts',   'edit_own'),
    (support_role_id, 'activities', 'view'),
    (support_role_id, 'activities', 'create'),
    (support_role_id, 'activities', 'edit_own');

  -- Viewer: read only
  insert into role_permissions (role_id, resource, action) values
    (viewer_role_id, 'contacts',   'view'),
    (viewer_role_id, 'deals',      'view'),
    (viewer_role_id, 'activities', 'view'),
    (viewer_role_id, 'reports',    'view');
end;
$$;

grant execute on function seed_default_roles(uuid) to authenticated;

-- ─── UPDATE create_workspace_with_owner to seed roles ─────────
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
  -- Create workspace
  insert into workspaces (name, slug)
  values (ws_name, ws_slug)
  returning * into new_workspace;

  -- Seed default roles for this workspace
  perform seed_default_roles(new_workspace.id);

  -- Get the Owner role id
  select id into owner_role_id
  from roles
  where workspace_id = new_workspace.id and name = 'Owner';

  -- Add user as owner with Owner role
  insert into workspace_members (workspace_id, user_id, role, role_id, full_name)
  values (new_workspace.id, owner_id, 'owner', owner_role_id, owner_name);

  return row_to_json(new_workspace);
end;
$$;

grant execute on function create_workspace_with_owner(text, text, uuid, text) to authenticated;