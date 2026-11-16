import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none transition-shadow",
        "placeholder:text-on-surface-variant/60",
        "focus:bg-surface-container-low focus:ring-[3px] focus:ring-primary-fixed",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:ring-[3px] aria-invalid:ring-error-container",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
