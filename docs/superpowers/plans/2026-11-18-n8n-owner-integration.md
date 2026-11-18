# n8n Owner Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-owner API keys and owner-scoped read endpoints so n8n can run a daily digest and an on-demand Telegram chat bot for owners.

**Architecture:** New `api_keys` table + `requireApiKeyContext` merged into `requireApiContext` (X-API-Key). Owner endpoints under `/api/v1/owner/*` reuse `owner-portal.ts` scoping. n8n MCP config + workflow templates + live workflows.

**Tech Stack:** Next.js 15, Supabase, TypeScript strict, Zod, Vitest, n8n REST API.

**Spec:** docs/superpowers/specs/2026-11-18-n8n-owner-integration-design.md

## Global Constraints

- Money in minor units (bigint); never float.
- RLS on every table; cross-tenant tests required.
- No new npm deps unless noted in DECISIONS.md.
- All user-visible strings via next-intl.
- Generated DB types regenerated after migration.

## Review Focus

- API key hash collision / timing: compare with constant-time.
- Owner scoping must not leak another owner's buildings when ownerId resolved from key.
- Revoked/expired keys must 401.
- Digest endpoint must not include tenant PII beyond owner scope.
- n8n workflow credentials must not be committed.

---

### Task 1: Migration — api_keys table + RLS

**Files:**
- Create: `supabase/migrations/20261118000048_api_keys.sql`
- Test: `supabase/tests/api_keys_rls.sql` (pgTAP)

- [ ] **Step 1: Write migration**

```sql
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  user_id uuid not null references auth.users(id),
  role member_role not null,
  owner_id uuid references owners(id),
  name text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index on api_keys (org_id);
create index on api_keys (key_hash);
alter table api_keys enable row level security;
create policy api_keys_org_read on api_keys for select using (org_id = auth_org());
create policy api_keys_org_write on api_keys for all using (org_id = auth_org() and auth_role() in ('org_admin')) with check (org_id = auth_org());
```

- [ ] **Step 2: Apply migration via supabase db push --linked**
- [ ] **Step 3: Regenerate types: pnpm gen:types**
- [ ] **Step 4: Commit**

### Task 2: API key hashing + validation helper

**Files:**
- Create: `src/lib/api-keys.ts`
- Create: `src/lib/api-keys.test.ts`

- [ ] **Step 1: Write failing test for hash + verify**

```ts
import { describe, it, expect } from "vitest";
import { hashKey, verifyKey } from "./api-keys";
it("hashes and verifies", () => {
  const k = "gulf_abc123";
  const h = hashKey(k);
  expect(h).not.toBe(k);
  expect(verifyKey(k, h)).toBe(true);
  expect(verifyKey("gulf_wrong", h)).toBe(false);
});
```

- [ ] **Step 2: Run test (fail)**
- [ ] **Step 3: Implement**

```ts
import { createHash, timingSafeEqual } from "crypto";
export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
export function verifyKey(key: string, hash: string): boolean {
  const a = Buffer.from(hashKey(key));
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
export function generateKey(): { key: string; hash: string } {
  const raw = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const key = `gulf_${raw}`;
  return { key, hash: hashKey(key) };
}
```

- [ ] **Step 4: Run test (pass)**
- [ ] **Step 5: Commit**

### Task 3: requireApiKeyContext

**Files:**
- Modify: `src/lib/api/context.ts`

- [ ] **Step 1: Add requireApiKeyContext**

Resolve key from X-API-Key header or Authorization: ApiKey. Hash, look up via service role, check not revoked/expired, resolve owner_id if role owner. Return { supabase: serviceRoleClient, userId, orgId, role, ownerId }.

- [ ] **Step 2: Modify requireApiContext to try API key when no bearer token and header present.**
- [ ] **Step 3: Commit**

### Task 4: Owner-scoped service helpers for API

**Files:**
- Create: `src/server/services/owner-api.ts`

- [ ] **Step 1: Wrap owner-portal queries.** Functions take { supabase, orgId, ownerId, userId } and return the same shapes. Reuse getOwnerScope logic but by ownerId (buildings where owner_id = ownerId). Also add getOwnerUnitsSummary and getOwnerDigest.
- [ ] **Step 2: Commit**

### Task 5: Owner API routes

**Files:**
- Create: `src/app/api/v1/owner/dashboard/route.ts`
- Create: `src/app/api/v1/owner/units/summary/route.ts`
- Create: `src/app/api/v1/owner/cheques/due/route.ts`
- Create: `src/app/api/v1/owner/leases/route.ts`
- Create: `src/app/api/v1/owner/receivables/route.ts`
- Create: `src/app/api/v1/owner/statements/route.ts`
- Create: `src/app/api/v1/owner/payouts/route.ts`
- Create: `src/app/api/v1/owner/approvals/route.ts`
- Create: `src/app/api/v1/owner/maintenance/route.ts`
- Create: `src/app/api/v1/owner/documents/route.ts`
- Create: `src/app/api/v1/owner/digest/route.ts`

Each: GET → requireApiContext → check role owner → call service helper → route envelope, cache no-store.

- [ ] **Step 1: Create all route files.**
- [ ] **Step 2: typecheck.**
- [ ] **Step 3: Commit.**

### Task 6: API key management actions

**Files:**
- Create: `src/server/actions/api-keys.ts`
- Modify: org settings page to add UI (optional minimal: create/list/revoke). I'll add a simple page under settings.

- [ ] **Step 1: Server Actions: createApiKey, revokeApiKey, listApiKeys.**
- [ ] **Step 2: Minimal UI in settings/integrations.**
- [ ] **Step 3: Commit.**

### Task 7: n8n config + docs + templates

**Files:**
- Modify: `opencode.json` (add n8n mcp)
- Create: `docs/n8n.md`
- Create: `docs/n8n/daily-owner-digest.json`
- Create: `docs/n8n/owner-query-agent.json`

- [ ] **Step 1: Add n8n MCP config.**
- [ ] **Step 2: Write docs.**
- [ ] **Step 3: Create workflow JSON templates.**
- [ ] **Step 4: Commit.**

### Task 8: Live workflow creation in cloud n8n

- [ ] **Step 1: Use n8n REST API to create both workflows.**
- [ ] **Step 2: Verify via n8n_list_workflows / GET.**

### Task 9: Tests

- [ ] **Step 1: Vitest for api-keys.**
- [ ] **Step 2: Cross-tenant API tests.**
- [ ] **Step 3: Run lint + typecheck + test.**

### Task 10: DECISIONS.md entry D-021

- [ ] **Step 1: Append entry.**

---

Execution: I'll proceed task by task now.
