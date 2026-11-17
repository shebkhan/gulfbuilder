"use client";

import { useActionState, type FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toFormData } from "@/lib/form-data";
import { importPropertiesAction, type PropertyState } from "@/server/actions/property";

// shortcut: the file check is client-side only; the action re-validates the uploaded File.
const importSchema = z.object({
  file: z.unknown().refine((value): value is File => value instanceof File, "validation.required"),
});

type ImportValues = z.infer<typeof importSchema>;

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
    help: Record<string, string>;
    errors: Record<string, string>;
  };
};

export function ImportForm({ labels }: Props) {
  const form = useForm<ImportValues>({
    resolver: zodResolver(importSchema),
    defaultValues: { file: undefined },
  });
  const [state, dispatch, pending] = useActionState<PropertyState, FormData>(
    importPropertiesAction,
    {},
  );
  const report = state.report;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const mode = submitter?.value === "commit" ? "commit" : "dry";
    void form.handleSubmit((values) => {
      const formData = toFormData(values);
      formData.set("mode", mode);
      dispatch(formData);
    })(event);
  };

  return (
    <div className="flex flex-col gap-6">
      <Form {...form}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={labels.help.file}>{labels.file}</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(event.target.files?.[0])}
                    className="h-auto py-2.5 file:me-3 file:rounded-full file:border-0 file:bg-surface-container-high file:px-4 file:py-1.5 file:font-label-md file:text-label-md"
                  />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          {state.error ? (
            <p
              role="alert"
              className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
            >
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
      </Form>

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
                    <td className="tabular py-1">{error.row}</td>
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
