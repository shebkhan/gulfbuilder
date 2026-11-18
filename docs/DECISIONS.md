# Decisions

Deviations from `docs/SPEC.md` and `docs/CLAUDE.md`, newest first. Each entry names the spec
section it departs from and why.

## 2026-11-18

**D-025 · `src/app/manifest.ts` is dynamic so the installed PWA reads branding.**
SPEC §10 lists an installable, white-labeled PWA, and the manifest was a static metadata object. It
now reads the request host from the `x-forwarded-host`/`host` headers and passes it directly to
`resolveBrand()` at request time — the middleware matcher excludes dotted paths, so `x-brand` is
never set on `/manifest.webmanifest` and `getBrand()` would always return null there — so `name`,
`short_name`, `theme_color`, `background_color` and the logo icon reflect the organization's
`org_branding` instead of one hard-coded identity. Caveat: browsers expect fixed pixel sizes for
raster manifest icons, so the bundled SVG may remain the installed icon. Reason: an installed PWA must carry the
tenant's name, colors and logo, not a single global brand.

**D-024 · Branded print documents keep the HTML `window.print()` sheet instead of `@react-pdf/renderer`.**
SPEC §3 names `@react-pdf/renderer` as the PDF stack and §8 A2/M5 call for bilingual PDFs, but D-014
already established printable HTML for the four print routes. The new `logoUrl` on `PrintDocument`
and the four print pages reuse that A4 sheet rather than introducing a renderer dependency, so the
logo appears through the same browser print path. Reason: follow the existing code and keep Arabic
layout in the app's RTL stack; cost is still no server-side PDF file.

**D-023 · The new `branding` Storage bucket is public instead of private with signed URLs.**
SPEC §3, §6 and §11 (and `docs/CLAUDE.md`) call for private buckets with `{org_id}/` prefixes and
signed URLs. The `branding` bucket is marked public with public `select`; paths are
`{org_id}/logo/...` and `{org_id}/favicon/...`, and `insert`/`update`/`delete` still require
`authenticated`, the prefix matching `auth_org()` and `auth_role() = 'org_admin'`. Reason: login,
notification email, the PWA manifest and print documents render the logo outside a signed-in,
RLS-scoped session, so they need a stable public URL; the tenant boundary is enforced on writes.

**D-022 · Global `theme_presets` has no `org_id`, matching the `market_packs` exception.**
SPEC §5/§6 and `docs/CLAUDE.md` require `org_id`, RLS and org-scoped indexes on every business table.
`theme_presets` is a super-admin catalog of colors and font, like `market_packs`: RLS allows
`authenticated` select, and all writes go through the service-role client in the `(platform)` route
group with no client write policies. Organizations snapshot the selected values into `org_branding`
rather than referencing a shared row. Reason: presets are platform-wide baselines, not tenant data;
this follows the existing `market_packs` precedent.

**D-021 · n8n integration uses per-owner API keys with service-role scoping.**
Owners (and staff) get read-only API keys (`gulf_…`, stored hashed) for n8n. `/api/v1/owner/*`
and `requireApiContext` accept `X-API-Key`, resolve identity via the `api_keys` table, and use
the service-role client with mandatory application scoping (owner → owned buildings/leases).
RLS is bypassed on this transport because Supabase cannot issue per-user JWTs for API keys;
mitigated by key hashing, expiry/revocation, scopes, and cross-tenant tests. n8n-mcp is wired
into `opencode.json` via `{env:N8N_API_URL}` / `{env:N8N_API_KEY}`. Two workflows (daily digest
and owner query agent) are shipped as importable JSON and created live in the user's cloud n8n.

**D-020 · An API layer sits in front of Supabase; supersedes D-010.**
Supabase remains the database, auth provider and object store, and RLS remains the gate on every
query. The web app calls `src/server/services/*` in-process (no HTTP hop between server components
and the API), while mobile and future consumers call the versioned `/api/v1` route handlers that
wrap the same services. Mobile authenticates through `/api/v1/auth/*`, so it never talks to
PostgREST directly; the web keeps its `@supabase/ssr` cookie session. Responses are explicit Zod
schemas rather than raw table rows, so a column rename cannot silently break a client. An ESLint
override forbids importing `@supabase/*` from pages, components and server actions, which is what
keeps the boundary from eroding. D-010's three rules (location, secrets, shape) still apply; only
"no API layer" is reversed. Reason: the mobile client needs a stable, versioned contract and a
single place for business logic.

