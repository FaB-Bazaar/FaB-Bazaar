import { describe, it, expect } from "vitest";
import { candidateSourceKeys, resolveFallbackClaims } from "./upgrade-plan";

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
