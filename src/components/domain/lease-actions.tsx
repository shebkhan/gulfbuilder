"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import {
  activateLeaseAction,
  approveSubletAction,
  renewLeaseAction,
  terminateLeaseAction,
} from "@/server/actions/leases";

type Props = {
  leaseId: string;
  status: string;
  isSublet: boolean;
  subletApproved: boolean;
  canWrite: boolean;
  canApprove: boolean;
  labels: {
    activate: string;
    activating: string;
    terminate: string;
    terminating: string;
    renew: string;
    renewing: string;
    approveSublet: string;
    approving: string;
    terminationDate: string;
    terminationReason: string;
    startDate: string;
    endDate: string;
    rent: string;
    frequency: string;
    installments: string;
    dueDay: string;
    deposit: string;
    cancel: string;
  };
};

export function LeaseActions({
  leaseId,
  status,
  isSublet,
  subletApproved,
  canWrite,
  canApprove,
  labels,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminateDate, setTerminateDate] = useState(new Date().toISOString().slice(0, 10));
  const [terminateReason, setTerminateReason] = useState("");

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewStartDate, setRenewStartDate] = useState("");
  const [renewEndDate, setRenewEndDate] = useState("");
  const [renewRent, setRenewRent] = useState("");

  const handleActivate = () => {
    setError(null);
    startTransition(async () => {
      const res = await activateLeaseAction(leaseId);
      if (res.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleApproveSublet = () => {
    setError(null);
    startTransition(async () => {
      const res = await approveSubletAction(leaseId);
      if (res.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleTerminate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await terminateLeaseAction(leaseId, terminateDate, terminateReason);
      if (res.error) {
        setError(res.error);
      } else {
        setShowTerminateModal(false);
        router.refresh();
      }
    });
  };

  const handleRenew = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("startDate", renewStartDate);
    formData.set("endDate", renewEndDate);
    formData.set("rent", renewRent);
    formData.set("frequency", "annual");
    formData.set("installments", "4");
    formData.set("dueDay", "1");

    startTransition(async () => {
      const res = await renewLeaseAction(leaseId, formData);
      if (res.error) {
        setError(res.error);
      } else if (res.newLeaseId) {
        setShowRenewModal(false);
        router.push(`/leases/${res.newLeaseId}`);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {status === "draft" && canWrite ? (
          <Button type="button" onClick={handleActivate} disabled={isPending}>
            {isPending ? labels.activating : labels.activate}
          </Button>
        ) : null}

        {status === "draft" && isSublet && !subletApproved && canApprove ? (
          <Button type="button" variant="secondary" onClick={handleApproveSublet} disabled={isPending}>
            {isPending ? labels.approving : labels.approveSublet}
          </Button>
        ) : null}

        {status === "active" && canWrite ? (
          <>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowTerminateModal(true)}
              disabled={isPending}
            >
              {labels.terminate}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowRenewModal(true)}
              disabled={isPending}
            >
              {labels.renew}
            </Button>
          </>
        ) : null}
      </div>

      {showTerminateModal ? (
        <form
          onSubmit={handleTerminate}
          className="mt-2 flex flex-col gap-3 rounded-xl border border-hairline bg-surface-container-low p-4"
        >
          <h4 className="font-title-sm text-title-sm text-on-surface">{labels.terminate}</h4>
          <div>
            <Label htmlFor="terminateDate">{labels.terminationDate}</Label>
            <Input
              id="terminateDate"
              type="date"
              required
              value={terminateDate}
              onChange={(e) => setTerminateDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="terminateReason">{labels.terminationReason}</Label>
            <Input
              id="terminateReason"
              required
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? labels.terminating : labels.terminate}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowTerminateModal(false)}
            >
              {labels.cancel}
            </Button>
          </div>
        </form>
      ) : null}

      {showRenewModal ? (
        <form
          onSubmit={handleRenew}
          className="mt-2 flex flex-col gap-3 rounded-xl border border-hairline bg-surface-container-low p-4"
        >
          <h4 className="font-title-sm text-title-sm text-on-surface">{labels.renew}</h4>
          <div>
            <Label htmlFor="renewStartDate">{labels.startDate}</Label>
            <Input
              id="renewStartDate"
              type="date"
              required
              value={renewStartDate}
              onChange={(e) => setRenewStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="renewEndDate">{labels.endDate}</Label>
            <Input
              id="renewEndDate"
              type="date"
              required
              value={renewEndDate}
              onChange={(e) => setRenewEndDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="renewRent">{labels.rent}</Label>
            <Input
              id="renewRent"
              type="number"
              step="any"
              required
              dir="ltr"
              value={renewRent}
              onChange={(e) => setRenewRent(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? labels.renewing : labels.renew}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowRenewModal(false)}
            >
              {labels.cancel}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
