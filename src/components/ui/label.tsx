import * as React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(function Label({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn(
        "mb-2.5 block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant",
        className,
      )}
      {...props}
    />
  );
});
