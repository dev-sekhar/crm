# HubClone RBAC – Permissions Documentation

## Overview

HubClone uses a **Role-Based Access Control (RBAC)** system. Every user in a workspace is assigned a role. Each role has a set of permissions that control what they can see and do.

Permissions are stored in the Supabase `role_permissions` table and enforced at **two layers**:

| Layer | Where | How |
|---|---|---|
| **Database** | Supabase RLS policies | `has_permission()` function checks `role_permissions` table on every API call — even direct API/curl calls are blocked |
| **UI** | `usePermissions()` hook | Loads permissions from DB on login, hides/shows buttons and actions in real time |

Changing a role's permissions in **Team Settings → Roles & Permissions** immediately updates both layers.

---

## Resources

A **resource** is a type of data in the CRM. There are 5 resources:

| Resource | Description |
|---|---|
| `contacts` | People and companies in the CRM |
| `deals` | Sales opportunities and pipeline entries |
| `activities` | Logged calls, emails, meetings, and notes |
| `team` | Workspace members and role assignments |
| `reports` | Dashboard metrics and analytics |

---

## Actions

An **action** is something a user can do to a resource. Not all actions apply to all resources.

| Action | Applies to | Description |
|---|---|---|
| `view` | contacts, deals, activities, team, reports | Read / see the data |
| `create` | contacts, deals, activities | Add new records |
| `edit_own` | contacts, deals, activities | Edit records **you created** |
| `edit_any` | contacts, deals, activities | Edit **any** record, including others' |
| `delete_own` | contacts, deals, activities | Delete records **you created** |
| `delete_any` | contacts, deals, activities | Delete **any** record |
| `invite` | team | Invite new members to the workspace via slug |
| `remove` | team | Remove a member from the workspace |
| `manage_roles` | team | Create, edit, and assign roles |

> **Note:** `edit_any` supersedes `edit_own` — if you have `edit_any` there is no need to also grant `edit_own`. The same applies to `delete_any` vs `delete_own`.

---

## Built-in Roles

There are 5 built-in default roles. They are created automatically when a workspace is set up. Default roles **cannot be deleted**, but their permissions can be edited (except for Owner).

### Owner
> *"Full control over workspace, billing and team"*

The person who created the workspace. Has **all permissions** on all resources. The Owner role is **permanently locked** — it cannot be edited, reassigned, or removed by anyone including the owner themselves. There is always exactly one Owner per workspace.

| Resource | Permissions |
|---|---|
| Contacts | view, create, edit_any, delete_any |
| Deals | view, create, edit_any, delete_any |
| Activities | view, create, edit_any, delete_any |
| Team | view, invite, remove, manage_roles |
| Reports | view |

---

### Admin
> *"Manage team members, roles and all CRM data"*

A trusted manager or team lead. Has full CRM access and can manage team members, but **cannot manage roles** (only the Owner can assign/edit roles).

| Resource | Permissions |
|---|---|
| Contacts | view, create, edit_any, delete_any |
| Deals | view, create, edit_any, delete_any |
| Activities | view, create, edit_any, delete_any |
| Team | view, invite, remove |
| Reports | view |

> Admin can see **Team Settings** (Members tab only). They cannot create new roles or change role permissions.

---

### Sales Rep
> *"Manage own pipeline, view team contacts and deals"*

A standard sales team member. Can create and manage their own contacts and deals, and view everyone else's — but cannot delete or edit other people's records.

| Resource | Permissions |
|---|---|
| Contacts | view, create, edit_own, delete_own |
| Deals | view, create, edit_own, delete_own |
| Activities | view, create, edit_own |
| Team | — |
| Reports | view |

> Sales Rep **cannot** access Team Settings.

---

### Support Agent
> *"View contacts, log activities, no deal access"*

A customer support team member. Focused on contacts and activity logging. Has no access to deals or financial pipeline data.

| Resource | Permissions |
|---|---|
| Contacts | view, create, edit_own |
| Deals | — |
| Activities | view, create, edit_own |
| Team | — |
| Reports | — |

> Support Agent **cannot** access Team Settings.

---

### Viewer
> *"Read-only access to all CRM data"*

The **default role** assigned to any new user who joins a workspace via slug. Can see everything but cannot create, edit, or delete anything. Useful for investors, interns, or stakeholders who need visibility without write access.

| Resource | Permissions |
|---|---|
| Contacts | view |
| Deals | view |
| Activities | view |
| Team | — |
| Reports | view |

> Viewer **cannot** access Team Settings.

---

## Custom Roles

Owners and Admins can create custom roles with any combination of permissions via **Team Settings → Roles & Permissions → + New Role**.

Examples of custom roles you might create:

| Custom Role | Suggested Permissions |
|---|---|
| Field Agent | contacts: view, create, edit_own · activities: view, create |
| Partner | contacts: view · deals: view · reports: view |
| Marketing | contacts: view, create · activities: view, create |
| Finance | deals: view · reports: view |

Custom roles can be deleted. Default roles cannot.

---

## Default Role on Join

When a new user joins a workspace via slug, they are automatically assigned the **Viewer** role. An Owner or Admin must manually promote them to a more privileged role from Team Settings → Members tab.

This is configured in `src/permissions.js`:

```js
export const DEFAULT_JOIN_ROLE = ROLES.VIEWER
```

To change the default join role, update this constant — no other files need to change.

---

## Permission Enforcement Architecture

```
User performs an action (e.g. delete a contact)
            │
            ▼
   ┌─────────────────┐
   │   UI Layer      │  userCan('contacts', 'delete_any')
   │  permissions.js │  → hides Delete button if false
   │  usePermissions │  → loaded from DB on login
   └────────┬────────┘
            │  if UI allows, API call is made
            ▼
   ┌─────────────────┐
   │   DB Layer      │  has_permission(workspace_id, 'contacts', 'delete_any')
   │   RLS Policy    │  → checks role_permissions table
   │   Supabase      │  → blocks request if false (even via curl/Postman)
   └─────────────────┘
```

Permissions are **never hardcoded in frontend logic**. The UI reads from the same `role_permissions` table that the DB enforces — meaning the two layers are always in sync.

---

## Key Files

| File | Purpose |
|---|---|
| `src/permissions.js` | Central config: role name constants, action labels, `usePermissions()` hook, `can()` helper |
| `src/TeamSettings.jsx` | UI for editing roles and permissions |
| `rbac_schema.sql` | Creates `roles` and `role_permissions` tables, seeds default roles |
| `dynamic_rls.sql` | Creates `has_permission()` DB function and all dynamic RLS policies |

---

## Changing Permissions

### Via UI (recommended)
1. Sign in as Owner or Admin
2. Sidebar → **👥 Team Settings** → **Roles & Permissions**
3. Click **✏ Edit** on any non-Owner role
4. Check/uncheck permissions in the matrix
5. Click **Save Permissions** — changes take effect immediately for all users with that role

### Via SQL (advanced)
```sql
-- Grant a permission
insert into role_permissions (role_id, resource, action)
values ('your-role-uuid', 'deals', 'delete_any');

-- Revoke a permission
delete from role_permissions
where role_id = 'your-role-uuid'
  and resource = 'deals'
  and action = 'delete_any';
```

---

## Adding a New Resource or Action

1. Add the resource/action to `RESOURCES` / `RESOURCE_ACTIONS` / `ALL_ACTIONS` in `src/permissions.js`
2. Add the label to `ACTION_LABELS`
3. Add a corresponding RLS policy in Supabase SQL Editor using the `has_permission()` pattern
4. The permission matrix in Team Settings will automatically show the new row/column
