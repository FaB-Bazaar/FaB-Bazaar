/**
 * Custom Token Cards Client Service
 *
 * Wraps the public `/api/creators/*` + `/api/token-cards/*` surface and the
 * authenticated `/api/portal/*` surface in a consistent ApiResponse<T> shape.
 */

import type { ApiResponse } from './types';
import { handleResponse, handleError } from './utils';
import type {
  CustomTokenCardCreatorDTO,
  CustomTokenCardDTO,
  CreateCreatorProfileInput,
  UpdateCreatorProfileInput,
  CreateCustomTokenCardInput,
  UpdateCustomTokenCardInput,
} from '@/lib/services/contracts/ICustomTokenCardService';

// ============================================================================
// Public reads
// ============================================================================

export async function listCreators(): Promise<ApiResponse<CustomTokenCardCreatorDTO[]>> {
  try {
    return await handleResponse(await fetch('/api/creators'));
  } catch (error) {
    return handleError(error);
  }
}

export async function getCreatorBySlug(
  slug: string,
): Promise<ApiResponse<{ creator: CustomTokenCardCreatorDTO; tokenCards: CustomTokenCardDTO[] }>> {
  try {
    return await handleResponse(await fetch(`/api/creators/${encodeURIComponent(slug)}`));
  } catch (error) {
    return handleError(error);
  }
}

export async function getTokenCard(tokenCardId: string): Promise<ApiResponse<CustomTokenCardDTO>> {
  try {
    return await handleResponse(await fetch(`/api/token-cards/${encodeURIComponent(tokenCardId)}`));
  } catch (error) {
    return handleError(error);
  }
}

// ============================================================================
// Portal (authenticated)
// ============================================================================

export async function getMyCreatorProfile(): Promise<ApiResponse<CustomTokenCardCreatorDTO | null>> {
  try {
    return await handleResponse(await fetch('/api/portal/creator-profile'));
  } catch (error) {
    return handleError(error);
  }
}

export async function createMyCreatorProfile(
  input: CreateCreatorProfileInput,
): Promise<ApiResponse<CustomTokenCardCreatorDTO>> {
  try {
    const response = await fetch('/api/portal/creator-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return await handleResponse(response);
  } catch (error) {
    return handleError(error);
  }
}

export async function updateMyCreatorProfile(
  input: UpdateCreatorProfileInput,
): Promise<ApiResponse<CustomTokenCardCreatorDTO>> {
  try {
    const response = await fetch('/api/portal/creator-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return await handleResponse(response);
  } catch (error) {
    return handleError(error);
  }
}

export async function listMyTokenCards(): Promise<ApiResponse<CustomTokenCardDTO[]>> {
  try {
    return await handleResponse(await fetch('/api/portal/token-cards'));
  } catch (error) {
    return handleError(error);
  }
}

export async function createTokenCard(
  input: CreateCustomTokenCardInput,
): Promise<ApiResponse<CustomTokenCardDTO>> {
  try {
    const response = await fetch('/api/portal/token-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return await handleResponse(response);
  } catch (error) {
    return handleError(error);
  }
}

export async function updateTokenCard(
  tokenCardId: string,
  input: UpdateCustomTokenCardInput,
): Promise<ApiResponse<CustomTokenCardDTO>> {
  try {
    const response = await fetch(`/api/portal/token-cards/${encodeURIComponent(tokenCardId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return await handleResponse(response);
  } catch (error) {
    return handleError(error);
  }
}

export async function deleteTokenCard(tokenCardId: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`/api/portal/token-cards/${encodeURIComponent(tokenCardId)}`, {
      method: 'DELETE',
    });
    return await handleResponse(response);
  } catch (error) {
    return handleError(error);
  }
}
