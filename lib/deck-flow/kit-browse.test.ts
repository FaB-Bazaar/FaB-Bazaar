import { describe, it, expect } from "vitest";
import { buildKitSections } from "./kit-browse";

const build = (id: string, name: string, printingIds: string[], curator?: string | null) => ({
  id,
  name,
  cards: printingIds.map(printingId => ({ printingId })),
  curatorUser: curator === undefined ? null : { displayUsername: curator },
});

describe("buildKitSections", () => {
  it("dedupes repeated printingIds within a kit into qty counts, preserving first-seen order", () => {
    const { sections } = buildKitSections([build("k1", "Aggro Kit", ["a", "b", "a", "c", "a", "b"])]);
    expect(sections).toHaveLength(1);
    expect(sections[0].entries).toEqual([
      { printingId: "a", qty: 3 },
      { printingId: "b", qty: 2 },
      { printingId: "c", qty: 1 },
    ]);
  });

  it("keeps duplicate cards across kits in each kit's section, but collects unique ids once", () => {
    const { sections, allPrintingIds } = buildKitSections([
      build("k1", "Kit One", ["a", "b"]),
      build("k2", "Kit Two", ["b", "c", "b"]),
    ]);
    expect(sections[0].entries.map(e => e.printingId)).toEqual(["a", "b"]);
    expect(sections[1].entries).toEqual([
      { printingId: "b", qty: 2 },
      { printingId: "c", qty: 1 },
    ]);
    expect(allPrintingIds).toEqual(["a", "b", "c"]);
  });

  it("skips kits with no cards and carries curator display names", () => {
    const { sections } = buildKitSections([
      build("k1", "Empty Kit", []),
      build("k2", "Real Kit", ["x"], "mistercakes"),
      build("k3", "Anon Kit", ["y"]),
    ]);
    expect(sections.map(s => s.name)).toEqual(["Real Kit", "Anon Kit"]);
    expect(sections[0].curatorName).toBe("mistercakes");
    expect(sections[1].curatorName).toBeNull();
  });

  it("returns empty results for no builds", () => {
    expect(buildKitSections([])).toEqual({ sections: [], allPrintingIds: [] });
  });

  it("counts total cards per section including repeats", () => {
    const { sections } = buildKitSections([build("k1", "Kit", ["a", "a", "b"])]);
    expect(sections[0].totalCards).toBe(3);
  });
});
