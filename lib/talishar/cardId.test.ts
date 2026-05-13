import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toTalisharCardId, normalizeTalisharId } from "./cardId";

describe("toTalisharCardId", () => {
  it("handles plain ASCII names with each pitch suffix", () => {
    expect(toTalisharCardId("Crown of Providence", 0)).toBe("crown_of_providence");
    expect(toTalisharCardId("Snapdragon Scalers", 0)).toBe("snapdragon_scalers");
    expect(toTalisharCardId("Aether Dart", 1)).toBe("aether_dart_red");
    expect(toTalisharCardId("Aether Dart", 2)).toBe("aether_dart_yellow");
    expect(toTalisharCardId("Aether Dart", 3)).toBe("aether_dart_blue");
  });

  it("strips apostrophes, commas, colons, exclamation marks", () => {
    expect(toTalisharCardId("Titan's Fist", 2)).toBe("titans_fist_yellow");
    expect(toTalisharCardId("Aegis, Archangel of Protection", 0)).toBe("aegis_archangel_of_protection");
    expect(toTalisharCardId("Art of the Dragon: Blood", 1)).toBe("art_of_the_dragon_blood_red");
    expect(toTalisharCardId("Wrench-tastic!", 0)).toBe("wrench_tastic");
  });

  it("strips commas inside numbers", () => {
    expect(toTalisharCardId("10,000 Year Reunion", 1)).toBe("10000_year_reunion_red");
  });

  it("preserves double underscore between DFC faces", () => {
    expect(toTalisharCardId("Comet Storm // Shock", 1)).toBe("comet_storm__shock_red");
  });

  it("transliterates diacritics including ð (eth)", () => {
    expect(toTalisharCardId("Jarl Vetreiði", 0)).toBe("jarl_vetreidi");
  });

  it("appends the pitch word verbatim even when the slug already ends in it", () => {
    // "Backup Protocol: RED" is a pitch-1 card whose slug ends in "_red"; the
    // suffix is still appended, producing backup_protocol_red_red.
    expect(toTalisharCardId("Backup Protocol: RED", 1)).toBe("backup_protocol_red_red");
  });

  it("honors Talishar's one hardcoded exception", () => {
    expect(toTalisharCardId("Goldfin Harpoon", 0)).toBe("goldfin_harpoon_yellow");
  });

  it("matches every (cardId, name, pitch) triple from real FaB Bazaar game results", () => {
    // Fixture extracted from a deck with 17 game results — see lib/talishar/__fixtures__/.
    const raw = readFileSync(join(__dirname, "__fixtures__/real-cards.jsonl"), "utf8");
    const samples = raw.split("\n").filter(Boolean).map(l => JSON.parse(l) as {
      cardId: string;
      cardName: string;
      pitchValue: number;
    });

    const mismatches: Array<{ cardName: string; pitchValue: number; expected: string; got: string }> = [];
    for (const s of samples) {
      const got = toTalisharCardId(s.cardName, s.pitchValue);
      if (got !== s.cardId) mismatches.push({ ...s, expected: s.cardId, got });
    }

    expect(mismatches).toEqual([]);
    expect(samples.length).toBeGreaterThan(300);
  });
});

describe("normalizeTalisharId", () => {
  it("strips the _equip state suffix", () => {
    expect(normalizeTalisharId("crown_of_providence_equip")).toBe("crown_of_providence");
  });

  it("preserves the pitch suffix on equipped pitched equipment (Evo)", () => {
    // Evo equipment is pitched — the cards table stores the pitch suffix as
    // part of the canonical talishar_card_id, so stripping the pitch alongside
    // _equip would break the lookup.
    expect(normalizeTalisharId("evo_beta_base_chest_blue_equip")).toBe("evo_beta_base_chest_blue");
    expect(normalizeTalisharId("evo_atom_breaker_red_equip")).toBe("evo_atom_breaker_red");
    expect(normalizeTalisharId("evo_battery_pack_yellow_equip")).toBe("evo_battery_pack_yellow");
  });

  it("strips the _ally state suffix", () => {
    expect(normalizeTalisharId("ash_runs_red_ally")).toBe("ash_runs_red");
  });

  it("strips the _r reversed suffix", () => {
    expect(normalizeTalisharId("cintari_saber_r")).toBe("cintari_saber");
  });

  it("strips the SET-coded alt-art prefix", () => {
    expect(normalizeTalisharId("MST053_inner_chi_blue")).toBe("inner_chi_blue");
  });

  it("is a no-op on a clean cardId", () => {
    expect(normalizeTalisharId("titans_fist_yellow")).toBe("titans_fist_yellow");
  });

  it("strips prefix then suffix when both are present", () => {
    expect(normalizeTalisharId("MST053_inner_chi_blue")).toBe("inner_chi_blue");
  });
});
