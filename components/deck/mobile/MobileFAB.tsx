// components/deck/mobile/MobileFAB.tsx
"use client";

import React from "react";
import { Plus } from "lucide-react";

interface MobileFABProps {
  onClick: () => void;
}

export default function MobileFAB({ onClick }: MobileFABProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center active:bg-blue-700 transition-colors"
      aria-label="Add card to deck"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
