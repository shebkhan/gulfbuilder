import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-2.5 block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant",
        className,
      )}
      {...props}
    />
  );
}
