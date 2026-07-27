import { describe, it, expect } from 'vitest';
import { isCloudflareUploadId, resolveArticleImageUrl } from './article-image';

// `articles.image` holds one of two things:
//   - a Cloudflare upload id (UUID) from the admin image uploader
//   - a printing_id, when the cover was picked from a card
// The printing_id-keyed CDN images were deleted (2026-07), so a constructed
// `<CF_BASE>/<printing_id>/public` always 404s and must never be rendered.
const CF_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';

describe('isCloudflareUploadId', () => {
  it('recognizes a Cloudflare upload UUID', () => {
    expect(isCloudflareUploadId('707d9e0f-a50a-4453-3eae-7fd3a90d6200')).toBe(true);
  });

  it('rejects a 21-char printing_id nanoid', () => {
    expect(isCloudflareUploadId('LqgbhgKQtqTGbKPJp7cLd')).toBe(false);
  });
});

describe('resolveArticleImageUrl', () => {
  it('returns null when the article has no image', () => {
    expect(resolveArticleImageUrl(undefined, new Map())).toBeNull();
    expect(resolveArticleImageUrl('', new Map())).toBeNull();
  });

  it('builds a CDN url for a Cloudflare upload id', () => {
    const id = '707d9e0f-a50a-4453-3eae-7fd3a90d6200';
    expect(resolveArticleImageUrl(id, new Map())).toBe(`${CF_BASE}/${id}/public`);
  });

  it('uses the printing row image_url for a printing_id cover', () => {
    const printingId = 'LqgbhgKQtqTGbKPJp7cLd';
    const stored = `${CF_BASE}/EVO007/public`;
    const resolved = resolveArticleImageUrl(printingId, new Map([[printingId, stored]]));
    expect(resolved).toBe(stored);
  });

  it('never constructs a printing_id-keyed url when the lookup misses', () => {
    const printingId = 'LqgbhgKQtqTGbKPJp7cLd';
    const resolved = resolveArticleImageUrl(printingId, new Map());
    expect(resolved).toBeNull();
    expect(resolved ?? '').not.toContain(printingId);
  });

  it('falls back to a CDN url for a legacy non-UUID custom upload id', () => {
    // Custom-id uploads (e.g. playmats) are neither UUIDs nor printing ids, and
    // they do still exist on the CDN — only ids that look like printing ids are
    // withheld when unresolved.
    const id = 'playmat-brute-2024';
    expect(resolveArticleImageUrl(id, new Map())).toBe(`${CF_BASE}/${id}/public`);
  });
});
