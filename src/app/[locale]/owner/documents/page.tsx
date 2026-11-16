import { FileText } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnerDocuments, getOwnerScope } from "@/server/queries/owner-portal";

export default async function OwnerDocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("owner.documents");
  const scope = await getOwnerScope();
  if (!scope) return null;

  const documents = await getOwnerDocuments(scope);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("list")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {documents.length === 0 ? (
            <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="flex items-center gap-2 font-body-md text-body-md font-medium text-on-surface">
                    <FileText className="size-4 text-primary" />
                    {d.kind}
                  </span>
                  {d.expires_on && (
                    <Badge
                      variant={
                        d.expires_on < new Date().toISOString().slice(0, 10) ? "danger" : "warning"
                      }
                    >
                      {t("expiresOn", { date: d.expires_on })}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
