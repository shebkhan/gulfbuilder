# Console organization provisioning

## Problem

`createOrganizationAction` in `src/server/actions/platform.ts` creates the organization,
branding and chart of accounts, but no membership, self-owner or profile link. A console-created
organization therefore has nobody who can act in it: the staff layout cannot resolve a role,
`auth_org()` returns nothing, and the owner portal has no owner row to read. The onboarding path
does all of this inside the `create_organization` RPC, but that RPC keys off `auth.uid()` and is
not callable on behalf of a platform admin through the service-role client.

## Goal

A console-created organization has the same initial provisioning as an onboarding-created one,
with the platform admin as its first `org_admin` and self-owner.

## Design

In `createOrganizationAction`, after the organization insert and before the audit write, add
three writes through the existing service-role client, using `ctx.userId` and the new org id:

1. **Profile.** Upsert `profiles` with `{ id, locale, created_by }` and `ignoreDuplicates: true`.
   Platform admins normally have a profile already, so this only fills the gap. Do **not** set
   `active_org_id` — the console has a separate audited "Switch active org" action, and
   auto-switching would silently change what the admin's staff workspace shows.
2. **Membership.** Insert `org_members` with `{ org_id, user_id, role: "org_admin", created_by }`.
   This gives the admin a role for `(app)/layout.tsx` and makes `auth_org()` resolve.
3. **Self-owner.** Insert `owners` with `{ org_id, name, user_id, is_company_self: true,
   ownership_model: "self", created_by }`. This mirrors the onboarding RPC and, unlike it, links
   `user_id`, so owner-scoped RLS can see the row.

Check the error result of each of the three new writes and return `fail("failed")` if any
fails; a partially provisioned org must not be reported as created. The existing `org_branding`
insert, `seed_chart_of_accounts` call and audit row stay as they are (unchecked), so this change
does not expand into a transaction or a refactor of the surrounding action.

## Constraints

- No migration, SQL RPC or `supabase db push` — all target tables and columns already exist.
- No new client, dependency, component or translation key.
- Do not change the onboarding RPC or any caller outside `createOrganizationAction`.

## Verification

Owner excluded automated test suites from v1. Verify with `pnpm lint` and `pnpm typecheck`.
The observable check is that a console-created org has exactly one `org_members` row with role
`org_admin`, one `owners` row with `is_company_self = true` and `user_id` set to the creator, and
a profile whose `active_org_id` is unchanged from before creation.

## Out of scope

- Adding a nominated user as the first owner instead of the acting admin.
- Changing the admin's active organization automatically.
- Backfilling membership/owner rows for organizations created before this change.
