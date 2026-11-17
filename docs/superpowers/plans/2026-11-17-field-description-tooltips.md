# Field Description Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every form field's help text out of the space below its input and into a shadcn tooltip on an info icon beside the label.

**Architecture:** Add one shadcn `Tooltip` primitive and teach the shared `FormLabel` an optional `description` prop that renders the icon + tooltip. Domain forms then move their existing `FormDescription` children into that prop and drop the `FormDescription` component entirely. One shared change, then a mechanical migration.

**Tech Stack:** Next.js 15 / React 19, react-hook-form, Radix UI, lucide-react, Tailwind, vitest (type/static checks only).

**Spec:** `docs/superpowers/specs/2026-11-17-field-description-tooltips-design.md`

## Global Constraints

- Preserve all help text verbatim — no copy, translation-key or schema changes.
- Use shadcn components from `@/components/ui` only; introduce no raw HTML form controls.
- Do not modify `opencode.json` (pre-existing uncommitted user change).
- Do not change `Label` or other UI primitives beyond what Task 1 specifies.
- Existing hidden `<input type="hidden">` fields are out of scope.

## Review Focus

- **Tooltip trigger rendered inside `<label>`** — invalid interactive nesting and clicking the icon focuses the input; expected: trigger is a sibling of the `<label>` in the DOM. Pinned in Task 1 verification.
- **Info button inside a `<form>`** — expected: `type="button"` so hovering/clicking never submits. Pinned in Task 1 verification.
- **Dangling `aria-describedby`** — expected: `FormControl` no longer references a removed description id; error message linking still works. Pinned in Task 1 verification.
- **A field lost its description in migration** — expected: every former `FormDescription` child becomes a `FormLabel description={…}` with the same expression. Pinned in Task 2 verification.
- **Tooltip unreachable by keyboard** — expected: Radix trigger is a focusable button showing the tooltip on focus. Pinned in Task 2 spot-check step.

---

### Task 1: Shared form primitives and shadcn tooltip

**Files:**
- Modify: `package.json` (add `@radix-ui/react-tooltip`)
- Create: `src/components/ui/tooltip.tsx`
- Modify: `src/components/ui/form.tsx`

**Interfaces:**
- Consumes: existing `Label` (`@/components/ui/label`), `Button` (`@/components/ui/button`), `cn` (`@/lib/utils`), lucide `Info`.
- Produces: `FormLabel` accepting `description?: React.ReactNode` in addition to its current props; `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` exported from `@/components/ui/tooltip`; `FormDescription` removed from `@/components/ui/form`.

- [ ] **Step 1: Install the Radix tooltip primitive**

Run: `pnpm add @radix-ui/react-tooltip`
Expected: dependency added to `package.json` and `pnpm-lock.yaml`; no other files changed.

- [ ] **Step 2: Create `src/components/ui/tooltip.tsx`**

Follow the existing `src/components/ui/*.tsx` house style (`"use client"`, `React.forwardRef`, `cn` merge). Export `TooltipProvider = TooltipPrimitive.Provider`, `Tooltip = TooltipPrimitive.Root`, `TooltipTrigger = TooltipPrimitive.Trigger`, and a `TooltipContent` that portals `TooltipPrimitive.Content` with `sideOffset = 4` and surface/body typography classes drawn from the project's Tailwind tokens (e.g. `bg-surface-container-high text-on-surface font-body-sm text-body-sm rounded-xl px-3 py-2 shadow-lg`). No arrow, no animation variant.

- [ ] **Step 3: Extend `FormLabel` in `src/components/ui/form.tsx`**

Signature: `React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { description?: React.ReactNode }>`. Destructure `description` out of props. Render a `div` with `mb-2.5 flex items-center gap-1.5` containing (a) the existing `Label` with `ref`, `htmlFor={formItemId}`, `mb-0`, the error colour and the caller's `className`, and (b) when `description` is non-null, a `TooltipProvider`-wrapped `Tooltip` whose `TooltipTrigger` uses `asChild` with a shadcn `Button` (`variant="ghost"`, `size="icon"`, `type="button"`, `aria-label` naming it as more information, `className="size-4"`) containing `<Info />`, and whose `TooltipContent` is `description`. The trigger must be a sibling of `Label`, not a descendant.

- [ ] **Step 4: Fix `FormControl` and remove `FormDescription`**

In `useFormField`, drop `formDescriptionId`. In `FormControl`, set `aria-describedby={error ? formMessageId : undefined}`. Delete the `FormDescription` component and remove it from the export list.

- [ ] **Step 5: Verify Task 1**

Note: `pnpm typecheck` is intentionally deferred to Task 2 — domain forms still import the removed
`FormDescription` until then. Use static checks here.
Run: `grep -n 'formDescriptionId\|<p' src/components/ui/form.tsx`
Expected: no `formDescriptionId`; only `FormMessage`'s `<p>`.
Run: `grep -n 'type="button"\|TooltipProvider\|<Label' src/components/ui/form.tsx`
Expected: `type="button"`, one `TooltipProvider`, and a `<Label` sibling (not nested inside a button or label).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/ui/tooltip.tsx src/components/ui/form.tsx
git commit -m "feat(ui): show field descriptions in label tooltips"
```

### Task 2: Migrate every domain form to the description prop

**Files:**
- Modify all 19 files containing `<FormDescription`:
  `src/components/domain/{tenant-form,maintenance-form,organization-settings-form,building-access,lease-form,cheque-table,meter-form,bulk-forms,building-form,import-form,payment-form,inspection-form,deposit-card,invite-form,org-form,branding-form,expense-form,document-upload-form}.tsx`

**Interfaces:**
- Consumes: `FormLabel description={…}` from Task 1.
- Produces: no `FormDescription` references anywhere in `src/`.

- [ ] **Step 1: Migrate each field**

For each `<FormDescription>{EXPR}</FormDescription>`, move `EXPR` verbatim into the matching `<FormLabel description={EXPR}>` and delete the `<FormDescription>` element. For `<FormLabel className="…">`, keep the className. For `branding-form.tsx` (`customDomain`), move the whole multi-line expression including the domain-status suffix into the prop. Remove `FormDescription` from each file's `@/components/ui/form` import block.

- [ ] **Step 2: Verify migration is complete**

Run: `grep -rn 'FormDescription' src || true`
Expected: no output.
Run: `git diff --stat`
Expected: only the 19 domain form files (plus Task 1 files) changed; no translation/message files touched.

- [ ] **Step 3: Verify behaviour**

Run: `pnpm typecheck && pnpm test && pnpm lint`
Expected: all pass.
Spot-check one rendered form: hover and keyboard-focus the info icon to see the exact original help text; confirm clicking it neither submits the form nor focuses the input; confirm no help text remains under any input.

- [ ] **Step 4: Commit**

```bash
git add src/components/domain
git commit -m "refactor(forms): move help text into label tooltips"
```
