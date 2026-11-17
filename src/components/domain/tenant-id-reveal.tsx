"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { revealTenantIdAction } from "@/server/actions/tenants";

type Props = {
  tenantId: string;
  initialMasked: string;
  labels: {
    idNumber: string;
    reveal: string;
    revealing: string;
    hide: string;
    copy: string;
    copied: string;
  };
};

export function TenantIdReveal({ tenantId, initialMasked, labels }: Props) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    if (show) {
      setShow(false);
      return;
    }

    if (revealed) {
      setShow(true);
      return;
    }

    startTransition(async () => {
      const res = await revealTenantIdAction(tenantId);
      if (res.ok && res.plaintextId) {
        setRevealed(res.plaintextId);
        setShow(true);
      }
    });
  };

  const handleCopy = () => {
    const val = revealed || initialMasked;
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="flex flex-col">
        <span className="font-label-sm text-label-sm text-on-surface-variant">{labels.idNumber}</span>
        <span className="font-headline-sm text-headline-sm tracking-wider text-on-surface" dir="ltr">
          {show && revealed ? revealed : initialMasked}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isPending}
          onClick={handleToggle}
        >
          {isPending ? labels.revealing : show ? labels.hide : labels.reveal}
        </Button>
        {show && revealed ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? labels.copied : labels.copy}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
