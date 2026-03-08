-- ============================================================
-- HubClone – Activity Enhancements
-- Adds: deal_id, parent_activity_id (follow-up chains),
--       task type support, stage-change activity logging
-- Run after: 04_stages_schema.sql
-- ============================================================

-- ─── Link activities to deals ────────────────────────────────
alter table activities
  add column if not exists deal_id uuid references deals(id) on delete set null;

-- ─── Follow-up chain ─────────────────────────────────────────
-- A follow-up activity points back to the activity that created it.
-- This enables infinite chains:  activity → follow-up → follow-up → …
alter table activities
  add column if not exists parent_activity_id uuid references activities(id) on delete set null;

-- ─── task type ───────────────────────────────────────────────
-- type column already exists (text). Valid values now:
--   call | email | meeting | note | stage_change | task
--
-- For tasks:
--   activity_at    = due date
--   follow_up_done = completion flag  (mark done = mark task complete)
--   contact_id / deal_id are optional
--
-- Overdue rules:
--   task      → overdue when activity_at < now() AND follow_up_done = false
--   follow-up → overdue when follow_up_date < now() AND follow_up_done = false

-- ─── stage_change activity ───────────────────────────────────
-- type  = 'stage_change'
-- text  = "Stage changed: Lead → Contacted"
-- notes = JSON: { "from": "Lead", "to": "Contacted", "comment": "user note" }
-- deal_id is always set for stage change activities

-- ─── Performance indexes ─────────────────────────────────────
create index if not exists activities_deal_id_idx   on activities(deal_id);
create index if not exists activities_parent_idx    on activities(parent_activity_id);
create index if not exists activities_contact_idx   on activities(contact_id);
create index if not exists activities_workspace_idx on activities(workspace_id);
create index if not exists activities_type_idx      on activities(type);
create index if not exists activities_followup_idx  on activities(follow_up_date) where follow_up_done = false;
