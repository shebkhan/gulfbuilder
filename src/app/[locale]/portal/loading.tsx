import { LottieAnimation } from "@/components/domain/lottie-animation";

export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LottieAnimation src="/animations/loading.lottie" className="h-16 w-16" />
    </div>
  );
}