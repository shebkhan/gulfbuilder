# Platform Org Management Design

Goal: let a platform admin manage an organization's reference lookups, Telegram
integration config and general settings from the platform console.

## Scope

- Platform console only (`/platform/organizations/[id]`).
- Lookups are per organization. Categories: `unit_type`, `expense_category`,
  `maintenance_category`, `payment_method_label`, `charge_type_label`.
- Payment methods and charge types stay Postgres enums. Only their display
  labels are editable via lookup rows.
- Telegram config is per organization: bot token, bot name, chat ID, enabled.
- General settings are the fields already editable in `/settings/organization`.

## Data model

`org_lookups`: `id`, `org_id`, `category`, `code`, `label`, `sort_order`,
`is_active`, `created_at`, `updated_at`, `created_by`; unique on
`(org_id, category, code)`. RLS: org members read, org_admin writes own org.

`org_integrations`: `id`, `org_id`, `provider`, `config` (jsonb), timestamps,
`created_by`; unique on `(org_id, provider)`. RLS: org_admin reads/writes own
org. Platform actions use the service-role client behind `is_platform_admin`.

## UI

Three new cards on the org detail page: Organization settings, Lookups,
Telegram. The lookups card is a client component with category tabs and inline
add/edit/delete. Bot token is a password input; an empty value on save keeps
the stored token and the UI shows a masked placeholder.

## Behavior

- All mutations go through server actions guarded by `platformAdmin()`, Zod
  validated, audit logged, and followed by `revalidatePath` on the org page.
- Invalid enum-label codes are rejected by the schema.
- Deleting a lookup is a hard delete (no external references to lookup rows).
- Telegram dispatch wiring to read the per-org token is out of scope; the
  stored config is for admin management only for now.

## Tests

- pgTAP: RLS isolation, cross-org write denial, unique constraint.
- Vitest: lookup/integration schemas and the shared org settings mapper.
