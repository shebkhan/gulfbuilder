"use client";

import { MinusCircle, PiggyBank, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
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
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<DepositState>({});

  const [deductTarget, setDeductTarget] = useState<DepositItem | null>(null);
  const [deductAmount, setDeductAmount] = useState("");
  const [deductReason, setDeductReason] = useState("");

  const [refundTarget, setRefundTarget] = useState<DepositItem | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const handleDeductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deductTarget) return;
    setState({});

    const formData = new FormData();
    formData.set("depositId", deductTarget.id);
    formData.set("amount", deductAmount);
    formData.set("reason", deductReason);

    startTransition(async () => {
      const res = await applyDeductionAction({}, formData);
      setState(res);
      if (res.ok) {
        setDeductTarget(null);
        setDeductAmount("");
        setDeductReason("");
      }
    });
  };

  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    setState({});

    const formData = new FormData();
    formData.set("depositId", refundTarget.id);
    formData.set("amount", refundAmount);
    if (refundReason) formData.set("reason", refundReason);

    startTransition(async () => {
      const res = await refundDepositAction({}, formData);
      setState(res);
      if (res.ok) {
        setRefundTarget(null);
        setRefundAmount("");
        setRefundReason("");
      }
    });
  };

  return (
    <>
      {state.error && (
        <div className="rounded-xl bg-error-container p-3 font-body-sm text-body-sm text-on-error-container">
          {state.error}
        </div>
      )}

      {deposits.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-hairline bg-surface-container-lowest p-12 text-center shadow-card">
          <PiggyBank className="size-12 text-on-surface-variant/40" />
          <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {deposits.map((dep) => {
            const currentBalance = BigInt(dep.held_minor - dep.deducted_minor - dep.refunded_minor);
            const canAct = writable && currentBalance > 0n;

            return (
              <Card key={dep.id} className="flex flex-col justify-between">
                <CardBody className="p-5">
                  <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3">
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                        {dep.tenant?.full_name || "—"}
                      </span>
                      {dep.lease && (
                        <Link
                          href={`/leases/${dep.lease.id}`}
                          className="font-mono text-sm text-primary hover:underline"
                        >
                          {dep.lease.lease_no}
                        </Link>
                      )}
                    </div>
                    <Badge variant={currentBalance > 0n ? "success" : "neutral"}>
                      {currentBalance > 0n ? "Active escrow" : "Settled"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-surface-container-low p-2">
                      <span className="block text-[11px] uppercase tracking-wider text-on-surface-variant">
                        {t("held")}
                      </span>
                      <span className="font-semibold text-on-surface">
                        {formatMoney(BigInt(dep.held_minor), dep.currency, locale)}
                      </span>
                    </div>

                    <div className="rounded-lg bg-surface-container-low p-2">
                      <span className="block text-[11px] uppercase tracking-wider text-error">
                        {t("deducted")}
                      </span>
                      <span className="font-semibold text-error">
                        {formatMoney(BigInt(dep.deducted_minor), dep.currency, locale)}
                      </span>
                    </div>

                    <div className="rounded-lg bg-surface-container-low p-2">
                      <span className="block text-[11px] uppercase tracking-wider text-on-surface-variant">
                        {t("refunded")}
                      </span>
                      <span className="font-semibold text-on-surface">
                        {formatMoney(BigInt(dep.refunded_minor), dep.currency, locale)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl bg-primary-fixed/30 p-3">
                    <span className="font-label-md text-label-md font-semibold text-on-surface">
                      {t("balance")}
                    </span>
                    <span className="font-headline-sm text-headline-sm font-bold text-primary">
                      {formatMoney(currentBalance, dep.currency, locale)}
                    </span>
                  </div>

                  {canAct && (
                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-hairline pt-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setDeductTarget(dep);
                          setDeductAmount("");
                          setDeductReason("");
                        }}
                        disabled={isPending}
                        className="flex items-center gap-1.5"
                      >
                        <MinusCircle className="size-3.5" />
                        {t("applyDeduction")}
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setRefundTarget(dep);
                          setRefundAmount((Number(currentBalance) / 100).toFixed(2));
                          setRefundReason("");
                        }}
                        disabled={isPending}
                        className="flex items-center gap-1.5"
                      >
                        <RotateCcw className="size-3.5" />
                        {t("refund")}
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Deduction Modal */}
      {deductTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              {t("applyDeduction")}
            </h2>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              Tenant: {deductTarget.tenant?.full_name} ({deductTarget.lease?.lease_no})
            </p>
            <form onSubmit={handleDeductSubmit} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("amount")} (QAR) *
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(
                    (deductTarget.held_minor -
                      deductTarget.deducted_minor -
                      deductTarget.refunded_minor) /
                    100
                  ).toFixed(2)}
                  value={deductAmount}
                  onChange={(e) => setDeductAmount(e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("reason")} *
                </label>
                <Textarea
                  required
                  rows={2}
                  value={deductReason}
                  onChange={(e) => setDeductReason(e.target.value)}
                  placeholder="Damage repairs / unpaid utility bills"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDeductTarget(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={isPending}>
                  {t("applyDeduction")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("refund")}</h2>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              Tenant: {refundTarget.tenant?.full_name} ({refundTarget.lease?.lease_no})
            </p>
            <form onSubmit={handleRefundSubmit} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("amount")} (QAR) *
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(
                    (refundTarget.held_minor -
                      refundTarget.deducted_minor -
                      refundTarget.refunded_minor) /
                    100
                  ).toFixed(2)}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("reason")}
                </label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Lease concluded with full clearance"
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRefundTarget(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {t("refund")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
