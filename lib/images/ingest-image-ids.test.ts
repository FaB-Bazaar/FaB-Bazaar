import { describe, it, expect } from "vitest";
import { planIngestImageIds, type IngestRow } from "./ingest-image-ids";

const row = (over: Partial<IngestRow> & { printing_id: string }): IngestRow => ({
  language: "en",
  collector_number: "IAR001",
  foiling: "s",
  edition: "n",
  is_extended_art: false,
  is_front_face: true,
  art_variations: null,
  image_url: "https://storage.googleapis.com/lss/IAR001.webp",
  ...over,
});

describe("planIngestImageIds", () => {
  it("uploads under the deterministic key for a plain English printing", () => {
    const r = row({ printing_id: "nanoid1" });

    const plan = planIngestImageIds([r], [r]);

    expect(plan).toEqual([
      {
        printing_id: "nanoid1",
        image_id: "IAR001",
        source_url: "https://storage.googleapis.com/lss/IAR001.webp",
        fallback: false,
      },
    ]);
  });

  it("carries the language prefix and back-face suffix into the key", () => {
    const rows = [
      row({ printing_id: "n1", language: "ja", collector_number: "IAR106", foiling: "c" }),
      row({ printing_id: "n2", collector_number: "IAR106", is_front_face: false }),
    ];

    const plan = planIngestImageIds(rows, rows);

    expect(plan.map((p) => p.image_id)).toEqual(["JA_IAR106-CF", "IAR106_BACK"]);
  });

  it("falls back to printing_id when no key can be derived", () => {
    const r = row({ printing_id: "nanoid2", collector_number: "" });

    const plan = planIngestImageIds([r], [r]);

    expect(plan[0]).toMatchObject({ image_id: "nanoid2", fallback: true });
    expect(plan[0].reason).toBe("no derivable key");
  });

  it("falls back for every row in a colliding key group", () => {
    const rows = [
      row({ printing_id: "alt1", art_variations: null }),
      row({ printing_id: "alt2", art_variations: null }),
    ];

    const plan = planIngestImageIds(rows, rows);

    expect(plan.map((p) => [p.image_id, p.fallback])).toEqual([
      ["alt1", true],
      ["alt2", true],
    ]);
    expect(plan[0].reason).toBe("key collision: IAR001");
  });

  it("detects collisions against rows outside the pending set", () => {
    const pending = row({ printing_id: "new1" });
    const existing = row({ printing_id: "old1" });

    const plan = planIngestImageIds([pending], [pending, existing]);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ printing_id: "new1", image_id: "new1", fallback: true });
  });

  it("plans nothing for a row that has no source image", () => {
    const r = row({ printing_id: "nanoid3", image_url: null });

    expect(planIngestImageIds([r], [r])).toEqual([]);
  });
});
