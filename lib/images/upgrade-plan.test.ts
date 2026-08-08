import { describe, it, expect } from "vitest";
import { candidateSourceKeys, resolveFallbackClaims, resolveFeedClaims } from "./upgrade-plan";

// Candidate CardVault "large" keys to try, in order, for a Cloudflare image
// key. First hit wins. Derivation rules were established empirically against
// Rosetta (2026-08): CardVault omits our doubled -EA-EA suffix entirely, and
// publishes cold-foil (Marvel) art under `<collector>-MV` rather than `-CF*`.
describe("candidateSourceKeys", () => {
  it("plain key: itself only", () => {
    expect(candidateSourceKeys("ROS116")).toEqual(["ROS116"]);
  });

  it("rainbow foil: itself only", () => {
    expect(candidateSourceKeys("ROS176-RF")).toEqual(["ROS176-RF"]);
  });

  it("digit-leading set codes are valid keys", () => {
    expect(candidateSourceKeys("1HP357")).toEqual(["1HP357"]);
  });

  it("cold foil falls back to the Marvel key", () => {
    expect(candidateSourceKeys("ROS255-CF")).toEqual(["ROS255-CF", "ROS255-MV"]);
  });

  it("cold foil with art variations still falls back to base Marvel key", () => {
    expect(candidateSourceKeys("ROS022-CF-AA-FA")).toEqual(["ROS022-CF-AA-FA", "ROS022-MV"]);
    expect(candidateSourceKeys("ROS133-CF-FA")).toEqual(["ROS133-CF-FA", "ROS133-MV"]);
  });

  it("doubled extended-art suffix strips entirely", () => {
    expect(candidateSourceKeys("ROS033-EA-EA")).toEqual(["ROS033-EA-EA", "ROS033"]);
    expect(candidateSourceKeys("ROS033-RF-EA-EA")).toEqual(["ROS033-RF-EA-EA", "ROS033-RF"]);
  });

  it("cold foil + doubled EA chains both fallbacks", () => {
    expect(candidateSourceKeys("ROS028-CF-EA-EA")).toEqual([
      "ROS028-CF-EA-EA",
      "ROS028-CF",
      "ROS028-MV",
    ]);
  });

  it("language prefix is preserved through fallbacks", () => {
    expect(candidateSourceKeys("JA_ROS076-CF")).toEqual(["JA_ROS076-CF", "JA_ROS076-MV"]);
  });

  // Editioned sets (WTR/ARC/CRU/MON/ELE/EVR) encode the edition in the key,
  // but CardVault publishes ONE image per card with no edition token — and it
  // is the FIRST EDITION / ALPHA art (verified 2026-08 by diffing the edition
  // symbol: CardVault ELE001 scored 8.2 against 1st-ed vs 37.3 against
  // unlimited; WTR001 5.1 alpha vs 10.3 unlimited). So a 1E/AL key may drop
  // its edition token, and an unlimited key must NEVER derive anything —
  // it would silently serve first-edition art on an Unlimited printing.
  it("first-edition keys drop the edition token", () => {
    expect(candidateSourceKeys("EVR001-1E")).toEqual(["EVR001-1E", "EVR001"]);
    expect(candidateSourceKeys("ARC002-1E")).toEqual(["ARC002-1E", "ARC002"]);
  });

  it("alpha keys drop the edition token", () => {
    expect(candidateSourceKeys("WTR001-AL")).toEqual(["WTR001-AL", "WTR001"]);
  });

  it("edition token is dropped mid-suffix, and chains with other rules", () => {
    expect(candidateSourceKeys("EVR001-CF-1E")).toEqual(["EVR001-CF-1E", "EVR001-CF", "EVR001-MV"]);
    expect(candidateSourceKeys("WTR000-CF-AL")).toEqual(["WTR000-CF-AL", "WTR000-CF", "WTR000-MV"]);
    expect(candidateSourceKeys("EVR021-RF-EA-1E-EA")).toEqual([
      "EVR021-RF-EA-1E-EA",
      "EVR021-RF-EA-EA",
      "EVR021-RF",
    ]);
  });

  it("unlimited keys derive NOTHING — CardVault has no unlimited art", () => {
    expect(candidateSourceKeys("ELE001-UL")).toEqual(["ELE001-UL"]);
    expect(candidateSourceKeys("ARC000-RF-UL")).toEqual(["ARC000-RF-UL"]);
    // Especially not the marvel fallback: that would be first-edition art.
    expect(candidateSourceKeys("MON001-CF-UL")).toEqual(["MON001-CF-UL"]);
  });

  it("nanoid (printing_id fallback) keys are not derivable", () => {
    expect(candidateSourceKeys("WNJdpMp9wf7tn9wWPhj9q")).toEqual([]);
    expect(candidateSourceKeys("cLHGKMCjPb89zwNPmMFBp")).toEqual([]);
  });

  it("back-face keys keep their suffix", () => {
    expect(candidateSourceKeys("MPW135-FA_BACK")).toEqual(["MPW135-FA_BACK"]);
  });

  it("underscore-attached back-face keys are derivable (UPR hero backs)", () => {
    expect(candidateSourceKeys("UPR006_BACK")).toEqual(["UPR006_BACK"]);
  });
});

