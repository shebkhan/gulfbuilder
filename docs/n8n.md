# n8n integration for Gulf Property

## 1. Create an owner API key

1. Sign in as an org_admin.
2. Go to Settings → Integrations.
3. Create a key with role scope `owner` and the owner's ID.
4. Copy the key (shown once).

## 2. Configure n8n-mcp (optional, for managing workflows from OpenCode)

Set env vars before starting OpenCode:

```sh
export N8N_API_URL="https://n8n-zhyu.srv1456548.hstgr.cloud"
export N8N_API_KEY="<your n8n api key>"
```

## 3. Gulf API base URL

`https://<your-gulf-app>/api/v1/owner/...` with header `X-API-Key: <key>`.

Endpoints: dashboard, units/summary, cheques/due?days=, leases?expiring_days=, receivables, statements, payouts, approvals, maintenance, documents, digest.

## 4. Import workflows

Import `docs/n8n/daily-owner-digest.json` and `docs/n8n/owner-query-agent.json` into n8n. Set credentials: Gulf API key (Header Auth) and Telegram bot.

## 5. Daily digest

Schedule trigger 07:00 Asia/Qatar → GET /owner/digest → format → send per owner.

## 6. Admin endpoints

Admin/manager/accountant keys use `/api/v1/admin/*`: dashboard, units/summary, cheques/due, leases, receivables, maintenance, approvals, digest. An admin daily digest template is shipped as `docs/n8n/daily-admin-digest.json`.

## 7. Notification dispatch (automated delivery)

Import `docs/n8n/notification-dispatch.json`. It POSTs to `/api/notifications/dispatch` every 5 minutes.

Credential: HTTP Header Auth with header `Authorization` and value `Bearer <NOTIFICATION_CRON_SECRET>` (the env var on the Gulf app). The route returns `{ claimed, sent, failed, skipped }`; inspect the execution log or the Settings → Notifications health panel for failures. Set the workflow to active once the credential is saved. Retry/backoff is handled server-side in `src/server/notifications/backoff.ts`.