## 2026-11-17

**D-019 · `web-push` and Resend, Twilio and Telegram services are introduced for delivery.**
The notification delivery core (1A) needs the `web-push` npm dependency plus the Resend, Twilio
and Telegram services to actually send outbox rows. WhatsApp remains unimplemented: the channel
value stays in the check constraints for existing data, but no adapter ships in this milestone.

**D-018 · The service-role client is imported by `src/server/notifications/*` and
`src/app/api/notifications/dispatch/*` instead of only Edge Functions and `(platform)`.**
The dispatch worker must drain every organization's `notification_outbox` rows and claim them via
`claim_notification_batch()`, which is granted to `service_role` only. The chosen trigger is a
Next.js route rather than an Edge Function, so those modules hold the service-role client. The key
never leaves the server, per D-007's rule.

## 2026-11-16

**D-017 · No sender for `notification_outbox` while automation is excluded.**
SPEC §9 enqueues notifications and an Edge Function sends them on a schedule. The owner
excluded scheduled jobs and Edge Function senders from v1, so business events still write
outbox rows and the staff notification screen can display them, but nothing delivers them.
Adding a sender later needs no schema change — only the worker and its retries.

**D-016 · Tenant and owner self-scope policies.**
Migration 0022 rewrote the select policies on finance, ledger, ops and reporting tables so
tenant members see only rows on leases whose tenant has their `user_id`, and owners only
rows on buildings they own or statements/payouts/approvals they own. Staff keep
organization-wide reads; tightening managers to assigned buildings would empty their
screens because the live database has no `member_building_access` rows. The portals rely
on these policies as the single gate and add no application-level scoping.

**D-015 · Platform admins live in a separate table, not in `member_role`.**
SPEC §4 lists `platform_admin` as a role, but platform operators have no organization
membership. Adding the value to `member_role` would force a synthetic organization and
expose them to every `org_id = auth_org()` policy. The `(platform)` route group instead
checks `is_platform_admin()` against `platform_admins` and uses the service-role client
below the layout, with an audit row for every mutation.

**D-014 · Printable HTML instead of `@react-pdf/renderer`.**
SPEC §8 A2 and M5 call for bilingual PDFs. The four print routes render an A4 sheet
(`@page { size: A4; margin: 15mm }`) with a browser print button and a link to the other
language; the user saves as PDF from the print dialog. This avoids a rendering dependency
and keeps Arabic layout in the app's existing RTL stack. Cost: no server-side PDF file,
so nothing writes `pdf_path` or attaches a generated contract to a lease.

**D-013 · Lease contract PDFs and signed-copy upload move to M4.**
SPEC M2 includes bilingual contract PDFs and uploading the signed copy. Both need object storage and
the documents table that arrive with `0005_ops` in M4, so building them now would mean a second
storage pass later. `leases.contract_path` stays unused until then. M2's DoD is unaffected: criteria
3 and 6 are about schedule generation and room-versus-unit rules, not documents.

**D-012 · `charges` is created in `0003_tenancy`, not `0004_finance`.**
M2's DoD requires `activate_lease` to generate a charge schedule, and `generate_lease_charges`
cannot write to a table that does not exist yet. The table ships with SPEC §5.4's shape unchanged, so
M3 adds only the finance tables around it. `payments` and allocations arrive in M3; until then
charges carry `paid_minor = 0`.

**D-011 · Tenant ID encryption moves into Postgres via Vault + pgcrypto (resolves O2/D13).**
`src/lib/crypto.ts` held the AES key in the Next process, so only the web app could ever write a
tenant and a mobile client would need a server round-trip through an endpoint that owns the secret.
`encrypt_id`/`decrypt_id` are now `security definer` SQL functions reading `id_encryption_key` from
Supabase Vault, with plaintext exposed only through a role-gated view so RLS still governs access.
Chosen over pgsodium columns to stay on plain Postgres primitives. The TS module and its test are
deleted in M2; `ID_ENCRYPTION_KEY` leaves `.env.local`.

