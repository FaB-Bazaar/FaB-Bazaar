/**
 * Article cover images.
 *
 * `articles.image` stores a bare id, not a url, and it can be either:
 *   - a Cloudflare upload id (UUID) from the admin image uploader, or
 *   - a `printing_id`, when the cover was picked from a card.
 *
 * Card images are keyed by printing characteristics now (2026-07), and the old
 * printing_id-keyed Cloudflare images were DELETED — so `<CF_BASE>/<printing_id>/public`
 * 404s. A printing_id cover must be resolved through the printing row's stored
 * `image_url`; it must never be turned into a url by string concatenation.
 */

const CF_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';

const CF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** printing_id / card_unique_id shape: a 21-char nanoid. */
const NANOID_21 = /^[A-Za-z0-9_-]{21}$/;

export function isCloudflareUploadId(imageId: string): boolean {
  return CF_UUID.test(imageId);
}

/** An id that looks like one of our nanoid PKs — i.e. a deleted CDN image. */
function looksLikePrintingId(imageId: string): boolean {
  return !isCloudflareUploadId(imageId) && NANOID_21.test(imageId);
}

/**
 * Turn a stored `articles.image` id into a renderable url.
 *
 * @param imageId          the raw `articles.image` value
 * @param printingImageUrls printing_id -> stored `image_url`, from resolveArticleImageUrls()
 * @returns a url, or null when there is nothing safe to render (caller shows its placeholder)
 */
export function resolveArticleImageUrl(
  imageId: string | null | undefined,
  printingImageUrls: Map<string, string>
): string | null {
  if (!imageId) return null;

  const fromPrinting = printingImageUrls.get(imageId);
  if (fromPrinting) return fromPrinting;

  // Unresolved and shaped like a printing_id: the CDN image is gone. Render the
  // placeholder rather than a url we know 404s.
  if (looksLikePrintingId(imageId)) return null;

  return `${CF_BASE}/${imageId}/public`;
}

/**
 * Batch-resolve the printing-backed covers in a set of article image ids.
 * Ids that aren't printing-shaped are skipped — they need no lookup.
 */
export async function resolveArticleImageUrls(
  imageIds: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const candidates = [...new Set(imageIds.filter((id): id is string => !!id && looksLikePrintingId(id)))];
  const resolved = new Map<string, string>();
  if (candidates.length === 0) return resolved;

  // Lazy import: keeps this module safe to use from anywhere without risking the
  // ServiceFactory circular-dependency TDZ trap.
  const { printingsService } = await import('@/lib/services');
  const result = await printingsService.getPrintingsByIds(candidates, { limit: candidates.length });
  if (!result.success) {
    console.error('[article-image] failed to resolve printing covers:', result.error);
    return resolved;
  }

  for (const printing of result.data?.printings ?? []) {
    if (printing.printing_id && printing.image_url) {
      resolved.set(printing.printing_id, printing.image_url);
    }
  }
  return resolved;
}
