# Cheque image upload + OCR-assisted registration — Implementation Plan

**Goal:** Allow uploading a cheque photo during registration, parse fields via OpenAI vision, and pre-fill the form for review. Add a reusable drag-and-drop uploader.

**Architecture:** Server action uploads image to a private `cheques` Supabase Storage bucket, calls OpenAI vision with a strict JSON prompt, validates with zod, returns parsed fields + suggested tenant. `cheques` table stores `image_path`/`payee_raw`. Generic `FileDropzone` component shared across features.

**Tech Stack:** Next.js 15, Supabase (Postgres + Storage), OpenAI Chat Completions (vision), zod, react-hook-form, next-intl, vitest.

**Spec:** see conversation design (cheque image upload + OCR).

## Global Constraints
- Roles allowed: org_admin, manager, accountant.
- Storage limits: 10 MB, image/jpeg, image/png, image/webp.
- Default OCR model: gpt-4o-mini (override via CHEQUE_OCR_MODEL).
- No new runtime dependencies (native drag-and-drop).

## Review Focus
- Handwritten amounts misread → user must review before submit.
- OpenAI failure must not block manual entry (image still stored).
- Tenant name matching must be case-insensitive and optional.
- Storage RLS must scope by org prefix.

## Tasks

### Task 1: DB migration + storage bucket
Files: create `supabase/migrations/20261119000003_cheque_images.sql`
- Add `image_path text`, `payee_raw text` to `cheques`.
- Update `register_cheque` and `replace_cheque` signatures to accept `p_image_path text default null`, `p_payee_raw text default null`.
- Create `cheques` bucket (private) + storage.objects RLS policies by org prefix.
- Apply migration via Supabase MCP.

### Task 2: OpenAI helper
Files: create `src/server/cheque-ocr.ts`, `src/server/cheque-ocr.test.ts`
- `parseChequeImage(buffer, mimeType): Promise<ParsedCheque | null>` calling OpenAI vision, returns zod-validated object or null.

### Task 3: Server action
Files: modify `src/server/actions/cheques.ts`
- Add `parseChequeImageAction(formData)` and `getChequeImageUrlAction`.
- Update `registerChequeAction`/`replaceChequeAction` to read `imagePath`/`payeeRaw` from formData and pass to RPC.

### Task 4: Schemas
Files: modify `src/schemas/cheques.ts`
- Add `imagePath`, `payeeRaw` optional to register/replace schemas.
- Add `ParsedChequeSchema`.

### Task 5: Generic FileDropzone
Files: create `src/components/ui/file-dropzone.tsx`
- Native drag-and-drop, single/multiple, preview, remove, size/type validation callbacks.

### Task 6: Form integration
Files: modify `src/components/domain/cheque-table.tsx`
- Add dropzone + "Scan cheque" button to `ChequeRegisterForm`; hidden `imagePath`; pre-fill fields; show suggested tenant.

### Task 7: i18n
Files: modify `messages/en.json`, `messages/ar.json`
- Add keys for scan/upload/parse errors.

### Task 8: Types
Files: modify `src/types/database.ts` (regen) or manual add columns.

### Task 9: Tests + verify
- Run vitest, typecheck.
```

Path: docs/superpowers/plans/2026-11-19-cheque-image-ocr.md. Let's write.<|end|><|start|><|start|>assistant to=write<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="content">
# Cheque image upload + OCR-assisted registration — Implementation Plan

**Goal:** Allow uploading a cheque photo during registration, parse fields via OpenAI vision, and pre-fill the form for review. Add a reusable drag-and-drop uploader.

**Architecture:** Server action uploads image to a private `cheques` Supabase Storage bucket, calls OpenAI vision with a strict JSON prompt, validates with zod, returns parsed fields + suggested tenant. `cheques` table stores `image_path`/`payee_raw`. Generic `FileDropzone` component shared across features.

**Tech Stack:** Next.js 15, Supabase (Postgres + Storage), OpenAI Chat Completions (vision), zod, react-hook-form, next-intl, vitest.

**Spec:** conversation design (cheque image upload + OCR).

## Global Constraints
- Roles allowed: org_admin, manager, accountant.
- Storage limits: 10 MB, image/jpeg, image/png, image/webp.
- Default OCR model: gpt-4o-mini (override via CHEQUE_OCR_MODEL).
- No new runtime dependencies (native drag-and-drop).

## Review Focus
- Handwritten amounts misread → user must review before submit.
- OpenAI failure must not block manual entry (image still stored).
- Tenant name matching must be case-insensitive and optional.
- Storage RLS must scope by org prefix.

## Tasks

### Task 1: DB migration + storage bucket
- Create migration adding columns and updating RPCs; create bucket + policies; apply.

### Task 2: OpenAI helper
- `src/server/cheque-ocr.ts` + tests.

### Task 3: Server actions
- Add parse + signed URL actions; thread image path through register/replace.

### Task 4: Schemas
- Add image/payee fields + ParsedChequeSchema.

### Task 5: Generic FileDropzone
- `src/components/ui/file-dropzone.tsx`.

### Task 6: Form integration
- Update ChequeRegisterForm.

### Task 7: i18n + types
- messages + database types.

### Task 8: Verify
- vitest + typecheck.
