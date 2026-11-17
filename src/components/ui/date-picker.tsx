"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type PickerProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "onChange" | "defaultValue"
> & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  granularity?: "day" | "month";
  required?: boolean;
};

const DatePicker = React.forwardRef<HTMLButtonElement, PickerProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      placeholder = "Pick a date",
      granularity = "day",
      name,
      className,
      disabled,
      required,
      ...props
    },
    ref,
  ) => {
    const [internal, setInternal] = React.useState(defaultValue ?? "");
    const current = value !== undefined ? value : internal;
    const pattern = granularity === "month" ? "yyyy-MM" : "yyyy-MM-dd";
    const selected = parse(current, pattern, new Date());
    const [open, setOpen] = React.useState(false);

    const commit = (date?: Date) => {
      if (!date || !isValid(date)) return;
      const next = format(date, pattern);
      setInternal(next);
      onChange?.(next);
      setOpen(false);
    };

    return (
      <>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              type="button"
              variant="secondary"
              disabled={disabled}
              className={cn("w-full justify-start font-normal", className)}
              {...props}
            >
              <CalendarIcon className="size-4 opacity-70" />
              {current || placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Calendar
              mode="single"
              selected={isValid(selected) ? selected : undefined}
              defaultMonth={isValid(selected) ? selected : undefined}
              onSelect={commit}
            />
          </PopoverContent>
        </Popover>
        {name ? <input type="hidden" name={name} value={current} required={required} /> : null}
      </>
    );
  },
);
DatePicker.displayName = "DatePicker";

const MonthPicker = React.forwardRef<HTMLButtonElement, Omit<PickerProps, "granularity">>(
  (props, ref) => (
    <DatePicker ref={ref} granularity="month" placeholder="Pick a month" {...props} />
  ),
);
MonthPicker.displayName = "MonthPicker";

export { DatePicker, MonthPicker };
