import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-label-sm text-label-sm font-semibold",
  {
    variants: {
      variant: {
        // Cleared / active / settled
        success: "bg-secondary-container/60 text-on-secondary-container",
        // Cheque due / maturing
        warning: "bg-primary-fixed/50 text-on-primary-fixed-variant",
        // Bounced / overdue
        danger: "bg-error-container text-on-error-container",
        // Draft / neutral
        neutral: "border border-hairline bg-surface-container-low text-on-surface-variant",
        info: "bg-tertiary-fixed/60 text-on-tertiary-container",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

const dots: Record<string, string> = {
  success: "bg-on-secondary-container",
  warning: "bg-on-primary-fixed-variant",
  danger: "bg-error",
  info: "bg-tertiary",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant = "neutral", dot = true, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && variant !== "neutral" ? (
        <span className={cn("size-1 rounded-full", dots[variant ?? "neutral"])} />
      ) : null}
      {children}
    </span>
  );
}
