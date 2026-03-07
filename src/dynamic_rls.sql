-- ============================================================
-- HubClone – Dynamic RLS via role_permissions table
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── Helper: does current user have a specific permission? ───
-- This is called by every RLS policy. It joins workspace_members
-- → roles → role_permissions to check the actual DB-stored rules.
create or replace function has_permission(ws_id uuid, p_resource text, p_action text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members wm
    join roles r on r.id = wm.role_id
    join role_permissions rp on rp.role_id = r.id
    where wm.workspace_id = ws_id
      and wm.user_id      = auth.uid()
      and rp.resource     = p_resource
      and rp.action       = p_action
  );
$$;

grant execute on function has_permission(uuid, text, text) to authenticated;

-- ─── Helper: get workspace_id for a contact/deal/activity ────
-- Used in RLS policies to resolve the workspace from the row
create or replace function get_record_creator(record_id uuid, tbl text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select case tbl
    when 'contacts'   then (select created_by from contacts   where id = record_id limit 1)
    when 'deals'      then (select created_by from deals      where id = record_id limit 1)
    when 'activities' then (select created_by from activities where id = record_id limit 1)
  end;
$$;

-- ─── Add created_by to contacts and deals ────────────────────
-- So we can enforce edit_own / delete_own
alter table contacts add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table deals    add column if not exists created_by uuid references auth.users(id) on delete set null;

-- ─── Drop old simple RLS policies ────────────────────────────
drop policy if exists "auth full access" on contacts;
drop policy if exists "auth full access" on deals;
drop policy if exists "auth full access" on activities;
drop policy if exists "contacts select"  on contacts;
drop policy if exists "contacts insert"  on contacts;
drop policy if exists "contacts update"  on contacts;
drop policy if exists "contacts delete"  on contacts;
drop policy if exists "deals select"     on deals;
drop policy if exists "deals insert"     on deals;
drop policy if exists "deals update"     on deals;
drop policy if exists "deals delete"     on deals;
drop policy if exists "activities select" on activities;
drop policy if exists "activities insert" on activities;
drop policy if exists "activities update" on activities;
drop policy if exists "activities delete" on activities;

-- ─── CONTACTS – Dynamic RLS ──────────────────────────────────
create policy "contacts view"
  on contacts for select to authenticated
  using (has_permission(workspace_id, 'contacts', 'view'));

create policy "contacts create"
  on contacts for insert to authenticated
  with check (has_permission(workspace_id, 'contacts', 'create'));

create policy "contacts update"
  on contacts for update to authenticated
  using (
    has_permission(workspace_id, 'contacts', 'edit_any')
    or (has_permission(workspace_id, 'contacts', 'edit_own') and created_by = auth.uid())
  );

create policy "contacts delete"
  on contacts for delete to authenticated
  using (
    has_permission(workspace_id, 'contacts', 'delete_any')
    or (has_permission(workspace_id, 'contacts', 'delete_own') and created_by = auth.uid())
  );

-- ─── DEALS – Dynamic RLS ─────────────────────────────────────
create policy "deals view"
  on deals for select to authenticated
  using (has_permission(workspace_id, 'deals', 'view'));

create policy "deals create"
  on deals for insert to authenticated
  with check (has_permission(workspace_id, 'deals', 'create'));

create policy "deals update"
  on deals for update to authenticated
  using (
    has_permission(workspace_id, 'deals', 'edit_any')
    or (has_permission(workspace_id, 'deals', 'edit_own') and created_by = auth.uid())
  );

create policy "deals delete"
  on deals for delete to authenticated
  using (
    has_permission(workspace_id, 'deals', 'delete_any')
    or (has_permission(workspace_id, 'deals', 'delete_own') and created_by = auth.uid())
  );

-- ─── ACTIVITIES – Dynamic RLS ────────────────────────────────
create policy "activities view"
  on activities for select to authenticated
  using (has_permission(workspace_id, 'activities', 'view'));

create policy "activities create"
  on activities for insert to authenticated
  with check (has_permission(workspace_id, 'activities', 'create'));

create policy "activities update"
  on activities for update to authenticated
  using (
    has_permission(workspace_id, 'activities', 'edit_any')
    or (has_permission(workspace_id, 'activities', 'edit_own') and created_by = auth.uid())
  );

create policy "activities delete"
  on activities for delete to authenticated
  using (
    has_permission(workspace_id, 'activities', 'delete_any')
    or (has_permission(workspace_id, 'activities', 'edit_own') and created_by = auth.uid())
  );

-- ─── ROLES – Dynamic RLS ─────────────────────────────────────
drop policy if exists "roles select" on roles;

create policy "roles view"
  on roles for select to authenticated
  using (is_workspace_member(workspace_id));

create policy "roles insert"
  on roles for insert to authenticated
  with check (has_permission(workspace_id, 'team', 'manage_roles'));

create policy "roles update"
  on roles for update to authenticated
  using (has_permission(workspace_id, 'team', 'manage_roles'));

create policy "roles delete"
  on roles for delete to authenticated
  using (has_permission(workspace_id, 'team', 'manage_roles'));

-- ─── ROLE_PERMISSIONS – Dynamic RLS ──────────────────────────
alter table role_permissions enable row level security;

create policy "role_permissions view"
  on role_permissions for select to authenticated
  using (
    exists (
      select 1 from roles r
      where r.id = role_id
      and is_workspace_member(r.workspace_id)
    )
  );

create policy "role_permissions manage"
  on role_permissions for all to authenticated
  using (
    exists (
      select 1 from roles r
      where r.id = role_id
      and has_permission(r.workspace_id, 'team', 'manage_roles')
    )
  )
  with check (
    exists (
      select 1 from roles r
      where r.id = role_id
      and has_permission(r.workspace_id, 'team', 'manage_roles')
    )
  );
