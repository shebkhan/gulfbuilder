"use client";

import { ArrowRightLeft, Landmark, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { BuildingTenantPicker } from "@/components/domain/building-tenant-picker";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { toFormData } from "@/lib/form-data";
import type { BuildingOption } from "@/lib/tenant-picker";
import { formatMoney } from "@/lib/money";
import { registerChequeSchema, replaceChequeSchema } from "@/schemas/cheques";
import {
  bounceChequeAction,
  clearChequeAction,
  depositChequeAction,
  registerChequeAction,
  replaceChequeAction,
  type ChequeState,
} from "@/server/actions/cheques";

export type ChequeItem = {
  id: string;
  cheque_no: string;
  bank_name: string | null;
  amount_minor: number;
  currency: string;
  cheque_date: string;
  status: "received" | "deposited" | "cleared" | "bounced" | "returned" | "replaced";
  bounce_reason: string | null;
  tenant: { id: string; full_name: string } | null;
  lease: { id: string; lease_no: string } | null;
};

type LeaseOption = { id: string; lease_no: string; tenant_id: string };

type RegisterValues = {
  tenantId: string;
  leaseId: string;
  chequeNo: string;
  bankName: string;
  amount: string;
  currency: string;
  chequeDate: string;
  notes?: string;
};

type ReplaceValues = {
  oldChequeId: string;
  chequeNo: string;
  bankName: string;
  amount: string;
  currency: string;
  chequeDate: string;
  notes?: string;
};

export function ChequeTable({
  cheques,
  buildings,
  leases,
  writable = false,
  locale = "en",
}: {
  cheques: ChequeItem[];
  buildings: BuildingOption[];
  leases: LeaseOption[];
  writable?: boolean;
  locale?: string;
}) {
  const t = useTranslations("cheques");
  const tCommon = useTranslations("common");
  const errors = t.raw("errors") as Record<string, string>;
  const help = t.raw("help") as Record<string, string>;

  const [isPending, startTransition] = useTransition();
  const [statusState, setStatusState] = useState<ChequeState>({});
  const [openRegister, setOpenRegister] = useState(false);
  const [bounceTarget, setBounceTarget] = useState<ChequeItem | null>(null);
  const [bounceReason, setBounceReason] = useState("");
  const [replaceTarget, setReplaceTarget] = useState<ChequeItem | null>(null);

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerChequeSchema),
    defaultValues: {
      tenantId: "",
      leaseId: "",
      chequeNo: "",
      bankName: "",
      amount: "",
      currency: "QAR",
      chequeDate: new Date().toISOString().slice(0, 10),
      notes: "",
    },
  });

  const [registerState, registerDispatch, registerPending] = useActionState<ChequeState, FormData>(
    async (prev, formData) => {
      const res = await registerChequeAction(prev, formData);
      if (res.ok) {
        setOpenRegister(false);
        registerForm.reset();
      }
      return res;
    },
    {},
  );

  const replaceForm = useForm<ReplaceValues>({
    resolver: zodResolver(replaceChequeSchema),
    defaultValues: {
      oldChequeId: "",
      chequeNo: "",
      bankName: "",
      amount: "",
      currency: "QAR",
      chequeDate: new Date().toISOString().slice(0, 10),
      notes: "",
    },
  });

  const [replaceState, replaceDispatch, replacePending] = useActionState<ChequeState, FormData>(
    async (prev, formData) => {
      const res = await replaceChequeAction(prev, formData);
      if (res.ok) setReplaceTarget(null);
      return res;
    },
    {},
  );

  const selectedTenant = registerForm.watch("tenantId");
  const filteredLeases = selectedTenant
    ? leases.filter((l) => l.tenant_id === selectedTenant)
    : leases;

  const handleDeposit = (chequeId: string) => {
    setStatusState({});
    const formData = new FormData();
    formData.set("chequeId", chequeId);
    startTransition(async () => setStatusState(await depositChequeAction({}, formData)));
  };

  const handleClear = (chequeId: string) => {
    setStatusState({});
    const formData = new FormData();
    formData.set("chequeId", chequeId);
    startTransition(async () => setStatusState(await clearChequeAction({}, formData)));
  };

  const handleBounceSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!bounceTarget) return;
    setStatusState({});
    const formData = new FormData();
    formData.set("chequeId", bounceTarget.id);
    if (bounceReason) formData.set("reason", bounceReason);
    startTransition(async () => {
      const res = await bounceChequeAction({}, formData);
      setStatusState(res);
      if (res.ok) {
        setBounceTarget(null);
        setBounceReason("");
      }
    });
  };

  const openReplace = (cheque: ChequeItem) => {
    replaceForm.reset({
      oldChequeId: cheque.id,
      chequeNo: "",
      bankName: cheque.bank_name ?? "",
      amount: (cheque.amount_minor / 100).toFixed(2),
      currency: "QAR",
      chequeDate: new Date().toISOString().slice(0, 10),
      notes: "",
    });
    setReplaceTarget(cheque);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "cleared":
        return "success";
      case "deposited":
        return "warning";
      case "bounced":
        return "danger";
      case "received":
        return "info";
      default:
        return "neutral";
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {statusState.error ? (
          <p
            role="alert"
            className="w-full rounded-xl bg-error-container p-3 font-body-sm text-body-sm text-on-error-container"
          >
            {errors[statusState.error] ?? statusState.error}
          </p>
        ) : null}
        {writable ? (
          <Button onClick={() => setOpenRegister(true)} className="flex items-center gap-2">
            <Plus className="size-4" />
            {t("registerCheque")}
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
        {cheques.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Landmark className="size-12 text-on-surface-variant/40" />
            <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-start font-body-sm text-body-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                  <th className="p-4 text-start">{t("chequeNo")}</th>
                  <th className="p-4 text-start">{t("bank")}</th>
                  <th className="p-4 text-start">{t("tenant")}</th>
                  <th className="p-4 text-start">{t("lease")}</th>
                  <th className="p-4 text-start">{t("dueDate")}</th>
                  <th className="p-4 text-start">{t("status")}</th>
                  <th className="p-4 text-end">{t("amount")}</th>
                  {writable ? <th className="p-4 text-center">{t("actions")}</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {cheques.map((cheque) => (
                  <tr
                    key={cheque.id}
                    className="transition-colors hover:bg-surface-container-low/50"
                  >
                    <td className="p-4 font-mono font-semibold text-primary">{cheque.cheque_no}</td>
                    <td className="p-4 text-on-surface">{cheque.bank_name || "—"}</td>
                    <td className="p-4 font-medium text-on-surface">
                      {cheque.tenant ? (
                        <Link
                          href={`/tenants/${cheque.tenant.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {cheque.tenant.full_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-on-surface-variant">
                      {cheque.lease ? (
                        <Link
                          href={`/leases/${cheque.lease.id}`}
                          className="font-mono hover:text-primary hover:underline"
                        >
                          {cheque.lease.lease_no}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-on-surface-variant" dir="ltr">
                      {cheque.cheque_date}
                    </td>
                    <td className="p-4">
                      <Badge variant={getStatusBadgeVariant(cheque.status)}>
                        {t(`statuses.${cheque.status}` as never)}
                      </Badge>
                      {cheque.bounce_reason ? (
                        <p className="mt-0.5 text-[11px] text-error">{cheque.bounce_reason}</p>
                      ) : null}
                    </td>
                    <td className="p-4 text-end font-semibold text-on-surface">
                      {formatMoney(BigInt(cheque.amount_minor), cheque.currency, locale)}
                    </td>
                    {writable ? (
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {cheque.status === "received" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDeposit(cheque.id)}
                              disabled={isPending}
                            >
                              {t("deposit")}
                            </Button>
                          ) : null}
                          {cheque.status === "deposited" ? (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleClear(cheque.id)}
                                disabled={isPending}
                              >
                                {t("clear")}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setBounceTarget(cheque);
                                  setBounceReason("");
                                }}
                                disabled={isPending}
                              >
                                {t("bounce")}
                              </Button>
                            </>
                          ) : null}
                          {cheque.status === "bounced" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openReplace(cheque)}
                              disabled={isPending}
                            >
                              <ArrowRightLeft className="me-1 size-3.5" />
                              {t("replace")}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register modal */}
      <Dialog open={openRegister} onOpenChange={setOpenRegister}>
        <DialogContent className="max-w-[38.4rem]">
          <DialogHeader>
            <DialogTitle>{t("register")}</DialogTitle>
          </DialogHeader>

          <Form {...registerForm}>
            <form
              onSubmit={registerForm.handleSubmit((values) => registerDispatch(toFormData(values)))}
              noValidate
              className="mt-4 flex flex-col gap-4"
            >
              <FormField
                control={registerForm.control}
                name="tenantId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("tenant")}</FormLabel>
                    <BuildingTenantPicker
                      buildings={buildings}
                      value={field.value}
                      onChange={(tenantId) => {
                        field.onChange(tenantId);
                        registerForm.setValue("leaseId", "");
                      }}
                    />
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="leaseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("lease")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectLease")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredLeases.map((lease) => (
                          <SelectItem key={lease.id} value={lease.id}>
                            {lease.lease_no}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={registerForm.control}
                  name="chequeNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel description={help.chequeNo}>{t("chequeNo")}</FormLabel>
                      <FormControl>
                        <Input {...field} dir="ltr" />
                      </FormControl>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel description={help.bank}>{t("bank")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={registerForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel description={help.amount}>
                        {t("amount")} ({tCommon("currency")})
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="any" {...field} dir="ltr" />
                      </FormControl>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="chequeDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel description={help.chequeDate}>{t("dueDate")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} dir="ltr" />
                      </FormControl>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {registerState.error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
                >
                  {errors[registerState.error] ?? registerState.error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setOpenRegister(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={registerPending}>
                  {t("registerCheque")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Bounce reason modal */}
      {bounceTarget ? (
        <Dialog open onOpenChange={(next) => !next && setBounceTarget(null)}>
          <DialogContent className="max-w-[33.6rem]">
            <DialogHeader>
              <DialogTitle>{t("bounceTitle", { no: bounceTarget.cheque_no })}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleBounceSubmit} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bounce-reason">{t("bounceReason")}</Label>
                <Input
                  id="bounce-reason"
                  value={bounceReason}
                  onChange={(event) => setBounceReason(event.target.value)}
                  placeholder={t("bounceReasonPlaceholder")}
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setBounceTarget(null)}
                  disabled={isPending}
                >
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" variant="destructive" disabled={isPending}>
                  {t("confirmBounce")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Replace modal */}
      {replaceTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              {t("replaceTitle", { no: replaceTarget.cheque_no })}
            </h2>
            <Form {...replaceForm}>
              <form
                onSubmit={replaceForm.handleSubmit((values) => replaceDispatch(toFormData(values)))}
                noValidate
                className="mt-4 flex flex-col gap-4"
              >
                <FormField
                  control={replaceForm.control}
                  name="oldChequeId"
                  render={({ field }) => <input type="hidden" {...field} />}
                />
                <FormField
                  control={replaceForm.control}
                  name="chequeNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel description={help.newChequeNo}>{t("newChequeNo")}</FormLabel>
                      <FormControl>
                        <Input {...field} dir="ltr" />
                      </FormControl>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={replaceForm.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel description={help.newBankName}>{t("newBankName")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={replaceForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel description={help.amount}>
                          {t("amount")} ({tCommon("currency")})
                        </FormLabel>
                        <FormControl>
                          <Input type="number" step="any" {...field} dir="ltr" />
                        </FormControl>
                        <LocalizedFormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={replaceForm.control}
                    name="chequeDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel description={help.chequeDate}>{t("dueDate")}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} dir="ltr" />
                        </FormControl>
                        <LocalizedFormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {replaceState.error ? (
                  <p
                    role="alert"
                    className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
                  >
                    {errors[replaceState.error] ?? replaceState.error}
                  </p>
                ) : null}

                <div className="flex items-center justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => setReplaceTarget(null)}>
                    {tCommon("cancel")}
                  </Button>
                  <Button type="submit" disabled={replacePending}>
                    {t("createReplacement")}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      ) : null}
    </>
  );
}
