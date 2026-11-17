"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { useFormField } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export const LocalizedFormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const t = useTranslations();

  if (!error) return null;

  const message = String(error.message ?? "");
  const body = t.has(message as never) ? t(message as never) : message;

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn("font-body-sm text-body-sm font-medium text-error", className)}
      {...props}
    >
      {body}
    </p>
  );
});
LocalizedFormMessage.displayName = "LocalizedFormMessage";
