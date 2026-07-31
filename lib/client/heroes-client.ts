/**
 * Heroes Client Service
 *
 * Client-side API abstraction for hero lookups: format legality rows
 * (`/api/heroes`) and representative hero card printings with images
 * (`/api/hero-printings`).
 */

import type { ApiResponse } from './types';
import { handleResponse, handleError } from './utils';
import type { HeroLegalityRow } from '@/lib/services/contracts/IPrintingsService';

export interface HeroPrinting {
  name: string;
  image_url: string | null;
  [key: string]: any;
}

/**
 * Get hero legality rows, optionally scoped to a format code (e.g. 'cc',
 * 'blitz'). No format returns all heroes.
 */
export async function getHeroes(
  formatCode?: string
): Promise<ApiResponse<HeroLegalityRow[]>> {
  try {
    const url = formatCode
      ? `/api/heroes?format=${encodeURIComponent(formatCode)}`
      : '/api/heroes';
    const response = await fetch(url);
    return await handleResponse<HeroLegalityRow[]>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get representative hero card printings (name + image) for a hero age
 * bracket.
 *
 * The route returns `heroes`/`count` at the TOP LEVEL of the body (no `data`
 * key), so this repackages the body instead of using handleResponse.
 */
export async function getHeroPrintings(
  format: 'young' | 'adult'
): Promise<ApiResponse<{ heroes: HeroPrinting[]; count: number }>> {
  try {
    const response = await fetch(`/api/hero-printings?format=${format}`);
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      return {
        success: false,
        error: body?.error || `HTTP ${response.status}: ${response.statusText}`,
        code: body?.code || `HTTP_${response.status}`,
      };
    }
    return {
      success: true,
      data: { heroes: body.heroes ?? [], count: body.count ?? 0 },
    };
  } catch (error) {
    return handleError(error);
  }
}
