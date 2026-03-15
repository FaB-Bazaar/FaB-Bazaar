"use client";

import { cn } from "@/lib/utils";

interface TalisharToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
}

export default function TalisharToggle({ checked, onChange }: TalisharToggleProps) {
  return (
    <button
      role="switch"
      type="button"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      title={checked ? "Remove from Talishar" : "Make available on Talishar"}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked
          ? "bg-green-500 dark:bg-green-600"
          : "bg-gray-300 dark:bg-gray-600"
      )}
    >
      <span
        className={cn(
          "pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      >
        <img
          src="https://talishar.net/assets/CoinLogo-CXy1VyVE.png"
          alt="Talishar"
          className="h-4 w-4 object-contain"
        />
      </span>
    </button>
  );
}
