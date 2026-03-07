// src/permissions.js
// ─────────────────────────────────────────────────────────────
// RBAC configuration — single source of truth for the UI.
//
// Rules are loaded dynamically from the Supabase role_permissions
// table (set via Team Settings). No permissions are hardcoded here
// except structural constants (resource/action names) and UI helpers.
//
// Enforcement happens at TWO levels:
//   1. DB level  — RLS policies call has_permission() in Supabase
//   2. UI level  — components call userCan() from usePermissions()
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// ─── Structural Constants ─────────────────────────────────────
// These define the shape of the permission system.
// Change these if you add new resources or actions.

export const RESOURCES = ['contacts', 'deals', 'activities', 'team', 'reports']

export const RESOURCE_ACTIONS = {
  contacts:   ['view', 'create', 'edit_own', 'edit_any', 'delete_own', 'delete_any'],
  deals:      ['view', 'create', 'edit_own', 'edit_any', 'delete_own', 'delete_any'],
  activities: ['view', 'create', 'edit_own', 'edit_any', 'delete_own', 'delete_any'],
  team:       ['view', 'invite', 'remove', 'manage_roles'],
  reports:    ['view'],
}

export const ALL_ACTIONS = [
  'view', 'create',
  'edit_own', 'edit_any',
  'delete_own', 'delete_any',
  'invite', 'remove', 'manage_roles',
]

export const ACTION_LABELS = {
  view:         'View',
  create:       'Create',
  edit_own:     'Edit own',
  edit_any:     'Edit any',
  delete_own:   'Delete own',
  delete_any:   'Delete any',
  invite:       'Invite members',
  remove:       'Remove members',
  manage_roles: 'Manage roles',
}

// ─── Built-in Role Names ──────────────────────────────────────
// Use these constants — never hardcode role name strings.
export const ROLES = {
  OWNER:         'Owner',
  ADMIN:         'Admin',
  SALES_REP:     'Sales Rep',
  SUPPORT_AGENT: 'Support Agent',
  VIEWER:        'Viewer',
}

// ─── Role Behaviour Config ────────────────────────────────────
// Change these to adjust app-level behaviour without touching
// any other file.

// Role assigned to the user who creates a workspace
export const WORKSPACE_CREATOR_ROLE = ROLES.OWNER

// Role assigned to users who join via slug
export const DEFAULT_JOIN_ROLE = ROLES.VIEWER

// Roles that can access Team Settings
export const TEAM_SETTINGS_ROLES = [ROLES.OWNER, ROLES.ADMIN]

// Roles that cannot be reassigned or edited by anyone
export const LOCKED_ROLES = [ROLES.OWNER]

// ─── Role Display ─────────────────────────────────────────────
export const ROLE_COLORS = {
  [ROLES.OWNER]:         '#ff7a59',
  [ROLES.ADMIN]:         '#3949ab',
  [ROLES.SALES_REP]:     '#2e7d32',
  [ROLES.SUPPORT_AGENT]: '#f57f17',
  [ROLES.VIEWER]:        '#888888',
}

export const getRoleColor = (roleName) => ROLE_COLORS[roleName] || '#6b6b6b'

// ─── Pure Helpers ─────────────────────────────────────────────

/** Check a permission map for a specific resource + action */
export const can = (permMap, resource, action) =>
  permMap?.[`${resource}:${action}`] === true

/** Build a flat perm map from DB role_permissions rows */
export const buildPermMap = (permRows = []) => {
  const map = {}
  permRows.forEach(p => { map[`${p.resource}:${p.action}`] = true })
  return map
}

/** Full permission map for Owner — all actions on all resources */
export const buildOwnerPermMap = () => {
  const map = {}
  RESOURCES.forEach(r => {
    ;(RESOURCE_ACTIONS[r] || []).forEach(a => { map[`${r}:${a}`] = true })
  })
  return map
}

/** Is this role locked from reassignment/editing? */
export const isLockedRole = (roleName) => LOCKED_ROLES.includes(roleName)

/** Does this role get access to Team Settings? */
export const canAccessTeamSettings = (roleName) =>
  TEAM_SETTINGS_ROLES.includes(roleName)

// ─── usePermissions Hook ──────────────────────────────────────
// Use this hook in any component that needs to check permissions.
// It loads the current user's role and permissions from the DB
// and exposes a userCan(resource, action) helper.
//
// Usage:
//   const { userCan, roleName, loading } = usePermissions(workspace, user)
//   if (userCan('contacts', 'delete_any')) { ... }

export function usePermissions(workspace, user) {
  const [permMap,  setPermMap]  = useState({})
  const [roleName, setRoleName] = useState('')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!workspace?.id || !user?.id) { setLoading(false); return }

    supabase
      .from('workspace_members')
      .select('role, role_id, roles(name, role_permissions(resource, action))')
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setLoading(false); return }

        const name = data.roles?.name || data.role || ''
        setRoleName(name)

        // Owners always get full permissions regardless of DB state
        if (name === ROLES.OWNER || data.role === 'owner') {
          setPermMap(buildOwnerPermMap())
        } else {
          setPermMap(buildPermMap(data.roles?.role_permissions || []))
        }
        setLoading(false)
      })
  }, [workspace?.id, user?.id])

  const userCan = (resource, action) => can(permMap, resource, action)

  return { userCan, roleName, permMap, loading }
}
