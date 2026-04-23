/**
 * Content creator auth helpers.
 *
 * Composes the existing service layer (`authenticateRequest` + `userService` +
 * `customTokenCardService`) to centralize the role/profile gate used by portal
 * routes. Returns a pre-built NextResponse on failure so routes stay one-liners.
 *
 * Being built via strict TDD — bodies throw until driven by failing tests.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { userService, customTokenCardService } from '@/lib/services';
import type { CustomTokenCardCreatorDTO } from '@/lib/services/contracts/ICustomTokenCardService';

export type RequireContentCreatorRoleResult =
  | { success: true; userId: string }
  | { success: false; response: NextResponse };

export type RequireCreatorProfileResult =
  | { success: true; userId: string; creator: CustomTokenCardCreatorDTO }
  | { success: false; response: NextResponse };

export async function requireContentCreatorRole(req: NextRequest): Promise<RequireContentCreatorRoleResult> {
  const auth = await authenticateRequest(req, {}, { allowOAuth: true });
  if (!auth.success || !auth.userId) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  const roleResult = await userService.hasRole(auth.userId, 'isContentCreator');
  if (!roleResult.success) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  if (!roleResult.data) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Content creator role required' }, { status: 403 }),
    };
  }

  return { success: true, userId: auth.userId };
}

export async function requireCreatorProfile(req: NextRequest): Promise<RequireCreatorProfileResult> {
  const roleGate = await requireContentCreatorRole(req);
  if (!roleGate.success) return roleGate;

  const creatorResult = await customTokenCardService.getCreatorByUserId(roleGate.userId);
  if (!creatorResult.success) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Failed to resolve creator profile' }, { status: 500 }),
    };
  }
  if (!creatorResult.data) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Creator profile not found — create one first' }, { status: 404 }),
    };
  }

  return { success: true, userId: roleGate.userId, creator: creatorResult.data };
}
