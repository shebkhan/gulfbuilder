# M4 Operations, Inspections and Notifications Implementation Plan

**Goal:** Maintenance requests, dispatch and status flow, meter tracking, move-in/move-out inspections (feeding deposit deductions), document vault, and notification outbox with bilingual UI.

**Architecture:**
- Tables: `maintenance_requests`, `maintenance_events`, `meters`, `meter_readings`, `inspections`, `documents`, `notification_templates`, `notification_outbox`.
- All tables org-scoped with RLS, audit triggers, and update triggers.
- RPCs for state transitions and atomic operations.
- Move-out inspections can automatically feed security deposit deductions when damages are identified.

**Spec:** `docs/SPEC.md` §5.5, §5.8, §7.3, §12 (M4), §13.

---

### Step 1: Database Migration — Operations Tables & RPCs
- File: `supabase/migrations/20261116000020_ops.sql`
- Push to remote Supabase database.
- Regenerate TypeScript types into `src/types/database.ts`.

### Step 2: Server Actions
- `src/server/actions/maintenance.ts` (create request, update status, assign vendor/staff)
- `src/server/actions/meters.ts` (create meter, record reading)
- `src/server/actions/inspections.ts` (create inspection, complete inspection, link deposit deduction)

### Step 3: Web UI Workspaces & Components
- Maintenance workspace: `src/app/[locale]/(app)/maintenance/page.tsx`
- Maintenance modal/forms: `src/components/domain/maintenance-form.tsx`
- Inspections view: `src/app/[locale]/(app)/inspections/page.tsx` + `src/components/domain/inspection-form.tsx`

### Step 4: Translations & Navigation
- `messages/en.json` & `messages/ar.json` for `maintenance` and `inspections`.
- Verify with `pnpm typecheck` and git commit.
