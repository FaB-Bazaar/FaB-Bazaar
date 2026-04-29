// app/api/mcp/resource/searchCapabilities.ts - CLAUDE-OPTIMIZED VERSION

export const searchCapabilitiesResource = {
  type: 'resource',
  name: 'searchable_card_fields',
  description: 'Comprehensive documentation of all searchable fields, filters, shorthand syntax, and options for the enhanced FAB printings search API. Optimized for Claude natural language processing.',
  schema: {
    type: 'object',
    properties: {
      claude_best_practices: {
        type: 'object',
        description: 'Claude-specific parsing guidelines and best practices'
      },
      human_input_patterns: {
        type: 'object',
        description: 'Common patterns in human card requests and how to parse them'
      },
      search_modes: {
        type: 'object',
        description: 'Available search input methods with Claude recommendations'
      },
      structured_filter_priority: {
        type: 'object',
        description: 'Why and when to use structured filters over shorthand'
      },
      parsing_strategy: {
        type: 'object',
        description: 'Step-by-step parsing approach for different input types'
      },
      common_abbreviations: {
        type: 'object',
        description: 'Complete abbreviation mapping for reliable parsing'
      },
      response_optimization: {
        type: 'object',
        description: 'Response modes and token optimization for Claude'
      }
    }
  },
  
  handler: async () => ({
    claude_best_practices: {
      default_approach: 'Always prefer structured filters for reliability and consistency',
      parsing_priority: [
        '1. Parse human input for quantities, foiling, and card names',
        '2. Convert natural language to structured filter objects',
        '3. Use shorthand only for simple, single-parameter queries',
        '4. Always use exact: true for specific card name requests',
        '5. Default to "summary" response mode for token efficiency'
      ],
      reliability_ranking: {
        highest: 'Structured filters with exact field matching - USE THIS',
        medium: 'Simple shorthand (single parameter like "p:<10")',
        lowest: 'Complex shorthand with quotes and multiple negations - AVOID'
      },
      consistency_rules: [
        'Always use structured filters for multi-parameter searches',
        'name + exact: true is the default — omitting exact does NOT mean exact. Without exact:true the service uses fuzzy/word_similarity matching and WILL return wrong cards for common words (e.g. "Aether Hail" → "Absorb in Aether"). The handler now defaults exact=true when name is provided, but always set it explicitly.',
        'Only use exact: false intentionally — when the card name might be misspelled or partially known',
        'Convert all natural language to structured equivalents',
        'Prefer arrays over comma-separated strings',
        'Use proper negation fields (raritiesNot, setsNot, etc.)'
      ]
    },

    human_input_patterns: {
      collection_requests: {
        description: 'Users requesting specific cards for collection/trading',
        examples: [
          '3x CF Art of Dragon: Blood',
          'CF Kunai (right facing)',
          '1x Sigil of Temporal Manipulation (Marvel)',
          'Endless Arrow (WB) x2'
        ],
        parsing_approach: {
          quantity_extraction: 'Extract numbers like "3x" or "x2" - store for binder use',
          foiling_codes: {
            'NF': 'Non-Foil / Standard → "foilings": ["s"]  ← most common; also use isNormalFoil: true',
            'RF': 'Rainbow Foil → "foilings": ["r"]',
            'CF': 'Cold Foil → "foilings": ["c"]',
            'GF': 'Gold Foil → "foilings": ["g"]',
            'EA': 'Extended Art → "isExtendedArt": true  (NOT editions: ["f"] — EA is an art treatment stored as is_extended_art=true, separate from edition/foiling)',
            'WARNING': 'r = Rainbow Foil, NOT non-foil. Non-foil is "s" (Standard). Using "r" for non-foil will return RF cards or 0 results.'
          },
          special_indicators: {
            '(Marvel)': [
              'Primary: "rarities": ["v"] — actual Marvel rarity cards',
              'Fallback if 0 results: "foilings": ["c"], "artVariations": ["FA"] — Full Art CF promos (e.g. TNP set) that the community calls "Marvel" but have rarity "p" (Promo)',
              'When unsure, fire both searches in parallel and merge results'
            ],
            '(WB)': '"sets": ["hp1"]',
            '(Promo)': 'Check for promo sets'
          },
          card_name_cleaning: [
            'Remove quantity prefixes/suffixes',
            'Remove foiling abbreviations (CF, RF, NF, EA, Marvel)',
            'Remove parenthetical descriptions',
            'Handle dual cards with "/" or "//"',
            'Trim whitespace',
            'Name matching is case-insensitive — pass any case, the handler normalizes to lowercase before comparing against the name field'
          ]
        },
        recommended_structure: {
          cards: [{
            filters: {
              name: 'cleaned_card_name',
              exact: true,
              foilings: ['c'],
              rarities: ['v']
            },
            options: {
              show: 'collection',
              limit: 10
            }
          }]
        }
      },

      deck_building_requests: {
        description: 'Users searching for cards for deck construction',
        examples: [
          'brute cards with power 6 and above that are majestic under $10',
          'guardian equipment under $5',
          'wizard instants with go again under $25'
        ],
        parsing_approach: {
          class_identification: 'brute → "types": ["brute"]',
          stat_ranges: 'power 6 and above → "powerMin": 6',
          rarity_terms: 'majestic → "rarities": ["m"]',
          price_terms: 'under $10 → "priceMax": 10',
          keyword_terms: 'go again → "keywords": ["go again"]'
        },
        recommended_structure: {
          cards: [{
            filters: {
              types: ['brute'],
              powerMin: 6,
              rarities: ['m'],
              priceMax: 10
            },
            options: {
              show: 'summary',
              sortBy: 'power',
              sortOrder: 'desc'
            }
          }]
        }
      },

      shorthand_queries: {
        description: 'Users using abbreviated syntax',
        examples: [
          't:equipment r:m f:rf p:<50',
          'hero:gravy p:<100 r:!c',
          'set:wtr,arc tal:!shadow'
        ],
        parsing_approach: 'Convert each component to structured equivalent',
        conversion_table: {
          't:equipment': '"types": ["equipment"]',
          'r:m': '"rarities": ["m"]',
          'f:rf': '"foilings": ["r"]',
          'p:<50': '"priceMax": 50',
          'r:!c': '"raritiesNot": ["c"]',
          'tal:!shadow': '"talentsNot": ["shadow"]'
        }
      }
    },

    search_modes: {
      structured_filters: {
        description: 'RECOMMENDED: Precise, reliable filtering (Claude should default to this)',
        priority: 1,
        reliability: 'Highest - No parsing ambiguity',
        when_to_use: [
          'All specific card requests',
          'Multi-parameter searches',
          'Complex boolean logic',
          'When user provides exact specifications',
          'Collection management queries'
        ],
        advantages: [
          'No parsing errors',
          'Precise control over all parameters',
          'Reliable negation handling',
          'Type safety',
          'Consistent results'
        ],
        template: {
          cards: [{
            filters: {
              name: 'string (use exact: true for specific cards)',
              types: ['array_of_strings'],
              rarities: ['array_of_codes'],
              foilings: ['array_of_codes'],
              priceMax: 'number',
              priceMin: 'number'
            },
            options: {
              show: 'summary|gameplay',
              limit: 'number (default 12)',
              sortBy: 'name|price|power|cost|defense',
              sortOrder: 'asc|desc'
            }
          }]
        }
      },

      shorthand_query: {
        description: 'Convenient but less reliable (use sparingly)',
        priority: 2,
        reliability: 'Medium - Parser dependent',
        when_to_use: [
          'Simple single-parameter queries',
          'Quick exploratory searches',
          'When structured conversion is complex'
        ],
        limitations: [
          'Quote parsing issues',
          'Ambiguous abbreviations',
          'Complex negation problems',
          'Context-dependent interpretation'
        ],
        recommendation: 'Convert to structured filters when possible'
      }
    },

    structured_filter_priority: {
      why_structured_is_better: [
        'No parsing ambiguity - what you specify is what you get',
        'Reliable negation with dedicated Not fields',
        'Precise array handling for multiple values',
        'Type safety prevents invalid combinations',
        'Consistent behavior across all queries'
      ],
      conversion_examples: {
        from_natural_language: {
          input: 'majestic rainbow foil equipment under $50',
          structured: {
            cards: [{
              filters: {
                types: ['equipment'],
                rarities: ['m'],
                foilings: ['r'],
                priceMax: 50
              },
              options: {
                show: 'summary'
              }
            }]
          }
        },
        from_shorthand: {
          input: 't:equipment r:m f:rf p:<50',
          structured: {
            cards: [{
              filters: {
                types: ['equipment'],
                rarities: ['m'],
                foilings: ['r'],
                priceMax: 50
              }
            }]
          }
        },
        from_collection_request: {
          input: '3x CF Art of Dragon: Blood',
          structured: {
            cards: [{
              filters: {
                name: 'Art of Dragon: Blood',
                exact: true,
                foilings: ['c']
              },
              options: {
                show: 'collection'
              }
            }]
          },
          quantity: 3
        }
      }
    },

    parsing_strategy: {
      step_by_step_approach: {
        step_1: {
          title: 'Identify Request Type',
          actions: [
            'Collection request (specific cards with quantities/foiling)',
            'Deck building (parameter-based search)',
            'Exploration (broad category search)'
          ]
        },
        step_2: {
          title: 'Extract Key Components',
          actions: [
            'Quantities (3x, x2) - store for later binder use',
            'Foiling abbreviations (CF, RF, EA)',
            'Card names (clean and normalize)',
            'Search parameters (class, rarity, price, stats)'
          ]
        },
        step_3: {
          title: 'Build Structured Query',
          actions: [
            'Map all components to structured filter fields',
            'Use arrays for multiple values',
            'Apply negation filters where needed',
            'Set appropriate response mode',
            'Add sorting if relevant'
          ]
        },
        step_4: {
          title: 'Optimize Response',
          actions: [
            'Use "summary" for general searches',
            'Use "gameplay" for deck building'
          ]
        }
      }
    },

    who_has_workflow_patterns: {
      description: 'Optimized patterns for finding card owners with different search intents',
      
      find_any_owners: {
        description: 'User wants to know if ANYONE owns a specific card (regardless of version)',
        examples: [
          'does anyone own Spider\'s Bite?',
          'who has Command and Conquer?',
          'anyone got Art of War?'
        ],
        recommended_approach: {
          step_1: 'Find any single printing ID of the card',
          step_2: 'Use who_has with searchAllVersions: true',
          advantages: [
            'Minimal API calls',
            'Cleaner code',
            'Matches user intent better',
            'Finds all versions automatically'
          ]
        },
        template: {
          search: 'Get one printing ID from search_printings',
          who_has: {
            printingIds: 'single_printing_id',
            searchAllVersions: true
          }
        }
      },
    
      find_specific_version_owners: {
        description: 'User wants owners of specific printings/versions',
        examples: [
          'who owns Cold Foil Spider\'s Bite?',
          'anyone have the Dynasty version?',
          'looking for First Edition owners'
        ],
        recommended_approach: {
          step_1: 'Search with specific filters (foiling, set, edition)',
          step_2: 'Extract specific printing IDs',
          step_3: 'Use who_has with exact printing IDs'
        }
      },
    
      find_multiple_card_owners: {
        description: 'User wants to find owners of several different cards',
        examples: [
          'who owns Spider\'s Bite or Command and Conquer?',
          'find owners of these 5 cards'
        ],
        recommended_approach: {
          step_1: 'Get one printing ID per unique card',
          step_2: 'Use who_has with comma-separated IDs and searchAllVersions: true'
        }
      }
    },

    common_abbreviations: {
      foiling_codes: {
        complete_mapping: {
          'CF': { full: 'Cold Foil', code: 'c' },
          'RF': { full: 'Rainbow Foil', code: 'r' },
          'EA': { full: 'Extended Art', note: 'Use isExtendedArt: true — NOT editions: ["f"]. EA is an art treatment (is_extended_art=true on the printing), not an edition code.' },
          'NF': { full: 'Non-foil/Standard', code: 's' },
          'GF': { full: 'Gold Foil', code: 'g' }
        },
        structured_conversion: {
          'CF': '"foilings": ["c"]',
          'RF': '"foilings": ["r"]',
          'EA': '"isExtendedArt": true',
          'NF': '"foilings": ["s"]',
          'Marvel (community usage)': [
            'Actual Marvel rarity → "rarities": ["v"]',
            'Full Art CF promos (TNP set, etc.) also called "Marvel" by community → "foilings": ["c"], "artVariations": ["FA"]',
            'If "rarities": ["v"] returns 0, retry with "foilings": ["c"], "artVariations": ["FA"]'
          ]
        },
        art_variation_codes: {
          'FA': 'Full Art → "artVariations": ["FA"]',
          'EA': 'Extended Art → use "isExtendedArt": true (NOT artVariations)',
          'AA': 'Alternate Art → "artVariations": ["AA"]',
          'AB': 'Alternate Border → "artVariations": ["AB"]',
          'AT': 'Alternate Text → "artVariations": ["AT"]',
          'HS': 'Half Size → "artVariations": ["HS"]'
        }
      },

      rarity_codes: {
        complete_mapping: {
          'c': 'Common',
          'r': 'Rare', 
          's': 'Super Rare',
          'm': 'Majestic',
          'l': 'Legendary',
          'f': 'Fabled',
          'v': 'Marvel',
          't': 'Token',
          'p': 'Promo'
        },
        natural_language: {
          'common': 'c',
          'rare': 'r',
          'super rare': 's',
          'majestic': 'm',
          'legendary': 'l',
          'fabled': 'f',
          'marvel': 'v'
        }
      },

      set_codes: {
        core_sets: {
          'wtr': 'Welcome to Rathe',
          'arc': 'Arcane Rising',
          'cru': 'Crucible of War',
          'mon': 'Monarch',
          'ele': 'Tales of Aria',
          'evr': 'Everfest',
          'upr': 'Uprising',
          'dyn': 'Dynasty',
          'out': 'Outsiders',
          'dtd': 'Dusk till Dawn',
          'evo': 'Bright Lights',
          'hvy': 'Heavy Hitters',
          'mst': 'Part the Mistveil',
          'ros': 'Rosetta',
          'hnt': 'The Hunted',
          'sea': 'High Seas'
        },
        special_sets: {
          'hp1': 'History Pack 1 (WB = Welcome Back)',
          '1hp': 'History Pack 1',
          'fab': 'Flesh and Blood Promo Cards'
        }
      },

      class_and_type_mapping: {
        classes: {
          'brute': 'Brute',
          'guardian': 'Guardian',
          'ninja': 'Ninja',
          'warrior': 'Warrior',
          'wizard': 'Wizard',
          'mechanologist': 'Mechanologist',
          'ranger': 'Ranger',
          'runeblade': 'Runeblade',
          'merchant': 'Merchant',
          'illusionist': 'Illusionist',
          'assassin': 'Assassin',
          'necromancer': 'Necromancer'
        },
        types: {
          'equipment': 'Equipment',
          'weapon': 'Weapon',
          'action': 'Action',
          'attack': 'Attack',
          'instant': 'Instant',
          'defense reaction': 'Defense Reaction'
        }
      }
    },

    response_optimization: {
      note: 'The "show" parameter is a hint only — all modes currently return the same full data. Use "limit" to control token usage.',
      recommendation: 'Keep limit low (10-20) for broad searches, higher (50-100) only when you need specific printing IDs for binder/deck operations.',
      claude_recommended_modes: {
        summary: {
          description: 'Default — use for general searches and deck building',
          when_to_use: ['General searches', 'Deck building queries', 'Quick lookups'],
          token_tip: 'Set limit: 12-20 for most searches'
        },
        gameplay: {
          description: 'Use for deck-building context where you need stats/keywords',
          when_to_use: ['Competitive deck building', 'Format-specific searches'],
          token_tip: 'Set limit: 20-50'
        }
      }
    },

    claude_parsing_templates: {
      collection_request_template: {
        input_pattern: 'Quantity + Foiling + Card Name + Special Indicators',
        parsing_regex: {
          quantity: '(\\d+)x|x(\\d+)',
          foiling: '\\b(CF|RF|EA|NF|GF)\\b',
          special: '\\((Marvel|WB|Promo|[^)]+)\\)',
          dual_cards: '(.+?)\\s*[/]{1,2}\\s*(.+)'
        },
        output_structure: {
          cards: [{
            filters: {
              name: 'extracted_card_name',
              exact: true,
              foilings: ['extracted_foiling_code'],
              rarities: ['extracted_rarity_if_special']
            },
            options: {
              show: 'collection',
              limit: 10
            }
          }],
          metadata: {
            quantity: 'extracted_quantity',
            original_input: 'user_input'
          }
        }
      },

      deck_building_template: {
        input_pattern: 'Class/Type + Stats + Rarity + Price + Keywords',
        natural_language_mapping: {
          classes: 'brute|guardian|ninja|warrior|wizard|mechanologist|ranger|runeblade|merchant|illusionist|assassin|necromancer',
          types: 'equipment|weapon|action|attack|instant|defense reaction',
          stat_phrases: 'power (\\d+) and above|under \\$(\\d+)|with (.+?) keyword',
          rarity_phrases: 'majestic|legendary|rare|common|fabled'
        },
        output_structure: {
          cards: [{
            filters: {
              types: ['extracted_types'],
              powerMin: 'extracted_min_power',
              priceMax: 'extracted_max_price',
              rarities: ['extracted_rarities'],
              keywords: ['extracted_keywords']
            },
            options: {
              show: 'summary',
              sortBy: 'power|price|name',
              sortOrder: 'desc|asc'
            }
          }]
        }
      }
    },

    error_handling_and_fallbacks: {
      no_results_found: {
        strategies: [
          'Remove exact: true if used',
          'Try partial name matching',
          'Check for common misspellings',
          'Try different foiling combinations',
          'Suggest similar cards'
        ]
      },
      ambiguous_input: {
        strategies: [
          'Ask for clarification',
          'Show multiple options',
          'Default to most common interpretation',
          'Provide structured alternatives'
        ]
      },
      parser_failures: {
        fallback_approach: [
          'Fall back to simple name search',
          'Use structured filters manually',
          'Break complex queries into simpler parts',
          'Guide user to better input format'
        ]
      }
    },

    filter_reference: {
      stat_filters: {
        power: 'Exact match: power: 6  |  Range: powerMin: 4, powerMax: 8  |  Exclude: powerNot: [0, 1]',
        cost: 'Exact match: cost: 0  |  Multiple: costs: [0,1,2]  |  Range: costMin/costMax  |  Exclude: costNot: [5,6]',
        defense: 'Exact match: defense: 3  |  Range: defenseMin/defenseMax  |  Exclude: defenseNot: [0]',
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
        critical_disambiguation: 'classes (the CARD\'s class) vs heroClasses (cards LEGAL FOR a hero of that class — includes generics + matching class). Picking heroClasses for "find brute cards" returns generic cards too (Command and Conquer, etc.) which is almost never what the user wants.',
        case_handling: 'Class/talent/rarity/foiling/edition/color/type/keyword values are case-insensitive — pass any case ("brute", "Brute", "BRUTE" all work).'
      },
      format_values: {
        supported: ['blitz', 'cc', 'commoner', 'll', 'silver_age'],
        note: 'silver_age is a valid format — do not omit it'
      },
      hero_filtering: {
        heroLegal: 'Single hero name, OR logic across that hero\'s classes/talents',
        heroClasses_heroTalents: 'HERO LEGALITY — cards LEGAL FOR a hero of that class/talent. Includes generics + class-matching cards. Use this only for hero-legal pools / deck-building searches, NOT for "find brute cards".',
        excludeClasses_excludeTalents: 'Explicit class/talent exclusion',
        critical_disambiguation: 'See class_filters.critical_disambiguation. heroClasses ≠ classes. "all brute majestics with 6 power" → use classes: ["brute"], not heroClasses: ["brute"].'
      },
      name_search_behavior: {
        exact_true: 'Exact name match only',
        exact_false_default: 'Broad mode: substring match + fuzzy word similarity. Handles typos and partial names.',
        collector_numbers: 'Names like "arc123" or "wtr001" are recognized as collector numbers'
      }
    },

    consistency_enforcement: {
      naming_conventions: {
        boolean_filters: 'Always use is/has prefix (isEquipment, hasLight)',
        negation_filters: 'Always use Not suffix (raritiesNot, setsNot, classesNot)',
        array_fields: 'Always plural (rarities, not rarity)',
        case_sensitivity: 'collectorNumber values must match exactly'
      },

      filter_standardization: {
        price_filtering: 'Always use priceMin/priceMax instead of operators',
        array_values: 'Always use arrays for multiple values',
        exact_matching: 'Set exact: true for specific card name requests',
        talent_logic: 'Use talents for OR, talentsAll for AND multi-talent requirements'
      },

      quality_checks: {
        before_search: [
          'Verify all filter values are valid',
          'Check array structures are correct',
          'Ensure negation fields are properly used',
          'Validate price ranges are logical'
        ],
        after_search: [
          'Check if results match user intent',
          'Verify quantities make sense',
          'Ensure response mode was appropriate',
          'Consider if additional filtering needed'
        ]
      }
    },

    claude_decision_tree: {
      input_analysis: {
        specific_card_request: {
          indicators: ['Card name mentioned', 'Quantity specified', 'Foiling mentioned'],
          action: 'Use structured filters with exact: true and collection mode'
        },
        deck_building_query: {
          indicators: ['Class mentioned', 'Stats specified', 'Format mentioned'],
          action: 'Use structured filters with summary mode and appropriate sorting'
        },
        exploration_search: {
          indicators: ['Broad categories', 'Multiple options', 'Discovery intent'],
          action: 'Use structured filters with summary mode and pagination'
        },
        complex_combination: {
          indicators: ['Multiple parameters', 'Negation needed', 'Advanced filters'],
          action: 'Build comprehensive structured filter object'
        }
      },
      question_analysis: {  // <- Now properly at the same level
        'does_anyone_own_X': {
          indicators: ['does anyone', 'who has', 'anyone got', 'who owns'],
          intent: 'Find any owners regardless of version',
          recommended_flow: 'Single ID + searchAllVersions: true'
        },
        'who_owns_specific_version': {
          indicators: ['Cold Foil', 'First Edition', 'Dynasty version', 'Rainbow Foil'],
          intent: 'Find owners of specific printing',
          recommended_flow: 'Filter search + specific printing IDs'
        },
        'trading_context': {
          indicators: ['for trade', 'looking to buy', 'available'],
          intent: 'Find tradeable copies',
          recommended_flow: 'Any approach + forTradeOnly: true'
        }
      }
    }
  })
};
