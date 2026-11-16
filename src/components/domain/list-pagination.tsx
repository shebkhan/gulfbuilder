import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PAGE_SIZE, pageHref } from "@/lib/pagination";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type Props = {
  page: number;
  pages: number;
  total: number;
  /** List path, e.g. "/tenants". */
  href: string;
  /** Active filters, kept in every link. */
  params?: Record<string, string | undefined>;
  pageSize?: number;
};

/** Page numbers to show: the first and last page, plus a window around the current one. */
function pageWindow(page: number, pages: number): (number | "ellipsis")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);

  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) items.push("ellipsis");
  for (let number = start; number <= end; number += 1) items.push(number);
  if (end < pages - 1) items.push("ellipsis");
  items.push(pages);
  return items;
}

export async function ListPagination({
  page,
  pages,
  total,
  href,
  params = {},
  pageSize = PAGE_SIZE,
}: Props) {
  if (pages <= 1) return null;

  const t = await getTranslations("pagination");
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center gap-3 pt-1">
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        {t("summary", { from, to, total })}
      </p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            {page > 1 ? (
              <PaginationPrevious asChild>
                <Link href={pageHref(href, params, page - 1)}>
                  <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
                  <span>{t("previous")}</span>
                </Link>
              </PaginationPrevious>
            ) : (
              <PaginationPrevious aria-disabled className="pointer-events-none opacity-40">
                <span>{t("previous")}</span>
              </PaginationPrevious>
            )}
          </PaginationItem>

          {pageWindow(page, pages).map((entry) =>
            entry === "ellipsis" ? (
              <PaginationItem key="ellipsis">
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={entry}>
                <PaginationLink asChild isActive={entry === page}>
                  <Link href={pageHref(href, params, entry)}>{entry}</Link>
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            {page < pages ? (
              <PaginationNext asChild>
                <Link href={pageHref(href, params, page + 1)}>
                  <span>{t("next")}</span>
                  <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
                </Link>
              </PaginationNext>
            ) : (
              <PaginationNext aria-disabled className="pointer-events-none opacity-40">
                <span>{t("next")}</span>
              </PaginationNext>
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
