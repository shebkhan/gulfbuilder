"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { exportDatasetAction } from "@/server/actions/export";

const DATASETS = ["tenants", "leases", "charges", "payments", "journal_lines"] as const;

export function ExportButtons() {
  const t = useTranslations("settings.export");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function download(dataset: string) {
    setError(undefined);
    startTransition(async () => {
      const result = await exportDatasetAction(dataset);
      if (result.error || !result.csv) {
        setError(result.error ?? "export_failed");
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename ?? `${dataset}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {DATASETS.map((dataset) => (
          <Button
            key={dataset}
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => download(dataset)}
          >
            <Download />
            {t(`datasets.${dataset}` as never)}
          </Button>
        ))}
      </div>
      {error && (
        <p className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {t(`errors.${error}` as never)}
        </p>
      )}
    </div>
  );
}
