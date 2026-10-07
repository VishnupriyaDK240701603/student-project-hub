"use client";

import React, { useEffect, useState } from "react";
import { Button, IconButton } from "@/components/ui";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallPrompt: React.FC<{ className?: string }> = ({ className = "" }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true); // default true until mounted

  useEffect(() => {
    // Check if already in standalone PWA mode
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(isStandaloneMode);

    if (isStandaloneMode) return;

    // Check if dismissed previously in session
    const wasDismissed = sessionStorage.getItem("sph_install_dismissed");
    if (wasDismissed) {
      setDismissed(true);
      return;
    }
    setDismissed(false);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !/crios|fxios/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Capture Chrome/Edge install prompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Register service worker if supported
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("Service worker registration skipped:", err);
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("sph_install_dismissed", "true");
  };

  if (isStandalone || dismissed) {
    return null;
  }

  // If not iOS and no install prompt event yet, don't show empty box
  if (!isIOS && !deferredPrompt) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="App installation notice"
      className={`relative rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/90 to-purple-50/90 dark:from-indigo-950/40 dark:to-purple-950/40 p-4 shadow-sm text-left ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-sm">
            SP
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Install Student Project Hub
            </h4>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {isIOS
                ? "Install on your iPhone/iPad for instant room access & notifications."
                : "Install as a desktop or mobile application for the fastest experience."}
            </p>

            {isIOS && (
              <div className="mt-2 text-[11px] text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/70 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                <span>
                  Tap the <strong>Share</strong> icon (
                  <svg
                    className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom text-indigo-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                  ) in Safari, then choose <strong>&quot;Add to Home Screen&quot;</strong>.
                </span>
              </div>
            )}

            {!isIOS && deferredPrompt && (
              <div className="mt-3">
                <Button onClick={handleInstallClick} size="sm" variant="primary">
                  Install Application
                </Button>
              </div>
            )}
          </div>
        </div>

        <IconButton
          aria-label="Dismiss install prompt"
          onClick={handleDismiss}
          size="sm"
          variant="ghost"
          className="text-slate-400 hover:text-slate-600"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </IconButton>
      </div>
    </div>
  );
};
