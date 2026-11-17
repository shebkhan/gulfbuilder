"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames, type DayPickerProps } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import "react-day-picker/style.css";

function Calendar({ className, classNames, showOutsideDays = true, ...props }: DayPickerProps) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      classNames={{
        root: cn("w-fit", defaults.root),
        months: cn("flex flex-col gap-4", defaults.months),
        month: cn("flex w-full flex-col gap-3", defaults.month),
        nav: cn("absolute inset-x-0 top-1 flex items-center justify-between", defaults.nav),
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-8 p-0",
          defaults.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-8 p-0",
          defaults.button_next,
        ),
        month_caption: cn("flex h-8 items-center justify-center", defaults.month_caption),
        caption_label: cn(
          "font-label-sm text-label-sm font-semibold text-on-surface",
          defaults.caption_label,
        ),
        weekdays: cn("flex", defaults.weekdays),
        weekday: cn("w-8 font-body-sm text-body-sm text-on-surface-variant", defaults.weekday),
        week: cn("mt-1 flex w-full", defaults.week),
        day: cn("relative aspect-square text-center", defaults.day),
        day_button: cn(
          "size-8 rounded-full font-body-sm text-body-sm text-on-surface hover:bg-surface-container-high",
          defaults.day_button,
        ),
        selected: cn("bg-primary text-on-primary hover:bg-primary", defaults.selected),
        today: cn("bg-surface-container-high", defaults.today),
        outside: cn("text-on-surface-variant/50", defaults.outside),
        disabled: cn("opacity-40", defaults.disabled),
        hidden: cn("invisible", defaults.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, style }) => {
          const iconClass = cn("size-4", className);
          if (orientation === "left") return <ChevronLeft className={iconClass} style={style} />;
          if (orientation === "right") return <ChevronRight className={iconClass} style={style} />;
          return <ChevronDown className={iconClass} style={style} />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
