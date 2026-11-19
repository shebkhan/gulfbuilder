# Gulf Property Management Platform: Build Specification

Version 0.3 · 19 November 2026 · Target stack: Next.js 15 + Supabase · Audience: Claude Code and human reviewers

## 0. How to use this spec

Companion file: `CLAUDE.md` (repo conventions, commands, rules). Read both fully before writing code. For product behavior, this file wins; for code style and tooling, `CLAUDE.md` wins.

Workflow:

1. Build in milestone order (section 12). Do not start a milestone until the previous Definition of Done passes.
2. At the start of each milestone, write a short plan (files to add or change), then implement in small commits.
3. Schema changes only through new migration files. Never edit applied migrations.
4. Write tests with the code (pgTAP, Vitest, Playwright).
5. Where this spec is ambiguous or marked `TODO(owner)`, ask. Never invent legal, tax or regulatory values; use placeholders marked `TODO(verify)`.
6. Log deviations in `docs/DECISIONS.md`.

## 1. Product summary

A multi-tenant, white-label SaaS for property companies in the Gulf. It manages buildings, floors, units (flats), rooms (sub-letting), tenants, leases, deposits, rent collection (including post-dated cheques), maintenance, expenses, owner statements and financial analytics.

- **First market:** Qatar (QAR). Architecture supports UAE, Saudi Arabia, Kuwait, Bahrain and Oman through per-organization market packs.
- **Customers:** (a) companies that own their buildings, (b) companies that manage buildings for third-party owners, (c) both at once. All three are supported through a per-owner `ownership_model`.
- **v1 surfaces:** responsive web app (Arabic RTL and English), tenant portal, owner portal, installable PWA, white-label branding, super-admin console.
- **Additive surface:** a public, unauthenticated property marketplace across organizations — landing, search, listing detail, enquiries and an org enquiry inbox (section 8 MP, section 12 M8). It is not part of the original v1 tenant scope; see D-027.
- **Out of scope for v1:** native apps (Expo, phase 2), government registry integrations (tracked manually), online card payments (phase 2), non-Gulf markets.

## 2. Locked decisions

| ID | Decision |
|---|---|
| D1 | One shared database, `org_id` on every business table, Row Level Security everywhere |
| D2 | Money is `bigint` minor units plus currency code; a `currencies` table holds the decimal exponent |
| D3 | First market Qatar (QAR); other Gulf countries added as market packs (rules as data, not code) |
| D4 | Ownership models per owner record: `self` (company owns the building) and `managed` (third-party owner). One organization may have both |
| D5 | Immutable double-entry ledger; corrections by reversal; accounting periods can be closed |
| D6 | A cheque is a memo item until it clears; the ledger posts and the charge is marked paid only when the cheque is cleared |
| D7 | Revenue recognition setting per organization: `on_due` (default) or `straight_line_monthly` |
| D8 | Sub-letting: Mode A, owner rents rooms directly (room leases); Mode B, tenant sub-lets (child lease with parent_lease_id and manager approval) |
| D9 | Arabic and English from day one; RTL via logical CSS; Hijri date display optional |
| D10 | Mobile: PWA in v1; Expo native apps and branded builds in phase 2 |
| D11 | Develop on hosted Supabase, keep everything portable to self-hosted Supabase. Production hosting region: `TODO(owner)` |
| D12 | Mutations via Server Actions; multi-step financial operations via Postgres RPC functions |
| D13 | ID numbers encrypted at rest (Vault/pgsodium or app-level envelope encryption behind `src/lib/crypto.ts`) |
| D14 | Soft delete on master data; effective-dated rent changes (`lease_terms`) |
| D15 | Public listings are exposed only through the `public_listings` security-definer view with an explicit column allow-list; anonymous users may only INSERT `listing_enquiries` for publicly listed units and cannot SELECT any lead |

## 3. Stack and conventions

| Concern | Choice |
|---|---|
| Framework | Next.js 15, App Router, React 19, TypeScript strict |
| UI | Tailwind CSS, shadcn/ui, Radix; logical properties for RTL |
| i18n | next-intl, locales `en` and `ar` |
| Forms | react-hook-form with Zod resolvers |
| Data | supabase-js server client (RLS via user JWT), TanStack Query for client interactivity |
| Database | Supabase Postgres with RLS, pg_cron, btree_gist |
| Auth | Supabase Auth: email and password, magic link, phone OTP; TOTP MFA for admin roles |
| Storage | Supabase Storage, private buckets with path prefix `{org_id}/`; `listing-images` is a deliberate public bucket for crawlable listing images (D-026) |
| Jobs | pg_cron plus Edge Functions |
| Charts | Recharts |
| PDF | @react-pdf/renderer, bilingual with RTL support |
| Email | Resend or equivalent (behind a `Notifier` interface) |
| WhatsApp and SMS | Provider `TODO(owner)`, behind the same `Notifier` interface |
| Tests | Vitest, Playwright, pgTAP |

Repository layout:

```
src/
  app/
    [locale]/
      /, properties, properties/[slug]                          # public marketplace
      (auth)/login, accept-invite, reset-password
      (app)/dashboard
      (app)/buildings/[id]/(overview | floors | units | stacking | expenses)
      (app)/units/[id]/(overview | leases | maintenance | meters)
      (app)/owners, tenants, leases, payments, cheques, deposits
      (app)/expenses, maintenance, reports, documents
      (app)/settings/(organization | users | branding | templates | notifications | accounting)
      (app)/listings/enquiries                                  # org lead inbox
      (owner)/home, buildings, statements, payouts, approvals, documents
      (portal)/home, statement, payments, requests, documents
      (platform)/organizations, plans, market-packs, usage      # platform_admin only
    api/webhooks/(whatsapp | payments)/route.ts
    sitemap.ts, robots.ts                                       # public marketplace SEO
  middleware.ts            # locale, host -> organization, auth redirect
  components/ui/           # shadcn primitives
  components/domain/       # StackingGrid, ChequeBoard, LedgerTable, LeaseForm, StatementView ...
  components/domain/marketplace/  # ListingCard, ListingSearch, EnquiryForm, ShareButtons
  lib/supabase/(server | client | admin).ts
  lib/(money | dates | hijri | rbac | i18n | kpi).ts
  lib/(marketplace | marketplace-data | marketplace-seo).ts
  schemas/*.ts             # Zod schemas shared by client and server
  server/actions/*.ts      # Server Actions per module
  server/queries/*.ts      # read models
  types/database.ts        # generated
messages/en.json  messages/ar.json
supabase/
  migrations/  functions/(notify | receipts | contracts | report-runner)  tests/  seed.sql
docs/DECISIONS.md
```

Request flow: browser, then Server Component or Server Action, then Supabase with the user's JWT. Middleware resolves the request host to an organization (white-label domains) and injects branding CSS variables in the root layout. A Supabase Auth custom access token hook adds `org_id` and `org_role` claims for the active organization. The marketplace routes (`/{locale}`, `/{locale}/properties`, `/{locale}/properties/[slug]`) are anonymous: they use the anon Supabase client against `public_listings` and are not matched by the auth-protected route list; only `/{locale}/listings/enquiries` requires a session.

## 4. Roles and permissions

Roles: `platform_admin` (your staff, console only), `org_admin`, `manager`, `accountant`, `caretaker`, `owner` (read-only, own buildings), `tenant` (own data).

Capability matrix (C create, R read, U update, D delete, A approve):

| Capability | org_admin | manager | accountant | caretaker | owner | tenant |
|---|---|---|---|---|---|---|
| Owners, buildings, floors, units, rooms | CRUD | CRU (assigned buildings) | R | R | R (own) | |
| Tenants and leases | CRUDA | CRUA | R | R | R (own) | own R |
| Charges and payments | CRUD | CR | CRUD | | R (own) | own R |
| Cheques | CRUD | CRU | CRUD | | R (own) | own R |
| Deposits and refunds | CRUDA | R | CRUA | | R (own) | own R |
| Expenses | CRUD | CRU | CRUD | C | R (own), A over threshold | |
| Maintenance requests | CRUD | CRUD | R | CRU | R (own) | C, own R |
| Meter readings, inspections | CRUD | CRU | R | CRU | | |
| Ledger, journals, periods | R, close | R | CRUD, close | | | |
| Reports and analytics | R | R (assigned) | R | | R (own) | |
| Owner statements and payouts | CRUDA | R | CRUDA | | R (own) | |
| Users, branding, settings | CRUD | | | | | |
| Public listing metadata and images (RLS permission; no management UI yet) | CRUD | CRU (assigned buildings) | | | | |
| Listing enquiries (org inbox) | R (assigned buildings), U (org) | R (assigned buildings), U (org) | R (assigned buildings), U (org) | | | |

