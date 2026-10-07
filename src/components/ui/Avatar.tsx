"use client";

import React, { useState } from "react";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
  status?: "online" | "offline" | "busy";
}

const sizeStyles: Record<AvatarSize, { container: string; text: string; dot: string }> = {
  sm: { container: "h-7 w-7", text: "text-xs", dot: "h-2 w-2" },
  md: { container: "h-9 w-9", text: "text-sm", dot: "h-2.5 w-2.5" },
  lg: { container: "h-11 w-11", text: "text-base font-semibold", dot: "h-3 w-3" },
  xl: { container: "h-14 w-14", text: "text-lg font-bold", dot: "h-3.5 w-3.5" },
};

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = "md",
  className = "",
  status,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const currentSize = sizeStyles[size];
  const initials = getInitials(name);

  return (
    <div className={`relative inline-block ${currentSize.container} shrink-0`}>
      <div
        className={`flex h-full w-full items-center justify-center rounded-full overflow-hidden select-none bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-medium ${currentSize.text} ${className}`}
        title={name}
      >
        {src && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-white dark:ring-slate-900 ${
            currentSize.dot
          } ${
            status === "online"
              ? "bg-green-500"
              : status === "busy"
              ? "bg-amber-500"
              : "bg-slate-400"
          }`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
};
