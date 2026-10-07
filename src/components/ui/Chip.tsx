import React from "react";

export type ChipVariant = "default" | "accent" | "success" | "warning" | "danger";

export interface ChipProps {
  label: string;
  variant?: ChipVariant;
  selected?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

const variantStyles: Record<ChipVariant, { base: string; selected: string }> = {
  default: {
    base: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
    selected: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
  },
  accent: {
    base: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-950",
    selected: "bg-indigo-600 text-white dark:bg-indigo-500",
  },
  success: {
    base: "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/60 dark:text-green-300",
    selected: "bg-green-600 text-white",
  },
  warning: {
    base: "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300",
    selected: "bg-amber-600 text-white",
  },
  danger: {
    base: "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-300",
    selected: "bg-red-600 text-white",
  },
};

export const Chip: React.FC<ChipProps> = ({
  label,
  variant = "default",
  selected = false,
  onRemove,
  onClick,
  className = "",
  disabled = false,
}) => {
  const styles = selected
    ? variantStyles[variant].selected
    : variantStyles[variant].base;

  return (
    <span
      onClick={!disabled ? onClick : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onKeyDown={
        onClick && !disabled
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors duration-150 select-none ${
        onClick ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" : ""
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${styles} ${className}`}
    >
      <span>{label}</span>
      {onRemove && !disabled && (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 -mr-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current"
        >
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </span>
  );
};
