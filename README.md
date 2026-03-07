# HubClone CRM

A full HubSpot-style CRM built on **React + Supabase**. Multi-tenant workspaces, real-time data, and a complete Role-Based Access Control (RBAC) system.

---

## Features

| Feature | Details |
|---|---|
| **Authentication** | Email/password sign up and login via Supabase Auth |
| **Multi-tenant Workspaces** | Each company gets its own isolated workspace — data never crosses between workspaces |
| **Contacts** | Full CRUD with detail panel, timeline, and search |
| **Deals** | Pipeline tracking with probability, close date, and value |
| **Pipeline** | Kanban board view by deal stage |
| **Activities** | Log calls, emails, meetings, and notes per contact |
| **Dashboard** | Live metrics — pipeline value, win rate, revenue won, open deals |
| **Real-time Sync** | Supabase Realtime — changes appear instantly across tabs and users |
| **RBAC** | 5 built-in roles + custom roles with a visual permission matrix editor |
| **Team Settings** | Invite members, change roles, manage permissions — all in-app |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (react-scripts), plain CSS-in-JS |
| Backend | Supabase (PostgreSQL + Auth + Realtime + RLS) |
| Package manager | pnpm |
| Permissions | Dynamic RLS policies + `usePermissions()` React hook |

---

## Quick Start

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a name, password, and region → Create
3. Wait ~1 minute for the project to spin up

### 2. Run the SQL files (in order)

In Supabase Dashboard → **SQL Editor**, run each file in order:

| # | File | What it does |
|---|---|---|
| 1 | `supabase_schema.sql` | Creates core tables: workspaces, workspace_members, contacts, deals, activities |
| 2 | `rbac_schema.sql` | Creates roles and role_permissions tables, seeds 5 default roles per workspace |
| 3 | `dynamic_rls.sql` | Creates `has_permission()` function and all dynamic RLS policies |

> If you are setting up a fresh project, run all three. If upgrading an existing project, run only the files you have not run yet.

### 3. Configure environment

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

```env
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-public-key
```

Find these in Supabase Dashboard → **Settings → API**.

### 4. Install and run

```bash
pnpm install
pnpm start
```

App runs at **http://localhost:3000**

### 5. First-time setup in the app

1. Click **Register** → create your account
2. On the workspace setup screen, click **Create new workspace**
3. Enter a name and slug (e.g. `acme`, `kiritra`) → you become the **Owner**
4. The CRM loads scoped to your workspace

To invite teammates: share your workspace slug. They register, choose **Join existing workspace**, and enter the slug. They join as **Viewer** by default — promote them in Team Settings.

---

## Project Structure

```
hubclone/
├── .env                      ← Your Supabase credentials (never commit this)
├── .env.example              ← Template for .env
├── .gitignore
├── package.json
│
├── supabase_schema.sql       ← Step 1: core tables + RLS setup
├── rbac_schema.sql           ← Step 2: roles, permissions, default role seeding
├── dynamic_rls.sql           ← Step 3: has_permission() + dynamic RLS policies
│
├── PERMISSIONS.md            ← Full RBAC documentation
│
├── public/
│   └── index.html
│
└── src/
    ├── index.js
    ├── supabaseClient.js     ← Supabase client (reads from .env)
    ├── permissions.js        ← RBAC config, constants, usePermissions() hook
    ├── App.jsx               ← Main CRM app (auth-aware, workspace-scoped)
    ├── Auth.jsx              ← Login, Register, WorkspaceSetup screens
    └── TeamSettings.jsx      ← Team members + roles & permissions editor
```

---

## RBAC System

HubClone has a full Role-Based Access Control system. See [PERMISSIONS.md](./PERMISSIONS.md) for complete documentation.

### Built-in Roles (quick reference)

| Role | CRM Access | Team Access | Notes |
|---|---|---|---|
| **Owner** | Full | Full incl. manage roles | Locked — cannot be changed by anyone |
| **Admin** | Full | Invite + remove members | Cannot manage roles |
| **Sales Rep** | Own records + view all | None | Default for promoted members |
| **Support Agent** | Contacts + activities only | None | No deal access |
| **Viewer** | Read-only | None | **Default role on join** |

### Changing permissions

Owner and Admin can edit role permissions via the in-app UI:

> **Sidebar → 👥 Team Settings → Roles & Permissions → ✏ Edit**

Changes take effect immediately for all users with that role — no restart needed.

### Custom roles

Admins and Owners can create custom roles with any combination of permissions:

> **Team Settings → Roles & Permissions → + New Role**

---

## Permission Architecture

Permissions are enforced at two independent layers:

```
User action (e.g. delete a contact)
        │
        ▼
┌───────────────────┐
│   UI Layer        │  usePermissions() hook in permissions.js
│   React / JS      │  → hides buttons the user cannot use
│                   │  → loaded from DB on login
└────────┬──────────┘
         │ API call made if UI allows
         ▼
┌───────────────────┐
│   DB Layer        │  has_permission() Postgres function
│   Supabase RLS    │  → checks role_permissions table on every query
│                   │  → blocks unauthorized requests even via curl/Postman
└───────────────────┘
```

The `role_permissions` table is the **single source of truth** — both layers read from it, so they are always in sync.

---

## Data Model

```
workspaces
    └── workspace_members  (links users to workspaces, with role_id)
    └── roles              (Owner, Admin, Sales Rep, Support Agent, Viewer + custom)
         └── role_permissions  (resource + action pairs per role)
    └── contacts           (workspace-scoped, with created_by)
    └── deals              (workspace-scoped, with created_by)
    └── activities         (workspace-scoped, linked to contacts)
```

All CRM data (contacts, deals, activities) is scoped to a workspace_id. Users from different workspaces never see each other's data.

---

## Deploy to Production

```bash
pnpm run build
```

Deploy the `build/` folder to **Vercel** (easiest):

```bash
npx vercel --prod
```

Add your `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` as environment variables in the Vercel dashboard.

---

## Troubleshooting

| Error | Fix |
|---|---|
| `new row violates row-level security` | RLS is enabled but permissions are not seeded. Run `rbac_schema.sql` then: `select seed_default_roles(id) from workspaces where slug = 'your-slug';` |
| `Workspace not found` on join | Run the `get_workspace_by_slug` function creation from `rls_fix_v2.sql` |
| Blank role name in sidebar | Your member record has no `role_id`. Run the member migration SQL in `rbac_schema.sql` comments |
| Buttons missing (no + Contact etc.) | Your role has no permissions yet. Go to Team Settings → Roles → edit your role |
| `function not found` error | The `has_permission` or `create_workspace_with_owner` function was not created. Re-run the relevant SQL file |
