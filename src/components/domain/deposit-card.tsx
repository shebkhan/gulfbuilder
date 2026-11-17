"use client";

import { MinusCircle, PiggyBank, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { toFormData } from "@/lib/form-data";
import { formatMoney } from "@/lib/money";
import { deductionSchema, refundSchema } from "@/schemas/deposits";
import {
  applyDeductionAction,
  refundDepositAction,
  type DepositState,
} from "@/server/actions/deposits";

export type DepositItem = {
  id: string;
  amount_minor: number;
  held_minor: number;
  deducted_minor: number;
  refunded_minor: number;
  currency: string;
  notes: string | null;
  tenant: { id: string; full_name: string } | null;
  lease: { id: string; lease_no: string } | null;
};

type DeductionValues = {
  depositId: string;
  amount: string;
  currency: string;
  reason: string;
  chargeId?: string;
};

type RefundValues = {
  depositId: string;
  amount: string;
  currency: string;
  reason?: string;
};

export function DepositCard({
  deposits,
  writable = false,
  locale = "en",
}: {
  deposits: DepositItem[];
  writable?: boolean;
  locale?: string;
}) {
  const t = useTranslations("deposits");
  const tCommon = useTranslations("common");
  const errors = t.raw("errors") as Record<string, string>;
  const help = t.raw("help") as Record<string, string>;
  const [deductTarget, setDeductTarget] = useState<DepositItem | null>(null);
  const [refundTarget, setRefundTarget] = useState<DepositItem | null>(null);

  const deductForm = useForm<DeductionValues>({
    resolver: zodResolver(deductionSchema),
    defaultValues: {
      depositId: "",
      amount: "",
      currency: "QAR",
      reason: "",
      chargeId: "",
    },
  });

  const [deductState, deductDispatch, deductPending] = useActionState<DepositState, FormData>(
    async (prev, formData) => {
      const res = await applyDeductionAction(prev, formData);
      if (res.ok) setDeductTarget(null);
      return res;
    },
    {},
  );

  const refundForm = useForm<RefundValues>({
    resolver: zodResolver(refundSchema),
    defaultValues: { depositId: "", amount: "", currency: "QAR", reason: "" },
  });

  const [refundState, refundDispatch, refundPending] = useActionState<DepositState, FormData>(
    async (prev, formData) => {
      const res = await refundDepositAction(prev, formData);
      if (res.ok) setRefundTarget(null);
      return res;
    },
    {},
  );

  const openDeduct = (deposit: DepositItem) => {
    deductForm.reset({
      depositId: deposit.id,
      amount: "",
      currency: "QAR",
      reason: "",
      chargeId: "",
    });
    setDeductTarget(deposit);
  };

  const openRefund = (deposit: DepositItem, balance: number) => {
    refundForm.reset({
      depositId: deposit.id,
      amount: (balance / 100).toFixed(2),
      currency: "QAR",
      reason: "",
    });
    setRefundTarget(deposit);
  };

  return (
    <>
      {deposits.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-hairline bg-surface-container-lowest p-12 text-center shadow-card">
          <PiggyBank className="size-12 text-on-surface-variant/40" />
          <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {deposits.map((deposit) => {
            const balance = deposit.held_minor - deposit.deducted_minor - deposit.refunded_minor;
            const currentBalance = BigInt(balance);
            const canAct = writable && currentBalance > 0n;

            return (
              <Card key={deposit.id} className="flex flex-col justify-between">
                <CardBody className="p-5">
                  <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3">
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                        {deposit.tenant?.full_name || "—"}
                      </span>
                      {deposit.lease ? (
                        <Link
                          href={`/leases/${deposit.lease.id}`}
                          className="font-mono text-sm text-primary hover:underline"
                        >
                          {deposit.lease.lease_no}
                        </Link>
                      ) : null}
                    </div>
                    <Badge variant={currentBalance > 0n ? "success" : "neutral"}>
                      {currentBalance > 0n ? t("activeEscrow") : t("settled")}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-surface-container-low p-2">
                      <span className="block text-[11px] uppercase tracking-wider text-on-surface-variant">
                        {t("held")}
                      </span>
                      <span className="font-semibold text-on-surface">
                        {formatMoney(BigInt(deposit.held_minor), deposit.currency, locale)}
                      </span>
                    </div>
                    <div className="rounded-lg bg-surface-container-low p-2">
                      <span className="block text-[11px] uppercase tracking-wider text-error">
                        {t("deducted")}
                      </span>
                      <span className="font-semibold text-error">
                        {formatMoney(BigInt(deposit.deducted_minor), deposit.currency, locale)}
                      </span>
                    </div>
                    <div className="rounded-lg bg-surface-container-low p-2">
                      <span className="block text-[11px] uppercase tracking-wider text-on-surface-variant">
                        {t("refunded")}
                      </span>
                      <span className="font-semibold text-on-surface">
                        {formatMoney(BigInt(deposit.refunded_minor), deposit.currency, locale)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl bg-primary-fixed/30 p-3">
                    <span className="font-label-md text-label-md font-semibold text-on-surface">
                      {t("balance")}
                    </span>
                    <span className="font-headline-sm text-headline-sm font-bold text-primary">
                      {formatMoney(currentBalance, deposit.currency, locale)}
                    </span>
                  </div>

                  {canAct ? (
                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-hairline pt-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openDeduct(deposit)}
                        className="flex items-center gap-1.5"
                      >
                        <MinusCircle className="size-3.5" />
                        {t("applyDeduction")}
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => openRefund(deposit, balance)}
                        className="flex items-center gap-1.5"
                      >
                        <RotateCcw className="size-3.5" />
                        {t("refund")}
                      </Button>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Deduction modal */}
      {deductTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              {t("applyDeduction")}
            </h2>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              {t("tenantLine", {
                tenant: deductTarget.tenant?.full_name ?? "—",
                lease: deductTarget.lease?.lease_no ?? "—",
              })}
            </p>
            <Form {...deductForm}>
              <form
                onSubmit={deductForm.handleSubmit((values) => deductDispatch(toFormData(values)))}
                noValidate
                className="mt-4 flex flex-col gap-4"
              >
                <FormField
                  control={deductForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel description={help.deductAmount}>{t("amount")}</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" {...field} dir="ltr" />
                      </FormControl>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={deductForm.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel description={help.deductReason}>{t("reason")}</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} placeholder={t("deductReasonPlaceholder")} />
                      </FormControl>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />

                {deductState.error ? (
                  <p
                    role="alert"
                    className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
                  >
                    {errors[deductState.error] ?? deductState.error}
                  </p>
                ) : null}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setDeductTarget(null)}>
                    {tCommon("cancel")}
                  </Button>
                  <Button type="submit" variant="destructive" disabled={deductPending}>
                    {t("applyDeduction")}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      ) : null}

      {/* Refund modal */}
      {refundTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("refund")}</h2>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              {t("tenantLine", {
                tenant: refundTarget.tenant?.full_name ?? "—",
                lease: refundTarget.lease?.lease_no ?? "—",
              })}
            </p>
            <Form {...refundForm}>
              <form
                onSubmit={refundForm.handleSubmit((values) => refundDispatch(toFormData(values)))}
                noValidate
                className="mt-4 flex flex-col gap-4"
              >
                <FormField
                  control={refundForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel description={help.refundAmount}>{t("amount")}</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" {...field} dir="ltr" />
                      </FormControl>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={refundForm.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel description={help.refundReason}>{t("reason")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder={t("refundReasonPlaceholder")}
                        />
                      </FormControl>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />

                {refundState.error ? (
                  <p
                    role="alert"
                    className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
                  >
                    {errors[refundState.error] ?? refundState.error}
                  </p>
                ) : null}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setRefundTarget(null)}>
                    {tCommon("cancel")}
                  </Button>
                  <Button type="submit" disabled={refundPending}>
                    {t("refund")}
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
