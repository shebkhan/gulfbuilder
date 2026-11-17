"use client";

import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toFormData } from "@/lib/form-data";
import { formatMoney } from "@/lib/money";
import { recordPaymentSchema } from "@/schemas/payments";
import {
  getTenantOutstandingCharges,
  recordPaymentAction,
  type PaymentState,
  type UnallocatedCharge,
} from "@/server/actions/payments";

type TenantOption = { id: string; name: string };
type LeaseOption = { id: string; lease_no: string; tenant_id: string };

type Values = {
  tenantId: string;
  leaseId?: string;
  amount: string;
  currency: string;
  method: "cash" | "bank_transfer" | "cheque" | "card" | "online";
  receivedAt: string;
  reference?: string;
  notes?: string;
  allocations?: string;
};

export function PaymentForm({
  tenants,
  leases,
  locale = "en",
}: {
  tenants: TenantOption[];
  leases: LeaseOption[];
  locale?: string;
}) {
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const errors = t.raw("errors") as Record<string, string>;
  const help = t.raw("help") as Record<string, string>;
  const [open, setOpen] = useState(false);

  const [charges, setCharges] = useState<UnallocatedCharge[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [loadingCharges, setLoadingCharges] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      tenantId: "",
      leaseId: "",
      amount: "",
      currency: "QAR",
      method: "cash",
      receivedAt: new Date().toISOString().slice(0, 10),
      reference: "",
      notes: "",
      allocations: "",
    },
  });

  const [state, dispatch, pending] = useActionState<PaymentState, FormData>(
    async (prev, formData) => {
      const res = await recordPaymentAction(prev, formData);
      if (res.ok) {
        setOpen(false);
        form.reset();
        setAllocations({});
      }
      return res;
    },
    {},
  );

  const tenantId = form.watch("tenantId");
  const filteredLeases = tenantId ? leases.filter((l) => l.tenant_id === tenantId) : leases;

  const handleTenantChange = async (value: string) => {
    form.setValue("tenantId", value);
    form.setValue("leaseId", "");
    setAllocations({});
    if (!value) {
      setCharges([]);
      return;
    }
    setLoadingCharges(true);
    try {
      setCharges(await getTenantOutstandingCharges(value));
    } catch {
      setCharges([]);
    } finally {
      setLoadingCharges(false);
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    const formData = toFormData(values);
    const allocArr = Object.entries(allocations)
      .filter(([, value]) => value && Number(value) > 0)
      .map(([charge_id, amount]) => ({ charge_id, amount }));
    if (allocArr.length > 0) formData.set("allocations", JSON.stringify(allocArr));
    dispatch(formData);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="size-4" />
          {t("recordPayment")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[43.2rem]">
        <DialogHeader>
          <DialogTitle>{t("recordPayment")}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
            <FormField
              control={form.control}
              name="tenantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("tenant")}</FormLabel>
                  <Select value={field.value} onValueChange={handleTenantChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectTenant")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>{help.tenant}</FormDescription>
                  <LocalizedFormMessage />
                </FormItem>
              )}
            />

            {tenantId ? (
              <FormField
                control={form.control}
                name="leaseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("lease")}</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
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
                    <FormDescription>{help.lease}</FormDescription>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("amount")} ({tCommon("currency")})</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} dir="ltr" />
                    </FormControl>
                    <FormDescription>{help.amount}</FormDescription>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("method")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(["cash", "bank_transfer", "cheque", "card", "online"] as const).map(
                          (key) => (
                            <SelectItem key={key} value={key}>
                              {t(`methods.${key}`)}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>{help.method}</FormDescription>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="receivedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("date")}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} dir="ltr" />
                    </FormControl>
                    <FormDescription>{help.date}</FormDescription>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reference")}</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} dir="ltr" />
                    </FormControl>
                    <FormDescription>{help.reference}</FormDescription>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />
            </div>

            {tenantId ? (
              <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-container-low p-3">
                <p className="font-label-md text-label-md font-semibold text-on-surface">
                  {t("allocations")}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {help.allocations}
                </p>
                {loadingCharges ? (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {tCommon("loading")}
                  </p>
                ) : charges.length === 0 ? (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {t("noOutstandingCharges")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      {t("outstandingCharges")}
                    </p>
                    {charges.map((charge) => (
                      <div
                        key={charge.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline/50 pb-2 text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface">
                            {charge.type} {charge.lease_no ? `(${charge.lease_no})` : ""} ·{" "}
                            {t("dueOn", { date: charge.due_date })}
                          </span>
                          <span className="text-on-surface-variant">
                            {t("remaining", {
                              amount: formatMoney(
                                BigInt(charge.remaining_minor),
                                charge.currency,
                                locale,
                              ),
                            })}
                          </span>
                        </div>
                        <Input
                          type="number"
                          step="any"
                          max={(charge.remaining_minor / 100).toFixed(2)}
                          value={allocations[charge.id] ?? ""}
                          onChange={(event) =>
                            setAllocations((prev) => ({ ...prev, [charge.id]: event.target.value }))
                          }
                          placeholder="0.00"
                          aria-label={help.allocationAmount}
                          className="w-24 text-end"
                          dir="ltr"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("notes")}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormDescription>{help.notes}</FormDescription>
                  <LocalizedFormMessage />
                </FormItem>
              )}
            />

            {state.error ? (
              <p
                role="alert"
                className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
              >
                {errors[state.error] ?? state.error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={pending} className="flex items-center gap-2">
                <Check className="size-4" />
                {pending ? t("recording") : t("recordPayment")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
