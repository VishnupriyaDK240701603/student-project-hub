import React from "react";

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dotColor: string }> = {
  neutral: {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    dotColor: "bg-slate-400",
  },
  accent: {
    bg: "bg-indigo-50 dark:bg-indigo-950/70",
    text: "text-indigo-700 dark:text-indigo-300",
    dotColor: "bg-indigo-500",
  },
  success: {
    bg: "bg-emerald-50 dark:bg-emerald-950/70",
    text: "text-emerald-700 dark:text-emerald-300",
    dotColor: "bg-emerald-500",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/70",
    text: "text-amber-800 dark:text-amber-300",
    dotColor: "bg-amber-500",
  },
  danger: {
    bg: "bg-rose-50 dark:bg-rose-950/70",
    text: "text-rose-700 dark:text-rose-300",
    dotColor: "bg-rose-500",
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "text-[11px] px-2 py-0.5 gap-1",
  md: "text-xs px-2.5 py-1 gap-1.5",
};

export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  size = "sm",
  dot = false,
  children,
  className = "",
  ...props
}) => {
  const currentVariant = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${currentVariant.bg} ${currentVariant.text} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${currentVariant.dotColor}`}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
};
