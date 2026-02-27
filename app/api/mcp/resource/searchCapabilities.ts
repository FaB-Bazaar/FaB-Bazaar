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
        'Use exact: true when users request specific cards',
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
            'CF': 'Cold Foil → "foilings": ["c"]',
            'RF': 'Rainbow Foil → "foilings": ["r"]',
            'EA': 'Extended Art (First Edition) → "editions": ["f"]'
          },
          special_indicators: {
            '(Marvel)': '"rarities": ["v"]',
            '(WB)': '"sets": ["hp1"]',
            '(Promo)': 'Check for promo sets'
          },
          card_name_cleaning: [
            'Remove quantity prefixes/suffixes',
            'Remove foiling abbreviations',
            'Remove parenthetical descriptions',
            'Handle dual cards with "/" or "//"',
            'Trim whitespace'
          ]
        },
        recommended_structure: {
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
            filters: {
              types: ['equipment'],
              rarities: ['m'],
              foilings: ['r'],
              priceMax: 50
            },
            options: {
              show: 'summary'
            }
          }
        },
        from_shorthand: {
          input: 't:equipment r:m f:rf p:<50',
          structured: {
            filters: {
              types: ['equipment'],
              rarities: ['m'],
              foilings: ['r'],
              priceMax: 50
            }
          }
        },
        from_collection_request: {
          input: '3x CF Art of Dragon: Blood',
          structured: {
            filters: {
              name: 'Art of Dragon: Blood',
              exact: true,
              foilings: ['c']
            },
            options: {
              show: 'collection'
            }
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
          'EA': { full: 'Extended Art (usually First Edition)', code: 'f' },
          'NF': { full: 'Non-foil/Standard', code: 's' },
          'GF': { full: 'Gold Foil', code: 'g' }
        },
        structured_conversion: {
          'CF': '"foilings": ["c"]',
          'RF': '"foilings": ["r"]',
          'EA': '"editions": ["f"]',
          'NF': '"foilings": ["s"]'
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
      claude_recommended_modes: {
        summary: {
          description: 'RECOMMENDED: Token-optimized essential data',
          when_to_use: [
            'General searches',
            'Deck building queries',
            'Quick lookups',
            'Most Claude interactions'
          ],
          includes: 'printing_id, name, printing_card_id, set, edition, foiling, rarity, color, tcg_market, power, cost, defense',
          token_efficiency: 'Highest'
        },
        gameplay: {
          description: 'Deck building and rules reference',
          when_to_use: [
            'Competitive deck building',
            'Rules questions',
            'Format-specific searches'
          ],
          includes: 'Game mechanics, stats, keywords, format legality',
          token_efficiency: 'Medium'
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
          filters: {
            name: 'extracted_card_name',
            exact: true,
            foilings: ['extracted_foiling_code'],
            rarities: ['extracted_rarity_if_special']
          },
          options: {
            show: 'collection',
            limit: 10
          },
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

    consistency_enforcement: {
      naming_conventions: {
        boolean_filters: 'Always use is/has prefix (isEquipment, hasLight)',
        negation_filters: 'Always use Not suffix (raritiesNot, setsNot)',
        array_fields: 'Always plural (rarities, not rarity)',
        case_sensitivity: 'printingCardId values must match exactly'
      },
      
      filter_standardization: {
        price_filtering: 'Always use priceMin/priceMax instead of operators',
        array_values: 'Always use arrays for multiple values',
        exact_matching: 'Set exact: true for specific card name requests',
        response_modes: 'Always specify show parameter for optimal results'
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