Anonymous visitors have no row-level access to business tables: they may read only the allow-listed columns of the `public_listings` view and insert enquiries for publicly listed vacant units. Managers and caretakers are limited to buildings in `member_building_access`. Owners are limited to buildings where `buildings.owner_id` matches their owner record (`owners.user_id = auth.uid()`). Tenants see only rows linked to their own leases (`tenants.user_id = auth.uid()`).

## 5. Database schema

Implement in this migration order. Every table below also gets `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (maintained by a `set_updated_at` trigger) and `created_by uuid`. Business tables carry `org_id uuid not null references organizations(id)`. Add `(org_id, ...)` indexes for every filtered or joined column.

### 5.1 `0001_core.sql`: extensions, enums, tenancy

```sql
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
-- pg_cron: enable through Supabase dashboard or config

create type member_role    as enum ('org_admin','manager','accountant','caretaker','owner','tenant');
create type ownership_model as enum ('self','managed');
create type unit_status    as enum ('vacant','occupied','reserved','maintenance');
create type lease_status   as enum ('draft','active','expired','terminated','renewed');
create type charge_type    as enum ('rent','deposit','utility','maintenance','late_fee','other');
create type charge_status  as enum ('pending','partial','paid','overdue','void');
create type payment_method as enum ('cash','bank_transfer','cheque','card','online');
create type cheque_status  as enum ('received','deposited','cleared','bounced','returned','replaced');
create type maint_status   as enum ('open','assigned','in_progress','resolved','closed','cancelled');
create type maint_priority as enum ('low','normal','high','urgent');

create table currencies (
  code char(3) primary key, name text not null, exponent smallint not null  -- QAR/AED/SAR 2; KWD/BHD/OMR 3
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null, legal_name text, tax_id text,
  slug text unique not null,
  country_code char(2) not null default 'QA',
  base_currency char(3) not null default 'QAR' references currencies(code),
  default_locale text not null default 'en',
  timezone text not null default 'Asia/Qatar',
  settings jsonb not null default '{}',  -- late_fee, tax_rate, reminder_days, revenue_recognition, grace_days
  plan text not null default 'trial', status text not null default 'active'
);

create table org_branding (
  org_id uuid primary key references organizations(id),
  app_name text, logo_url text, favicon_url text,
  primary_color text, secondary_color text, font_family text,
  custom_domain text unique, email_from text,
  terminology jsonb not null default '{}'
);

create table profiles (
  id uuid primary key references auth.users(id),
  full_name text, phone text, locale text default 'en'
);

create table org_members (
  org_id uuid not null references organizations(id),
  user_id uuid not null references auth.users(id),
  role member_role not null,
  primary key (org_id, user_id)
);

create table member_building_access (
  org_id uuid not null, user_id uuid not null, building_id uuid not null,
  primary key (user_id, building_id)
);

create table market_packs (            -- global, read-only for tenants
  country_code char(2) not null, version int not null, effective_from date not null,
  rules jsonb not null,                -- id_types, registration labels, weekend, tax defaults, notice periods, holidays, templates
  primary key (country_code, version)
);
```

### 5.2 `0002_property.sql`: owners and buildings

```sql
create table owners (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  is_company_self boolean not null default false,   -- auto-created per org; holds self-owned buildings
  ownership_model ownership_model not null default 'managed',
  user_id uuid references auth.users(id),           -- owner portal login
  contact jsonb not null default '{}',
  fee_type text not null default 'percent_of_collections',  -- percent_of_collections | fixed_per_unit | none
  fee_value numeric(12,4) not null default 0,        -- percent (e.g. 5.0) or amount in minor units per unit
  letting_fee_months numeric(4,2) not null default 0,       -- extra fee on new leases, in months of rent
  fee_tax_applicable boolean not null default false,
  reserve_pct numeric(5,2) not null default 0, reserve_minor bigint not null default 0,
  approval_threshold_minor bigint,                   -- expenses above this need owner approval
  payout_frequency text not null default 'monthly', payout_details jsonb not null default '{}',
  deleted_at timestamptz,
  check (not is_company_self or ownership_model = 'self')
);
create unique index one_self_owner_per_org on owners(org_id) where is_company_self;

create table buildings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  owner_id uuid not null references owners(id),
  code text not null, name text not null,
  country_code char(2) not null, city text, zone text, street text, building_no text,
  national_address jsonb, latitude numeric(9,6), longitude numeric(9,6),
  amenities text[] not null default '{}', property_value_minor bigint, notes text,
  deleted_at timestamptz,
  unique (org_id, code)
);

create table floors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, building_id uuid not null references buildings(id),
  level int not null, label text,
  unique (building_id, level)
);

create table units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, building_id uuid not null references buildings(id),
  floor_id uuid not null references floors(id),
  unit_no text not null, unit_type text,                       -- studio, 1br, 2br, office, shop
  occupancy_type text not null default 'family',               -- family | bachelor | staff | commercial
  bedrooms int, bathrooms int, area_sqm numeric(8,2), furnished boolean not null default false,
  rentable_as text not null default 'whole',                   -- whole | rooms
  default_rent_minor bigint, currency char(3),
  status unit_status not null default 'vacant',
  electricity_no text, water_no text, deleted_at timestamptz,
  unique (building_id, unit_no)
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, unit_id uuid not null references units(id),
  room_no text not null, label text, capacity int not null default 1,
  area_sqm numeric(6,2), private_bathroom boolean not null default false,
  default_rent_minor bigint, currency char(3),
  status unit_status not null default 'vacant', deleted_at timestamptz,
  unique (unit_id, room_no)
);
```

### 5.3 `0003_tenancy.sql`: tenants and leases

```sql
create table tenants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, user_id uuid references auth.users(id),
  kind text not null default 'person',                         -- person | company
  full_name text not null, nationality text,
  id_type text, id_number_enc text, id_expiry date,            -- id_number encrypted (D13)
  phone text, whatsapp text, email text, language text not null default 'ar',
  employer text, emergency_contact jsonb, deleted_at timestamptz
);

create table leases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, lease_no text not null,
  unit_id uuid references units(id), room_id uuid references rooms(id),
  parent_lease_id uuid references leases(id),                  -- Mode B sub-let
  tenant_id uuid not null references tenants(id),
  start_date date not null, end_date date not null,
  rent_minor bigint not null, currency char(3) not null,
  payment_frequency text not null,                             -- monthly | quarterly | semiannual | annual | custom
  installments int not null default 12, due_day int not null default 1,
  deposit_minor bigint not null default 0,
  rent_collected_by text not null default 'landlord',          -- landlord | main_tenant
  sublet_approved_by uuid, sublet_approved_at timestamptz,
  registration_no text, registration_status text not null default 'pending',
  notice_days int not null default 60,
  status lease_status not null default 'draft',
  contract_path text, signed_at date, terminated_at date, termination_reason text,
  check (end_date > start_date),
  check ((unit_id is not null)::int + (room_id is not null)::int = 1),
  unique (org_id, lease_no)
);
alter table leases add constraint no_overlap_unit
  exclude using gist (unit_id with =, daterange(start_date, end_date, '[]') with &&)
  where (unit_id is not null and status = 'active');
alter table leases add constraint no_overlap_room
  exclude using gist (room_id with =, daterange(start_date, end_date, '[]') with &&)
  where (room_id is not null and status = 'active');

create table lease_terms (        -- effective-dated rent changes
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, lease_id uuid not null references leases(id),
  effective_from date not null, rent_minor bigint not null, note text
);

