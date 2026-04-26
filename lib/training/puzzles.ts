// lib/training/puzzles.ts
//
// Curated value-framework puzzles for /training. Each puzzle presents a hand
// (with hero/weapon context) and asks the player to assign Attack / Block / Pitch
// to each card. After submitting, the precomputed "lines" reveal the article-
// sourced lessons.
//
// Card stats (power, defense, pitch, cost) come from the printings table.
// imageUrl uses the standard Cloudflare delivery pattern.

export type PuzzleAction = "unused" | "attack" | "block" | "pitch";

export interface PuzzleCard {
  id: string;
  printingId: string;
  name: string;
  power: number;
  defense: number;
  pitch: number;
  cost: number;
  imageUrl: string;
  pitchColor: "red" | "yellow" | "blue";
  subtypes?: string[];
}

export interface PuzzleHero {
  name: string;
  printingId: string;
  imageUrl: string;
  abilityNote?: string;
}

export interface PuzzleWeapon {
  id: string;
  name: string;
  printingId: string;
  imageUrl: string;
  power: number;
  cost: number;
  note?: string;
  subtypes?: string[];
}

export interface PuzzleHeroAbility {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costReductionSubtype?: string;
  // When true, activating the ability returns the first graveyard card to a
  // "returned" zone where the user picks attack or pitch for it. The card's
  // own stats determine the contribution.
  consumesGraveyardCard?: boolean;
}

export interface PuzzleLine {
  id: string;
  label: string;
  description: string;
  total: number;
  breakdown: string;
}

export interface Puzzle {
  id: string;
  title: string;
  lessonTag: string;
  hero: PuzzleHero;
  weapons?: PuzzleWeapon[];
  heroAbility?: PuzzleHeroAbility;
  scenario: string;
  hand: PuzzleCard[];
  graveyard?: PuzzleCard[];
  graveyardNote?: string;
  incomingAttack: { value: number; description: string };
  lines: PuzzleLine[];
  optimalLineId: string;
  lesson: string;
  source: string;
}

const img = (printingId: string) =>
  `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${printingId}/public`;

