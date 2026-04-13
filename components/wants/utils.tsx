// components/wants/utils.tsx

import React from 'react';
import { TcgAffiliateLink } from '@/components/tracking';
import { FOILING_STYLES } from '@/lib/fab-constants/foilings';

export const getFoilingInfo = (foiling?: string): { name: string; className: string } => {
  const key = foiling?.toLowerCase() as keyof typeof FOILING_STYLES | undefined;
  return (key && FOILING_STYLES[key]) ?? { name: 'Non-foil', className: 'bg-gray-500 text-white' };
};

export const getColorDot = (color?: string): string => {
  const colors: Record<string, string> = {
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
  };
  return colors[color ?? ''] ?? 'bg-gray-400';
};

export const renderPriceLine = (
  price: number | undefined,
  label: string,
  quantity: number,
  isLow = false
): React.ReactNode => {
  if (!price || price === 0) return null;
  const totalValue = price * quantity;
  return (
    <div className={`${isLow ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-600 dark:text-gray-400'} text-xs`}>
      <div className="flex justify-between items-center">
        <span className="text-gray-500 dark:text-gray-400">{label}:</span>
        <span>
          {quantity > 1
            ? `$${price.toFixed(2)} × ${quantity} = $${totalValue.toFixed(2)}`
            : `$${price.toFixed(2)}`}
        </span>
      </div>
    </div>
  );
};

export const renderPurchaseLink = (
  url: string | undefined,
  feature: string,
  showLabel = false
): React.ReactNode => {
  if (!url) return null;
  return (
    <div className="text-xs mt-2 pt-2 border-t border-gray-100 dark:border-gray-600">
      <TcgAffiliateLink
        tcgplayerUrl={url}
        feature={feature}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        title="Purchase on TCGPlayer"
      >
        <span>Available for purchase here</span>
        <div className="flex items-center gap-1">
          <img
            src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
            alt="TCGPlayer"
            className="h-4 w-auto"
          />
          {showLabel && <span className="font-medium">TCGPlayer</span>}
        </div>
      </TcgAffiliateLink>
    </div>
  );
};
