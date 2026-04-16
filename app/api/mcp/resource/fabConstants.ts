// app/api/mcp/resource/fabConstants.ts - ENHANCED VERSION with latest constants

import {
  FOILING_MAP,
  EDITION_MAP,
  SET_MAP,
  RARITY_MAP,
  CARD_NAME_ABBREVIATIONS,
  KEYWORDS,
  CARD_TYPES,
  COLORS,
  EQUIPMENT_SUBTYPES,
  HERO_CLASSES,
  FORMATS,
  PRICE_RANGES,
  POWER_RANGES,
  COST_RANGES
} from '@/lib/fab-constants';

import { HERO_NICKNAMES, HERO_INFO, getHeroInfo } from '@/lib/fab-constants';

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
        description: 'Hero nicknames, full names, and class/talent information'
      },
      talent_system: {
        type: 'object',
        description: 'Complete talent and essence system information'
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
      important_notes: {
        type: 'object',
        description: 'Critical usage notes for search accuracy'
      }
    }
  },
  
  handler: async () => ({
    foiling_mappings: {
      description: "Use these abbreviations for foiling searches:",
      mappings: FOILING_MAP,
      search_codes: { s: 'Standard/Non-foil (NF)', r: 'Rainbow Foil (RF)', c: 'Cold Foil (CF)', g: 'Gold Foil (GF)' },
      CRITICAL_WARNING: 'r = Rainbow Foil, NOT non-foil. NF/non-foil must use "s" (Standard). Using "r" for non-foil cards will return Rainbow Foil printings or 0 results.',
      filters_array_values: {
        'foilings: ["s"]': 'Non-foil / Standard (most common deck cards)',
        'foilings: ["r"]': 'Rainbow Foil only',
        'foilings: ["c"]': 'Cold Foil only',
        'foilings: ["g"]': 'Gold Foil only',
      },
      shorthand_query_tokens: { nf: '→ foilings:["s"]', rf: '→ foilings:["r"]', cf: '→ foilings:["c"]', gf: '→ foilings:["g"]' },
    },
    
    edition_mappings: {
      description: "Use these abbreviations for edition searches:",
      mappings: EDITION_MAP,
      search_codes: { a: 'Alpha', f: 'First Edition', u: 'Unlimited', n: 'Normal' },
      shorthand_examples: ['edition:a', 'edition:f,u', 'edition:!n', 'alpha', 'unlimited', '1st'],
      border_terminology: {
        'BB (Black Border)': [
          'Means the original black-bordered print from the card\'s release set — NOT Alpha or 1st Edition specifically (those are also BB but expensive).',
          'In trade posts, BB almost always means the CHEAPEST black-bordered version = Unlimited or Normal edition from original set.',
          'Correct filter: editions: ["u","n"], setsNot: ["hp1","hp2"]',
          'Do NOT use editions: ["a","f"] for BB — that targets expensive Alpha/1st prints the buyer usually doesn\'t want.',
        ],
        'WB (White Border)': [
          'History Pack reprints ONLY — sets: ["hp1","hp2"].',
          'Unlimited editions are NOT white-bordered. Only HP1 and HP2 are white-bordered.',
        ],
        note: 'When a post says "one BB one WB": BB = original-set Unlimited/Normal, WB = History Pack reprint.'
      }
    },
    
    set_mappings: {
      description: "Use these set codes for searching specific sets:",
      core_sets: {
        wtr: 'Welcome to Rathe',
        arc: 'Arcane Rising',
        cru: 'Crucible of War',
        mon: 'Monarch',
        ele: 'Tales of Aria',
        evr: 'Everfest',
        upr: 'Uprising',
        dyn: 'Dynasty',
        out: 'Outsiders',
        dtd: 'Dusk till Dawn',
        evo: 'Bright Lights',
        hvy: 'Heavy Hitters',
        mst: 'Part the Mistveil',
        ros: 'Rosetta',
        hnt: 'The Hunted',
        sea: 'High Seas'
      },
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
      shorthand_examples: ['set:wtr', 'set:wtr,arc', 'set:!out', 'set:mon,ele,evr']
    },
    
    rarity_mappings: {
      description: "Use these abbreviations for rarity searches:",
      mappings: RARITY_MAP,
      search_codes: { c: 'Common', r: 'Rare', s: 'Super Rare', m: 'Majestic', l: 'Legendary', f: 'Fabled', t: 'Token', v: 'Marvel', p: 'Promo' },
      shorthand_examples: ['rarity:m', 'r:l,f', 'r!c', 'rarity:m,l,!c'],
      note: "Be careful with 'r' - it can mean 'rare' or 'rainbow foil' depending on context"
    },
    
    card_name_abbreviations: {
      description: "Common card name abbreviations for quick searches:",
      mappings: CARD_NAME_ABBREVIATIONS,
      usage_note: "These are automatically expanded in shorthand queries",
      examples: [
        "cnc → Command and Conquer",
        "aow → Art of War", 
        "es → Enlightened Strike"
      ]
    },

    hero_mappings: {
      description: "Hero nicknames, full names, and class/talent information:",
      nicknames: HERO_NICKNAMES,
      hero_classes_and_talents: {
        // Elemental Heroes
        elemental_guardians: {
          'oldhim': { classes: ['guardian'], talents: ['elemental'], essences: ['earth', 'ice'] },
          'jarl': { classes: ['guardian'], talents: ['elemental'], essences: ['earth', 'ice'] },
          'starvo': { classes: ['guardian'], talents: ['elemental'], essences: ['lightning', 'ice', 'earth'] }
        },
        elemental_rangers: {
          'lexi': { classes: ['ranger'], talents: ['elemental'], essences: ['lightning', 'ice'] }
        },
        elemental_runeblades: {
          'briar': { classes: ['runeblade'], talents: ['elemental'], essences: ['lightning', 'earth'] },
          'aurora': { classes: ['runeblade'], talents: ['elemental'], essences: ['lightning'] },
          'florian': { classes: ['runeblade'], talents: ['elemental'], essences: ['earth'] }
        },
        elemental_wizards: {
          'iyslander': { classes: ['wizard'], talents: ['elemental'], essences: ['ice'] },
          'oscilio': { classes: ['wizard'], talents: ['elemental'], essences: ['lightning'] },
          'verdance': { classes: ['wizard'], talents: ['elemental'], essences: ['earth'] }
        },
        
        // Pirate Heroes
        pirate_heroes: {
          'gravy': { classes: ['necromancer'], talents: ['pirate'] },
          'marlynn': { classes: ['ranger'], talents: ['pirate'] },
          'puffin': { classes: ['mechanologist'], talents: ['pirate'] }
        },
        
        // Light Heroes
        light_heroes: {
          'boltyn': { classes: ['warrior'], talents: ['light'] },
          'prismaos': { classes: ['illusionist'], talents: ['light'] },
          'prismsoal': { classes: ['illusionist'], talents: ['light'] }
        },
        
        // Shadow Heroes
        shadow_heroes: {
          'chane': { classes: ['runeblade'], talents: ['shadow'] },
          'levia': { classes: ['brute'], talents: ['shadow'] },
          'vynnset': { classes: ['runeblade'], talents: ['shadow'] }
        }
      },
      shorthand_examples: ['hero:gravy', 'hero:oldhim', 'hero:!puffin'],
      usage_note: "Hero filtering automatically determines legal cards based on class and talent restrictions"
    },

    talent_system: {
      description: "Complete talent and essence system for elemental and thematic cards:",
      essences: {
        earth: "Earth essence cards (brown)",
        ice: "Ice essence cards (light blue)", 
        lightning: "Lightning essence cards (purple)",
        light: "Light essence cards (white/yellow)"
      },
      talents: {
        elemental: "Generic elemental talent",
        pirate: "Pirate-themed cards",
        light: "Light/holy themed cards",
        shadow: "Shadow/dark themed cards",
        draconic: "Dragon-themed cards",
        royal: "Royal/noble themed cards",
        chaos: "Chaos-themed cards",
        mystic: "Mystic/spiritual themed cards"
      },
      shorthand_examples: [
        'talent:light', 'tal:i,e', 'talent:!shadow',
        'talent:elemental', 'tal:pirate', 'talent:draconic'
      ],
      abbreviations: {
        'e': 'earth', 'i': 'ice', 'l': 'lightning', 'li': 'light',
        'p': 'pirate', 's': 'shadow', 'd': 'draconic'
      }
    },
    
    keywords: {
      description: "All valid card keywords for text searches:",
      core_mechanics: KEYWORDS.slice(0, 20),
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
      description: "Quick reference for natural language shorthand queries:",
      price_syntax: {
        examples: ['p:<10', 'p:>50', 'p:25'],
        operators: ['<', '>', '<=', '>=', ':']
      },
      type_syntax: {
        examples: ['type:equipment', 't:!generic', 'type:necromancer,!weapon'],
        negation: ['!', '-', 'not']
      },
      talent_syntax: {
        examples: ['talent:light', 'tal:i,e', 'talent:!shadow'],
        abbreviations: ['e=earth', 'i=ice', 'l=lightning', 'li=light']
      },
      rarity_syntax: {
        examples: ['rarity:m', 'r:l,f', 'r!c'],
        codes: ['c=common', 'r=rare', 'm=majestic', 'l=legendary', 'f=fabled']
      },
      set_syntax: {
        examples: ['set:wtr', 'set:wtr,arc', 'set:!out'],
        popular_sets: ['wtr', 'arc', 'mon', 'ele', 'out', 'dtd']
      },
      foiling_syntax: {
        examples: ['foil:rf', 'f:cf', 'foil:!s'],
        codes: ['rf=rainbow', 'cf=cold', 's=standard', 'g=gold']
      },
      hero_syntax: {
        examples: ['hero:gravy', 'hero:oldhim', 'h:!puffin'],
        note: 'Automatically filters for hero-legal cards'
      },
      color_syntax: {
        examples: ['color:red', 'color:!blue'],
        values: ['red', 'blue', 'yellow']
      },
      complex_examples: [
        'talent:light p:<25 rarity:m type:equipment',
        'rf cnc alpha wtr',
        'hero:gravy p:<100 rarity:!c', 
        'set:wtr,arc talent:!shadow foil:rf',
        'blue wizard instant p:<10',
        'type:attack power>6 cost:2,3'
      ]
    },

    colors: COLORS,
    equipment_subtypes: EQUIPMENT_SUBTYPES,
    hero_classes: HERO_CLASSES,
    formats: {
      blitz: 'Blitz (40-card constructed)',
      cc: 'Classic Constructed (60-card)',
      commoner: 'Common and rare cards only',
      ll: 'Living Legend format'
    },
    price_ranges: PRICE_RANGES,
    power_ranges: POWER_RANGES,
    cost_ranges: COST_RANGES,

    data_model: {
      card: "Abstract game object. One row per pitch variant — red/yellow/blue Enlightened Strike are 3 separate cards with different stats and different card_unique_ids.",
      printing: "A specific physical copy: one set + edition + foiling combination. Many printings per card. Identified by printingId.",
      why_it_matters: "search_printings returns printings (not cards). add_cards_to_deck requires a printingId. Searching 'Enlightened Strike' returns multiple results because pitch variants × editions × foilings all have distinct printingIds.",
      double_faced_cards: "Each face is its own printing, linked via other_face_printing_id."
    },

    deck_tools: {
      description: "Reference for all deck-related MCP tools and their intended use:",
      public_tools: {
        get_decks_to_beat: {
          purpose: "Browse curated meta reference decklists for a given month and year",
          auth_required: false,
          parameters: ["month (optional, defaults to current)", "year (optional, defaults to current)", "format", "heroName", "eventName"],
          use_when: "You want to see what decks are strong in the current or a past meta"
        }
      },
      binder_and_wants_tools: {
        note: "All tools below require authentication and operate on your own data only",
        add_to_binder: { purpose: "Add cards to your binder (add-only, never removes)", use_when: "Recording cards you own" },
        remove_from_binder: { purpose: "Remove cards from your binder by inventory item ID", use_when: "Removing cards you no longer own — always confirm with user before calling" },
        add_to_wants: { purpose: "Add cards to your wants list (add-only, never removes)", use_when: "Tracking cards you want to acquire" },
        remove_from_wants: { purpose: "Remove cards from your wants list by printing ID", use_when: "Removing cards you no longer want — always confirm with user before calling" }
      },
      personal_deck_tools: {
        note: "All tools below require authentication and operate on your own decks only",
        list_decks: {
          purpose: "View a summary of all decks in your account",
          use_when: "You want to see what decks you have saved"
        },
        get_deck: {
          purpose: "View the full decklist for one of your decks by name",
          use_when: "You want to inspect cards, categories, or sideboard plans for a specific deck"
        },
        create_deck: {
          purpose: "Create a new empty deck with a name, format, and hero",
          use_when: "Starting a brand new deck from scratch"
        },
        add_cards_to_deck: {
          purpose: "Add one or more cards to an existing deck by printing ID or card name",
          use_when: "Building out or updating a decklist"
        },
        remove_cards_from_deck: {
          purpose: "Remove cards from a deck by printing ID and category",
          use_when: "Cutting cards from a decklist — always confirm with user first"
        },
        update_deck: {
          purpose: "Update deck metadata: name, format, visibility, description, event name, event date, placing",
          use_when: "Renaming a deck, logging a tournament result, or changing visibility"
        },
        save_deck_matchup: {
          purpose: "Save a sideboard plan and notes for a specific opponent hero matchup",
          use_when: "Preparing sideboard strategies for upcoming events"
        }
      },
      typical_deck_workflow: [
        "1. get_decks_to_beat → research the current meta",
        "2. create_deck → start a new deck",
        "3. search_printings → find specific card printings",
        "4. add_cards_to_deck → build the list",
        "5. update_deck → log event info after a tournament",
        "6. save_deck_matchup → record sideboard plans"
      ]
    },

    trade_post_parsing: {
      description: 'How to parse community WTS/WTB/LF trade posts into search_printings queries',
      foiling_prefixes: {
        'RF': 'foilings: ["r"]  or shorthand standalone "rf"',
        'CF': 'foilings: ["c"]  or shorthand standalone "cf"',
        'NF': 'foilings: ["s"]  or shorthand standalone "nf"',
        'EA': 'isExtendedArt: true  (NOT editions: ["f"])',
        'EA RF': 'isExtendedArt: true + foilings: ["r"]',
        'Treasure / Treasures': 'Cold Foil High Seas amulet — foilings: ["c"], sets: ["sea"]. If no CF/Treasure specified on an amulet, default to foilings: ["s"] (NF).',
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
        '(PEN)': 'sets: ["pen"]',
        '(WTR)': 'sets: ["wtr"]',
        '(promo)': 'no set filter — open to any promo; optionally try sets: ["fab","pen","lgs","tnp","tcc"]',
      },
      quantity_terms: {
        'x2 / 2x': 'quantity = 2 (metadata only, not a search filter)',
        'playset': 'quantity = 3 (FaB max 3 copies of a card)',
        'one BB, one WB': 'two separate searches — see border_terminology in edition_mappings',
      },
      high_seas_amulets: {
        description: 'High Seas (SEA) equipment amulets (Diamond Amulet, Sapphire Amulet, etc.) come in two versions with wildly different prices:',
        'NF (Non-foil)': 'Standard print — ~$5–50. If no foiling is specified, assume NF.',
        'CF (Cold Foil)': 'Nicknamed "Treasures" by the community — ~$500–2500+. Only search CF if the post says "CF" or "Treasure/Treasures".',
        inference_rule: 'Amulet with no foiling spec → foilings: ["s"] (NF). "Treasure Diamond Amulet" or "Diamond Amulet CF" → foilings: ["c"].',
        community_terms: {
          'Treasure / Treasures': 'Cold Foil High Seas amulet — foilings: ["c"], sets: ["sea"]',
        },
      },
      border_terms: {
        'BB (Black Border)': 'editions: ["u","n"] — Unlimited/Normal edition (excludes expensive Alpha/1st). History Pack (set:1hp) is white-bordered but edition "n"; results may include it — buyer can distinguish visually.',
        'WB (White Border)': 'sets: ["hp1","hp2"] — History Pack reprints only',
      },
      fallback_strategy: [
        '1. Try exact: true with full name + all filters',
        '2. If 0 results: drop isExtendedArt / artVariations filters, retry exact: true',
        '3. If still 0: try exact: false — inspect returned name field for correct spelling (hyphens, plurals, apostrophes)',
        '4. If still 0: try exact: false with just the name, no other filters — card may not exist in that variant',
      ],
      shorthand_examples: [
        '"rf warrior\'s valor blue" → RF + pitch 3 + name search',
        '"cf ea timesnap potion" → CF + isExtendedArt (ea token) + name search',
        '"nf enlightened strike set:pen" → NF + PEN set + name search',
        '"alpha cnc" → Alpha edition + Command and Conquer (cnc expands automatically)',
        '"cheeto cf" → CF Kayo, Underhanded Cheat (cheeto expands automatically)',
      ],
    },

    important_notes: {
      workflow: "MANDATORY: Read fab://constants FIRST, then searchable://card/fields BEFORE using search_printings",
      case_sensitivity: "Card IDs are case-sensitive! Use 'WTR098' not 'wtr098'",
      shorthand_priority: "Use shorthand syntax for natural queries, structured filters for programmatic access",
      abbreviation_usage: "All abbreviations from this resource work in shorthand queries",
      hero_legal_filtering: "Hero filters automatically determine legal cards based on class/talent restrictions",
      talent_system: "Elemental heroes can play essence cards (earth/ice/lightning/light) and elemental talent cards",
      query_modes: "Use 'query' parameter for shorthand, 'filters' parameter for structured searches",
      next_step: "After reading this, read 'searchable://card/fields' for complete API documentation"
    }
  })
};