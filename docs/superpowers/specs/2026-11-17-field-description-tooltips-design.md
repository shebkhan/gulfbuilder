# Field description tooltips

## Problem

Form help text is rendered as `<FormDescription>` beneath each input (`src/components/ui/form.tsx`,
~80 usages across ~20 domain form components). This makes forms taller and pushes the validation
message further from the control. The description belongs with the label, revealed on demand.

## Goal

Every labelled field shows its help text in a tooltip on an info icon next to the label. No
description text is rendered below the input. All controls involved are shadcn components; no raw
HTML controls are introduced.

## Design

- Add a shadcn `Tooltip` at `src/components/ui/tooltip.tsx` (Radix `Tooltip` primitives) and add
  `@radix-ui/react-tooltip` to dependencies. Style `TooltipContent` with the project's existing
  surface tokens, matching the other files in `src/components/ui`.
- Extend `FormLabel` in `src/components/ui/form.tsx` with an optional `description: React.ReactNode`
  prop. When present, `FormLabel` renders a wrapper containing:
  - the existing `Label` (still `htmlFor={formItemId}`, still error-coloured), and
  - a shadcn tooltip whose trigger is a shadcn `Button` (`variant="ghost"`, `size="icon"`,
    `type="button"`, accessible name) showing a lucide `Info` icon. `TooltipContent` is the
    description.
  - The trigger is a **sibling** of `<label>`, not a descendant, so interactive content is not
    nested inside a label and clicking the icon does not focus the input.
- Update `FormControl` so `aria-describedby` no longer references the removed
  `formDescriptionId`; it keeps linking `formMessageId` when there is an error.
- Delete the `FormDescription` component and its export from `form.tsx`.
- In every domain form component, move the existing description text from
  `<FormDescription>{…}</FormDescription>` into `<FormLabel description={…}>`, remove the
  `FormDescription` element, and drop its import. Preserve the exact help text (usually
  `labels.help.*` / `help.*` / `t("…hint")`) — no copy changes.

## Constraints

- No new translation keys, schema changes, server actions or migrations.
- Do not touch `opencode.json` (pre-existing uncommitted user change).
- Do not introduce raw `<button>`, `<label>`, `<input>`, etc.; use shadcn components from
  `@/components/ui`. Hidden `<input type="hidden">` fields that already exist are out of scope.
- Do not change `Label` itself or the styling of other UI primitives.

## Verification

- `pnpm typecheck`, `pnpm test`, `pnpm lint` all pass.
- Grep confirms no `FormDescription` usage remains and no description text still renders beneath
  an input.
- Spot-check a rendered form: info icon beside the label, tooltip shows the original help text on
  hover and keyboard focus, and clicking the icon does not submit the form or focus the input.

## Out of scope

- Replacing existing hidden inputs or non-form native markup elsewhere in the app.
- Redesigning tooltips used outside form labels.
- Animating or repositioning labels.
