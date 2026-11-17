# Admin guide

Operator walkthrough for the Gulf Property v1 surfaces. All paths are relative to the
app origin; `{locale}` is `en` or `ar`. Roles come from `docs/SPEC.md` §4.

## First-time setup

1. **Create an organization.** A signed-in user without a membership lands on
   `/{locale}/onboarding`. Enter the name, a lowercase slug (`doha-towers`), the market
   country and the base currency. `create_organization` also creates the self-owner, the
   chart of accounts, the branding row, the profile and an `org_admin` membership.
2. **Platform operators** can create additional organizations from
   `/{locale}/platform` (Dashboard → Create organization). The console is visible only
   to users in `platform_admins`; membership in an organization is not required.
3. **Invite users.** `/{locale}/settings/users` → invite by email, choose a role
   (`manager`, `accountant`, `caretaker`, `owner`, `tenant`) and a locale. The invite is
   sent with the service-role key; the membership row is written under RLS. Managers and
   caretakers can be limited to specific buildings via the access control on that screen.
4. **Configure the organization.** `/{locale}/settings/organization` holds currency,
   locale, timezone, late fee and type, grace days, tax rate, reminder days and revenue
   recognition. `/{locale}/settings/branding` holds the logo, colours, font, terminology
   overrides and custom domain request. Notification templates and audit log live at
   `/{locale}/settings/notifications` and `/{locale}/settings/audit`.

## Property data

- **Import:** `/{locale}/buildings/import` accepts a CSV and offers a dry run before a
  commit. The importer only accepts `type=building` and `type=unit` rows. Column order,
  matching `src/lib/import-rows.ts`: `type,code,name,owner,city,country_code,floor,unit_no,unit_type,area_sqm,rent`.
  For a building, `code`/`name`/`owner`/`city`/`country_code` are used; for a unit,
  `code` is the parent building code and `rent` is in major currency units. Templates are
  in `docs/import-templates/`; the owners and tenants files are header-only references —
  create those records through their own screens until the importer supports their types.
- **Tenants:** `/{locale}/tenants` — create, edit and view with a masked national ID number;
  plaintext is revealed only through the role-gated detail action. Additional owners are
  created through the organization setup RPC or seed data; there is no owner admin screen
  in v1, and the owner portal is for owners already attached to a user.

## Daily operations

- **Activate a lease.** `/{locale}/leases` → create a draft lease (tenant, unit or sub-let
  mode, dates, rent, deposit, installments). Open the lease detail page and choose
  **Activate**. `activate_lease` flips the unit to occupied and generates the charge
  schedule from `src/lib/lease-schedule.ts`. Overlapping top-level leases on one unit and
  sub-let activation without approval are rejected.
- **Record a payment.** `/{locale}/payments` → **Record payment**. Receipt numbers are
  gapless per organization and year; the RPC allocates money to selected charges and
  posts the journal. Tenants instead submit a proof at `/{locale}/portal/payments`, which
  creates a `pending_confirmation` row for staff to confirm.
- **Clear or bounce a cheque.** `/{locale}/cheques`: register a cheque, then deposit it,
  clear it or bounce it. Bouncing reverses the allocation and updates the ledger.
- **Handle a deposit.** `/{locale}/deposits`: the deposit charge opens a held balance.
  Apply a deduction (optionally from a move-out inspection) or refund from there; both
  are recorded in `deposit_transactions`.
- **Close a period.** `/{locale}/settings/accounting` → close or reopen a month. Closed
  periods reject new journal postings. The same screen can run the overdue/late-fee
  sweep, which marks overdue charges and queues tenant notifications.
- **Issue an owner statement.** `/{locale}/reports` generates a draft statement;
  `/{locale}/owner/statements` lists them for the owner. `issue_owner_statement` locks a
  draft as issued and posts the management-fee journal.
- **Print documents.** `/{locale}/print/receipt/{id}`, `/print/statement/{leaseId}`,
  `/print/owner-statement/{id}` and `/print/contract/{leaseId}` render A4 sheets with a
  print button and a link to the other language.

## Portals

- **Tenant portal:** `/{locale}/portal` — lease summary, statement, payment proof upload,
  maintenance requests and documents. Tenants see only rows on their own leases; the
  portal is gated by the `tenant_portal` feature flag.
- **Owner portal:** `/{locale}/owner` — portfolio KPIs, buildings, rent roll,
  receivables, reports, statements, payouts, approvals and documents. Owners see only
  rows on buildings they own; the portal is gated by `owner_portal`.
- **Platform console:** `/{locale}/platform` — organizations, plan and feature flags,
  usage snapshots, market packs and audited active-org switching.

## Demo credentials (local only)

Created by `node scripts/seed-demo-data.cjs`; **never use these in a deployed
organization**:

| Login | Password | Surface |
| --- | --- | --- |
| `admin@example.com` | `Admin1234!` | Staff workspace (MFA setup required) |
| `manager@example.com` | `Manager1234!` | Staff workspace |
| `owner@example.com` | `Owner1234!` | Owner portal |
| `tenant@example.com` | `Tenant1234!` | Tenant portal |
