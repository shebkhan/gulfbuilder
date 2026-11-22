import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";
import { ListingMetadataForm, ListingImageUploadForm } from "@/components/domain/listing-manager";
import { removeListingImageAction } from "@/server/actions/listings";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function UnitListingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) redirect(`/${locale}/login`);
  if (!can(ctx.role, "properties.read")) redirect(`/${locale}/dashboard`);

  const role = ctx.role;

  const t = await getTranslations("marketplace.admin");

  const { data: unit } = await ctx.supabase
    .from("units")
    .select(
      "id, unit_no, building_id, is_listed_publicly, listing_title, listing_description, listing_slug",
    )
    .eq("id", id)
    .maybeSingle();
  if (!unit) redirect(`/${locale}/units`);

  const { data: building } = await ctx.supabase
    .from("buildings")
    .select("id, code, name, is_listed_publicly")
    .eq("id", unit.building_id)
    .maybeSingle();

  const { data: images } = await ctx.supabase
    .from("listing_images")
    .select("id, path, alt_text, sort_order")
    .eq("unit_id", id)
    .order("sort_order");

  const writable = can(role, "properties.write");

  return (
    <div className="flex max-w-4xl flex-col gap-space-lg pt-2">
      <PageHeader
        section="buildings"
        role={role}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Link
            href={`/units/${id}`}
            className="w-fit font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
          >
            ← {unit.unit_no}
          </Link>
        }
      />

      {!building?.is_listed_publicly ? (
        <div className="rounded-xl bg-warning-container px-4 py-3 font-body-sm text-body-sm text-on-warning-container">
          {t("buildingNotListed" as never) ??
            "The building is not listed publicly, so this unit will not appear in search."}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardBody>
          {writable ? (
            <ListingMetadataForm
              unitId={unit.id}
              buildingId={unit.building_id}
              isListed={unit.is_listed_publicly}
              title={unit.listing_title}
              description={unit.listing_description}
              slug={unit.listing_slug}
            />
          ) : (
            <div className="flex flex-col gap-2 font-body-md text-body-md text-on-surface">
              <p>
                <span className="text-on-surface-variant">{t("listed")}: </span>
                <Badge variant={unit.is_listed_publicly ? "success" : "neutral"}>
                  {String(unit.is_listed_publicly)}
                </Badge>
              </p>
              <p>
                <span className="text-on-surface-variant">{t("titleField")}: </span>
                {unit.listing_title ?? "—"}
              </p>
              <p>
                <span className="text-on-surface-variant">{t("slugField")}: </span>
                {unit.listing_slug ?? "—"}
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("images")}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <p className="font-body-sm text-body-sm text-on-surface-variant">{t("imagesHint")}</p>

          {images && images.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((img) => {
                const publicUrl = ctx.supabase.storage.from("listing-images").getPublicUrl(img.path).data
                  .publicUrl;
                return (
                  <li key={img.id} className="flex flex-col gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={publicUrl}
                      alt={img.alt_text ?? ""}
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                    {writable ? (
                      <form action={removeListingImageAction} className="self-end">
                        <input type="hidden" name="imageId" value={img.id} />
                        <input type="hidden" name="unitId" value={unit.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          {t("remove")}
                        </Button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant">{t("noImages")}</p>
          )}

          {writable ? <ListingImageUploadForm unitId={unit.id} buildingId={unit.building_id} /> : null}
        </CardBody>
      </Card>
    </div>
  );
}