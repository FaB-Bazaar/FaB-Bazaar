// app/api/mcp/resource/fabConstants.ts
//
// Mandatory first read for every MCP session — keep it LEAN.
// This payload is a per-session token tax on every client (free-tier Le Chat
// hits turn limits on large payloads). Guardrail: resourcePayloads.test.ts
// pins a size budget and the load-bearing content. Before adding anything,
// ask: is it already in tools/list descriptions, another resource
// (fab://heroes-by-format), or searchable://card/fields?

import {
  FOILING_MAP,
  EDITION_MAP,
  SET_MAP,
  CARD_FILTER_SETS,
  RARITY_MAP,
  CARD_NAME_ABBREVIATIONS,
  KEYWORDS,
  COLORS,
  EQUIPMENT_SUBTYPES,
  HERO_CLASSES,
  PRICE_RANGES,
  POWER_RANGES,
  COST_RANGES
} from '@/lib/fab-constants';

import { HERO_NICKNAMES } from '@/lib/fab-constants';

export const fabConstantsResource = {
  type: 'resource',
  name: 'fab_constants',
  description: '🎯 ESSENTIAL FIRST READ: Flesh and Blood game constants, abbreviations, and search codes. READ THIS BEFORE using search_printings tool!',
  schema: {
    type: 'object',
    properties: {
      foiling_mappings: {
        type: 'object',
        description: 'Maps foiling abbreviations to search codes (r=Rainbow, c=Cold, s=Standard, g=Gold)'
      },
      edition_mappings: {
        type: 'object',
        description: 'Maps edition abbreviations to search codes (a=Alpha, f=First, u=Unlimited, n=Normal)'
      },
      set_mappings: {
        type: 'object',
        description: 'Maps set abbreviations to official search codes'
      },
      rarity_mappings: {
        type: 'object',
        description: 'Maps rarity abbreviations to search codes'
      },
      card_name_abbreviations: {
        type: 'object',
        description: 'Common card name shortcuts and their full names'
      },
      hero_mappings: {
        type: 'object',
        description: 'Hero nickname → canonical name mapping. Full per-format roster lives in fab://heroes-by-format.'
      },
      talent_system: {
        type: 'object',
        description: 'Talent and essence system information'
      },
      keywords: {
        type: 'array',
        description: 'All valid card keywords and abilities for search filters'
      },
      card_types: {
        type: 'array',
        description: 'All valid card types including classes for search filters'
      },
      shorthand_syntax: {
        type: 'object',
        description: 'Quick reference for shorthand query syntax'
      },
      trade_post_parsing: {
        type: 'object',
        description: 'How to parse community WTS/WTB/LF trade posts into searches'
      },
      important_notes: {
        type: 'object',
        description: 'Critical usage notes for search accuracy'
      }
    }
  },

  handler: async () => ({
    foiling_mappings: {
      description: 'Alias → canonical foiling. Filter codes: foilings: ["s"(Non-foil/NF), "r"(Rainbow), "c"(Cold), "g"(Gold)]',
      mappings: FOILING_MAP,
      CRITICAL_WARNING: 'r = Rainbow Foil, NOT non-foil. NF/non-foil must use "s" (Standard). Using "r" for non-foil cards will return Rainbow Foil printings or 0 results.',
    },

    edition_mappings: {
      description: 'Alias → canonical edition. Filter codes: editions: ["a"(Alpha), "f"(First), "u"(Unlimited), "n"(Normal)]',
      mappings: EDITION_MAP,
      shorthand_examples: ['edition:a', 'edition:f,u', 'edition:!n'],
    },

    set_mappings: {
      description: "Use these set codes for searching specific sets:",
      // Generated from CARD_FILTER_SETS (the single curated standard-set list the
      // app filter chips read) so new sets appear automatically — do NOT hand-edit.
      // History Pack 1 (1hp) lives here too; it's the one non-booster in that list.
      core_sets: Object.fromEntries(
        CARD_FILTER_SETS.map(code => [code, SET_MAP[code as keyof typeof SET_MAP] ?? code])
      ),
      blitz_sets: Object.fromEntries(
        Object.entries(SET_MAP).filter(([key]) =>
          ['bol', 'chn', 'psm', 'lev', 'bri', 'lxi', 'old', 'dro', 'fai', 'ara', 'azl', 'ben', 'kat', 'rip', 'uzu', 'bet', 'ksi', 'kyo', 'ola', 'rhi', 'vic', 'eng', 'nuu', 'zen'].includes(key)
        )
      ),
      promo_sets: Object.fromEntries(
        Object.entries(SET_MAP).filter(([key]) =>
          ['fab', 'gem', 'tcc', 'lgs', 'jdg', 'win', 'her', 'lss', 'oxo', 'xxx'].includes(key)
        )
      ),
      shorthand_examples: ['set:wtr', 'set:wtr,arc', 'set:!out'],
    },

    rarity_mappings: {
      description: 'Alias → canonical rarity. Filter codes: c/r/s(Super)/m(Majestic)/l(Legendary)/f(Fabled)/v(Marvel)/t(Token)/p(Promo)',
      mappings: RARITY_MAP,
      shorthand_examples: ['rarity:m', 'r:l,f', 'rarity:m,l,!c'],
      note: "Be careful with 'r' - it can mean 'rare' or 'rainbow foil' depending on context",
    },

    card_name_abbreviations: {
      description: 'Card name shortcuts, auto-expanded in shorthand queries (e.g. cnc → Command and Conquer):',
      mappings: CARD_NAME_ABBREVIATIONS,
    },

    hero_mappings: {
      description: 'Hero nickname → canonical hero name. Pass canonical names to hero filters.',
      nicknames: HERO_NICKNAMES,
      shorthand_examples: ['hero:gravy', 'hero:oldhim', 'hero:!puffin'],
      usage_note: 'Hero filtering automatically determines legal cards based on class and talent restrictions.',
      full_roster: 'For the complete per-format hero roster (adult vs young, classes, talents, per-format legality) read fab://heroes-by-format — required before hero+format deck/list work.',
    },

    talent_system: {
      description: 'Talents and essences for elemental/thematic cards:',
      essences: ['earth', 'ice', 'lightning', 'light'],
      talents: ['elemental', 'light', 'shadow', 'draconic', 'royal', 'chaos', 'mystic', 'revered', 'reviled'],
      talents_note: "Valid talents[] values: the talents above plus the essences earth / ice / lightning. NOTE: 'pirate' is a CLASS — filter via classes:['pirate'], not talents.",
      shorthand_examples: ['talent:light', 'tal:i,e', 'talent:!shadow'],
      abbreviations: {
        'e': 'earth', 'i': 'ice', 'l': 'lightning', 'li': 'light',
        's': 'shadow', 'd': 'draconic', 'm': 'mystic'
      }
    },

    keywords: {
      description: "All valid card keywords for text searches:",
      all_keywords: KEYWORDS,
      shorthand_examples: ['keyword:"go again"', 'keyword:dominate', 'keyword:stealth,combo']
    },

    card_types: {
      description: "Valid card types including classes for filtering:",
      card_types: ['action', 'attack', 'defense reaction', 'instant', 'equipment', 'weapon', 'hero', 'mentor', 'token'],
      hero_classes: HERO_CLASSES,
      shorthand_examples: ['type:equipment', 't:!generic', 'type:necromancer,!weapon'],
      note: "Includes both card types (attack, action, etc.) AND classes (brute, guardian, etc.)"
    },

    shorthand_syntax: {
      description: 'Shorthand query facets. Codes for each facet are in the *_mappings sections above.',
      facets: {
        price: 'p:<10, p:>50, p:25 (operators < > <= >= :)',
        type: 'type:equipment, t:!generic (negation: ! - not)',
        talent: 'talent:light, tal:i,e, talent:!shadow',
        rarity: 'rarity:m, r:l,f, r!c',
        set: 'set:wtr, set:wtr,arc, set:!out',
        foiling: 'foil:rf, f:cf, foil:!s — or standalone tokens nf/rf/cf/gf',
        hero: 'hero:gravy, h:!puffin (auto-filters hero-legal cards)',
        color: 'color:red, color:!blue (red/yellow/blue = pitch 1/2/3)',
      },
      complex_examples: [
        'talent:light p:<25 rarity:m type:equipment',
        'rf cnc alpha wtr',
        'blue wizard instant p:<10',
      ]
    },

    colors: COLORS,
    equipment_subtypes: EQUIPMENT_SUBTYPES,
    hero_classes: HERO_CLASSES,
    formats: {
      _note: 'Pass these exact values to the `format` filter (or format: in shorthand). Users may use nicknames — translate before searching.',
      _seeAlso: 'For which HEROES are legal in each format (adult vs young, DB-derived), read fab://heroes-by-format.',
      blitz: 'Blitz (40-card constructed)',
      cc: 'Classic Constructed (60-card)',
      commoner: 'Common and rare cards only',
      ll: 'Living Legend format',
      silver_age: 'Silver Age format — community nicknames: "sage", "sa". Always translate these to silver_age before filtering.'
    },
    price_ranges: PRICE_RANGES,
    power_ranges: POWER_RANGES,
    cost_ranges: COST_RANGES,

    data_model: {
      card: "Abstract game object. One row per pitch variant — red/yellow/blue Enlightened Strike are 3 separate cards with different stats and different card_unique_ids.",
      printing: "A specific physical copy: one set + edition + foiling combination. Many printings per card. Identified by printingId.",
      why_it_matters: "search_printings groups by card by default: ONE representative printing per card (+ printing_count), so 'what cards…' / discovery queries return distinct cards, not every printing. add_cards_to_deck requires a printingId — the representative's printing_id works, but the user's actual copy may differ (pin it with sets[]/foilings[]/editions[]). Pass options.groupByCard:false to get every printing (all pitch variants × editions × foilings, each with its own printingId).",
      double_faced_cards: "Each face is its own printing, linked via other_face_printing_id."
    },

    trade_post_parsing: {
      description: 'How to parse community WTS/WTB/LF trade posts into search_printings queries',
      foiling_prefixes: {
        'RF': 'foilings: ["r"]  or shorthand standalone "rf"',
        'CF': 'foilings: ["c"]  or shorthand standalone "cf"',
        'NF': 'foilings: ["s"]  or shorthand standalone "nf"',
        'EA': 'isExtendedArt: true  (NOT editions: ["f"] — EA is an art treatment, separate from edition/foiling)',
        'EA RF': 'isExtendedArt: true + foilings: ["r"]',
      },
      rarity_prefixes: {
        'Marvel / MARVEL': 'rarities: ["v"]  — but if 0 results, retry with foilings: ["c"], artVariations: ["FA"] (Full Art CF promos also called Marvel)',
      },
      color_pitch: {
        'RED / red': 'pitch: 1  (or shorthand standalone "red")',
        'BLUE / blue': 'pitch: 3  (or shorthand standalone "blue")',
        'YELLOW / yellow': 'pitch: 2  (or shorthand standalone "yellow")',
      },
      set_hints: {
        '(GEM)': 'sets: ["gem"]',
        '(promo)': 'no set filter — open to any promo; optionally try sets: ["fab","pen","lgs","tnp","tcc"]',
      },
      quantity_terms: {
        'x2 / 2x': 'quantity = 2 (metadata only, not a search filter)',
        'playset': 'quantity = 3 (FaB max 3 copies of a card)',
        'one BB, one WB': 'two separate searches — see border_terms',
      },
      high_seas_amulets: {
        description: 'High Seas (SEA) equipment amulets come in two versions with wildly different prices. NF (standard, ~$5–50) vs CF (community nickname "Treasure/Treasures", ~$500–2500+).',
        inference_rule: 'Amulet with no foiling spec → foilings: ["s"] (NF). "Treasure Diamond Amulet" or "Diamond Amulet CF" → foilings: ["c"], sets: ["sea"].',
      },
      border_terms: {
        'BB (Black Border)': 'The CHEAPEST black-bordered print — editions: ["u","n"], setsNot: ["1hp","2hp"]. Do NOT use editions ["a","f"] (Alpha/1st are also black-bordered but expensive — not what trade posts mean).',
        'WB (White Border)': 'History Pack reprints ONLY — sets: ["1hp","2hp"] (DB codes are digit-first). Unlimited editions are NOT white-bordered.',
      },
      fallback_strategy: [
        '1. Try exact: true with full name + all filters',
        '2. If 0 results: drop isExtendedArt / artVariations filters, retry exact: true',
        '3. If still 0: try exact: false — inspect returned name field for correct spelling (hyphens, plurals, apostrophes)',
        '4. If still 0: try exact: false with just the name, no other filters — card may not exist in that variant',
      ],
      shorthand_examples: [
        '"rf warrior\'s valor blue" → RF + pitch 3 + name search',
        '"cf ea timesnap potion" → CF + isExtendedArt + name search',
        '"cheeto cf" → CF Kayo, Underhanded Cheat (cheeto expands automatically)',
      ],
    },

    important_notes: {
      workflow: "MANDATORY: Read fab://constants FIRST, then searchable://card/fields BEFORE using search_printings",
      case_sensitivity: "classes, talents, rarities, foilings, editions, types, keywords, and color values are CASE-INSENSITIVE. Collector numbers ARE case-sensitive — use 'WTR098' not 'wtr098'.",
      query_modes: "Use 'query' parameter for shorthand, 'filters' parameter for structured searches. Prefer structured filters for programmatic access.",
      classes_vs_heroClasses: "classes = the card class itself (use for 'find brute cards'); heroClasses = cards LEGAL FOR a hero of that class, generics included (deck pools only). Full explanation in searchable://card/fields.",
      next_step: "After reading this, read 'searchable://card/fields' for the complete filter API reference."
    }
  })
};
