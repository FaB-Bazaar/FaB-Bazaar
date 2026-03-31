// import mongoose from 'mongoose';
// import connectToDatabase from '@/lib/mongodb';

// Original function - keep for backwards compatibility
export function recalculateRarityCounts(cards: any[]) {
  const counts = { C: 0, R: 0, S: 0, M: 0, L: 0, F: 0, T: 0, B: 0, V: 0, P: 0 }
  for (const card of cards) {
    const rarity = (card.rarity || card.printingDetails?.rarity)?.toUpperCase()
    const qty = typeof card.quantity === 'number' ? card.quantity : (card.quantity?.$numberInt ? Number(card.quantity.$numberInt) : 1)
    if (rarity && (rarity in counts)) {
      counts[rarity as keyof typeof counts] += qty
    }
  }
  return counts
}

