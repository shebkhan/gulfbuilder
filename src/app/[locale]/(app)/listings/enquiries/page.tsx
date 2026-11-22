import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/domain/page-header";
import { RealtimeRefresh } from "@/components/domain/realtime-refresh";
import { getOrgContext } from "@/server/org-context";

export const dynamic = "force-dynamic";

export default async function EnquiriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketplace.inbox");
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const { data: enquiries } = await ctx.supabase
    .from("listing_enquiries")
    .select("id, name, email, phone, message, status, unit_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <RealtimeRefresh table="listing_enquiries" />

      <PageHeader
        section="buildings"
        role={ctx.role}
        title={t("title")}
        description={t("subtitle")}
      />
      {enquiries && enquiries.length > 0 ? (
        <div className="flex flex-col gap-3">
          {enquiries.map((enquiry) => (
            <article
              key={enquiry.id}
              className="rounded-2xl bg-surface-container-lowest p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-headline-sm text-headline-sm text-on-surface">
                  {enquiry.name}
                </p>
                <span className="rounded-full bg-surface-container px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">
                  {t.has(`status.${enquiry.status}` as never)
                    ? t(`status.${enquiry.status}` as never)
                    : enquiry.status}
                </span>
              </div>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant" dir="ltr">
                {enquiry.email}
                {enquiry.phone ? ` · ${enquiry.phone}` : ""}
              </p>
              <p className="mt-2 whitespace-pre-line font-body-md text-body-md text-on-surface">
                {enquiry.message}
              </p>
              <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">
                {new Date(enquiry.created_at).toLocaleString(locale)}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="font-body-lg text-body-lg text-on-surface-variant">{t("empty")}</p>
      )}
    </div>
  );
}
