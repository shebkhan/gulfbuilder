"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { whatsappEnquiryUrl } from "@/lib/marketplace";
import { submitListingEnquiryAction } from "@/server/actions/marketplace";
import type { EnquiryState } from "@/server/actions/marketplace";

export function EnquiryForm({
  orgId,
  unitId,
  whatsapp,
  message,
}: {
  orgId: string;
  unitId: string;
  whatsapp?: string | null;
  message: string;
}) {
  const t = useTranslations("marketplace.enquiry");
  const [state, action, pending] = useActionState<EnquiryState, FormData>(
    submitListingEnquiryAction,
    {},
  );
  const field =
    "w-full bg-surface-container-lowest rounded-xl border border-hairline px-3 py-2 font-body-sm text-body-sm text-on-surface";

  if (state.ok) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest p-5" role="status">
        <p className="font-headline-sm text-headline-sm text-primary">{t("success")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-5">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("title")}</h2>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="unitId" value={unitId} />
        <div>
          <Label htmlFor="enquiry-name">{t("name")}</Label>
          <Input id="enquiry-name" name="name" required minLength={2} className={field} />
        </div>
        <div>
          <Label htmlFor="enquiry-email">{t("email")}</Label>
          <Input id="enquiry-email" name="email" type="email" required className={field} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="enquiry-phone">{t("phone")}</Label>
          <Input id="enquiry-phone" name="phone" className={field} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="enquiry-message">{t("message")}</Label>
          <textarea
            id="enquiry-message"
            name="message"
            required
            minLength={5}
            rows={4}
            defaultValue={message}
            className={field}
          />
        </div>
        {state.error ? (
          <p className="font-body-sm text-body-sm text-error" role="alert">
            {t(state.error)}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {t("send")}
        </Button>
      </form>
      {whatsapp ? (
        <a
          href={whatsappEnquiryUrl(whatsapp, message)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-label-md text-label-md text-secondary underline"
        >
          {t("whatsapp")}
        </a>
      ) : null}
    </div>
  );
}
