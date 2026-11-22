"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { generateContractPdfAction } from "@/server/actions/contract-pdf";

export function ContractPdfButton({ leaseId }: { leaseId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await generateContractPdfAction(leaseId);
            if (res.url) window.open(res.url, "_blank");
            else if (res.error) setError(res.error);
          })
        }
      >
        {pending ? "Generating…" : "Download PDF"}
      </Button>
      {error ? <p className="font-body-sm text-body-sm text-error">{error}</p> : null}
    </div>
  );
}