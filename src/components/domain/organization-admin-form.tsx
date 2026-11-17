"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createOrganizationAction,
  impersonateAction,
  recordUsageSnapshotAction,
  setOrganizationPlanAction,
  type PlatformState,
} from "@/server/actions/platform";

type PlanOption = {
  code: string;
  name: string;
};

function Feedback({ state, ok }: { state: PlatformState; ok: string }) {
  const t = useTranslations("platform");
  return (
    <>
      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
        >
          {t(`errors.${state.error}` as never)}
        </p>
      ) : null}
      {state.ok ? (
        <p
          role="status"
          className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
        >
          {ok}
        </p>
      ) : null}
    </>
  );
}

export function CreateOrganizationForm() {
  const t = useTranslations("platform");
  const [state, action, pending] = useActionState<PlatformState, FormData>(
    createOrganizationAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("createOrg")}</h2>
      <div>
        <Label htmlFor="orgName">{t("orgName")}</Label>
        <Input id="orgName" name="name" required minLength={2} />
      </div>
      <div className="grid gap-x-3 gap-y-6 sm:grid-cols-3">
        <div>
          <Label htmlFor="orgSlug">{t("orgSlug")}</Label>
          <Input
            id="orgSlug"
            name="slug"
            required
            pattern="[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?"
            dir="ltr"
          />
        </div>
        <div>
          <Label htmlFor="orgCountry">{t("country")}</Label>
          <Input
            id="orgCountry"
            name="countryCode"
            defaultValue="QA"
            maxLength={2}
            dir="ltr"
            required
          />
        </div>
        <div>
          <Label htmlFor="orgCurrency">{t("currency")}</Label>
          <Input
            id="orgCurrency"
            name="baseCurrency"
            defaultValue="QAR"
            maxLength={3}
            dir="ltr"
            required
          />
        </div>
      </div>
      <Feedback state={state} ok={state.orgId ? t("created") : ""} />
      {state.orgId ? (
        <Link
          href={`/platform/organizations/${state.orgId}`}
          className="font-body-sm text-body-sm text-primary underline"
        >
          {t("openOrg")}
        </Link>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("working") : t("create")}
      </Button>
    </form>
  );
}

export function OrganizationPlanForm({
  orgId,
  plans,
  current,
  currentFeatures,
}: {
  orgId: string;
  plans: PlanOption[];
  current: { planCode: string | null; status: string | null; periodEnd: string | null };
  currentFeatures: Record<string, boolean>;
}) {
  const t = useTranslations("platform");
  const [state, action, pending] = useActionState<PlatformState, FormData>(
    setOrganizationPlanAction,
    {},
  );
  const features = ["owner_portal", "tenant_portal", "analytics", "custom_domain"] as const;

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="orgId" value={orgId} />
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("plan.title")}</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{t("plan.hint")}</p>
      <div className="grid gap-x-3 gap-y-6 sm:grid-cols-3">
        <div>
          <Label htmlFor="planCode">{t("plan.plan")}</Label>
          <Select name="planCode" defaultValue={current.planCode ?? plans[0]?.code} required>
            <SelectTrigger id="planCode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.code} value={plan.code}>
                  {plan.name || plan.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="status">{t("plan.status")}</Label>
          <Select name="status" defaultValue={current.status ?? "active"} required>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["active", "trialing", "past_due", "cancelled"].map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="periodEnd">{t("plan.periodEnd")}</Label>
          <DatePicker
            id="periodEnd"
            name="periodEnd"
            defaultValue={current.periodEnd?.slice(0, 10) ?? ""}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="maxUnits">{t("plan.maxUnits")}</Label>
        <NumberField id="maxUnits" name="maxUnits" min={0} defaultValue={0} className="max-w-xs" />
      </div>
      <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
        <legend className="font-label-md text-label-md font-medium text-on-surface">
          {t("plan.features")}
        </legend>
        {features.map((feature) => (
          <div key={feature} className="flex items-center gap-2">
            <Checkbox
              id={`feature-${feature}`}
              name="features"
              value={feature}
              defaultChecked={currentFeatures[feature] === true}
            />
            <Label
              htmlFor={`feature-${feature}`}
              className="mb-0 font-body-sm normal-case tracking-normal text-on-surface"
            >
              {feature}
            </Label>
          </div>
        ))}
      </fieldset>
      <Feedback state={state} ok={t("plan.saved")} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("working") : t("save")}
      </Button>
    </form>
  );
}

export function UsageSnapshotForm({ orgId }: { orgId: string }) {
  const t = useTranslations("platform");
  const [state, action, pending] = useActionState<PlatformState, FormData>(
    recordUsageSnapshotAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="orgId" value={orgId} />
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("usage.record")}</h2>
      <div className="grid gap-x-3 gap-y-6 sm:grid-cols-4">
        <div>
          <Label htmlFor="takenOn">{t("usage.date")}</Label>
          <DatePicker id="takenOn" name="takenOn" required />
        </div>
        <div>
          <Label htmlFor="units">{t("usage.units")}</Label>
          <NumberField id="units" name="units" min={0} defaultValue={0} required />
        </div>
        <div>
          <Label htmlFor="users">{t("usage.users")}</Label>
          <NumberField id="users" name="users" min={0} defaultValue={0} required />
        </div>
        <div>
          <Label htmlFor="storageMb">{t("usage.storage")}</Label>
          <NumberField id="storageMb" name="storageMb" min={0} defaultValue={0} required />
        </div>
      </div>
      <Feedback state={state} ok={t("usage.saved")} />
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        {pending ? t("working") : t("save")}
      </Button>
    </form>
  );
}

export function ImpersonateButton({
  orgId,
  userId,
  name,
  locale,
}: {
  orgId: string;
  userId: string;
  name: string;
  locale: string;
}) {
  const t = useTranslations("platform");
  const [state, action, pending] = useActionState<PlatformState, FormData>(impersonateAction, {});

  return (
    <form action={action}>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending} title={state.error ?? ""}>
        {pending ? t("working") : t("impersonate")}
      </Button>
      {state.ok ? (
        <span role="status" className="font-body-sm text-body-sm text-secondary">
          {t("impersonated")}
        </span>
      ) : null}
      <span className="sr-only">{name}</span>
    </form>
  );
}
