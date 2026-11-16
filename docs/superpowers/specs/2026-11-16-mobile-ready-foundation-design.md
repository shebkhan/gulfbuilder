# Mobile-ready foundation — design

Date: 2026-11-16
Status: approved by owner
Supersedes: SPEC O2 (open item), clarifies SPEC D10, SPEC D13

## Context

The owner asked whether the platform should become "server API based" so a mobile app can be
built on the same foundation. Two answers were considered and one rejected.

**The database already is the API.** Supabase exposes every table through PostgREST, guarded by
the same RLS policies the web app relies on, plus the RPCs in `0001`–`0008`. A React Native client
using `supabase-js` with a user JWT reaches the same endpoints. No wrapper is required.

What *was* missing for a second client:

| Today | Why it blocks a mobile client |
|---|---|
| Validation and orchestration in `src/server/actions/*.ts` | Only callable from Next server actions; a mobile client would reimplement it and drift |
| `src/lib/crypto.ts` encrypts tenant ID numbers with `ID_ENCRYPTION_KEY` | The secret cannot ship to a client, so only the Next process can ever write a tenant |
| MFA gate in `(app)/layout.tsx` | A per-client UX gate; the data itself is protected by AAL |

## Decision 1 — no API layer

The web app keeps calling Supabase directly (server components for reads, server actions for
writes). A native client later calls Supabase directly too. No `/api/v1/*` façade, no OpenAPI
spec, no abstraction over the database.

Rejected alternative: route handlers wrapping every operation. It doubles serialisation, duplicates
auth, and slows M2–M7 by roughly a third for no capability the database lacks.

## Decision 2 — three standing rules

Recorded as D-010. These apply to all code from M2 onward.

1. **Rule of location.** A rule that more than one client must execute lives in the database as an
   RPC: state transitions, money arithmetic, multi-row writes. A server action parses input, calls
   the RPC, and revalidates. It does not contain the rule.
2. **Rule of secrets.** Encryption keys and the service-role key never appear in a request path.
   Anything needing them is a SQL function or a server-only module no client can reach.
3. **Rule of shape.** What crosses the wire is the table's own shape: integer minor units plus a
   currency code, ISO timestamps, UUIDs. No client-specific DTOs.

Presentation concerns stay in the client: CSV parsing for import, PDF rendering, form validation
messages. They are not business rules and never need a second implementation.

## Decision 3 — tenant ID encryption moves into Postgres

Resolves SPEC O2 and D13. Replaces `src/lib/crypto.ts`.

- The 32-byte key is stored once in **Supabase Vault** as `id_encryption_key`. It is never written
  to a migration, a `.env` file that is committed, or git.
- `encrypt_id(plaintext text) returns text` is `volatile` (random salt per call) and
  `decrypt_id(ciphertext text) returns text` is `immutable`. Both are `security definer`, set
  `search_path`, read the key from `vault.decrypted_secrets`, and use `pgcrypto`
  (`pgp_sym_encrypt`/`pgp_sym_decrypt`, AES-256). Ciphertext is stored as base64 text in the same
  column shape SPEC D13 specifies.
- Decryption is not exposed to `authenticated` directly. A role-gated view (or a function restricted
  to `org_admin`, `manager` and the tenant's own user) returns plaintext, so RLS still decides who
  may see whose ID.
- `src/lib/crypto.ts` and `src/lib/crypto.test.ts` are deleted in M2. They have no call sites today,
  and `ID_ENCRYPTION_KEY` is removed from `.env.local`.
- Key rotation: a second Vault secret plus a version tag in the ciphertext prefix; documented, not
  implemented until there is production data.

Both `pgcrypto` and `supabase_vault` are confirmed installed on the hosted project.

## Vendor posture

**Postgres-portable, not database-agnostic.** Authorization lives in 39 RLS policies and 15
functions; moving DB would mean rewriting the security model into application code and losing
enforcement. That is a deliberate trade, not an oversight.

To stay portable: prefer plain SQL over Supabase-proprietary features where a plain equivalent
exists (hence `pgcrypto` with Vault rather than pgsodium columns). Vault and Auth are Supabase
extensions; both run on self-hosted Supabase, so they add no new class of lock-in.

Revisit at M6: Realtime is the next proprietary dependency in line, if notifications use it.

## Out of scope

Mobile screens, push notifications, offline sync, a public/third-party API, and the PWA manifest
(SPEC says PWA in v1; the manifest does not exist yet — separate small task, not part of this
decision).

## Consequences

- **M2 onward** writes state transitions and money arithmetic as SQL functions. `activate_lease`,
  `generate_lease_charges`, `terminate_lease`, `renew_lease` already comply.
- **No change** to existing property code. `import_property_rows` already follows rule 1;
  `generate_units` already follows it.
- **Milestone count unchanged.** Slower per-feature authoring, but no added milestones.

## Verification

- A rolled-back SQL probe writes a tenant through the RPC and reads the plaintext back as
  `org_admin`, and fails as `caretaker` and as a foreign org.
- The ciphertext column contains no readable digits for the same row.
- `grep -r ID_ENCRYPTION_KEY src` returns nothing after M2.
- Vitest suite stays green; `pnpm typecheck` clean.
