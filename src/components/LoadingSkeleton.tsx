export const LoadingSkeleton = () => (
  <div className="mx-auto min-h-dvh w-full max-w-[1920px] px-3 py-4 sm:px-5 lg:px-6 xl:px-8 2xl:px-10">
    <div className="space-y-4">
      <div className="fly-enter h-20 animate-pulse rounded-[28px] bg-white/60 [--enter-base:0ms] dark:bg-white/10" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="fly-enter h-44 animate-pulse rounded-[28px] bg-white/60 [--enter-base:90ms] dark:bg-white/10" />
        <div className="fly-enter h-44 animate-pulse rounded-[28px] bg-white/60 [--enter-base:140ms] dark:bg-white/10" />
      </div>
      <div className="fly-enter h-64 animate-pulse rounded-[28px] bg-white/60 [--enter-base:220ms] dark:bg-white/10" />
    </div>
  </div>
);
