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

// // New database-based function for modified binders (used in add route)
// export async function recalculateModifiedBinders(binders: any[]) {
//   for (const binder of binders) {
//     const counts = { C: 0, R: 0, S: 0, M: 0, L: 0, F: 0, T: 0, B: 0, V: 0, P: 0 };
    
//     for (const card of binder.cards || []) {
//       const rarity = (card.printingDetails?.rarity || card.rarity)?.toUpperCase();
//       const quantity = typeof card.quantity === 'number' 
//         ? card.quantity 
//         : (card.quantity?.$numberInt ? parseInt(card.quantity.$numberInt) : 1);
      
//       if (rarity && counts.hasOwnProperty(rarity)) {
//         counts[rarity] += quantity;
//       }
//     }
    
//     // Update the binder object and save
//     binder.rarityCounts = counts;
//     await binder.save();
    
//     console.log(`[RarityRecalc] Updated binder ${binder.slug || binder.name}:`, counts);
//   }
// }

// // Calculate rarity counts for all binders of a user
// export async function recalculateUserRarityCounts(userId: string) {
//   const { db } = await connectToDatabase();
  
//   // Get all binders for this user in one query
//   const binders = await db.collection('binders')
//     .find({ userId: new mongoose.Types.ObjectId(userId) })
//     .toArray();
  
//   // Calculate totals across all binders
//   const counts = { C: 0, R: 0, S: 0, M: 0, L: 0, F: 0, T: 0, B: 0, V: 0, P: 0 };
  
//   for (const binder of binders) {
//     for (const card of binder.cards || []) {
//       const rarity = (card.printingDetails?.rarity || card.rarity)?.toUpperCase();
//       const quantity = typeof card.quantity === 'number' 
//         ? card.quantity 
//         : (card.quantity?.$numberInt ? parseInt(card.quantity.$numberInt) : 1);
      
//       if (rarity && counts.hasOwnProperty(rarity)) {
//         counts[rarity] += quantity;
//       }
//     }
//   }
  
//   // Update all user's binders with the same counts (bulk operation)
//   if (binders.length > 0) {
//     await db.collection('binders').updateMany(
//       { userId: new mongoose.Types.ObjectId(userId) },
//       { 
//         $set: { 
//           rarityCounts: counts,
//           updatedAt: new Date()
//         } 
//       }
//     );
//   }
  
//   console.log(`[RarityRecalc] Updated ${binders.length} binders for user ${userId}:`, counts);
//   return counts;
// }