create table lease_occupants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, lease_id uuid not null references leases(id),
  tenant_id uuid references tenants(id), full_name text, relation text
);
```

Triggers to implement with tests: `enforce_room_vs_unit` (no room lease while a whole-unit lease is active on the same unit, and the reverse), `enforce_sublet` (parent lease must be active, `sublet_approved_by` set, occupants within capacity), `derive_unit_status` (from active leases and maintenance state).

### 5.4 `0004_finance.sql`: operational finance

```sql
create table charges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, lease_id uuid not null references leases(id),
  type charge_type not null, description text,
  period_start date, period_end date, due_date date not null,
  amount_minor bigint not null check (amount_minor >= 0), currency char(3) not null,
  paid_minor bigint not null default 0 check (paid_minor >= 0 and paid_minor <= amount_minor),
  status charge_status not null default 'pending',
  unique (lease_id, type, period_start)                        -- idempotent generation
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, tenant_id uuid not null references tenants(id),
  amount_minor bigint not null check (amount_minor > 0), currency char(3) not null,
  method payment_method not null, received_at timestamptz not null,
  reference text, cheque_id uuid, receipt_no text, proof_path text,
  status text not null default 'posted',                       -- posted | pending_confirmation | reversed
  bank_account_id uuid, received_by uuid references auth.users(id)
);

create table payment_allocations (
  payment_id uuid not null references payments(id),
  charge_id uuid not null references charges(id),
  amount_minor bigint not null check (amount_minor > 0),
  primary key (payment_id, charge_id)
);

create table tenant_credits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, tenant_id uuid not null references tenants(id),
  source_payment_id uuid references payments(id),
  remaining_minor bigint not null, currency char(3) not null
);

create table cheques (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, lease_id uuid not null references leases(id), tenant_id uuid not null,
  cheque_no text not null, bank_name text, drawer_name text,
  amount_minor bigint not null, currency char(3) not null,
  issue_date date, due_date date not null,
  status cheque_status not null default 'received',
  charge_id uuid references charges(id),
  deposited_at date, cleared_at date, bounce_reason text,
  replaced_by uuid references cheques(id), image_path text
);

create table deposits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, lease_id uuid not null unique references leases(id),
  amount_minor bigint not null, currency char(3) not null,
  received_at date, held_in text, status text not null default 'held'   -- held | partially_refunded | refunded
);

create table deposit_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, deposit_id uuid not null references deposits(id),
  kind text not null check (kind in ('receipt','deduction','refund')),
  amount_minor bigint not null check (amount_minor > 0), reason text,
  charge_id uuid references charges(id), evidence_path text,
  occurred_at date not null, approved_by uuid
);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, name text not null, trade text, phone text, email text,
  rating numeric(3,2), notes text, deleted_at timestamptz
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, building_id uuid references buildings(id), unit_id uuid references units(id),
  owner_id uuid references owners(id),                         -- derived from building; null = company overhead
  account_id uuid, vendor_id uuid references vendors(id),
  category text not null, description text,
  amount_minor bigint not null check (amount_minor > 0), currency char(3) not null,
  incurred_on date not null, paid_on date, bank_account_id uuid,
  status text not null default 'draft',                        -- draft | pending_owner_approval | approved | paid | rejected
  charge_to text not null default 'owner',                     -- owner | company | tenant
  tenant_charge_id uuid references charges(id), receipt_path text
);

create table receipt_sequences (
  org_id uuid not null, year int not null, last_no int not null default 0,
  primary key (org_id, year)
);
```

Rules in the database: allocations must not exceed the payment amount or the charge's open balance; a deposit balance (receipts minus deductions minus refunds) can never go negative; `charges.status` derives from `paid_minor` and `due_date`.

### 5.5 `0005_ops.sql`: maintenance, meters, inspections, documents

```sql
create table maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, building_id uuid not null references buildings(id),
  unit_id uuid references units(id), room_id uuid references rooms(id), tenant_id uuid references tenants(id),
  category text, priority maint_priority not null default 'normal', status maint_status not null default 'open',
  title text not null, description text,
  assigned_vendor_id uuid references vendors(id), assigned_user_id uuid,
  cost_minor bigint, currency char(3), charge_to text default 'owner', expense_id uuid references expenses(id),
  opened_at timestamptz not null default now(), resolved_at timestamptz
);
create table maintenance_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, request_id uuid not null references maintenance_requests(id),
  kind text not null, body text, photo_paths text[] default '{}', author_id uuid, created_at timestamptz not null default now()
);
create table meters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, building_id uuid references buildings(id), unit_id uuid references units(id),
  kind text not null, meter_no text                              -- electricity | water | gas
);
create table meter_readings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, meter_id uuid not null references meters(id),
  read_on date not null, value numeric(14,3) not null, photo_path text, read_by uuid
);
create table inspections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, lease_id uuid not null references leases(id),
  kind text not null check (kind in ('move_in','move_out')),
  data jsonb not null default '{}', completed_at timestamptz, tenant_signed boolean not null default false
);
create table documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, entity_type text not null, entity_id uuid not null,
  kind text not null, path text not null, expires_on date, uploaded_by uuid
);
```

### 5.6 `0006_ledger.sql`: accounting

```sql
create table accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, code text not null, name text not null,
  type text not null check (type in ('asset','liability','income','expense','equity')),
  parent_id uuid references accounts(id), is_system boolean not null default false,
  unique (org_id, code)
);
create table accounting_periods (
  org_id uuid not null, month date not null,                    -- first day of month
  status text not null default 'open',                          -- open | closed
  closed_by uuid, closed_at timestamptz,
  primary key (org_id, month)
);
create table journals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, posted_on date not null,
  source_type text not null, source_id uuid not null,           -- charge | payment | cheque | expense | deposit_txn | statement | payout | writeoff
  memo text, reversal_of uuid references journals(id),
  created_at timestamptz not null default now()
);
create table journal_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, journal_id uuid not null references journals(id),
  account_id uuid not null references accounts(id),
  debit_minor bigint not null default 0, credit_minor bigint not null default 0, currency char(3) not null,
  building_id uuid, unit_id uuid, lease_id uuid, owner_id uuid, tenant_id uuid,       -- reporting dimensions
  check (debit_minor >= 0 and credit_minor >= 0 and (debit_minor = 0 or credit_minor = 0))
);
create index on journal_lines (org_id, account_id, journal_id);
create index on journal_lines (org_id, owner_id);
create index on journal_lines (org_id, building_id);

