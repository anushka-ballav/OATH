export const LoadingSkeleton = () => (
  <div className="space-y-4 p-4">
    <div className="h-20 animate-pulse rounded-[28px] bg-white/60 dark:bg-white/10" />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="h-44 animate-pulse rounded-[28px] bg-white/60 dark:bg-white/10" />
      <div className="h-44 animate-pulse rounded-[28px] bg-white/60 dark:bg-white/10" />
    </div>
    <div className="h-64 animate-pulse rounded-[28px] bg-white/60 dark:bg-white/10" />
  </div>
);
