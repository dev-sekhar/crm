# HubClone — Database Schema Reference

## Run Order

All SQL files live in `schema/`. Run in this order in Supabase SQL Editor:

| # | File | Purpose |
|---|------|---------|
| 1 | `01_core_schema.sql` | Core tables: workspaces, members, contacts, deals, activities |
| 2 | `02_rbac_schema.sql` | Roles, role_permissions + seed_default_roles() |
| 3 | `03_dynamic_rls.sql` | has_permission() function + RLS policies |
| 4 | `04_stages_schema.sql` | deal_stages table + seed_default_stages() |
| 5 | `05_activity_enhancements.sql` | deal_id, parent_activity_id columns + indexes |
| 6 | `06_rls_fixes.sql` | Security definer functions for workspace create/join |

Seed an existing workspace:
```sql
select seed_default_roles('YOUR_WORKSPACE_UUID');
select seed_default_stages('YOUR_WORKSPACE_UUID');
```

---

## Tables

### workspaces
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Display name |
| slug | text UNIQUE | Used for join links |
| created_at | timestamptz | |

### workspace_members
| Column | Type | Notes |
|--------|------|-------|
| workspace_id | uuid FK | |
| user_id | uuid FK | auth.users |
| role | text | Legacy: owner/admin/member |
| role_id | uuid FK | roles (RBAC) |
| full_name | text | |

### contacts
| Column | Type | Notes |
|--------|------|-------|
| workspace_id | uuid FK | |
| created_by | uuid FK | |
| name / email / phone / company | text | |
| status | text | Lead / Active / Inactive |
| value | numeric | |

### deals
| Column | Type | Notes |
|--------|------|-------|
| workspace_id | uuid FK | |
| contact_id | uuid FK | contacts |
| stage_id | uuid FK | deal_stages |
| stage | text | Mirrors stage name |
| name / value / probability / close_date / notes | | |

### deal_stages
| Column | Type | Notes |
|--------|------|-------|
| workspace_id | uuid FK | |
| name / description / color | text | |
| position | integer | Sort order |
| is_won / is_lost / is_default | boolean | |

Default stages: Lead → Contacted → Proposal → Negotiation → Won → Lost

### activities
| Column | Type | Notes |
|--------|------|-------|
| contact_id | uuid FK | Optional for tasks |
| deal_id | uuid FK | Optional — links activity to deal |
| parent_activity_id | uuid FK | Self-ref follow-up chain |
| type | text | call / email / meeting / note / stage_change / task |
| text | text | Summary / title |
| activity_at | timestamptz | When it happened; **for tasks = due date** |
| duration_mins | integer | Calls and meetings |
| notes | text | Free text; stage_change = JSON (see below) |
| follow_up_action | text | What needs to happen next |
| follow_up_date | timestamptz | Follow-up due date |
| follow_up_done | boolean | Also = task completion flag |

#### Activity types and overdue rules

| type | contact required | Overdue condition |
|------|-----------------|-------------------|
| call / email / meeting / note | yes | follow_up_date < now AND follow_up_done = false |
| task | no | activity_at < now AND follow_up_done = false |
| stage_change | no | never overdue |

#### Follow-up chain
parent_activity_id creates a tree. "Log follow-up" creates a child activity and marks the parent done. No depth limit.

#### stage_change notes JSON
```json
{ "from": "Lead", "to": "Contacted", "comment": "User's reason for moving" }
```

---

## Key Functions

| Function | Purpose |
|----------|---------|
| create_workspace_with_owner() | Creates workspace, seeds roles + stages, adds owner |
| get_workspace_by_slug() | Security definer lookup for join flow |
| seed_default_roles(ws_id) | Seeds 5 built-in roles |
| seed_default_stages(ws_id) | Seeds 6 deal stages |
| has_permission(ws_id, resource, action) | Used by all RLS policies |
| is_workspace_member(ws_id) | Used by RLS policies |

## RLS Summary
- workspaces / workspace_members — RLS disabled (security definer functions)
- contacts / deals / activities — dynamic RLS via has_permission()
- deal_stages / roles / role_permissions — member-based RLS
