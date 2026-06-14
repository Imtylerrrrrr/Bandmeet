// 로딩 스켈레톤(스피너 대신 레이아웃 모양 그대로). animate-pulse.

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-hover ${className}`} />;
}

/** 헤더 + 본문 스켈레톤(인증 라우트 loading.tsx 공용). */
export function AppSkeleton() {
  return (
    <>
      <div className="sticky top-0 border-b bg-surface">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-2.5">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-72" />
        </div>
      </div>
      <main className="mx-auto flex max-w-[1100px] flex-col gap-4 px-6 py-6">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-80 w-full" />
      </main>
    </>
  );
}