// Two different printings may resolve (via fallback) onto the SAME source
// image (e.g. ROS255-CF and ROS255-CF-FA both → ROS255-MV). That means at
// least one of them would get wrong art — skip every claimant and report,
// never guess. Direct self-claims (key === source) can't collide because
// image keys are unique.
describe("resolveFallbackClaims", () => {
  it("passes unique claims through", () => {
    const out = resolveFallbackClaims([
      { key: "ROS255-CF", source: "ROS255-MV" },
      { key: "ROS133-CF-FA", source: "ROS133-MV" },
    ]);
    expect(out.accepted).toEqual([
      { key: "ROS255-CF", source: "ROS255-MV" },
      { key: "ROS133-CF-FA", source: "ROS133-MV" },
    ]);
    expect(out.collided).toEqual([]);
  });

  it("rejects every claimant of a contested source", () => {
    const out = resolveFallbackClaims([
      { key: "ROS255-CF", source: "ROS255-MV" },
      { key: "ROS255-CF-FA", source: "ROS255-MV" },
      { key: "ROS013-CF", source: "ROS013-MV" },
    ]);
    expect(out.accepted).toEqual([{ key: "ROS013-CF", source: "ROS013-MV" }]);
    expect(out.collided.map((c) => c.key).sort()).toEqual(["ROS255-CF", "ROS255-CF-FA"]);
  });

  it("self-claims (direct hits) never collide with fallback claims", () => {
    const out = resolveFallbackClaims([
      { key: "ROS255-MV", source: "ROS255-MV" },
      { key: "ROS255-CF", source: "ROS255-MV" },
    ]);
    expect(out.accepted).toEqual([{ key: "ROS255-MV", source: "ROS255-MV" }]);
    expect(out.collided.map((c) => c.key)).toEqual(["ROS255-CF"]);
  });
});

// The fab-cube feed uses ONE image file per (card, edition, art variant) and
// reuses it across finishes — foiling is a physical treatment, not different
// art (verified: ELE003 standard and cold foil both point at
// ELE003.width-450.png). So two image keys sharing a feed source is normal and
// correct when the rows differ only by foiling; it is a genuine conflict when
// they differ by edition, art variant, or face.
describe("resolveFeedClaims", () => {
  const row = (over: Partial<{ collector: string; edition: string; artVariations: string[]; isFrontFace: boolean }> = {}) => ({
    collector: "ELE003", edition: "u", artVariations: [] as string[], isFrontFace: true, ...over,
  });

  it("accepts a source claimed by one key", () => {
    const out = resolveFeedClaims([{ key: "ELE003-UL", source: "U-ELE003.png", rows: [row()] }]);
    expect(out.accepted.map((c) => c.key)).toEqual(["ELE003-UL"]);
    expect(out.rejected).toEqual([]);
  });

  it("accepts finish variants sharing one source", () => {
    const out = resolveFeedClaims([
      { key: "ELE003-UL", source: "U-ELE003.png", rows: [row()] },
      { key: "ELE003-RF-UL", source: "U-ELE003.png", rows: [row()] },
    ]);
    expect(out.accepted.map((c) => c.key).sort()).toEqual(["ELE003-RF-UL", "ELE003-UL"]);
    expect(out.rejected).toEqual([]);
  });

  it("rejects keys of different EDITIONS sharing a source", () => {
    const out = resolveFeedClaims([
      { key: "ELE003-1E", source: "ELE003.png", rows: [row({ edition: "f" })] },
      { key: "ELE003-UL", source: "ELE003.png", rows: [row({ edition: "u" })] },
    ]);
    expect(out.accepted).toEqual([]);
    expect(out.rejected.map((c) => c.key).sort()).toEqual(["ELE003-1E", "ELE003-UL"]);
  });

  it("rejects keys of different ART VARIANTS sharing a source", () => {
    const out = resolveFeedClaims([
      { key: "ELE003-UL", source: "U-ELE003.png", rows: [row()] },
      { key: "ELE003-EA-UL", source: "U-ELE003.png", rows: [row({ artVariations: ["EA"] })] },
    ]);
    expect(out.accepted).toEqual([]);
    expect(out.rejected).toHaveLength(2);
  });

  it("rejects front and back faces sharing a source", () => {
    const out = resolveFeedClaims([
      { key: "ELE003-UL", source: "U-ELE003.png", rows: [row()] },
      { key: "ELE003-UL_BACK", source: "U-ELE003.png", rows: [row({ isFrontFace: false })] },
    ]);
    expect(out.accepted).toEqual([]);
    expect(out.rejected).toHaveLength(2);
  });
});
