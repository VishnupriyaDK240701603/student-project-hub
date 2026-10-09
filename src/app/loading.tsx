export default function Loading() {
  return (
    <main className="min-h-dvh bg-[#f4f7f5] text-[#112217] dark:bg-[#08150e] dark:text-[#f4fbf6] md:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#0a2215] p-6 md:flex">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-white/10" />
          <div className="space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-white/15" />
            <div className="h-2 w-24 animate-pulse rounded bg-emerald-200/15" />
          </div>
        </div>
        <div className="mt-12 space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-11 animate-pulse rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      </aside>

      <section aria-label="Loading page" className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-[#dce8df] dark:bg-[#1a3525]" />
        <div className="rounded-3xl border border-[#dce8df] bg-white p-6 shadow-sm dark:border-[#1a3525] dark:bg-[#0e2016] sm:p-8">
          <div className="h-5 w-36 animate-pulse rounded bg-[#dce8df] dark:bg-[#1a3525]" />
          <div className="mt-4 h-8 w-2/3 animate-pulse rounded-lg bg-[#e8f1ec] dark:bg-[#14281d]" />
          <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-[#e8f1ec] dark:bg-[#14281d]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="space-y-4 rounded-2xl border border-[#dce8df] bg-white p-5 dark:border-[#1a3525] dark:bg-[#0e2016]">
              <div className="h-4 w-24 animate-pulse rounded-full bg-[#dce8df] dark:bg-[#1a3525]" />
              <div className="h-6 w-3/4 animate-pulse rounded bg-[#e8f1ec] dark:bg-[#14281d]" />
              <div className="h-12 animate-pulse rounded bg-[#e8f1ec] dark:bg-[#14281d]" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