**D-010 · No API layer; Supabase is the client-facing API (clarifies D10).**
PostgREST already exposes every table under RLS, plus the RPCs, so a native client can call it
directly with `supabase-js`. Three rules apply from M2 onward: business rules that more than one
client must execute live in SQL functions; secrets never appear in a request path; values cross the
wire in the table's own shape (minor units + currency, ISO timestamps, UUIDs). Presentation work
(CSV parsing, PDFs, form messages) stays in the client. Vendor posture is Postgres-portable, not
database-agnostic. Full reasoning in `docs/superpowers/specs/2026-11-16-mobile-ready-foundation-design.md`.

**D-009 · `auth_org()`/`auth_role()` fall back to the database when the token hook is absent.**
SPEC 6 expects `org_id` and `org_role` to arrive in the JWT from a custom access token hook, but the
hook is a dashboard toggle. Until it is enabled, a fresh token has neither claim and every
`org_id = auth_org()` policy filtered to zero rows. The helpers now prefer the claims and fall back
to `profiles.active_org_id` plus the matching `org_members` row, both read in a `security definer`
function that only ever looks at `auth.uid()`. Enabling the hook still wins and removes the extra
lookup. `create_organization()` sets `active_org_id`, and existing memberships were backfilled.

**D-008 · pgTAP is not run for new milestones (owner instruction).**
`supabase test db` needs Docker, which is not installed on the build machine; the existing suite is
run ad hoc through the Supabase MCP inside a rolled-back transaction. From M1 onward, verification
is manual SQL probes plus the app's own tests. SPEC 11's pgTAP requirement stays unmet by design.

**D-007 · Team invites use the service-role key.**
`auth.admin.inviteUserByEmail` only exists on the service-role client. Authorisation is checked
first against the caller's session (`org_admin`), and the membership row is then written with that
same user-scoped client so RLS still applies. The key never leaves the server.

**D-006 · Design tokens come from the mockups, not DESIGN.md prose.**
`docs/design_brief/*/code.html` embed a Material 3 palette (`primary #795919`, `surface #fcf9f5`,
`secondary #156c47`). DESIGN.md's Colour section lists different values (`#C9A15A` gold,
`#F5F5F3` canvas). The code is the more concrete artefact and all four screens agree with it, so
`tailwind.config.ts` implements the mockup tokens. Revisit if the owner prefers the prose palette.

**D-005 · Database writes go through the Supabase CLI, not MCP.**
The project MCP server is configured `read_only=true` (it is a good safety default for exploration).
Schema changes and seeds run through `supabase` CLI against the linked project.

**D-004 · `can_access_building()` is deferred to `0002_property`.**
SPEC section 6 places it with the core helpers, but it joins `buildings` and `owners`-by-user;
`buildings` does not exist until 0002.

**D-003 · `audit_log` is created in `0001_core`, not `0008_system`.**
SPEC 5.8 creates it last. M0's Definition of Done requires audit triggers on the core tables, so
the table and `audit_trigger()` ship with the first migration. `0008` will only add notification
and platform tables.

**D-002 · `owners` is created in `0001_core`, not `0002_property`.**
SPEC 5.2 puts it with the property tables. `create_organization()` must create the organization's
self owner in the same transaction (SPEC 7.7 R6); splitting them would leave the RPC unable to
satisfy that rule. Property tables stay in 0002.

**D-001 · Development runs directly on hosted Supabase (owner decision).**
Levels with SPEC D11. Consequence: there is no `supabase db reset` and `supabase/seed.sql` is not
replayed automatically. pgTAP runs with `supabase test db --linked`, generated types with
`supabase gen types typescript --linked`, and migrations are applied with `supabase db push --linked`.
A local Docker stack is reintroduced for the M7 load and restore tests.
