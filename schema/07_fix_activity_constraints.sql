-- ============================================================
-- HubClone – Fix activity type constraint + contact_id
-- Allows: task and stage_change types
--         contact_id to be NULL (required for tasks)
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- 1. Drop the old type check constraint
alter table activities
  drop constraint if exists activities_type_check;

-- 2. Add updated constraint with all valid types
alter table activities
  add constraint activities_type_check
  check (type in ('call', 'email', 'meeting', 'note', 'stage_change', 'task'));

-- 3. Make contact_id nullable (tasks don't require a contact)
--    If it's already nullable this is a no-op.
alter table activities
  alter column contact_id drop not null;

-- Verify:
-- select conname, consrc from pg_constraint
-- where conrelid = 'activities'::regclass and contype = 'c';
