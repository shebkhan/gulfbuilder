import { setRequestLocale } from "next-intl/server";

export default async function PrintLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-neutral-200 p-6 text-black">
      <style>{`
        @page { size: A4; margin: 15mm; }
        @media print {
          body { background: #fff !important; }
          .print-no-print { display: none !important; }
          .print-sheet { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: none !important; }
        }
      `}</style>
      {children}
    </div>
  );
}
