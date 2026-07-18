import { deterministicImageId, type PrintingKeyAttrs } from "./deterministic-image-id";

export interface MigratableRow extends PrintingKeyAttrs {
  printing_id: string;
  set: string;
  image_url: string | null;
}

export interface PlannedUpload {
  printing_id: string;
  new_image_id: string;
  source_url: string;
  new_image_url: string;
}

export interface MigrationPlan {
  uploads: PlannedUpload[];
  fallbacks: Array<{ printing_id: string; reason: string }>;
  done: Array<{ printing_id: string }>;
}

const CF_URL = /^(https:\/\/imagedelivery\.net\/[^/]+)\/[^/]+\/([^/]+)$/;

export function planImageIdMigration(
  rows: MigratableRow[],
  opts: { set?: string } = {},
): MigrationPlan {
  // Collision detection always runs over the FULL row set; opts.set only
  // filters which rows get actions, so a scoped run can never adopt a key
  // that collides with a row outside the filter.
  const keyCount = new Map<string, number>();
  const keys = new Map<string, string | null>();
  for (const row of rows) {
    const key = deterministicImageId(row);
    keys.set(row.printing_id, key);
    if (key !== null) keyCount.set(key, (keyCount.get(key) ?? 0) + 1);
  }

  const plan: MigrationPlan = { uploads: [], fallbacks: [], done: [] };

  for (const row of rows) {
    if (opts.set && row.set !== opts.set) continue;

    const key = keys.get(row.printing_id) ?? null;
    if (key === null) {
      plan.fallbacks.push({ printing_id: row.printing_id, reason: "no derivable key" });
      continue;
    }
    if ((keyCount.get(key) ?? 0) > 1) {
      plan.fallbacks.push({ printing_id: row.printing_id, reason: `key collision: ${key}` });
      continue;
    }

    const m = row.image_url?.match(CF_URL);
    if (!m) {
      plan.fallbacks.push({ printing_id: row.printing_id, reason: "image not on imagedelivery" });
      continue;
    }
    const [, base, variant] = m;
    const targetUrl = `${base}/${key}/${variant}`;
    if (row.image_url === targetUrl) {
      plan.done.push({ printing_id: row.printing_id });
      continue;
    }

    plan.uploads.push({
      printing_id: row.printing_id,
      new_image_id: key,
      source_url: row.image_url!,
      new_image_url: targetUrl,
    });
  }

  return plan;
}
