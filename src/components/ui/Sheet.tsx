"use client";

import React, { useEffect, useId } from "react";

export type SheetPosition = "left" | "right" | "bottom";

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  position?: SheetPosition;
  children: React.ReactNode;
  className?: string;
}

const positionStyles: Record<SheetPosition, { container: string; panel: string }> = {
  right: {
    container: "fixed inset-y-0 right-0 flex max-w-full pl-10",
    panel: "w-screen max-w-md h-full rounded-l-2xl border-l border-slate-200 dark:border-slate-800",
  },
  left: {
    container: "fixed inset-y-0 left-0 flex max-w-full pr-10",
    panel: "w-screen max-w-md h-full rounded-r-2xl border-r border-slate-200 dark:border-slate-800",
  },
  bottom: {
    container: "fixed inset-x-0 bottom-0 flex max-h-full pt-10",
    panel: "w-full max-h-[85vh] rounded-t-2xl border-t border-slate-200 dark:border-slate-800 overflow-y-auto",
  },
};

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  position = "right",
  children,
  className = "",
}) => {
  const id = useId();
  const titleId = `${id}-sheet-title`;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentStyles = positionStyles[position];

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className={currentStyles.container}>
        <div
          className={`relative z-10 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-transform duration-200 ease-out text-left flex flex-col ${currentStyles.panel} ${className}`}
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            {title ? (
              <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h2>
            ) : <div />}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sheet"
              className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
};
