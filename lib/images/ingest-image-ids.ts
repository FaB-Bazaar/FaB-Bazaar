/**
 * Decide the Cloudflare custom id to upload a freshly-ingested printing under.
 *
 * Ingest is the one moment where we can put the image at its deterministic
 * LSS-style key on the FIRST upload — no CF→CF copy, no orphaned nanoid image
 * (which is what migrate-image-ids.ts has to clean up after the fact).
 *
 * Same fallback contract as the migration: a row whose key can't be derived,
 * or whose key collides with another row (the alt-art tail — printings that
 * differ by nothing but the image itself), keeps its printing_id-keyed image.
 * Collision detection runs over `universe`, not `pending`, so a row already in
 * the DB can veto a new row's claim on a key.
 */
import { deterministicImageId, type PrintingKeyAttrs } from "./deterministic-image-id";

export interface IngestRow extends PrintingKeyAttrs {
  printing_id: string;
  /** Source image to fetch and re-upload (LSS S3 at ingest time). */
  image_url: string | null;
}

export interface PlannedIngestUpload {
  printing_id: string;
  /** Cloudflare custom id — deterministic key, or printing_id when falling back. */
  image_id: string;
  source_url: string;
  fallback: boolean;
  reason?: string;
}

export function planIngestImageIds(
  pending: IngestRow[],
  universe: IngestRow[],
): PlannedIngestUpload[] {
  const keyCount = new Map<string, number>();
  for (const row of universe) {
    const key = deterministicImageId(row);
    if (key !== null) keyCount.set(key, (keyCount.get(key) ?? 0) + 1);
  }

  const plan: PlannedIngestUpload[] = [];

  for (const row of pending) {
    if (!row.image_url) continue;

    const key = deterministicImageId(row);
    if (key === null) {
      plan.push({
        printing_id: row.printing_id,
        image_id: row.printing_id,
        source_url: row.image_url,
        fallback: true,
        reason: "no derivable key",
      });
      continue;
    }
    if ((keyCount.get(key) ?? 0) > 1) {
      plan.push({
        printing_id: row.printing_id,
        image_id: row.printing_id,
        source_url: row.image_url,
        fallback: true,
        reason: `key collision: ${key}`,
      });
      continue;
    }

    plan.push({
      printing_id: row.printing_id,
      image_id: key,
      source_url: row.image_url,
      fallback: false,
    });
  }

  return plan;
}
