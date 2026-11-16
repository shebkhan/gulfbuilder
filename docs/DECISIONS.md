# Decisions

Deviations from `docs/SPEC.md` and `docs/CLAUDE.md`, newest first. Each entry names the spec
section it departs from and why.

## 2026-11-16

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
