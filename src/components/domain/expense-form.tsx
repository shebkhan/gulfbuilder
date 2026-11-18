"use client";

import { Check, CheckCircle2, CreditCard, Plus, Receipt } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Link } from "@/i18n/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toFormData } from "@/lib/form-data";
import { formatMoney } from "@/lib/money";
import { createExpenseSchema } from "@/schemas/expenses";
import {
  approveExpenseAction,
  createExpenseAction,
  payExpenseAction,
  type ExpenseState,
} from "@/server/actions/expenses";

export type ExpenseItem = {
  id: string;
  category: string;
  description: string;
  amount_minor: number;
  currency: string;
  status: "draft" | "submitted" | "approved" | "paid" | "rejected";
  expense_date: string;
  paid_at: string | null;
  vendor: { id: string; name: string } | null;
  building: { id: string; name: string; code: string } | null;
  unit: { id: string; unit_no: string } | null;
};

type VendorOption = { id: string; name: string };
type BuildingOption = { id: string; name: string; code: string };

type Values = {
  category: string;
  description: string;
  amount: string;
  currency: string;
  expenseDate: string;
  vendorId?: string;
  buildingId?: string;
  unitId?: string;
  notes?: string;
};

/** The category column is free text: seeded rows hold labels, new rows hold keys. */
const CATEGORY_KEYS: Record<string, string> = {
  "Maintenance and Repairs": "maintenance",
  Utilities: "utilities",
  Insurance: "insurance",
  Cleaning: "cleaning",
  "General and Administrative": "other",
};

export function ExpenseForm({
  vendors,
  buildings,
  currency = "QAR",
}: {
  vendors: VendorOption[];
  buildings: BuildingOption[];
  currency?: string;
}) {
  const t = useTranslations("expenses");
  const tCommon = useTranslations("common");
  const errors = t.raw("errors") as Record<string, string>;
  const help = t.raw("help") as Record<string, string>;

  const form = useForm<Values>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      category: "maintenance",
      description: "",
      amount: "",
      currency,
      expenseDate: new Date().toISOString().slice(0, 10),
      vendorId: "",
      buildingId: "",
      unitId: "",
      notes: "",
    },
  });

  const [createState, createDispatch, createPending] = useActionState<ExpenseState, FormData>(
    async (prev, formData) => {
      const res = await createExpenseAction(prev, formData);
      if (res.ok) form.reset();
      return res;
    },
    {},
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => createDispatch(toFormData(values)))}
        noValidate
        className="flex flex-col gap-6"
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={help.category}>{t("category")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(
                      [
                        "maintenance",
                        "utilities",
                        "insurance",
                        "cleaning",
                        "management_fee",
                        "other",
                      ] as const
                    ).map((key) => (
                      <SelectItem key={key} value={key}>
                        {t(`categories.${key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expenseDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={help.date}>{t("date")}</FormLabel>
                <FormControl>
                  <DatePicker {...field} dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel description={help.description}>{t("description")}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t("descriptionPlaceholder")} />
              </FormControl>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={help.amount}>
                  {t("amount")} ({tCommon("currency")})
                </FormLabel>
                <FormControl>
                  <NumberField step="any" {...field} dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="buildingId"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={help.property}>{t("property")}</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("generalExpense")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {buildings.map((building) => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.code} - {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="vendorId"
          render={({ field }) => (
            <FormItem>
              <FormLabel description={help.vendor}>{t("vendor")}</FormLabel>
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectVendor")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        {createState.error ? (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          >
            {errors[createState.error] ?? createState.error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" asChild>
            <Link href="/expenses">{tCommon("cancel")}</Link>
          </Button>
          <Button type="submit" disabled={createPending}>
            <Check className="size-4" />
            {t("createExpense")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function ExpenseList({
  expenses,
  canWrite,
  canApprove,
  canPay,
  locale = "en",
}: {
  expenses: ExpenseItem[];
  canWrite: boolean;
  canApprove: boolean;
  canPay: boolean;
  locale?: string;
}) {
  const t = useTranslations("expenses");
  const errors = t.raw("errors") as Record<string, string>;
  const [isPending, startTransition] = useTransition();
  const [statusState, setStatusState] = useState<ExpenseState>({});

  const handleApprove = (expenseId: string) => {
    setStatusState({});
    const formData = new FormData();
    formData.set("expenseId", expenseId);
    startTransition(async () => setStatusState(await approveExpenseAction({}, formData)));
  };

  const handlePay = (expenseId: string) => {
    setStatusState({});
    const formData = new FormData();
    formData.set("expenseId", expenseId);
    startTransition(async () => setStatusState(await payExpenseAction({}, formData)));
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "success";
      case "approved":
        return "info";
      case "submitted":
        return "warning";
      case "rejected":
        return "danger";
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
        {canWrite ? (
          <Button asChild className="flex items-center gap-2">
            <Link href="/expenses/new">
              <Plus className="size-4" />
              {t("createExpense")}
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Receipt className="size-12 text-on-surface-variant/40" />
            <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-start font-body-sm text-body-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                  <th className="p-4 text-start">{t("date")}</th>
                  <th className="p-4 text-start">{t("category")}</th>
                  <th className="p-4 text-start">{t("description")}</th>
                  <th className="p-4 text-start">{t("vendor")}</th>
                  <th className="p-4 text-start">{t("property")}</th>
                  <th className="p-4 text-start">{t("status")}</th>
                  <th className="p-4 text-end">{t("amount")}</th>
                  {canApprove || canPay ? (
                    <th className="p-4 text-center">{t("actions")}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {expenses.map((expense) => {
                  const categoryKey = CATEGORY_KEYS[expense.category] ?? expense.category;
                  const category = t.has(`categories.${categoryKey}` as never)
                    ? t(`categories.${categoryKey}` as never)
                    : expense.category;
                  return (
                    <tr
                      key={expense.id}
                      className="transition-colors hover:bg-surface-container-low/50"
                    >
                      <td className="p-4 text-on-surface-variant" dir="ltr">
                        {expense.expense_date}
                      </td>
                      <td className="p-4 font-medium text-on-surface">{category}</td>
                      <td className="p-4 text-on-surface">{expense.description}</td>
                      <td className="p-4 text-on-surface-variant">{expense.vendor?.name || "—"}</td>
                      <td className="p-4 text-on-surface-variant">
                        {expense.building
                          ? `${expense.building.code} - ${expense.building.name}`
                          : "—"}
                      </td>
                      <td className="p-4">
                        <Badge variant={getStatusVariant(expense.status)}>
                          {t(`statuses.${expense.status}` as never)}
                        </Badge>
                      </td>
                      <td className="p-4 text-end font-semibold text-on-surface">
                        {formatMoney(BigInt(expense.amount_minor), expense.currency, locale)}
                      </td>
                      {canApprove || canPay ? (
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {expense.status === "submitted" && canApprove ? (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleApprove(expense.id)}
                                disabled={isPending}
                                className="flex items-center gap-1"
                              >
                                <CheckCircle2 className="size-3.5" />
                                {t("approve")}
                              </Button>
                            ) : null}
                            {expense.status === "approved" && canPay ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handlePay(expense.id)}
                                disabled={isPending}
                                className="flex items-center gap-1"
                              >
                                <CreditCard className="size-3.5" />
                                {t("pay")}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
