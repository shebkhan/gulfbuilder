"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  decideExpenseApprovalAction,
  type OwnerPortalState,
} from "@/server/actions/owner-portal";

export function ApprovalDecisionButtons({ approvalId }: { approvalId: string }) {
  const t = useTranslations("owner.approvals");
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<OwnerPortalState>({});

  function decide(decision: "approved" | "rejected") {
    setState({});
    const formData = new FormData();
    formData.set("approvalId", approvalId);
    formData.set("decision", decision);
    startTransition(async () => {
      setState(await decideExpenseApprovalAction({}, formData));
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={isPending}
        onClick={() => decide("approved")}
        className="flex items-center gap-1.5"
      >
        <Check className="size-4" />
        {t("approve")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={isPending}
        onClick={() => decide("rejected")}
        className="flex items-center gap-1.5"
      >
        <X className="size-4" />
        {t("reject")}
      </Button>
      {state.error && (
        <span className="font-body-sm text-body-sm text-error">
          {t(`errors.${state.error}` as never)}
        </span>
      )}
    </div>
  );
}
