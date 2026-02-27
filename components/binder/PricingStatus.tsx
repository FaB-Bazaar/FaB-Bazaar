// components/binder/PricingStatus.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { CheckCircle, Info } from 'lucide-react';

interface PricingStatusProps {
  lastUpdatedAt?: Date | null;
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const PricingStatus: React.FC<PricingStatusProps> = ({ lastUpdatedAt }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showTooltip && !target.closest('.tooltip-container')) {
        setShowTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTooltip]);

  const label = lastUpdatedAt
    ? `Prices updated ${formatRelativeDate(lastUpdatedAt)}`
    : 'Prices updated daily';

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <CheckCircle className="h-4 w-4" />
        <span>{label}</span>
      </div>

      {/* Click-to-toggle Tooltip */}
      <div className="relative tooltip-container">
        <button
          onClick={() => setShowTooltip(!showTooltip)}
          className={`text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ${
            showTooltip ? 'text-blue-500 dark:text-blue-400' : ''
          }`}
          aria-label="System status information"
        >
          <Info className="h-4 w-4" />
        </button>

        {showTooltip && (
          <div className="absolute left-1/2 transform -translate-x-1/2 top-full mt-2 w-80 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg z-50">
            <div className="space-y-2">
              <p className="font-medium">How pricing works:</p>
              <p>• Card prices sync once daily from tcgcsv.com</p>
              <p>• Collection values are calculated in real-time</p>
              <p>• For live prices, check <a href="https://www.tcgplayer.com/search/flesh-and-blood-tcg/product?productLineName=flesh-and-blood-tcg&page=1&view=grid" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline">tcgplayer.com</a></p>
            </div>
            {/* Tooltip arrow pointing up */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900 dark:border-b-gray-800"></div>
          </div>
        )}
      </div>
    </div>
  );
};
