export default function BlockedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-2xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 p-8 shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
          <svg className="h-7 w-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">
          Account Restricted
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Your account has been blocked or deactivated. If you believe this is an error,
          please contact your college administration or the system moderators for assistance.
        </p>
        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
          Blocked accounts cannot access any features of the Student Project Hub.
          If your account was deactivated due to graduation, this is expected behavior.
        </p>
      </div>
    </main>
  );
}
