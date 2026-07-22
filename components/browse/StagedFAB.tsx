// components/browse/StagedFAB.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StagedFABProps {
  count: number;
  onClick: () => void;
  className?: string;
}

export default function StagedFAB({ count, onClick, className }: StagedFABProps) {
  if (count === 0) return null;

  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-30",
        "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600",
        "transition-all duration-200 ease-in-out",
        "lg:hidden", // Only show on mobile/tablet
        className
      )}
      size="icon"
    >
      <div className="relative">
        <Layers className="h-6 w-6 text-white" />
        <Badge
          className="absolute -top-2 -right-2 h-5 min-w-[20px] rounded-full bg-red-500 text-white text-xs font-bold px-1.5 border-2 border-white"
        >
          {count}
        </Badge>
      </div>
    </Button>
  );
}
