// lib/deck-utils.ts
// Utility functions for deck operations (non-auth related)
// NOTE: This file now uses the service layer - no direct mongoose access

import { deckService } from '@/lib/services';
import Deck from '@/models/Deck';
import mongoose from 'mongoose';

/**
 * Find deck by publicId
 * Primary lookup method for deck operations using the globally unique publicId.
 *
 * @param publicId - The deck's public identifier (21-char nanoid)
 * @param userId - Optional user ID for ownership verification
 * @returns Mongoose document or null if not found
 */
export async function findDeckByPublicId(publicId: string, userId?: string) {
  const query: any = { publicId };

  if (userId) {
    query.userId = new mongoose.Types.ObjectId(userId);
  }

  return Deck.findOne(query);
}

/**
 * Find deck with backwards compatibility (by slug or ObjectId)
 * Common utility for deck operations
 *
 * @deprecated Use findDeckByPublicId() instead - slug/ObjectId lookups are deprecated
 */
export async function findDeckWithBackwardsCompatibility(identifier: string, userId: string) {
  const result = await deckService.findBySlugOrId(identifier, userId);

  if (!result.success) {
    console.error('[deck-utils] Error finding deck:', result.error);
    return null;
  }

  return result.data;
}
