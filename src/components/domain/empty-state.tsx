import { LottieAnimation } from "@/components/domain/lottie-animation";
import { cn } from "@/lib/utils";

export function EmptyState({
  animation = "/animations/empty-box.lottie",
  title,
  description,
  className,
}: {
  animation?: string;
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}>
      <LottieAnimation src={animation} className="h-28 w-28" />
      {title ? <p className="font-headline-sm text-headline-sm text-on-surface">{title}</p> : null}
      {description ? (
        <p className="max-w-sm font-body-md text-body-md text-on-surface-variant">{description}</p>
      ) : null}
    </div>
  );
}