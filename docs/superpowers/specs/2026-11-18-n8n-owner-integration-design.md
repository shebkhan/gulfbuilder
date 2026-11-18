# n8n Owner Integration Design

Date: 2026-11-18
Status: approved

## Goal

Let property owners query the Gulf platform and receive daily digests through n8n:
scheduled 07:00 Asia/Qatar per-owner digest (cheques due, units summary, lease expiry,
receivables, maintenance, approvals) plus an on-demand Telegram chat bot that answers
owner questions via an n8n AI agent calling Gulf API tools. Read-only.

## Architecture

Gulf remains system of record. It exposes a stable, owner-scoped, read-only API under
`/api/v1/owner/*` and authenticates callers with per-owner API keys. n8n owns scheduling,
delivery (email/Telegram), and the conversational agent. Two importable workflow templates
are shipped and also created live in the user's cloud n8n.

## Components

1. `api_keys` table (migration) + RLS + indexes.
2. `requireApiKeyContext` in `src/lib/api/context.ts` (X-API-Key path) merged into `requireApiContext`.
3. Owner read endpoints `/api/v1/owner/*` reusing `src/server/queries/owner-portal.ts` scoping.
4. API key management Server Actions + org settings UI.
5. n8n MCP config entry in `opencode.json`.
6. Workflow JSON templates in `docs/n8n/` and `docs/n8n.md`.
7. Live workflows created in cloud n8n via REST API.

## Auth

Key format `gulf_<random>` (shown once). Stored as SHA-256 hash. Validation uses service role.
Resolved identity: { orgId, userId, role, ownerId }. Owner role scoping reuses owner-portal
scoping by ownerId (buildings/leases/tenants owned).

Deviation D-021: API-key path uses service role with mandatory application scoping; RLS is
bypassed for this transport. Mitigated by hashing, expiry/revocation, scopes, cross-tenant
tests.

## Endpoints

- GET /api/v1/owner/dashboard
- GET /api/v1/owner/units/summary
- GET /api/v1/owner/cheques/due?days=
- GET /api/v1/owner/leases?expiring_days=
- GET /api/v1/owner/receivables
- GET /api/v1/owner/statements
- GET /api/v1/owner/payouts
- GET /api/v1/owner/approvals
- GET /api/v1/owner/maintenance
- GET /api/v1/owner/documents
- GET /api/v1/owner/digest

## Security

- Read-only scopes only.
- Cross-tenant tests: key from org A cannot read org B; owner key cannot read another owner's data.

## Open questions resolved

- Digest: 07:00 Asia/Qatar, per-owner.
- Chat: Telegram trigger.
- Delivery: templates + live creation.
