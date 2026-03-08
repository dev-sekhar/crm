# HubClone — Build Prompts

All feature and design prompts used to build this app, in chronological order. Error messages, debug outputs, and one-word confirmations have been excluded.

---

**a.** Build me a hubspot clone

## Session 1 — Core CRM + Auth + Multi-tenancy

**1.** Have 2 users (jd, jk) created for the same company (Kiritra). Details created by jk are visible to jd — not sure if that is correct.

**2.** What if I have a company and within the company have a workspace — in that case workspace can share but not outside. How is that?

**3.** The only thing missing is if you want multiple workspaces within one company — for example Kiritra has a Sales team and a Support team, each with their own separate CRM data but under the same company umbrella. Is this how HubSpot works?

**4.** In this, who is owner, admin, member — with examples?

**5.** Mostly ok, we need to have multiple roles for member.

**6.** Sure, but add the possibility of creating new roles as required by admin with ability to map activities allowed.

**7.** Where can I see my role?

**8.** Now when I sign up as a new user, what role will be assigned to this user?

**9.** How to change the role of a user? Can a screen be created for both owner and admin?

**10.** Owner's role should not be changeable by anyone including the owner himself.

**11.** Other than owner and admin, no need to show the team settings for other roles. What happened to the member role?

**12.** Change default role assigned to Viewer unless it is the first user for the workspace.

**13.** Can we extract the rules to reside externally and use them in our auth/app code?

**14.** permissions.js must be part of UI under Team Settings.

**15.** Both — DB enforcement + dynamic permissions loaded from DB.

**16.** Can you explain these permissions and document it in a permissions.md (also update the README)?

**17.** Explain the resource "team" — how can team invite members, remove members, manage roles? The owner permissions should be viewable but not editable (even by owner). Permissions screen closes if I move to a different browser tab.

---

## Session 2 — Pipeline, Deal Stages & Activity

**18.** In the deals screen, explain at the bottom the "Stage"; there should be a workflow for the stages of a deal (editable using the UI — maybe a tab in Team Settings); in pipeline screen drag and drop should work (inline with workflow); when I click on the card in the pipeline screen it should display the deal details; for activity log calls/email/meeting notes — capture datetime, notes and minutes (for meetings), and follow-up actions with dates.

**Q&A before building:**

> Q: What should the default deal stages be?
> A: Simple sales (Lead → Contacted → Proposal → Negotiation → Won/Lost)

> Q: For activity follow-up actions — how should reminders work?
> A: Show overdue follow-ups as a badge/alert in the app

> Q: Deal card click in Pipeline — what should the detail view look like?
> A: Full modal popup

---

## Session 3 — Stage Change Notes, Follow-up Chains & Activity Improvements

**19.** When moving between stages user must add notes/comments; activity should be linked to a deal (I think is a good option); log activity screen clears data if moved to a different browser tab (check behaviour for all modal windows and fix it across all); automatically create a new activity if a follow-up has been created and link the two — there could be a cursive linkage i.e. activity1 → followup1 (which is an activity in its own) → followup2 and so on.

---

## Session 4 — Schema Organisation, Stage Change Display & Task Type

**20.** Remember I have a schema folder where all schema files are, a docs folder for permissions.md and any further documentation; notes added when deal stage change are not displayed when I click on the deal in the deals/pipeline screen; when does an activity become overdue; create a new activity type task (to-do list independent of contact).

---

## Session 5 — Internationalisation & Constraint Fix

**21.** Introduce internationalisation for the app; update README; when adding a task get error "violates constraint".

---

## Session 6 — This Document

**22.** Create a md file that has all the prompts that we have used for this app (ignore any that had to do with errors).
