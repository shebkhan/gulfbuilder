"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  title: string;
  description?: string;
  /** Label on the button that opens the modal. */
  triggerLabel: string;
  children: React.ReactNode;
  wide?: boolean;
};

/**
 * Modal wrapper for the create forms. It closes itself once the form reports
 * success: the forms render a `role="status"` message when the action lands.
 */
export function FormDialog({ title, description, triggerLabel, children, wide }: Props) {
  const [open, setOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const submitted = React.useRef(false);

  React.useEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    const onSubmit = () => {
      submitted.current = true;
    };
    const observer = new MutationObserver(() => {
      if (submitted.current && node.querySelector('[role="status"]')) setOpen(false);
    });

    node.addEventListener("submit", onSubmit);
    observer.observe(node, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      node.removeEventListener("submit", onSubmit);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent ref={contentRef} className={wide ? "max-w-3xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
