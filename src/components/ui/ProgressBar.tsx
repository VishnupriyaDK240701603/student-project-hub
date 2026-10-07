import React from "react";

export type ProgressVariant = "accent" | "success" | "warning" | "danger";

export interface ProgressBarProps {
  value?: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: ProgressVariant;
  indeterminate?: boolean;
  className?: string;
}

const variantStyles: Record<ProgressVariant, string> = {
  accent: "bg-indigo-600 dark:bg-indigo-500",
  success: "bg-emerald-600 dark:bg-emerald-500",
  warning: "bg-amber-600 dark:bg-amber-500",
  danger: "bg-rose-600 dark:bg-rose-500",
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value = 0,
  max = 100,
  label,
  showValue = false,
  variant = "accent",
  indeterminate = false,
  className = "",
}) => {
  const percentage = Math.min(Math.max(Math.round((value / max) * 100), 0), 100);

  return (
    <div className={`w-full text-left space-y-1.5 ${className}`}>
      {(label || showValue) && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-700 dark:text-slate-300">
          {label && <span>{label}</span>}
          {showValue && !indeterminate && <span>{percentage}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : percentage}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || "Progress"}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            variantStyles[variant]
          } ${
            indeterminate
              ? "w-1/3 animate-[indeterminate_1.5s_infinite_linear]"
              : ""
          }`}
          style={!indeterminate ? { width: `${percentage}%` } : undefined}
        />
      </div>
    </div>
  );
};
