# HelixCRM

A full-stack HubSpot-style CRM built with React + Supabase. Multi-tenant, role-based, fully internationalised.

## Tech Stack

- **Frontend**: React 18 (react-scripts 5), inline styles, no CSS framework
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Package manager**: npm

---

## Quick Start

### 1. Supabase Setup

In [Supabase](https://supabase.com) → SQL Editor, run these files **in order** from the `schema/` folder:

```
schema/01_core_schema.sql
schema/02_rbac_schema.sql
schema/03_dynamic_rls.sql
schema/04_stages_schema.sql
schema/05_activity_enhancements.sql
schema/06_rls_fixes.sql
schema/07_fix_activity_constraints.sql   ← run if you get type constraint errors
```

Then seed your workspace (replace with your workspace UUID):
```sql
select seed_default_roles('YOUR_WORKSPACE_UUID');
select seed_default_stages('YOUR_WORKSPACE_UUID');
```

In Supabase → Authentication → Settings:
- Disable **email confirmations** for local development

### 2. Environment

```bash
cp .env.example .env
# Fill in your Supabase URL and anon key
```

`.env`:
```
REACT_APP_SUPABASE_URL=https://xxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
```

### 3. Install & run

```bash
npm install
npm start
# → http://localhost:3000
```

---

## Features

### CRM
| Feature | Details |
|---------|---------|
| **Contacts** | Full CRUD, search, slide-in detail panel with deal & activity timeline |
| **Deals** | List view, probability bars, linked to contacts and stages |
| **Pipeline** | Kanban board, drag & drop between stages, deal detail modal |
| **Activity** | Timeline with calls, emails, meetings, notes, tasks, stage changes |
| **Dashboard** | Live metrics: pipeline value, revenue won, open deals, win rate |

### Activities

| Type | Contact required | Overdue condition |
|------|-----------------|-------------------|
| call / email / meeting / note | Yes | `follow_up_date < now` AND not done |
| **task** | No | `activity_at < now` AND not done |
| stage_change | No | Never overdue |

**Follow-up chains**: each activity can have a follow-up. Logging a follow-up creates a child activity linked via `parent_activity_id`. Chains are infinite and rendered recursively, indented.

**Stage change notes**: moving a deal between stages prompts for a reason. A `stage_change` activity is auto-created and linked to the deal.

### Pipeline
- Drag & drop cards between stage columns
- Clicking a card opens a full deal modal with activity timeline
- Stage legend at the bottom explains each stage

### Deal Stages
- Workspace-scoped, fully editable in Team Settings → Deal Stages tab
- Default stages: Lead → Contacted → Proposal → Negotiation → Won → Lost
- Each stage has a colour, description, and Won/Lost/Default flags

### RBAC (Role-based Access Control)

5 built-in roles per workspace:

| Role | CRM | Team |
|------|-----|------|
| Owner | Full | Full incl. manage_roles |
| Admin | Full | invite + remove |
| Sales Rep | Own records + view all | — |
| Support Agent | Contacts + activities | — |
| Viewer | Read-only | — |

Roles and permissions are fully editable in Team Settings → Roles & Permissions.

### Internationalisation (i18n)

9 languages included: English, Español, Français, Deutsch, Português, हिन्दी, 日本語, 中文, العربية (RTL supported).

Language is persisted in `localStorage`. Switch via the flag picker at the bottom of the sidebar.

To add a new language:
1. Open `src/i18n.js`
2. Add an entry to `LANGUAGES`
3. Add a translation object to `translations`
4. All untranslated keys fall back to English automatically

---

## Project Structure

```
helixcrm/
├── schema/                     # SQL migrations (run in order)
│   ├── 01_core_schema.sql
│   ├── 02_rbac_schema.sql
│   ├── 03_dynamic_rls.sql
│   ├── 04_stages_schema.sql
│   ├── 05_activity_enhancements.sql
│   ├── 06_rls_fixes.sql
│   └── 07_fix_activity_constraints.sql
├── docs/
│   ├── SCHEMA.md               # Full DB reference
│   └── PERMISSIONS.md          # RBAC documentation
├── src/
│   ├── i18n.js                 # Translations + useTranslation hook
│   ├── App.jsx                 # Main app shell + CRUD logic
│   ├── Auth.jsx                # Login / Register / WorkspaceSetup
│   ├── Pipeline.jsx            # Kanban board + deal modal + stage change prompt
│   ├── ActivityLog.jsx         # Timeline, task list, follow-up chains
│   ├── StageManager.jsx        # Stage workflow editor
│   ├── TeamSettings.jsx        # Members, roles, stages tabs
│   ├── permissions.js          # RBAC hook + constants
│   └── supabaseClient.js       # Supabase client
├── .env.example
├── .gitignore
└── package.json
```

---

## Adding Translations

All user-facing strings are keyed in `src/i18n.js`. The pattern is:

```js
// Simple string
t('nav.deals')                          // → "Deals"

// With interpolation
t('deals.count', { count: 5 })          // → "5 deals"
t('common.error', { msg: 'Not found' }) // → "Error: Not found"
```

Missing keys fall back to English, then to the key itself — so partially translated languages still work.