export const PUZZLES: Puzzle[] = [
  // ── Puzzle 1 ────────────────────────────────────────────────────────────
  {
    id: "brawnhide-action-points",
    title: "Brute hand: where does the action point go?",
    lessonTag: "Action-point allocation",
    hero: {
      name: "Brute",
      printingId: "",
      imageUrl: "",
      abilityNote: "Generic Brute attacks. No hero ability or weapon used.",
    },
    scenario:
      "You're piloting a Brute deck. Your opponent attacks for 8. Most cards are 0-cost, so the real decision is which one to spend your single action point on after Head Jab.",
    hand: [
      {
        id: "brawnhide",
        printingId: "cDbcHtpNjDjtwm9THfMpk",
        name: "Barraging Brawnhide (blue)",
        power: 5,
        defense: 2,
        pitch: 3,
        cost: 3,
        imageUrl: img("cDbcHtpNjDjtwm9THfMpk"),
        pitchColor: "blue",
      },
      {
        id: "head-jab",
        printingId: "CFdkjrbMz8bnPjbkmqzBF",
        name: "Head Jab (red)",
        power: 3,
        defense: 2,
        pitch: 1,
        cost: 0,
        imageUrl: img("CFdkjrbMz8bnPjbkmqzBF"),
        pitchColor: "red",
      },
      {
        id: "wounding-blow",
        printingId: "Ttc8bDLbkDD7Pc8d6kK7k",
        name: "Wounding Blow (red)",
        power: 4,
        defense: 3,
        pitch: 1,
        cost: 0,
        imageUrl: img("Ttc8bDLbkDD7Pc8d6kK7k"),
        pitchColor: "red",
      },
      {
        id: "raging-onslaught",
        printingId: "MppLRWQHTCgMftc6Ftkn6",
        name: "Raging Onslaught (red)",
        power: 7,
        defense: 3,
        pitch: 1,
        cost: 3,
        imageUrl: img("MppLRWQHTCgMftc6Ftkn6"),
        pitchColor: "red",
      },
    ],
    incomingAttack: {
      value: 8,
      description: "Opponent attacks for 8 (no on-hit effect).",
    },
    lines: [
      {
        id: "block-out",
        label: "Block everything",
        description:
          "Hide behind the whole hand. Wastes most of the defense (block totals 10 vs 8 incoming) and contributes nothing on offense.",
        total: 8,
        breakdown: "0 attack + 8 blocked (over-block ignored) = 8",
      },
      {
        id: "wounding-blow-line",
        label: "Wounding Blow line",
        description:
          "Attack with Head Jab and Wounding Blow (7 damage). Block with Brawnhide and Raging Onslaught (5 prevented).",
        total: 12,
        breakdown: "7 attack + 5 blocked = 12",
      },
      {
        id: "raging-onslaught-line",
        label: "Raging Onslaught line",
        description:
          "Pitch Brawnhide for 3 to pay Raging Onslaught's cost. Attack with Head Jab and Raging Onslaught (10 damage). Block with Wounding Blow (3 prevented).",
        total: 13,
        breakdown: "10 attack + 3 blocked = 13",
      },
    ],
    optimalLineId: "raging-onslaught-line",
    lesson:
      "Action points are the real constraint here, not damage. Both Wounding Blow and Raging Onslaught take an action point, so the question becomes: which one earns the action point its highest value? Pitching Brawnhide to power Raging Onslaught (7 power) beats the Wounding Blow line (4 power) by exactly the gap between the two attacks (3) minus what you give up on defense (2) = +1 net.",
    source: "Thinking Like a Pro: Value (Brawnhide hand example).",
  },

  // ── Puzzle 2 ────────────────────────────────────────────────────────────
  {
    id: "fai-aggressive-go-again",
    title: "Fai: aggressive hand, full go-again chain",
    lessonTag: "Aggressive decks attack everything",
    hero: {
      name: "Fai, Rising Rebellion",
      printingId: "ncq89NkTPw6NTFh6kKDpc",
      imageUrl: img("ncq89NkTPw6NTFh6kKDpc"),
      abilityNote:
        "Fai's hero ability and Searing Emberblade chain together to add reach. Phoenix Flame returns from graveyard during the chain.",
    },
    weapons: [
      {
        id: "searing-emberblade",
        name: "Searing Emberblade",
        printingId: "c7Bw7RmCRHBQwTb6RMhjr",
        imageUrl: img("c7Bw7RmCRHBQwTb6RMhjr"),
        power: 3,
        cost: 2,
        subtypes: ["draconic"],
      },
    ],
    heroAbility: {
      id: "fai-phoenix-chain",
      name: "Phoenix Chain",
      description:
        "Activate Fai's hero ability — return a Phoenix Flame from graveyard to hand. Costs 3, reduced by 1 for each Draconic chain link you control (attacks + weapon swings tagged Draconic).",
      baseCost: 3,
      costReductionSubtype: "draconic",
      consumesGraveyardCard: true,
    },
    scenario:
      "You're playing Fai, Rising Rebellion. You have 2 Phoenix Flames in graveyard. Opponent presented only a moderate attack this turn. Every card in hand has go-again potential — what's the line?",
    hand: [
      {
        id: "brand-cinderclaw",
        printingId: "pW8McWBBMnfctjHn9kHrR",
        name: "Brand with Cinderclaw (blue)",
        power: 1,
        defense: 2,
        pitch: 3,
        cost: 0,
        imageUrl: img("pW8McWBBMnfctjHn9kHrR"),
        pitchColor: "blue",
        subtypes: ["draconic"],
      },
      {
        id: "command-and-conquer",
        printingId: "kfdLTDtgtRk9QQhrMKtnP",
        name: "Command and Conquer",
        power: 6,
        defense: 3,
        pitch: 1,
        cost: 2,
        imageUrl: img("kfdLTDtgtRk9QQhrMKtnP"),
        pitchColor: "red",
      },
      {
        id: "rising-resentment",
        printingId: "FpHBWLftHNztbkWrmW9tN",
        name: "Rising Resentment (red)",
        power: 3,
        defense: 2,
        pitch: 1,
        cost: 0,
        imageUrl: img("FpHBWLftHNztbkWrmW9tN"),
        pitchColor: "red",
        subtypes: ["draconic"],
      },
      {
        id: "ronin-renegade",
        printingId: "MJf6m7jqFMDgHjMB7mQt7",
        name: "Ronin Renegade (red)",
        power: 3,
        defense: 2,
        pitch: 1,
        cost: 0,
        imageUrl: img("MJf6m7jqFMDgHjMB7mQt7"),
        pitchColor: "red",
        subtypes: ["draconic"],
      },
    ],
    graveyard: [
      {
        id: "phoenix-flame-1",
        printingId: "bt9kQ6J6L8CbMtFjKfkfz",
        name: "Phoenix Flame",
        power: 1,
        defense: 0,
        pitch: 1,
        cost: 0,
        imageUrl: img("bt9kQ6J6L8CbMtFjKfkfz"),
        pitchColor: "red",
        subtypes: ["draconic"],
      },
      {
        id: "phoenix-flame-2",
        printingId: "bt9kQ6J6L8CbMtFjKfkfz",
        name: "Phoenix Flame",
        power: 1,
        defense: 0,
        pitch: 1,
        cost: 0,
        imageUrl: img("bt9kQ6J6L8CbMtFjKfkfz"),
        pitchColor: "red",
        subtypes: ["draconic"],
      },
    ],
    graveyardNote: "2× Phoenix Flame in graveyard.",
    incomingAttack: {
      value: 6,
      description: "Opponent presents a 6-damage attack with no on-hit effect.",
    },
    lines: [
      {
        id: "full-block",
        label: "Block everything",
        description:
          "Hide behind the entire hand. Defense totals 9 but caps at 6. You produce zero offense and waste your hand.",
        total: 6,
        breakdown: "0 attack + 6 blocked = 6",
      },
      {
        id: "split-2-2",
        label: "Block 2 / attack 2",
        description:
          "Block with two cards (≈5), swing two attackers for ~6 damage. Lukewarm — neither defends well nor pressures.",
        total: 11,
        breakdown: "~6 attack + ~5 blocked = 11",
      },
      {
        id: "full-attack-chain",
        label: "Full-attack chain (take the 6)",
        description:
          "Take the 6. Pitch Brand (3 res). Attack Ronin → Rising → Searing weapon swing (3 Draconic chain links so far, 1 res floating after Searing's 2 cost). Activate Fai's ability for free (cost 3 − 3 Draconic links = 0) to return Phoenix Flame. Pitch PF (+1 res) and attack with Command and Conquer for 2. Total: 15 damage threatened.",
        total: 15,
        breakdown: "15 attack + 0 blocked = 15 (you take 6 face)",
      },
    ],
    optimalLineId: "full-attack-chain",
    lesson:
      "Aggressive go-again decks live or die by hand conversion on offense. The chain only closes because of the Draconic chain-link tower: Ronin → Rising → Searing all qualify, dropping Fai's ability cost to 0, which returns a Phoenix Flame to pitch and pay Command and Conquer's 2 cost. Without the ability the resource math doesn't work — you'd be 1 short. That's the value of synergy: 15 damage threatened from a 4-card hand, +9 vs full-block.",
    source:
      "Card Value & Turn Cycle Logic (Fai aggressive hand example, 15-damage chain).",
  },

  // ── Puzzle 3 ────────────────────────────────────────────────────────────
  {
    id: "bravo-pitch-to-weapon",
    title: "Bravo: heavy hand, pitch to the weapon",
    lessonTag: "Pitch-to-weapon when red attacks underwhelm",
    hero: {
      name: "Bravo, Showstopper",
      printingId: "fd6ztBbmtntbwDJBq89kh",
      imageUrl: img("fd6ztBbmtntbwDJBq89kh"),
      abilityNote:
        "Bravo's ability gives Anothos +1 attack and dominate when you pay 1 from a non-attack action.",
    },
    weapons: [
      {
        id: "anothos",
        name: "Anothos",
        printingId: "NJqtTchQKFgmQTNF7dCRb",
        imageUrl: img("NJqtTchQKFgmQTNF7dCRb"),
        power: 4,
        cost: 1,
        note: "With pitched resources, swing for 4.",
      },
    ],
    scenario:
      "You're playing Bravo, Showstopper. None of these cards have go-again, and the red ones are heavy. Opponent attacks for 9.",
    hand: [
      {
        id: "buckling-1",
        printingId: "MbgCTLhQ9DRnjRRHwWjGJ",
        name: "Buckling Blow (blue)",
        power: 6,
        defense: 3,
        pitch: 3,
        cost: 4,
        imageUrl: img("MbgCTLhQ9DRnjRRHwWjGJ"),
        pitchColor: "blue",
      },
      {
        id: "buckling-2",
        printingId: "MbgCTLhQ9DRnjRRHwWjGJ",
        name: "Buckling Blow (blue)",
        power: 6,
        defense: 3,
        pitch: 3,
        cost: 4,
        imageUrl: img("MbgCTLhQ9DRnjRRHwWjGJ"),
        pitchColor: "blue",
      },
      {
        id: "chokeslam",
        printingId: "WmFGp8CfWDMdQPWNRHgwg",
        name: "Chokeslam (red)",
        power: 8,
        defense: 3,
        pitch: 1,
        cost: 4,
        imageUrl: img("WmFGp8CfWDMdQPWNRHgwg"),
        pitchColor: "red",
      },
      {
        id: "show-time",
        printingId: "mTD99mHC96Rz7Tj9kzNqj",
        name: "Show Time! (blue)",
        power: 0,
        defense: 3,
        pitch: 3,
        cost: 3,
        imageUrl: img("mTD99mHC96Rz7Tj9kzNqj"),
        pitchColor: "blue",
      },
    ],
    incomingAttack: {
      value: 9,
      description: "Opponent attacks for 9 (no on-hit effect).",
    },
    lines: [
      {
        id: "swing-chokeslam",
        label: "Attack with Chokeslam",
        description:
          "Pitch Show Time! and one Buckling for 6 resources. Swing Chokeslam for 8 (cost 4). Block the rest with one Buckling for 3.",
        total: 11,
        breakdown: "8 attack + 3 blocked = 11",
      },
      {
        id: "block-down-anothos",
        label: "Block down, swing Anothos",
        description:
          "Block with Chokeslam and both Bucklings (3+3+3 = 9 prevented, exactly covers incoming). Pitch Show Time! to swing Anothos for 4.",
        total: 13,
        breakdown: "4 attack + 9 blocked = 13",
      },
      {
        id: "full-block",
        label: "Block everything",
        description:
          "Block with all four cards. 12 defense, capped at 9 incoming. No offense at all.",
        total: 9,
        breakdown: "0 attack + 9 blocked = 9",
      },
    ],
    optimalLineId: "block-down-anothos",
    lesson:
      "When red attacks are heavy (Chokeslam costs 4, Bucklings cost 4) and have no go-again, attacking with them is expensive and slow. Pitching them for the weapon converts the same resources more efficiently. Block-down + Anothos extracts every point of defense from a hand that doesn't want to attack, and the 4 weapon damage clears the gap.",
    source: "Card Value & Turn Cycle Logic (Bravo + Anothos hand example).",
  },
];

export function getPuzzle(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}
