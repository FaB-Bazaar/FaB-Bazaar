// lib/deck-utils.ts
// DEAD CODE — commented out 2026-03-22
// Neither function is imported anywhere. Use deckService.findByPublicId() instead.

// import { deckService } from '@/lib/services';
// import Deck from '@/models/Deck';
// import mongoose from 'mongoose';

// /**
//  * Find deck by publicId
//  * @deprecated Use deckService.findByPublicId() from @/lib/services instead
//  */
// export async function findDeckByPublicId(publicId: string, userId?: string) {
//   const query: any = { publicId };
//   if (userId) {
//     query.userId = new mongoose.Types.ObjectId(userId);
//   }
//   return Deck.findOne(query);
// }

// /**
//  * Find deck with backwards compatibility (by slug or ObjectId)
//  * @deprecated Use deckService.findBySlugOrId() from @/lib/services instead
//  */
// export async function findDeckWithBackwardsCompatibility(identifier: string, userId: string) {
//   const result = await deckService.findBySlugOrId(identifier, userId);
//   if (!result.success) {
//     console.error('[deck-utils] Error finding deck:', result.error);
//     return null;
//   }
//   return result.data;
// }
