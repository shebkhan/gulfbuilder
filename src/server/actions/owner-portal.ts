"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOrgContext } from "@/server/org-context";

export type OwnerPortalState = {
  error?: string;
  ok?: string;
};

const decisionSchema = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

function fail(error: string): OwnerPortalState {
  return { error };
}

/** An owner decides an expense approval on their own building (SPEC §7.8). */
export async function decideExpenseApprovalAction(
  _prev: OwnerPortalState,
  formData: FormData,
): Promise<OwnerPortalState> {
  const ctx = await getOrgContext();
  if (!ctx || ctx.role !== "owner") return fail("not_authorised");

  const parsed = decisionSchema.safeParse({
    approvalId: formData.get("approvalId"),
    decision: formData.get("decision"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return fail("invalid_input");

  const { data, error } = await ctx.supabase
    .from("owner_expense_approvals")
    .update({
      status: parsed.data.decision,
      decided_at: new Date().toISOString(),
      decided_by: ctx.userId,
      note: parsed.data.note || null,
    })
    .eq("id", parsed.data.approvalId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return fail("failed");
  if (!data) return fail("not_found");

  revalidatePath("/owner/approvals");
  return { ok: "decision_saved" };
}
