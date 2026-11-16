"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importPropertiesAction, type PropertyState } from "@/server/actions/property";

type Props = {
  labels: {
    file: string;
    dryRun: string;
    commit: string;
    report: string;
    committed: string;
    nothingWritten: string;
    row: string;
    message: string;
    errors: Record<string, string>;
  };
};

export function ImportForm({ labels }: Props) {
  const [state, formAction, pending] = useActionState<PropertyState, FormData>(
    importPropertiesAction,
    {},
  );
  const report = state.report;

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="file">{labels.file}</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="h-auto py-2.5 file:me-3 file:rounded-full file:border-0 file:bg-surface-container-high file:px-4 file:py-1.5 file:font-label-md file:text-label-md"
          />
        </div>

        {state.error ? (
          <p role="alert" className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
            {labels.errors[state.error] ?? labels.errors.failed}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" name="mode" value="dry" variant="secondary" disabled={pending}>
            {labels.dryRun}
          </Button>
          <Button type="submit" name="mode" value="commit" disabled={pending}>
            {labels.commit}
          </Button>
        </div>
      </form>

      {report ? (
        <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-container-low p-5">
          <p className="font-label-md text-label-md text-on-surface">
            {labels.report
              .replace("{buildings}", String(report.buildings))
              .replace("{floors}", String(report.floors))
              .replace("{units}", String(report.units))}
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {report.committed ? labels.committed : labels.nothingWritten}
          </p>

          {report.errors.length > 0 ? (
            <table className="w-full text-start font-body-sm text-body-sm">
              <thead>
                <tr className="text-on-surface-variant">
                  <th className="w-16 py-1 text-start font-medium">{labels.row}</th>
                  <th className="py-1 text-start font-medium">{labels.message}</th>
                </tr>
              </thead>
              <tbody>
                {report.errors.map((error, index) => (
                  <tr key={`${error.row}-${index}`} className="border-t border-hairline">
                    <td className="py-1 tabular">{error.row}</td>
                    <td className="py-1">{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
