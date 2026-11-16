import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-20 w-full rounded-xl bg-surface-container-lowest px-3.5 py-2.5 font-body-md text-body-md text-on-surface shadow-sm outline-none transition-shadow",
      "placeholder:text-on-surface-variant/60",
      "focus:bg-surface-container-low focus:ring-[3px] focus:ring-primary-fixed",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-invalid:ring-[3px] aria-invalid:ring-error-container",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
