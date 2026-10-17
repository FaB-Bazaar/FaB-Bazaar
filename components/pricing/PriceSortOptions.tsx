// The "price" sort options for the viewer's price source (TCG Low $ or Cardmarket €).
import type { PriceSource } from '@/lib/pricing/price-source'

export function PriceSortOptions({ source }: { source: PriceSource }) {
  return source === 'cardmarket' ? (
    <>
      <option value="cardmarket-desc">Sort: Cardmarket € (High to Low)</option>
      <option value="cardmarket-asc">Sort: Cardmarket € (Low to High)</option>
    </>
  ) : (
    <>
      <option value="tcg-low-desc">Sort: TCG Low (High to Low)</option>
      <option value="tcg-low-asc">Sort: TCG Low (Low to High)</option>
    </>
  )
}
