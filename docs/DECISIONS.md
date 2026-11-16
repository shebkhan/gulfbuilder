# Decisions

Deviations from `docs/SPEC.md` and `docs/CLAUDE.md`, newest first. Each entry names the spec
section it departs from and why.

## 2026-11-16

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
