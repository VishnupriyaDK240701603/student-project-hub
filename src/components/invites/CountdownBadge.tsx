"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui";

interface CountdownBadgeProps {
  expiresAt: string | null;
  className?: string;
}

export const CountdownBadge: React.FC<CountdownBadgeProps> = ({ expiresAt, className = "" }) => {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    if (!expiresAt) return;

    const calculate = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft("Expired");
        return;
      }

      const totalHours = Math.floor(diff / (1000 * 60 * 60));
      const totalMinutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (totalHours > 24) {
        const days = Math.floor(totalHours / 24);
        const remHours = totalHours % 24;
        setTimeLeft(`${days}d ${remHours}h left`);
      } else if (totalHours > 0) {
        setTimeLeft(`${totalHours}h ${totalMinutes}m left`);
      } else {
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${totalMinutes}m ${seconds}s left`);
      }
    };

    calculate();
    const interval = setInterval(calculate, 10000); // 10 second refresh
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return null;

  return (
    <Badge
      variant={isExpired ? "danger" : "warning"}
      size="sm"
      className={`font-mono text-[10px] tracking-tight ${className}`}
    >
      ⏱️ {timeLeft}
    </Badge>
  );
};
