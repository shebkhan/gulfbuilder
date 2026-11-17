import type { RelatedSection } from "@/components/domain/related-links";
import type { Role } from "@/lib/rbac";

type PageHeaderProps = {
  section: RelatedSection;
  role: Role;
  title: React.ReactNode;
  description: React.ReactNode;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