create table owner_ledger_entries (   -- running balance owed to managed owners
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, owner_id uuid not null references owners(id),
  building_id uuid, occurred_on date not null,
  kind text not null check (kind in ('collection','other_income','expense','management_fee','fee_tax','reserve','payout','adjustment')),
  amount_minor bigint not null,                                 -- signed: positive increases the amount owed to the owner
  currency char(3) not null, source_type text, source_id uuid, statement_id uuid
);
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, name text not null, bank_name text, account_ref text,
  currency char(3) not null, opening_balance_minor bigint not null default 0, ledger_account_id uuid references accounts(id)
);
create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, bank_account_id uuid not null references bank_accounts(id),
  txn_date date not null, description text, amount_minor bigint not null,   -- signed
  matched_type text, matched_id uuid, imported_at timestamptz not null default now()
);
create table fx_rates (
  org_id uuid not null, rate_date date not null, from_currency char(3) not null, to_currency char(3) not null,
  rate numeric(18,8) not null, source text, primary key (org_id, rate_date, from_currency, to_currency)
);
create table budgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, building_id uuid references buildings(id), account_id uuid not null references accounts(id),
  month date not null, amount_minor bigint not null, currency char(3) not null,
  unique (org_id, building_id, account_id, month)
);
```

Seed the default chart of accounts per organization (`is_system = true` for rows marked *):

| Code | Name | Type |
|---|---|---|
| 1000* | Bank accounts | asset |
| 1010* | Cash on hand | asset |
| 1100* | Rent receivable | asset |
| 1110 | Other receivables | asset |
| 1200 | Prepaid expenses | asset |
| 2000* | Security deposits held | liability |
| 2010* | Unearned (advance) rent | liability |
| 2020* | Tenant credits | liability |
| 2030* | Owner funds held (clearing; excluded from journal-derived balance sheet, see 7.7) | liability |
| 2040 | Accounts payable | liability |
| 2050 | Tax payable | liability |
| 4000* | Rental income | income |
| 4010* | Late fees | income |
| 4020 | Utility recharges | income |
| 4030* | Management fee income | income |
| 4090 | Other income | income |
| 5000 | Maintenance and repairs | expense |
| 5010 | Utilities | expense |
| 5020 | Cleaning and security | expense |
| 5030 | Insurance | expense |
| 5040 | Government and registration fees | expense |
| 5050 | Marketing and leasing | expense |
| 5060 | Management fees paid | expense |
| 5070* | Bad debt | expense |
| 5090 | Other operating expenses | expense |

Triggers: `enforce_journal_balance` (deferred constraint: per journal and currency, debits equal credits), `block_journal_mutation` (no update or delete), `enforce_period_open` (reject postings into closed periods).

### 5.7 `0007_reporting_owners.sql`

```sql
create table owner_statements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, owner_id uuid not null references owners(id),
  period_start date not null, period_end date not null, currency char(3) not null,
  status text not null default 'draft',                         -- draft | review | issued
  opening_minor bigint not null default 0, closing_minor bigint not null default 0,
  totals jsonb not null default '{}', lines jsonb not null default '[]',
  pdf_path text, issued_at timestamptz, issued_by uuid,
  unique (owner_id, period_start, currency)
);
create table owner_payouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, owner_id uuid not null references owners(id),
  statement_id uuid references owner_statements(id),
  amount_minor bigint not null check (amount_minor > 0), currency char(3) not null,
  paid_on date not null, method text, reference text, bank_account_id uuid references bank_accounts(id)
);
create table owner_expense_approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, expense_id uuid not null references expenses(id), owner_id uuid not null references owners(id),
  status text not null default 'pending',                       -- pending | approved | rejected
  requested_at timestamptz not null default now(), decided_at timestamptz, decided_by uuid, note text
);
create table report_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, owner_user_id uuid, name text not null, report_key text not null, params jsonb not null default '{}'
);
create table scheduled_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, report_definition_id uuid not null references report_definitions(id),
  recipients text[] not null, frequency text not null, format text not null default 'pdf', next_run timestamptz not null, active boolean not null default true
);
create table report_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, report_key text not null, period_start date, period_end date,
  params jsonb, payload jsonb, pdf_path text, created_at timestamptz not null default now()
);
```

### 5.8 `0008_system.sql`

```sql
create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, event text not null, channel text not null, locale text not null, subject text, body text not null,
  unique (org_id, event, channel, locale)
);
create table notification_outbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, event text not null, channel text not null, recipient text not null, locale text not null,
  payload jsonb not null, status text not null default 'queued', attempts int not null default 0,
  send_after timestamptz not null default now(), sent_at timestamptz, error text
);
create table audit_log (
  id bigint generated always as identity primary key,
  org_id uuid, actor_id uuid, table_name text not null, row_id uuid, action text not null,
  old_data jsonb, new_data jsonb, at timestamptz not null default now()
);
-- platform tables: service role only
create table plans (code text primary key, name text, limits jsonb, features jsonb, price_minor bigint, currency char(3));
create table subscriptions (org_id uuid primary key references organizations(id), plan_code text references plans(code), status text, period_end date);
create table usage_snapshots (org_id uuid, taken_on date, units int, users int, storage_mb int, primary key (org_id, taken_on));
```

Attach `audit_trigger` (writes old and new row to `audit_log`) to all business tables.

### 5.9 `20261119000002_public_marketplace.sql`: public listings and enquiries

Additive and opt-in: a unit appears only when its slug is set, both building and unit flags allow listing, status is `vacant` and neither row is soft-deleted. No tenant, lease, cheque or internal financial column is ever exposed publicly. The flag defaults are permissive, so setting a slug is the effective publish action; an admin UI for these fields is still to come.

```sql
-- opt-in flags/listings metadata on existing tables
buildings: is_listed_publicly boolean not null default true, listing_description text
units:     is_listed_publicly boolean not null default true, listing_title text,
           listing_description text, listing_slug text unique, listed_at timestamptz

create table listing_images (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  unit_id uuid not null references units(id),
  path text not null, alt_text text, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid
);
create index listing_images_org_unit_idx on listing_images (org_id, unit_id, sort_order);

create table listing_enquiries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  unit_id uuid not null references units(id),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 255),
  phone text check (char_length(phone) <= 40),
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'new',  -- app uses new/read/replied/closed
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid
);
create index listing_enquiries_org_idx on listing_enquiries (org_id, created_at desc);
create index listing_enquiries_unit_idx on listing_enquiries (unit_id);
```

`public_listings` is a `security_definer` view with an explicit column allow-list: `unit_id`, `org_id`, `slug`, `title`, `description`, `rent_minor`, `currency`, `unit_type`, `bedrooms`, `bathrooms`, `area_sqm`, `furnished`, `occupancy_type`, `city`, `zone`, `building_name`, `latitude`, `longitude` and an org-configured `whatsapp` number. It includes only units that are opted in, not soft-deleted and `status = 'vacant'`.

Helper functions `is_publicly_listed`, `public_listing_org` and `public_listing_building` are `security definer` so anonymous visitors can check eligibility and resolve the owning organization without reading `units` or `buildings`. Policies:

- `public_listings`: anon and authenticated `SELECT` on the allow-listed columns only.
- `listing_images`: org members with `org_admin`/`manager` role and `can_access_building(public_listing_building(unit_id))` may write; anon may read images of publicly listed units.
- `listing_enquiries`: anon may `INSERT` only where `is_publicly_listed(unit_id)` and `org_id = public_listing_org(unit_id)`, via a column grant restricted to `org_id, unit_id, name, email, phone, message` (no anon `SELECT`). Org members read leads only for buildings they can access, scoped to `org_admin`, `manager` and `accountant`; the update policy is org-scoped (`org_id = auth_org()`).

A public-read `listing-images` Storage bucket holds crawlable image URLs; writes are restricted to the `{org_id}/` folder prefix (D-026). The WhatsApp number comes from the platform organization's `whatsapp` integration config, not a hard-coded constant.

## 6. Auth, RLS and storage

**Access token hook.** A Supabase Auth custom access token hook reads `org_members` for the user's active organization and adds claims `org_id` and `org_role`. Switching organization updates the active org (stored in `profiles` or user metadata) and refreshes the session.

**Helper functions and policy patterns**

```sql
create function auth_org() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'org_id','')::uuid $$;
create function auth_role() returns text language sql stable as $$
  select auth.jwt() ->> 'org_role' $$;
create function can_access_building(b uuid) returns boolean language sql stable security definer as $$
  select auth_role() in ('org_admin','accountant')
     or exists (select 1 from member_building_access m where m.user_id = auth.uid() and m.building_id = b)
     or exists (select 1 from buildings bl join owners o on o.id = bl.owner_id
                where bl.id = b and o.user_id = auth.uid()) $$;

-- pattern for building-scoped tables (select):
create policy org_read on buildings for select
  using (org_id = auth_org() and can_access_building(id));
-- pattern for writes:
create policy org_write on buildings for all
  using (org_id = auth_org() and auth_role() in ('org_admin','manager'))
  with check (org_id = auth_org());
