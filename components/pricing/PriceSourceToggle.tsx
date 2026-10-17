"use client"

// Account-wide price source switch: TCGplayer $ / Cardmarket €. See hooks/usePriceSource.
import type { PriceSource } from '@/lib/pricing/price-source'

const OPTIONS: { value: PriceSource; label: string; title: string }[] = [
  { value: 'tcgplayer', label: '$ TCGplayer', title: 'Show TCGplayer prices in US dollars' },
  { value: 'cardmarket', label: '€ Cardmarket', title: 'Show Cardmarket prices in euros' },
]

export function PriceSourceToggle({ value, onChange }: { value: PriceSource; onChange: (v: PriceSource) => void }) {
  return (
    <div role="group" aria-label="Prices from" className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden shrink-0">
      {OPTIONS.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-base whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              active
                ? 'bg-blue-50 dark:bg-gray-700 text-blue-700 dark:text-blue-300 font-semibold border-t-[3px] border-blue-500'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {active && <span aria-hidden="true">✓ </span>}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
