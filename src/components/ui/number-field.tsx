"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NumberFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "step"
> & {
  value?: string | number;
  onChange?: (value: string) => void;
  step?: string | number;
};

const NumberField = React.forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ value, defaultValue, onChange, min, max, step = 1, className, disabled, ...props }, ref) => {
    const [internal, setInternal] = React.useState(
      defaultValue !== undefined ? String(defaultValue) : "",
    );
    const current = value !== undefined ? String(value) : internal;
    const numeric = Number(current || 0);
    const increment = step === "any" ? 1 : Number(step);

    const set = (next: string) => {
      setInternal(next);
      onChange?.(next);
    };

    const stepBy = (direction: 1 | -1) => {
      const clamped = Math.min(
        max === undefined ? Infinity : Number(max),
        Math.max(min === undefined ? -Infinity : Number(min), numeric + direction * increment),
      );
      set(String(Number(clamped.toFixed(6))));
    };

    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Input
          ref={ref}
          type="number"
          inputMode="decimal"
          value={current}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => set(event.target.value)}
          className="min-w-0 flex-1"
          {...props}
        />
        <div className="flex shrink-0 flex-col">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Increase"
            disabled={disabled || (max !== undefined && numeric >= Number(max))}
            onClick={() => stepBy(1)}
            className="size-5 rounded-none p-0"
          >
            <ChevronUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Decrease"
            disabled={disabled || (min !== undefined && numeric <= Number(min))}
            onClick={() => stepBy(-1)}
            className="size-5 rounded-none p-0"
          >
            <ChevronDown />
          </Button>
        </div>
      </div>
    );
  },
);
NumberField.displayName = "NumberField";

export { NumberField };
