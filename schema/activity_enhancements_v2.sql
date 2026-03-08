-- ============================================================
-- HubClone – Activity Enhancements v2
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── Link activities to deals ────────────────────────────────
alter table activities
  add column if not exists deal_id uuid references deals(id) on delete set null;

-- ─── Follow-up chain: link child activity to parent ──────────
alter table activities
  add column if not exists parent_activity_id uuid references activities(id) on delete set null;

-- ─── Stage change log ─────────────────────────────────────────
-- We reuse the activities table with type='stage_change'
-- and store from_stage/to_stage in notes as JSON

-- ─── Index for performance ───────────────────────────────────
create index if not exists activities_deal_id_idx on activities(deal_id);
create index if not exists activities_parent_idx  on activities(parent_activity_id);
create index if not exists activities_contact_idx on activities(contact_id);

-- ─── View: full activity chain ───────────────────────────────
-- Useful for debugging chains; not required by the app
create or replace view activity_chains as
with recursive chain as (
  -- Root activities (no parent)
  select id, text, type, deal_id, contact_id, follow_up_action, follow_up_date,
         parent_activity_id, 0 as depth, id as root_id
  from activities
  where parent_activity_id is null
  union all
  -- Child activities
  select a.id, a.text, a.type, a.deal_id, a.contact_id, a.follow_up_action, a.follow_up_date,
         a.parent_activity_id, c.depth + 1, c.root_id
  from activities a
  join chain c on c.id = a.parent_activity_id
)
select * from chain;
