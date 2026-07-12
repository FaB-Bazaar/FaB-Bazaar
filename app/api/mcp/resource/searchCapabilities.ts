// app/api/mcp/resource/searchCapabilities.ts
//
// Mandatory second read for every MCP session — keep it LEAN.
// This is the filter API reference for search_printings. Code tables
// (foiling/rarity/set/edition aliases) live in fab://constants — do NOT
// duplicate them here. Guardrail: resourcePayloads.test.ts pins a size
// budget and the load-bearing content.

export const searchCapabilitiesResource = {
  type: 'resource',
  name: 'searchable_card_fields',
  description: 'Filter API reference for the FAB printings search: best practices, field reference, input parsing, and who_has workflows.',
  schema: {
    type: 'object',
    properties: {
      best_practices: {
        type: 'object',
        description: 'How to build reliable queries: structured filters, exact matching, negation'
      },
      filter_reference: {
        type: 'object',
        description: 'Complete reference for stat, talent, class, format, and hero filters'
      },
      input_parsing: {
        type: 'object',
        description: 'How to parse human card requests (quantities, foiling, name cleaning)'
      },
      who_has_workflow_patterns: {
        type: 'object',
        description: 'Patterns for finding card owners with different search intents'
      },
      response_optimization: {
        type: 'object',
        description: 'Response modes and token control'
      }
    }
  },

  handler: async () => ({
    best_practices: {
      default_approach: 'Always prefer structured filters over shorthand for multi-parameter searches — no parsing ambiguity, reliable negation, type safety. Shorthand is fine for simple single-parameter queries.',
      exact_matching: 'name + exact: true is the default for specific card requests — omitting exact does NOT mean exact. Without exact:true the service uses fuzzy/word_similarity matching and WILL return wrong cards for common words (e.g. "Aether Hail" → "Absorb in Aether"). The handler defaults exact=true when name is provided, but always set it explicitly. Only use exact: false intentionally — when the name might be misspelled or partially known.',
      conventions: [
        'Arrays always plural (rarities, not rarity); use arrays for multiple values',
        'Negation via Not-suffix fields: raritiesNot, setsNot, classesNot, talentsNot',
        'Boolean filters use is/has prefix (isExtendedArt, isNormalFoil)',
        'Price via priceMin/priceMax numbers, not operators',
        'Code tables (foiling/rarity/set/edition aliases) are in fab://constants — use those exact codes',
      ],
      worked_example: {
        input: '3x CF Art of Dragon: Blood',
        structured: {
          cards: [{
            filters: { name: 'Art of Dragon: Blood', exact: true, foilings: ['c'] },
            options: { show: 'collection', limit: 10 }
          }]
        },
        quantity: 3,
        note: 'Quantity ("3x"/"x2") is metadata for the follow-up binder/deck call, not a search filter.'
      },
      no_results_fallback: 'Follow fallback_strategy in fab://constants trade_post_parsing: retry without art filters → exact:false → name only.',
    },

    input_parsing: {
      description: 'Parsing human card requests: Quantity + Foiling + Card Name + Special Indicators',
      quantity_extraction: 'Extract "3x" / "x2" style quantities — store for the binder/deck call',
      foiling_and_special: 'Foiling prefixes (CF/RF/NF/EA), Marvel fallback, BB/WB border terms, Treasure amulets: see trade_post_parsing in fab://constants',
      card_name_cleaning: [
        'Remove quantity prefixes/suffixes, foiling abbreviations (CF, RF, NF, EA, Marvel), and parenthetical descriptions',
        'Handle dual cards with "/" or "//"',
        'Name matching is case-insensitive — the handler normalizes before comparing',
      ],
      art_variation_codes: {
        'FA': 'Full Art → "artVariations": ["FA"]',
        'EA': 'Extended Art → use "isExtendedArt": true (NOT artVariations, NOT editions)',
        'AA': 'Alternate Art → "artVariations": ["AA"]',
        'AB': 'Alternate Border → "artVariations": ["AB"]',
        'AT': 'Alternate Text → "artVariations": ["AT"]',
        'HS': 'Half Size → "artVariations": ["HS"]'
      },
    },

    filter_reference: {
      stat_filters: {
        power: 'Exact match: power: 6  |  Range: powerMin: 4, powerMax: 8  |  Exclude: powerNot: [0, 1]',
        cost: 'Exact match: cost: 0  |  Multiple: costs: [0,1,2]  |  Range: costMin/costMax  |  Exclude: costNot: [5,6]',
        defense: 'Exact match: defense: 3  |  Range: defenseMin/defenseMax  |  Exclude: defenseNot: [0]',
        arcane: 'Arcane damage dealt when played. Exact: arcane: 3  |  Range: arcaneMin/arcaneMax ("deals 3+ arcane damage" → arcaneMin: 3)  |  Exclude: arcaneNot: [1]. NULL for cards with no (or variable "X") arcane damage — never matched by ranges.',
        pitch: 'pitch: 1 (red)  |  pitch: 2 (yellow)  |  pitch: 3 (blue)'
      },
      talent_filters: {
        talents: 'OR logic — card has ANY of these talents: ["light", "ice"]',
        talentsAll: 'AND logic — card must have ALL of these: ["light", "ice"] (for dual-talent cards)',
        talentsNot: 'Exclude cards with any of these talents'
      },
      class_filters: {
        classes: 'CARD CLASS — cards whose own class is in this list (Beast Within, Massacre, etc. for ["brute"]). Use this for "find me brute cards".',
        classesNot: 'Exclude cards whose card class is in this list',
        critical_disambiguation: 'classes (the CARD\'s class) vs heroClasses (cards LEGAL FOR a hero of that class — includes generics + matching class). Picking heroClasses for "find brute cards" returns generic cards too (Command and Conquer, etc.) which is almost never what the user wants. "all brute majestics with 6 power" → classes: ["brute"], not heroClasses.',
        case_handling: 'Class/talent/rarity/foiling/edition/color/type/keyword values are case-insensitive.'
      },
      format_values: {
        supported: ['blitz', 'cc', 'commoner', 'll', 'silver_age'],
        note: 'silver_age is a valid format — do not omit it'
      },
      hero_filtering: {
        heroLegal: 'Single hero name, OR logic across that hero\'s classes/talents',
        heroClasses_heroTalents: 'HERO LEGALITY — cards LEGAL FOR a hero of that class/talent. Includes generics. Use only for hero-legal pools / deck-building searches, NOT for "find brute cards".',
        excludeClasses_excludeTalents: 'Explicit class/talent exclusion',
      },
      name_search_behavior: {
        exact_true: 'Exact name match only',
        exact_false: 'Broad mode: substring match + fuzzy word similarity. Handles typos and partial names.',
        collector_numbers: 'Names like "arc123" or "wtr001" are recognized as collector numbers. Collector number values are case-sensitive.'
      }
    },

    who_has_workflow_patterns: {
      description: 'Patterns for finding card owners with different search intents',
      find_any_owners: {
        intent: '"does anyone own X?" — any version counts',
        flow: 'Get ONE printing ID from search_printings, then who_has with searchAllVersions: true. Minimal calls, finds all versions automatically.',
      },
      find_specific_version_owners: {
        intent: '"who owns Cold Foil X?" / "the Dynasty version?"',
        flow: 'search_printings with specific filters (foiling/set/edition) → who_has with those exact printing IDs.',
      },
      find_multiple_card_owners: {
        intent: 'Owners of several different cards',
        flow: 'One printing ID per unique card → who_has with comma-separated IDs + searchAllVersions: true.',
      },
      trading_context: {
        intent: '"for trade" / "looking to buy"',
        flow: 'Any pattern above + forTradeOnly: true.',
      },
    },

    response_optimization: {
      note: 'The "show" parameter is a hint only — all modes currently return the same full data. Use "limit" to control token usage.',
      recommendation: 'Keep limit low (10-20) for broad searches; higher (50-100) only when you need many printing IDs for binder/deck operations.',
    },
  })
};
