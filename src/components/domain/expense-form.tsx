"use client";

import { CheckCircle2, CreditCard, Plus, Receipt, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
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

export function ExpenseForm({
  expenses,
  vendors,
  buildings,
  canWrite = false,
  canApprove = false,
  canPay = false,
  locale = "en",
}: {
  expenses: ExpenseItem[];
  vendors: VendorOption[];
  buildings: BuildingOption[];
  canWrite?: boolean;
  canApprove?: boolean;
  canPay?: boolean;
  locale?: string;
}) {
  const t = useTranslations("expenses");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ExpenseState>({});

  // Create form state
  const [category, setCategory] = useState("maintenance");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorId, setVendorId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [notes, setNotes] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setState({});

    const formData = new FormData();
    formData.set("category", category);
    formData.set("description", description);
    formData.set("amount", amount);
    formData.set("expenseDate", expenseDate);
    if (vendorId) formData.set("vendorId", vendorId);
    if (buildingId) formData.set("buildingId", buildingId);
    if (notes) formData.set("notes", notes);

    startTransition(async () => {
      const res = await createExpenseAction({}, formData);
      setState(res);
      if (res.ok) {
        setOpen(false);
        setDescription("");
        setAmount("");
        setNotes("");
        setVendorId("");
        setBuildingId("");
      }
    });
  };

  const handleApprove = (expenseId: string) => {
    setState({});
    const formData = new FormData();
    formData.set("expenseId", expenseId);

    startTransition(async () => {
      const res = await approveExpenseAction({}, formData);
      setState(res);
    });
  };

  const handlePay = (expenseId: string) => {
    setState({});
    const formData = new FormData();
    formData.set("expenseId", expenseId);

    startTransition(async () => {
      const res = await payExpenseAction({}, formData);
      setState(res);
    });
  };

  const getStatusVariant = (s: string) => {
    switch (s) {
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
        {state.error && (
          <div className="w-full rounded-xl bg-error-container p-3 font-body-sm text-body-sm text-on-error-container">
            {state.error}
          </div>
        )}
        <div />
        {canWrite && (
          <Button onClick={() => setOpen(true)} className="flex items-center gap-2">
            <Plus className="size-4" />
            {t("createExpense")}
          </Button>
        )}
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
                  {(canApprove || canPay) && <th className="p-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="transition-colors hover:bg-surface-container-low/50">
                    <td className="p-4 text-on-surface-variant">{exp.expense_date}</td>
                    <td className="p-4 font-medium text-on-surface">
                      {t(`categories.${exp.category}` as never) || exp.category}
                    </td>
                    <td className="p-4 text-on-surface">{exp.description}</td>
                    <td className="p-4 text-on-surface-variant">{exp.vendor?.name || "—"}</td>
                    <td className="p-4 text-on-surface-variant">
                      {exp.building ? `${exp.building.code} - ${exp.building.name}` : "—"}
                    </td>
                    <td className="p-4">
                      <Badge variant={getStatusVariant(exp.status)}>
                        {t(`statuses.${exp.status}` as never)}
                      </Badge>
                    </td>
                    <td className="p-4 text-end font-semibold text-on-surface">
                      {formatMoney(BigInt(exp.amount_minor), exp.currency, locale)}
                    </td>
                    {(canApprove || canPay) && (
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {exp.status === "submitted" && canApprove && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleApprove(exp.id)}
                              disabled={isPending}
                              className="flex items-center gap-1"
                            >
                              <CheckCircle2 className="size-3.5" />
                              {t("approve")}
                            </Button>
                          )}
                          {exp.status === "approved" && canPay && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handlePay(exp.id)}
                              disabled={isPending}
                              className="flex items-center gap-1"
                            >
                              <CreditCard className="size-3.5" />
                              {t("pay")}
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                {t("createExpense")}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container-high"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {t("category")} *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                  >
                    <option value="maintenance">{t("categories.maintenance")}</option>
                    <option value="utilities">{t("categories.utilities")}</option>
                    <option value="insurance">{t("categories.insurance")}</option>
                    <option value="cleaning">{t("categories.cleaning")}</option>
                    <option value="management_fee">{t("categories.management_fee")}</option>
                    <option value="other">{t("categories.other")}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {t("date")} *
                  </label>
                  <input
                    required
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("description")} *
                </label>
                <input
                  required
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="AC Maintenance / Elevator Inspection"
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {t("amount")} (QAR) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {t("property")}
                  </label>
                  <select
                    value={buildingId}
                    onChange={(e) => setBuildingId(e.target.value)}
                    className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                  >
                    <option value="">General property expense</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("vendor")}
                </label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                >
                  <option value="">Select vendor (optional)</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {t("createExpense")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
