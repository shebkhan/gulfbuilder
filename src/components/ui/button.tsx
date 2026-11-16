import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-label-md text-label-md transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "rounded-full bg-primary text-on-primary shadow-md hover:bg-primary-container hover:text-on-primary-container",
        secondary: "rounded-full border border-hairline bg-transparent text-on-surface hover:bg-surface-container-high",
        ghost: "rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        destructive: "rounded-full bg-error-container text-on-error-container hover:bg-error hover:text-on-error",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-5",
        lg: "h-11 px-7",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
