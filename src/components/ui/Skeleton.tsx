import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: "sm" | "md" | "lg" | "full";
}

const roundedStyles = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
  full: "rounded-full",
};

export const Skeleton: React.FC<SkeletonProps> = ({
  rounded = "md",
  className = "",
  ...props
}) => {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-slate-200 dark:bg-slate-800 ${roundedStyles[rounded]} ${className}`}
      {...props}
    />
  );
};