```

Apply these patterns to every table:

- **Org isolation:** `org_id = auth_org()` on every policy.
- **Building scope** for manager, caretaker and owner through `can_access_building`, joined via the row's building or unit.
- **Tenant self-access:** a tenant reads only rows tied to leases where `tenants.user_id = auth.uid()`.
- **Owner access:** read-only, buildings owned by the signed-in owner; owner sees expense approvals only for their own expenses and may update only their own approval row.
- **Role limits:** writes follow the capability matrix in section 4.
- **Ledger tables:** insert only through RPC functions (security definer); no direct insert, update or delete by clients.
- **Platform tables and `market_packs` writes:** service role only; `market_packs` readable by authenticated users.
- **Storage:** object path is `{org_id}/{entity}/{id}/{file}`; policies check the first path segment against `auth_org()` plus entity-level access.

Every table needs pgTAP tests proving: org A cannot read or write org B; a role cannot exceed its matrix; a tenant sees only their own data; an owner sees only their own buildings.

## 7. Business rules and RPC functions

### 7.1 RPC functions (all `security definer`, validate role and org, run in one transaction)

| Function | Behavior |
|---|---|
| `activate_lease(lease_id)` | Validates dates, overlap and sub-let rules; sets status active; calls `generate_lease_charges`; creates deposit record and deposit charge; sets unit or room status; writes `lease_terms` first row |
| `generate_lease_charges(lease_id)` | Idempotent schedule generation (7.2) |
| `record_payment(tenant_id, amount, method, received_at, reference, allocations jsonb)` | Creates payment, receipt number, allocations (default oldest first), credit for any unallocated remainder, posts journals, writes owner ledger entries for managed owners |
| `register_cheque(...)`, `deposit_cheque(id)`, `clear_cheque(id)`, `bounce_cheque(id, reason)`, `replace_cheque(old_id, new_cheque)` | Cheque state machine (7.4); clearing creates the payment and posts the ledger |
| `apply_deposit_deduction(deposit_id, amount, reason, charge_id)`, `refund_deposit(deposit_id, amount)` | Deposit rules (7.5); refund requires approval permission |
| `record_expense(...)`, `approve_expense(id)`, `pay_expense(id, bank_account_id)` | Expense workflow including owner approval above threshold; posts journals and owner ledger entries |
| `post_journal(source_type, source_id, lines jsonb)` | Single entry point that inserts balanced journals; used by all other functions |
| `reverse_journal(journal_id, reason)` | Posts a reversing journal; never edits the original |
| `close_period(org_id, month)`, `reopen_period(org_id, month, reason)` | Period close checks (all payments allocated, no draft statements for the period); reopen restricted to org_admin and audited |
| `draft_owner_statement(owner_id, period_start, period_end)`, `issue_owner_statement(statement_id)`, `record_owner_payout(...)` | Statement rules (7.8) |
| `terminate_lease(lease_id, date, reason)`, `renew_lease(lease_id, new_terms jsonb)` | Termination voids future charges and starts move-out; renewal creates a draft lease linked to the old one |
| `mark_overdue_and_late_fees()` | Daily job function: marks charges overdue after grace days, applies late fee rule once per charge |

### 7.2 Charge schedule generation

1. Run on lease activation and after approved amendments.
2. Frequency maps to period length: monthly 1, quarterly 3, semiannual 6, annual 12 months; `custom` uses user-entered rows (one per cheque or installment).
3. Installment amount is total rent for the period divided by installments; the rounding remainder goes on the last charge.
4. Due date is the period start adjusted to `due_day`; optional prorating for a partial first period.
5. Unique key `(lease_id, type, period_start)` makes re-runs safe. Regeneration replaces unpaid future charges only; paid charges are never touched.
6. A deposit charge (`type = deposit`) is created on activation when `deposit_minor > 0`.

### 7.3 Status transitions

- Charge: `pending` to `partial` or `paid` on allocation; `pending` or `partial` to `overdue` when due date plus grace days has passed (daily job).
- Lease: `draft` to `active` (RPC); `active` to `expired` at end date unless renewed; `active` to `terminated` by RPC.
- Unit and room status derive from active leases, signed-but-not-started leases (`reserved`) and open maintenance blocks (`maintenance`); not edited by hand except to set maintenance.

### 7.4 Cheques (Gulf-critical)

- States: `received` then `deposited` then `cleared`, or `bounced`, `returned`, `replaced`.
- A cheque linked to a charge does **not** mark it paid until `cleared`. Received and deposited cheques appear in the cheque pipeline and cash forecast as expected receipts but are not posted to the ledger.
- `clear_cheque` creates the payment (method cheque), allocates it to the linked charge, posts the ledger and the owner ledger entry.
- `bounce_cheque` after clearing posts a reversing journal and reopens the charge; before clearing it just records the status. Optional bounce fee charge per organization settings. Notify manager and accountant immediately.
- Lease creation can generate the expected cheque list from the installment schedule.

### 7.5 Deposits

- Deposit is a liability (Security deposits held), never income.
- Transactions: receipt, deduction (needs reason and, where relevant, evidence and a linked charge), refund.
- Balance can never go negative. Refund requires approval permission and a completed move-out inspection (configurable).
- A deposit liability report lists held balances by lease and building.

### 7.6 Sub-letting

- Unit `rentable_as = whole`: one lease on the unit. `rentable_as = rooms`: leases per room.
- Whole-unit lease and room leases are mutually exclusive on the same unit while active (trigger).
- Mode B: a child lease sets `parent_lease_id`, needs `sublet_approved_by`, parent must be active, occupants must not exceed capacity. `rent_collected_by = main_tenant` means the platform records the sub-tenant but does not bill them.
- Market packs may add sub-letting restrictions. Default: approval mandatory.

### 7.7 Ledger posting rules and ownership models

All journals carry reporting dimensions (building, unit, lease, owner, tenant). Posting date follows the event date. Rent recognition is `on_due` (post on charge due date) unless the organization sets `straight_line_monthly` (post monthly; advance receipts sit in Unearned rent).

| Event | Debit | Credit |
|---|---|---|
| Rent charge posted | Rent receivable | Rental income |
| Rent received before its period | Bank | Unearned rent |
| Payment received (cash or transfer) | Bank or Cash | Rent receivable (unallocated part: Tenant credits) |
| Cheque cleared | Bank | Rent receivable |
| Cheque bounce after clearing | Rent receivable | Bank |
| Deposit received | Bank | Security deposits held |
| Deposit deduction applied | Security deposits held | Rent receivable or Other income |
| Deposit refunded | Security deposits held | Bank |
| Expense paid | Expense account | Bank or Cash |
| Expense recorded, paid later | Expense account | Accounts payable |
| Late fee charged | Rent receivable | Late fees |
| Write-off | Bad debt | Rent receivable |
| Management fee at statement issue (managed owners) | Owner funds held | Management fee income |
| Owner payout (managed owners) | Owner funds held | Bank |

**Ownership model rules** (implement in report functions and RPCs; flag `TODO(verify)` for accountant review per customer before production use):

- **R1.** Every journal line is tagged with `owner_id` (from the building). Overhead with no building has `owner_id` null (company overhead).
- **R2.** Owner and building reports (P&L, cash flow, rent roll, receivables) use all lines for that owner, regardless of model.
- **R3.** Company P&L = all lines for owners with `ownership_model = 'self'` + management fee income lines for `managed` owners + company overhead lines (`owner_id` null). Rental income and property expenses of `managed` owners are excluded.
- **R4.** Company balance sheet: Bank and Cash for all; Rent receivable, Unearned rent and Tenant credits for `self` owners only; Security deposits held for all owners (cash sits in the company bank); Owner funds held = sum of `owner_ledger_entries` for `managed` owners (the `2030` account is a clearing account and is excluded from journal-derived balance sheet lines to avoid double counting).
- **R5.** For `managed` owners, `owner_ledger_entries` are written when cash is received for their rent (kind `collection`), when expenses are paid for them (`expense`), when fees are charged (`management_fee`, `fee_tax`), on reserve changes and on payouts. Amounts are signed: positive means owed to the owner.
- **R6.** Each organization has one auto-created owner (`is_company_self = true`, model `self`) that owns self-owned buildings. No statements are produced for it by default.

### 7.8 Owner statements (managed owners)

`draft_owner_statement(owner, period)` computes, per currency:

1. `opening` = closing of the previous issued statement (0 if none).
2. `collections` and `other_income` = sum of `owner_ledger_entries` kinds `collection` and `other_income` in the period (cleared amounts only; deposits excluded).
3. `expenses` = paid expenses with `charge_to = owner` in the period, each with receipt link.
4. `fee` by `fee_type`: `percent_of_collections` = fee_value percent of (collections + other income); `fixed_per_unit` = fee_value minor units per occupied unit at period end; plus `letting_fee_months` times monthly rent for leases activated in the period. `fee_tax` = tax rate on fee if `fee_tax_applicable`.
5. `reserve` top-up to the owner's reserve target.
6. `net_payable = opening + collections + other_income - expenses - fee - fee_tax - reserve_top_up`; payouts in the period reduce it; `closing = net_payable - payouts`.

Workflow: draft (first day after period close) then review by accountant then issue. Issuing locks the statement (immutable), links its owner ledger entries, posts the fee journal, renders the bilingual PDF, emails the owner and shows it in the owner portal. Corrections appear as adjustments in the next statement. Expenses above `approval_threshold_minor` need an owner approval before payment.

## 8. Functional requirements

**Properties (P)**
- P1 Owners CRUD with ownership model, fee configuration, reserve, approval threshold, portal access invite.
- P2 Buildings with owner, address fields (zone, street, building number, national address), coordinates, amenities, property value (optional, for yield).
- P3 Floors by level, with bulk generation (for example levels 0 to 12).
- P4 Units in bulk per floor using a naming pattern; type, size, furnished, occupancy type.
- P5 `rentable_as` per unit and room management with capacity and rent.
- P6 Stacking view: floor-by-floor grid for a building, colored by status, click through to the unit.
- P7 Excel and CSV import for owners, buildings, floors, units, rooms, tenants with validation and dry-run preview.

**Tenants and leases (L)**
- L1 Tenant records with ID type and expiry (QID, Emirates ID, Iqama, GCC ID, passport), contact, WhatsApp, language, employer.
- L2 Lease for a unit or room: dates, rent, frequency, installments, deposit, registration number and status.
- L3 Workflow draft, active, expired, terminated, renewed through RPCs; activation generates schedule and deposit.
- L4 Sub-letting Modes A and B (section 7.6).
- L5 One-click renewal with proposed increase; old lease closes on activation of the new one.
- L6 Termination with date and reason; voids future charges; starts move-out inspection and deposit settlement.
- L7 Contract PDFs from templates in Arabic and English; upload signed copy.
- L8 Alerts: lease expiry at 90, 60, 30 days; tenant ID expiry; registration pending.

**Finance (F)**
- F1 Charges and schedule (7.2). F2 Payments and allocation. F3 Gapless receipts, bilingual PDF, send by email or WhatsApp.
- F4 Cheque register with images and the state machine (7.4); this-week due list; replacement flow.
- F5 Deposits (7.5). F6 Expenses with vendor, receipt, owner approval, charge to tenant option.
- F7 Tenant statement PDF. F8 Late fees by organization rule with waiver and reason.
- F9 Ledger: journals viewer, trial balance, general ledger with drill-down, period close and reopen.
- F10 Bank accounts, CSV bank import and reconciliation (phase 2).

**Operations (M)**
- M1 Maintenance requests from tenant, manager or caretaker with photos, priority and location.
- M2 Assignment to vendor or staff, status flow, cost and who bears it.
- M3 Move-in and move-out inspections with photos feeding deposit deductions.
- M4 Meters and readings with consumption history (offline-friendly on mobile in phase 2).
- M5 Document vault with expiry reminders.

**Portals (T and O)**
- T1 Tenant portal: sign in (email or phone OTP), lease, statement, dues, cheques, upload transfer proof (creates `pending_confirmation` payment), maintenance requests, receipts, language choice.
- O1 Owner portal (read-only): dashboard, buildings drill-down, rent roll, aged receivables, statements and payouts archive, documents, expense approvals, notifications. Hide tenant ID numbers and phone numbers by default (organization setting).

**Administration (A)**
- A1 Invite users, assign roles and building access. A2 Organization settings (currency, late fee policy, grace days, reminder schedule, tax rate, revenue recognition, templates, terminology). A3 Branding. A4 Audit log viewer. A5 Full data export (CSV).

**Public marketplace (MP)** — additive to v1; see D-027
- MP1 Public landing at `/{locale}` with hero search, featured listings and browse-by-city; replaces the old dashboard redirect while a dashboard link remains in the header.
- MP2 `/{locale}/properties` search results with filters (city, unit type, bedrooms, furnished, price, occupancy); anonymous users see only `public_listings`.
- MP3 `/{locale}/properties/[slug]` listing detail: gallery, specifications, map, share buttons, WhatsApp deep link and enquiry form.
- MP4 Enquiry form submits to `listing_enquiries` anonymously for publicly listed units only; a confirmation is shown and no lead data is readable by the public.
- MP5 Org enquiry inbox at `/{locale}/listings/enquiries` with status tracking, scoped to the member's accessible buildings.
- MP6 Opt-in fields: building/unit `is_listed_publicly` flags, listing title/description, unit slug, `listing_images` rows and the WhatsApp number from the org's integration config. These are database/API fields only — there is no admin UI yet for editing listing copy, flags or images; the WhatsApp number is set in the platform organization console. `e2e/setup.ts` seeds a representative public listing for tests.
- MP7 SEO: server-rendered pages, `generateMetadata`, Open Graph/Twitter cards, JSON-LD `Residence` with an `Offer`, `sitemap.ts`, `robots.ts` and stable slugs.
- MP8 Sharing: WhatsApp, X, Facebook and copy-link buttons; rich previews for every listing. Saved listings, social login, auto-posting and embeddable widgets are deferred.

## 9. Reports and analytics

Audience: A org admin, M manager, F accountant, O owner (own buildings only through RLS). All reports take parameters: date range, basis (accrual or cash), building, owner, unit type, currency, comparison (previous period, same period last year, budget). Every figure drills down to journal lines and then the source document.

| Report | Contents | Audience |
|---|---|---|
| Income statement (P&L) | Income less expenses by building, unit, owner, portfolio; company view follows R3 | A, F, O |
| Cash flow statement (direct) | Receipts by method, deposits, expenses, owner flows, payouts, opening and closing bank balance | A, F, O |
| Cash flow forecast | Next 3, 6, 12 months: scheduled charges, cheques in hand by expected clearing date, renewal probability, recurring expenses, owner payouts; base, conservative, optimistic scenarios; minimum balance warning | A, F, O |
| Balance sheet (management view) | Follows R4 | A, F |
| Trial balance, general ledger | Account balances and postings | A, F |
| Budget versus actual | Variance by account and building | A, F, O |
| Tax summary | Per organization tax settings (`TODO(verify)` rules per country) | A, F |
| Rent roll | Unit and room, tenant, dates, rent, deposit, paid-to date, status | A, M, F, O |
| Aged receivables | 0-30, 31-60, 61-90, 90+ days by tenant | A, M, F, O |
| Collection report | Billed versus collected, rate, average days to pay, by building and collector | A, M, F |
| Tenant ledger and statement | Charges, payments, credits, deposit | A, M, F |
| Cheque register and pipeline | By status, due this week and month, bounced, amount at risk | A, M, F, O |
| Deposit liability | Held balances, pending refunds, deductions | A, F, O |
| Write-offs and bad debt | With reasons and approvers | A, F |
| Owner statement and payout history | Section 7.8 | A, F, O |
| Owner portfolio summary and building comparison | KPIs per building side by side | A, O |
| Occupancy and vacancy | Physical and economic occupancy, days vacant, vacancy loss | A, M, O |
| Lease expiry and renewals | By month, renewal rate, rent change | A, M, O |
| Maintenance cost and performance | Cost per unit, resolution times, repeat issues, vendor scorecard | A, M, O |
| Utilities | Consumption and recharge recovery | A, M, F |
| Sub-letting performance | Room revenue versus whole-unit rent, room occupancy | A, M, O |
| Reconciliation | Bank, cheque, unallocated payments | A, F |
| Audit and exceptions | Waived fees, rent edits, reversals, backdated postings | A |

**KPI definitions** (implement once in SQL functions plus `src/lib/kpi.ts`; every screen and report must use them):

| KPI | Definition |
|---|---|
| GPR | Rent of all rentable units and rooms at lease or default rate for the period |
| Vacancy loss | GPR of vacant days |
| EGI | GPR less vacancy loss, concessions and bad debt, plus other income |
| NOI | EGI less operating expenses (excluding financing, depreciation, owner distributions) |
| Expense ratio | Operating expenses divided by EGI |
| Physical occupancy | Occupied units (or rooms) divided by rentable units (or rooms) |
| Economic occupancy | Rent collected divided by GPR |
| Collection rate | Cleared payments against charges due in the period, divided by charges due |
| Average days to pay | Average days from due date to clearing date |
| Net yield | Annualized NOI divided by property value (optional input) |
| Revenue per sqm | Rent income divided by rentable area |
| Renewal rate | Leases renewed divided by leases expiring |
| Turnover rate | Leases ended and not renewed divided by total leases |
| Maintenance cost per unit | Maintenance expense divided by units |
| Arrears ratio | Overdue balance divided by monthly billing |
| Deposit coverage | Deposits held divided by unpaid receivables |

**Dashboards**
- Org admin: occupancy, expected versus collected, overdue, cheques due this week, leases expiring in 90 days, open maintenance, 12-month collection chart; league tables by building and manager; revenue concentration; collector performance; renewal pipeline; rent versus market (user-entered benchmarks). Phase 2: risk scoring, churn prediction, anomaly detection, natural-language questions over the reporting views.
- Owner: occupancy, collected versus expected, arrears, NOI year to date, upcoming cheques, open maintenance, expiring leases, next payout, yield.
- Platform operator (aggregated, no tenant personal data): organizations, units under management, active users, adoption, MRR, churn, job and delivery health.

**Report engine.** SQL functions and views over `journal_lines` and operational tables, returning rows plus totals, run under the user's RLS context. Heavy views are materialized and refreshed on schedule and after period close. Output: on-screen tables and charts, PDF (bilingual, branded), Excel, CSV. Saved parameter sets (`report_definitions`) and scheduled email delivery (`scheduled_reports`, pg_cron plus Edge Function). Period close freezes snapshots (`report_snapshots`). Multi-currency reports convert with dated `fx_rates` and show the rate source.

## 10. White-label, notifications and localization

**White-label**
- Branding from `org_branding`, applied as CSS variables (`--brand-primary`, `--brand-secondary`, font family) in the root layout; logo and app name in header, emails and PDFs.
- Custom domains: organization adds a domain, CNAME is verified, domain attached through the hosting provider's API. Middleware maps host to organization (also supports `{slug}.yourapp.com`).
- Terminology overrides: dictionary merged over default translations (for example lease versus tenancy contract).
- Plans and feature flags per plan (analytics, owner portal, tenant portal, custom domain, branded app); limits by unit count; `usage_snapshots` feed billing.
- Super-admin console (`(platform)` route group, platform_admin only): create organizations, set plan and limits, impersonate with audit trail, usage and health, manage market packs.
- Phase 2: branded Expo builds from a per-organization config file through EAS in CI.

**Public marketplace sharing.** Listing detail pages render WhatsApp, X, Facebook and copy-link share actions and emit Open Graph/Twitter metadata for link previews. The WhatsApp deep link and the card's contact number use the `whatsapp` phone configured in the organization's integration config; there is no hard-coded global number. Saved listings, social login, auto-posting and embeddable widgets are out of scope for this surface.

**Notifications.** Events enqueue rows in `notification_outbox`; an Edge Function on a short schedule sends with retries. Channels: in-app, email, web push, WhatsApp, SMS behind a `Notifier` interface. Templates per organization, event, channel and locale. Respect tenant language and quiet hours. Listing enquiries create org-scoped lead rows for the inbox; they do not enqueue notification events.

| Event | Recipient | Default timing |
|---|---|---|
| Rent due | Tenant | 5 and 1 days before |
| Rent overdue | Tenant, manager | Day 1, then weekly |
| Cheque due for deposit | Accountant | 3 days before |
| Cheque bounced | Manager, accountant | Immediately |
| Lease expiring | Manager, tenant | 90, 60, 30 days |
| Tenant ID or document expiring | Manager | 60 and 30 days |
| Maintenance update | Requester | On status change |
| Payment received | Tenant | Immediately, receipt attached |
| Owner statement issued, payout made | Owner | Immediately |
| Expense needs owner approval | Owner | Immediately |

**Localization**
- Locales `en` and `ar`; Arabic is the default tenant language. Full RTL, bilingual PDFs, locale-aware number, currency and date formatting.
- Gregorian dates by default with optional Hijri secondary display; weekend days come from the market pack.
- Market pack (Qatar seed): ID types (QID, passport, GCC ID), registration labels, weekend (Friday and Saturday), currency QAR, tax defaults, notice periods, holidays, contract templates. All legal, tax and registration values are `TODO(verify)` placeholders until reviewed by local counsel.

## 11. Non-functional requirements and testing

**Non-functional**
- Performance: lists and dashboards under 1 second at p95 for 5,000 units per organization; server-side pagination and filtering; indexes on `(org_id, ...)`.
- Availability: 99.5% target at launch; point-in-time recovery enabled; quarterly restore test.
- Security: RLS on every table, encrypted ID numbers, private storage with signed URLs, MFA for admin roles, rate limiting on auth and public endpoints, audit log, dependency scanning, secrets only in environment management. The `listing-images` bucket is the documented public-read exception (D-026). Rate limiting on marketplace enquiries is deferred (D-027).
- Privacy: data minimization for ID copies, retention settings per organization, export and deletion workflows, data processing agreement template.
- Accessibility: WCAG 2.1 AA targets, keyboard navigation, mobile-first layouts for caretaker, tenant and owner screens.
- Observability: error tracking (Sentry or equivalent), structured logs, job failure alerts, uptime check.

**Testing**
- pgTAP: every RLS policy, exclusion constraints, triggers, journal balance, period locks, RPC functions, ownership model rules R1 to R6, plus `20261119000002_public_marketplace.sql` (`supabase/tests/0004_public_marketplace_test.sql`): anon reads only `public_listings`, anon inserts only for opted-in units, no anon lead reads, org isolation for lead reads and the public `listing-images` bucket flag.
- Vitest: money, schedule generation (including rounding remainder), allocation, KPI functions, Zod schemas, plus `src/lib/marketplace.ts` (slug generation, filter parsing, money formatting, share/WhatsApp links) and `src/lib/marketplace-seo.ts` (JSON-LD and OG metadata).
- Playwright (run in `en` and `ar`): onboarding, bulk property setup, lease with 4 cheques, clear and bounce flow, partial payment and receipt, deposit deduction and refund, sub-letting (both modes), tenant portal, owner portal and statement issue, period close, white-label domain and branding, plus `e2e/marketplace.spec.ts` (browse, filter, detail, enquiry).
- CI (GitHub Actions): lint, typecheck, unit, `supabase db reset` plus `supabase test db`, e2e. Cross-tenant access tests are mandatory for every new table.

**Seed data** (`supabase/seed.sql`): one demo organization (Qatar, QAR) with a `self` owner and two `managed` owners; 3 buildings with 10 floors and about 200 units, some with rooms; tenants (Arabic and English names), active and expired leases, cheques in every status, partial payments, deposits with deductions, expenses (one pending owner approval), maintenance requests, a closed period and an issued statement. Users for every role with documented demo credentials (local only).

## 12. Milestones (build order)

Each milestone ends with its Definition of Done (DoD). Do not proceed until it passes.

### M0 Foundation
- [ ] Initialize repo: Next.js 15, TypeScript strict, pnpm, ESLint, Prettier, Tailwind, shadcn/ui, next-intl (en, ar), Vitest, Playwright, CI pipeline.
- [ ] `supabase init`; migration `0001_core`; extensions; helper functions; access token hook; base RLS for org tables; `set_updated_at` and `audit_trigger`.
- [ ] Auth: sign up, sign in, invite and accept, password reset, MFA for admin roles; organization creation wizard (creates org, branding row, default chart of accounts, self owner, market pack selection).
- [ ] App shell: RTL-aware layout, organization switcher, language switcher, role-based navigation, branding variables from `org_branding`.
- [ ] Libraries: `money`, `dates`, `hijri`, `rbac`, `crypto`, Supabase clients.
- **DoD:** a new user can create an organization, invite a manager, switch language to Arabic with correct RTL, and pgTAP proves cross-organization isolation for all tables so far.

### M1 Property core
- [ ] Migration `0002_property`; owners (ownership model, fee config), buildings, floors, units, rooms CRUD with RLS and tests.
- [ ] Bulk floor and unit generation; Excel and CSV import with dry-run; building access assignment for managers and caretakers.
- [ ] Stacking view; unit detail page.
- **DoD:** import a file with 3 buildings and 200 units in one run; manager sees only assigned buildings; owner login sees only their own buildings (read-only).

### M2 Leasing
- [ ] Migration `0003_tenancy`; tenants (encrypted ID numbers), leases, terms, occupants, triggers (room versus unit, sub-let rules, unit status).
- [ ] RPCs: `activate_lease`, `generate_lease_charges`, `terminate_lease`, `renew_lease`; lease workflow UI; Mode A and Mode B sub-letting.
- [ ] Contract PDFs (ar and en) and signed copy upload; expiry alerts.
- **DoD:** acceptance criteria 3 and 6 in section 13 pass; schedule generation is idempotent and covered by Vitest and pgTAP.

### M3 Finance and ledger
- [ ] Migrations `0004_finance`, `0006_ledger` (core parts: accounts, periods, journals, lines, owner ledger); seed chart of accounts; `post_journal` and balance triggers.
- [ ] RPCs: `record_payment`, cheque functions, deposit functions, expense functions, `reverse_journal`, `mark_overdue_and_late_fees`; receipts with gapless numbering and bilingual PDF.
- [ ] UI: payments, allocation screen, cheque register board, deposits, expenses, tenant statement, journals and trial balance viewer, period close.
- **DoD:** acceptance criteria 4, 5, 7 and 8 pass; every journal balances (database enforced); closed periods reject postings; ownership rules R1 to R6 covered by pgTAP.

### M4 Operations, portals and notifications
- [ ] Migrations `0005_ops`, `0008_system`; maintenance, vendors, meters, inspections, documents.
- [ ] Notification outbox, Edge Function sender, templates, reminder jobs (pg_cron).
- [ ] Tenant portal; PWA (manifest, offline shell, web push).
- **DoD:** tenant sees only their own data (tested); reminders and cheque alerts fire from the scheduler; move-in and move-out inspection feeds a deposit deduction.

### M5 Reporting, owners and analytics
- [ ] Migration `0007_reporting_owners`; owner statements, payouts, expense approvals, owner portal.
- [ ] KPI functions; reports for P&L (company and owner views), cash flow (actual), balance sheet, rent roll, aged receivables, collection, cheque pipeline, deposit liability, occupancy and vacancy, lease expiry, maintenance cost; PDF and Excel export; dashboards for admin and owner; drill-down to journal lines.
- [ ] Phase 2 items (separate PR, after v1 pilot): forecast and scenarios, budgets, bank import and reconciliation, scheduled reports, multi-currency consolidation.
- **DoD:** acceptance criteria 9 to 14 pass; KPI values match across dashboard, reports and statements.

### M6 White-label and platform
- [ ] Custom domain flow and host-to-organization middleware; branding editor; terminology overrides.
- [ ] `plans`, `subscriptions`, `usage_snapshots`; feature flags; super-admin console with audit-logged impersonation.
- **DoD:** two organizations on two domains show different branding and cannot see each other's data; a plan flag hides a gated module.

### M7 Hardening and pilot
- [ ] Security review (RLS audit, storage policies, secrets, rate limits), performance pass with 5,000-unit synthetic organization, backup and restore test, error tracking and alerts.
- [ ] Documentation (admin guide, runbook), onboarding import templates, pilot with one customer.
- **DoD:** all acceptance criteria pass; load and restore tests documented in `docs/`.

### M8 Public marketplace (additive)
- [x] Migration `20261119000002_public_marketplace.sql`: opt-in flags, listing metadata, `listing_images`, `listing_enquiries`, `public_listings` view, definer helpers, RLS and the public `listing-images` bucket; generated types updated.
- [x] Public routes: `/{locale}` landing, `/{locale}/properties` search, `/{locale}/properties/[slug]` detail, `/{locale}/listings/enquiries` org inbox.
- [x] SEO: `generateMetadata`, JSON-LD, Open Graph/Twitter cards, `sitemap.ts`, `robots.ts`.
- [x] Sharing: WhatsApp/X/Facebook/copy-link and org-configured WhatsApp enquiry deep link.
- [x] Tests: pgTAP RLS, Vitest helpers and metadata, Playwright browse/filter/detail/enquiry.
- [x] Deviations recorded in `docs/DECISIONS.md` (D-026, D-027).
- **DoD:** an anonymous visitor can browse and enquire only on opted-in vacant units; an org member sees only their own leads; public SEO URLs are crawlable.
- **Deferred:** admin UI for listing flags/copy/images, saved listings, social login, auto-posting, embeddable widgets and rate limiting on the enquiry endpoint.

## 13. Acceptance criteria for v1

1. A new organization can be created, branded and populated with 3 buildings, 10 floors and 200 units through import in under 30 minutes.
2. Two organizations cannot read or modify each other's data, proven by automated tests on every table.
3. Activating a 12-month lease with 4 cheque installments generates the correct charges, cheque list and deposit charge; re-running generation creates no duplicates.
4. Recording a payment with partial allocation updates charge statuses, produces a numbered bilingual receipt and appears on the tenant statement.
5. A bounced cheque reopens its charge, notifies the right users and allows a replacement cheque.
6. A room can be leased separately; a whole-unit lease on the same unit is rejected while room leases are active, and the reverse; a sub-let needs manager approval and respects capacity.
7. A deposit balance cannot go negative and a refund requires approval.
8. Every journal balances; closing a month prevents backdated postings; reopening is restricted and audited.
9. The income statement for any building ties exactly to its journal lines and every figure drills down to its source document.
10. The cash flow closing balance equals the reconciled bank balance (reconciliation tooling may be phase 2; before that, equals the ledger bank account balance).
11. For a `managed` owner, an issued statement shows only cleared rent, reconciles to the owner ledger, is locked after issue, and is visible only to that owner; the company P&L shows only the management fee for that owner's buildings.
12. For a `self` owner, company P&L shows rental income and property expenses; mixed organizations (both models) report correctly on both views.
13. KPI values are identical on dashboards, reports and statements.
14. An owner user cannot access any report row outside their own buildings, proven by automated tests.
15. Arabic RTL renders correctly on every screen and in every PDF; the tenant portal shows only the tenant's own data.

**Public marketplace (additive)**

16. An anonymous visitor can browse and filter listings in both `en` and `ar`, open a detail page with crawlable metadata and submit an enquiry only for an opted-in vacant unit; no tenant or internal financial data is exposed.
17. An anonymous visitor cannot read any lead row and cannot enquire on a private or occupied unit; an org member sees only leads for buildings they can access, proven by pgTAP cross-tenant tests.
18. Listing detail URLs are unique, server-rendered, present in the sitemap and shared with working WhatsApp/X/Facebook/copy-link actions using the organization's configured WhatsApp number.

## 14. Open items (ask the owner; do not guess)

| ID | Item |
|---|---|
| O1 | Production hosting and data residency: hosted Supabase region versus self-hosted in a Gulf-region cloud |
| O2 | ID number encryption mechanism: Supabase Vault or pgsodium columns versus application-level envelope encryption |
| O3 | WhatsApp Business and SMS providers; sender approvals for the target country |
| O4 | Legal review of Qatar contract, notice and deposit templates and registration labels in the market pack |
| O5 | Tax and invoicing rules per country; default tax rate and whether residential rent is exempt |
| O6 | Accountant review of ownership model rules R1 to R6 before production |
| O7 | Payment gateway for phase 2 and local card schemes |
| O8 | Pricing and plan limits; branded mobile build add-on |
| O9 | Pilot customer data format for import templates |
| O10 | Whether v1 owner statements need per-building or per-owner-only granularity for fee calculation |
