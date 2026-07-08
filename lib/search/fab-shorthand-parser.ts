// lib/fab-shorthand-parser.ts - Complete updated version with talent support
// FIXED: All patterns now require explicit operators to prevent false matches
// FIXED: Pattern order optimized to prevent conflicts
// FIXED: Improved text removal to prevent fragments

import type { PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService';
import { HERO_NICKNAMES, normalizeSetCode } from '@/lib/fab-constants';
import { TalentUtils } from '@/lib/talent-constants';

interface ShorthandPattern {
  pattern: RegExp;
  parser: (match: RegExpMatchArray, filters: PrintingsSearchFilters) => void;
  description: string;
  examples: string[];
}

interface ParsedQuery {
  filters: PrintingsSearchFilters;
  remainingText: string;
  parsedTokens: string[];
}

export class FABShorthandParser {
  private patterns: ShorthandPattern[] = [
    // =====================================
    // NUMERIC PATTERNS FIRST - High priority to avoid conflicts
    // =====================================
    
    // Price searches - simple and clear
    {
      pattern: /\bp:(<|>|<=|>=)?(\d+(?:\.\d+)?)/gi,
      parser: (match, filters) => {
        const operator = match[1] || '<=';
        const price = parseFloat(match[2]);
        
        if (operator === '<' || operator === '<=') {
          filters.priceMax = price;
        } else if (operator === '>' || operator === '>=') {
          filters.priceMin = price;
        }
      },
      description: "Price filters",
      examples: ["p:<10", "p:>50", "p:25", "p:<=100"]
    },

    // Power searches - high priority to avoid conflicts
    {
      pattern: /\b(?:power|pow)([!<>:]?)(\d+(?:,\d+)*)/gi,
      parser: (match, filters) => {
        const operator = match[1] || ':';
        const valueString = match[2];
        
        // Parse comma-separated values
        const values = valueString.split(',').map(v => parseInt(v.trim()));
        
        switch (operator) {
          case '>':
            // power>3 means power >= 4
            filters.powerMin = values[0] + 1;
            break;
            
          case '<':
            // power<3 means power <= 2
            filters.powerMax = values[0] - 1;
            break;
            
          case '!':
            // power!3,4,5 means exclude power 3, 4, and 5
            if (!filters.powerNot) filters.powerNot = [];
            filters.powerNot.push(...values);
            break;
            
          case ':':
          default:
            // power:3,4,5 or power3,4,5 means exact matches
            if (values.length === 1) {
              filters.power = values[0];
            } else {
              filters.power = values;
            }
            break;
        }
      },
      description: "Card power with flexible operators and multiple values",
      examples: ["power>3", "power<6", "power!2,3", "power:1,4,5", "power4"]
    },

    // Cost searches - high priority to avoid conflicts
    {
      pattern: /\bcost([!<>:]?)(\d+(?:,\d+)*)/gi,
      parser: (match, filters) => {
        const operator = match[1] || ':';
        const valueString = match[2];
        
        // Parse comma-separated values
        const values = valueString.split(',').map(v => parseInt(v.trim()));
        
        switch (operator) {
          case '>':
            // cost>2 means cost >= 3
            filters.costMin = values[0] + 1;
            break;
            
          case '<':
            // cost<2 means cost <= 1
            filters.costMax = values[0] - 1;
            break;
            
          case '!':
            // cost!0,1 means exclude cost 0 and 1
            if (!filters.costNot) filters.costNot = [];
            filters.costNot.push(...values);
            break;
            
          case ':':
          default:
            // cost:0,1 or cost0,1 means exact matches for 0 or 1
            if (values.length === 1) {
              filters.cost = values[0];
            } else {
              filters.cost = values;
            }
            break;
        }
      },
      description: "Card cost with flexible operators and multiple values",
      examples: ["cost>2", "cost<3", "cost!0,1", "cost:0,1,2", "cost0,1"]
    },

    // Defense searches - high priority to avoid conflicts
    {
      pattern: /\b(?:defense|def)([!<>:]?)(\d+(?:,\d+)*)/gi,
      parser: (match, filters) => {
        const operator = match[1] || ':';
        const valueString = match[2];
        
        // Parse comma-separated values
        const values = valueString.split(',').map(v => parseInt(v.trim()));
        
        switch (operator) {
          case '>':
            // defense>3 means defense >= 4
            filters.defenseMin = values[0] + 1;
            break;
            
          case '<':
            // defense<3 means defense <= 2
            filters.defenseMax = values[0] - 1;
            break;
            
          case '!':
            // defense!2,3 means exclude defense 2 and 3
            if (!filters.defenseNot) filters.defenseNot = [];
            filters.defenseNot.push(...values);
            break;
            
          case ':':
          default:
            // defense:2,3 or def2,3 means exact matches for 2 or 3
            if (values.length === 1) {
              filters.defense = values[0];
            } else {
              filters.defense = values;
            }
            break;
        }
      },
      description: "Card defense with flexible operators and multiple values",
      examples: ["defense>2", "def<4", "defense!2,3", "def:1,2,3", "defense2,3"]
    },

    // =====================================
    // CATEGORICAL PATTERNS - Medium priority
    // =====================================

    // Type searches with flexible NOT support
    {
      pattern: /\b(?:type|t):([!-]?)([\w,!-]+)/gi,
      parser: (match, filters) => {
        const negationOperator = match[1]; // ! or -
        const typeString = match[2];
        
        // Handle global negation with operator (t:!generic or t:-generic)
        const isGlobalNot = negationOperator === '!' || negationOperator === '-';
        
        if (isGlobalNot) {
          // t:!generic,weapon - exclude all specified types
          const types = typeString.split(',').map(t => t.trim().toLowerCase());
          if (!filters.typesNot) filters.typesNot = [];
          filters.typesNot.push(...types);
          return;
        }
        
        // Handle mixed positive/negative (t:necromancer,!generic)
        const types = typeString.split(',').map(t => t.trim().toLowerCase());
        
        types.forEach(type => {
          const isNot = type.startsWith('!') || type.startsWith('-');
          const cleanType = type.replace(/^[!-]/, '');
          
          if (isNot) {
            if (!filters.typesNot) filters.typesNot = [];
            if (!filters.typesNot.includes(cleanType)) {
              filters.typesNot.push(cleanType);
            }
          } else {
            if (!filters.types) filters.types = [];
            if (!filters.types.includes(cleanType)) {
              filters.types.push(cleanType);
            }
          }
        });
      },
      description: "Card types with flexible NOT syntax",
      examples: [
        "t:equipment", 
        "t:!generic", 
        "t:necromancer,!generic", 
        "type:action,!attack",
        "t:!weapon,equipment"
      ]
    },

    // Talent searches
    {
      pattern: /\b(?:talents?|tal):([!-]?)([\w,!-]+)/gi,
      parser: (match, filters) => {
        const negationOperator = match[1]; // ! or -  
        const talentInput = match[2];
        
        // Handle global negation (tal:!light)
        const isGlobalNot = negationOperator === '!' || negationOperator === '-';
        
        if (isGlobalNot) {
          const talentTokens = talentInput.split(',').map(s => s.trim()).filter(Boolean);
          console.log('🎯 Global negation talent tokens:', talentTokens);
          
          try {
            const talentFilters = TalentUtils.convertTalentsToFilters(talentTokens, true);
            console.log('🎯 Global negation filters result:', talentFilters);
            Object.assign(filters, talentFilters);
          } catch (error) {
            console.error('🎯 Error in global talent negation:', error);
          }
          return;
        }
        
        // Handle regular case (mixed positive/negative)
        const talentTokens = talentInput.split(',').map(s => s.trim()).filter(Boolean);
        
        console.log('🎯 Talent tokens:', talentTokens);
        
        try {
          const talentFilters = TalentUtils.convertTalentsToFilters(talentTokens, false);
          console.log('🎯 Talent filters result:', talentFilters);
          
          console.log('🎯 Filters before assignment:', filters);
          Object.assign(filters, talentFilters);
          console.log('🎯 Filters after assignment:', filters);
          
        } catch (error) {
          console.error('🎯 Error in talent conversion:', error);
        }
      },
      description: "Card talents with abbreviation support and flexible NOT syntax",
      examples: ["tal:light", "tal:!light", "talent:i,e", "talent:!shadow", "tal:light,lightning"]
    },

    // Rarity searches
    {
      pattern: /\b(?:rarity|r):([!-]?)([\w,!-]+)/gi,
      parser: (match, filters) => {
        const negationOperator = match[1]; // '!' or '-'
        const rarityInput = match[2];
        
        // Handle global negation (r:!l)
        const isGlobalNot = negationOperator === '!' || negationOperator === '-';
        
        const rarityMap: { [key: string]: string } = {
          'c': 'c', 'common': 'c',
          'r': 'r', 'rare': 'r', 
          'm': 'm', 'majestic': 'm',
          'l': 'l', 'legendary': 'l',
          'f': 'f', 'fabled': 'f',
          's': 's', 'super': 's',
          'v': 'v', 'marvel': 'v',
          't': 't', 'token': 't',
          'p': 'p', 'promo': 'p'
        };
        
        if (isGlobalNot) {
          // r:!l syntax - single token with global negation
          const mappedRarity = rarityMap[rarityInput.toLowerCase()] || rarityInput.toLowerCase();
          
          if (!filters.raritiesNot) filters.raritiesNot = [];
          if (!filters.raritiesNot.includes(mappedRarity)) {
            filters.raritiesNot.push(mappedRarity);
          }
        } else {
          // r:l or r:m,l,!f syntax - supports comma-separated with mixed +/-
          const rarityTokens = rarityInput.split(',').map(s => s.trim()).filter(Boolean);
          
          rarityTokens.forEach(token => {
            const isNot = token.startsWith('!') || token.startsWith('-');
            const rarity = isNot ? token.substring(1) : token;
            const mappedRarity = rarityMap[rarity.toLowerCase()] || rarity.toLowerCase();
            
            if (isNot) {
              if (!filters.raritiesNot) filters.raritiesNot = [];
              if (!filters.raritiesNot.includes(mappedRarity)) {
                filters.raritiesNot.push(mappedRarity);
              }
            } else {
              if (!filters.rarities) filters.rarities = [];
              if (!filters.rarities.includes(mappedRarity)) {
                filters.rarities.push(mappedRarity);
              }
            }
          });
        }
      },
      description: "Card rarities with mixed +/- support",
      examples: ["rarity:m", "r:!c", "r:!l", "rarity:m,l,!f", "r:v,f,-m,-l"]
    },

    // Foiling searches
    {
      pattern: /\b(?:foil|f):([!a-zA-Z0-9,-]+)/gi,
      parser: (match, filters) => {
        const foilingInput = match[1];
        const foilingTokens = foilingInput.split(',').map(s => s.trim()).filter(Boolean);
        
        const foilingMap: { [key: string]: string } = {
          'rf': 'r', 'r': 'r', 'rainbow': 'r',
          'cf': 'c', 'c': 'c', 'cold': 'c',
          'nf': 's', 's': 's', 'normal': 's', 'standard': 's',
          'g': 'g', 'gold': 'g'
        };
        
        foilingTokens.forEach(token => {
          const isNot = token.startsWith('!') || token.startsWith('-');
          const foiling = isNot ? token.substring(1) : token;
          const mappedFoiling = foilingMap[foiling.toLowerCase()] || foiling.toLowerCase();
          
          if (isNot) {
            if (!filters.foilingsNot) filters.foilingsNot = [];
            if (!filters.foilingsNot.includes(mappedFoiling)) {
              filters.foilingsNot.push(mappedFoiling);
            }
          } else {
            if (!filters.foilings) filters.foilings = [];
            if (!filters.foilings.includes(mappedFoiling)) {
              filters.foilings.push(mappedFoiling);
            }
          }
        });
      },
      description: "Card foilings with mixed +/- support",
      examples: ["foil:rf", "f:!cf", "foil:r,c,!s", "f:rainbow,-cold"]
    },

    // Extended Art searches
    {
      pattern: /\b(?:ea|extendedart|extended):?(yes|no|true|false)?/gi,
      parser: (match, filters) => {
        const value = match[1]?.toLowerCase();
        // If no value or "yes"/"true", set to true; if "no"/"false", set to false
        if (!value || value === 'yes' || value === 'true') {
          filters.isExtendedArt = true;
        } else if (value === 'no' || value === 'false') {
          filters.isExtendedArt = false;
        }
      },
      description: "Extended art cards",
      examples: ["ea", "extendedart", "extended:yes", "ea:no"]
    },

    // Set searches
    {
      pattern: /\bset:([!a-zA-Z0-9,-]+)/gi,
      parser: (match, filters) => {
        const setInput = match[1];
        const setTokens = setInput.split(',').map(s => s.trim()).filter(Boolean);
        
        setTokens.forEach(token => {
          const isNot = token.startsWith('!') || token.startsWith('-');
          const setCode = normalizeSetCode(isNot ? token.substring(1) : token);

          if (isNot) {
            if (!filters.setsNot) filters.setsNot = [];
            if (!filters.setsNot.includes(setCode)) {
              filters.setsNot.push(setCode);
            }
          } else {
            if (!filters.sets) filters.sets = [];
            if (!filters.sets.includes(setCode)) {
              filters.sets.push(setCode);
            }
          }
        });
      },
      description: "Card sets with mixed +/- support",
      examples: ["set:wtr", "set:!arc", "set:wtr,arc,!out", "set:ele,mon,-dtd"]
    },

    // Edition searches
    {
      pattern: /\bedition:([!a-zA-Z0-9,-]+)/gi,
      parser: (match, filters) => {
        const editionInput = match[1];
        const editionTokens = editionInput.split(',').map(s => s.trim()).filter(Boolean);
        
        const editionMap: { [key: string]: string } = {
          'alpha': 'a', 'a': 'a',
          'first': 'f', 'f': 'f', 
          'unlimited': 'u', 'u': 'u',
          'normal': 'n', 'n': 'n'
        };
        
        editionTokens.forEach(token => {
          const isNot = token.startsWith('!') || token.startsWith('-');
          const edition = isNot ? token.substring(1) : token;
          const mappedEdition = editionMap[edition.toLowerCase()] || edition.toLowerCase();
          
          if (isNot) {
            if (!filters.editionsNot) filters.editionsNot = [];
            if (!filters.editionsNot.includes(mappedEdition)) {
              filters.editionsNot.push(mappedEdition);
            }
          } else {
            if (!filters.editions) filters.editions = [];
            if (!filters.editions.includes(mappedEdition)) {
              filters.editions.push(mappedEdition);
            }
          }
        });
      },
      description: "Card editions with mixed +/- support",
      examples: ["edition:f", "edition:!u", "edition:a,f,!n", "edition:first,-unlimited"]
    },

    // Pitch searches (pitch:1, pitch:red, pitch:2, pitch:yellow, pitch:3, pitch:blue)
    {
      pattern: /\bpitch:([1-3]|red|yellow|blue|r|y|b)\b/gi,
      parser: (match, filters) => {
        const val = match[1].toLowerCase();
        const pitchMap: { [key: string]: number } = {
          '1': 1, 'red': 1, 'r': 1,
          '2': 2, 'yellow': 2, 'y': 2,
          '3': 3, 'blue': 3, 'b': 3,
        };
        const pitch = pitchMap[val];
        if (pitch !== undefined) {
          filters.pitch = pitch;
        }
      },
      description: "Card pitch value (1/red, 2/yellow, 3/blue)",
      examples: ["pitch:1", "pitch:red", "pitch:2", "pitch:yellow", "pitch:3", "pitch:blue"]
    },

    // Color searches
    {
      pattern: /\bcolor:([!-]?)(red|blue|yellow|r|b|y)/gi,
      parser: (match, filters) => {
        const isNot = match[1] === '!' || match[1] === '-';
        const color = match[2].toLowerCase();
        const colorMap: { [key: string]: string } = {
          'r': 'red', 'b': 'blue', 'y': 'yellow'
        };
        const finalColor = colorMap[color] || color;
        
        if (isNot) {
          if (!filters.colorNot) filters.colorNot = [];
          if (!filters.colorNot.includes(finalColor)) {
            filters.colorNot.push(finalColor);
          }
        } else {
          filters.color = finalColor;
        }
      },
      description: "Card color (! or - for NOT)",
      examples: ["color:red", "color:b", "color:!red", "color:-blue"]
    },

    // Class searches - supports comma-separated classes
    {
      pattern: /\b(?:class|c):([!-]?)([\w,!-]+)/gi,
      parser: (match, filters) => {
        const negationOperator = match[1]; // ! or -
        const classInput = match[2];
        
        // Handle global negation with operator (c:!guardian or c:-guardian)
        const isGlobalNot = negationOperator === '!' || negationOperator === '-';
        
        if (isGlobalNot) {
          // c:!guardian,brute - exclude all specified classes
          const classes = classInput.split(',').map(c => c.trim().toLowerCase());
          if (!filters.classesNot) filters.classesNot = [];
          filters.classesNot.push(...classes);
          return;
        }
        
        // Handle mixed positive/negative (c:guardian,!brute)
        const classes = classInput.split(',').map(c => c.trim().toLowerCase());
        
        classes.forEach(className => {
          const isNot = className.startsWith('!') || className.startsWith('-');
          const cleanClass = className.replace(/^[!-]/, '');
          
          if (isNot) {
            if (!filters.classesNot) filters.classesNot = [];
            if (!filters.classesNot.includes(cleanClass)) {
              filters.classesNot.push(cleanClass);
            }
          } else {
            if (!filters.classes) filters.classes = [];
            if (!filters.classes.includes(cleanClass)) {
              filters.classes.push(cleanClass);
            }
          }
        });
      },
      description: "Card classes with flexible NOT syntax and multiple values",
      examples: ["class:guardian", "c:wizard,ranger", "class:!brute", "c:guardian,!generic", "c:!brute,guardian"]
    },

    // Hero searches
    {
      pattern: /\b(?:hero|h):([!-]?)([a-zA-Z\s]+?)(?=\s|$)/gi,
      parser: (match, filters) => {
        const isNot = match[1] === '!' || match[1] === '-';
        let heroName = match[2].trim().toLowerCase();
        
        if (!heroName) return;
        
        const mappedHero = HERO_NICKNAMES[heroName as keyof typeof HERO_NICKNAMES];
        const finalHero = mappedHero || heroName;
        
        if (isNot) {
          if (!filters.heroNotLegal) filters.heroNotLegal = [];
          filters.heroNotLegal.push(finalHero);
        } else {
          filters.heroLegal = finalHero;
        }
      },
      description: "Hero-specific cards (! or - for NOT)",
      examples: ["hero:gravy", "hero:marlynn", "hero:!puffin", "hero:-starvo"]
    },

    // =====================================
    // TEXT-BASED PATTERNS - Lower priority but specific syntax
    // =====================================

    // Keyword searches - quoted keywords (process before simple keywords)
    {
      pattern: /\b(?:keyword|k):([!-]?)"([^"]+)"/gi,
      parser: (match, filters) => {
        const isNot = match[1] === '!' || match[1] === '-';
        const keywordInput = match[2].trim();
        
        // Split by comma for multiple keywords in quotes
        const keywords = keywordInput.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
        
        keywords.forEach(keyword => {
          if (isNot) {
            if (!filters.keywordsNot) filters.keywordsNot = [];
            if (!filters.keywordsNot.includes(keyword)) {
              filters.keywordsNot.push(keyword);
            }
          } else {
            if (!filters.keywords) filters.keywords = [];
            if (!filters.keywords.includes(keyword)) {
              filters.keywords.push(keyword);
            }
          }
        });
      },
      description: "Card keywords with quotes, supports multiple keywords (! or - for NOT)",
      examples: ['keyword:"go again"', 'keyword:"dominate,stealth"', 'keyword:!"stealth"', 'keyword:-"crush,intimidate"']
    },

    // Simple keyword searches - FIXED: No spaces, only comma-separated single words
    {
      pattern: /\b(?:keyword|k):([!-]?)([\w,!-]+)/gi,
      parser: (match, filters) => {
        const negationOperator = match[1]; // ! or -
        const keywordInput = match[2].trim();
        
        // Handle global negation with operator (keyword:!dominate,stealth)
        const isGlobalNot = negationOperator === '!' || negationOperator === '-';
        
        if (isGlobalNot) {
          // keyword:!dominate,stealth - exclude all specified keywords
          const keywords = keywordInput.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
          if (!filters.keywordsNot) filters.keywordsNot = [];
          filters.keywordsNot.push(...keywords);
          return;
        }
        
        // Handle mixed positive/negative (keyword:dominate,!stealth)
        const keywords = keywordInput.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
        
        keywords.forEach(keyword => {
          const isNot = keyword.startsWith('!') || keyword.startsWith('-');
          const cleanKeyword = keyword.replace(/^[!-]/, '');
          
          if (isNot) {
            if (!filters.keywordsNot) filters.keywordsNot = [];
            if (!filters.keywordsNot.includes(cleanKeyword)) {
              filters.keywordsNot.push(cleanKeyword);
            }
          } else {
            if (!filters.keywords) filters.keywords = [];
            if (!filters.keywords.includes(cleanKeyword)) {
              filters.keywords.push(cleanKeyword);
            }
          }
        });
      },
      description: "Single-word keywords, comma-separated (! or - for NOT). Use quotes for multi-word keywords.",
      examples: ["keyword:dominate", "keyword:stealth,combo", "keyword:!crush", "keyword:dominate,!stealth"]
    },

    // Text searches
    {
      pattern: /\btext:([!-]?)"([^"]+)"/gi,
      parser: (match, filters) => {
        const isNot = match[1] === '!' || match[1] === '-';
        const searchText = match[2];

        if (isNot) {
          filters.textNot = searchText;
        } else {
          filters.text = searchText;
          filters.exact = true;
        }
      },
      description: "Exact text search (! or - for NOT)",
      examples: ['text:"create a gold"', 'text:"runechant"', 'text:!"dagger"', 'text:-"destroy"']
    },

    // Unquoted single-token text search: text:ice, text:!dagger
    // Multi-word phrases must use the quoted form above.
    {
      pattern: /\btext:([!-]?)([a-z0-9][a-z0-9_-]*)/gi,
      parser: (match, filters) => {
        const isNot = match[1] === '!' || match[1] === '-';
        const searchText = match[2];

        if (isNot) {
          filters.textNot = searchText;
        } else {
          filters.text = searchText;
        }
      },
      description: "Single-word rule-text search (! or - for NOT)",
      examples: ['text:ice', 'text:runechant', 'text:!dagger']
    },

    // Format searches
    {
      pattern: /\bformat:(blitz|cc|commoner|ll|silver_age|sage)/gi,
      parser: (match, filters) => {
        const fmt = match[1].toLowerCase();
        // "sage" is community shorthand for Silver Age
        filters.format = (fmt === 'sage' ? 'silver_age' : fmt) as any;
      },
      description: "Cards legal in format",
      examples: ["format:blitz", "format:cc", "format:silver_age (alias: sage)"]
    }
  ];

  // Keep simple expansions for common shortcuts
  private expansions: { [key: string]: string } = {
    'cnc': 'command and conquer',
    'aow': 'art of war',
    'ga': 'go again',
    'dom': 'dominate'
  };

  parseQuery(query: string): ParsedQuery {
    let workingQuery = query.toLowerCase().trim();
    const filters: PrintingsSearchFilters = {};
    const parsedTokens: string[] = [];

    // Apply patterns - with improved text removal
    for (const pattern of this.patterns) {
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      let match;
      
      while ((match = regex.exec(workingQuery)) !== null) {
        try {
          pattern.parser(match, filters);
          parsedTokens.push(`${match[0]} (${pattern.description})`);
          
          // Replace matched token with spaces to preserve indices (don't trim/collapse inside loop)
          const matchStart = match.index!;
          const matchEnd = matchStart + match[0].length;
          workingQuery = workingQuery.substring(0, matchStart) + ' '.repeat(match[0].length) + workingQuery.substring(matchEnd);

          // Reset regex lastIndex to prevent infinite loops
          regex.lastIndex = 0;
        } catch (error) {
          console.warn('Pattern parsing error:', error);
          // Reset regex lastIndex on error to prevent infinite loops
          regex.lastIndex = 0;
        }
      }
    }

    // Apply expansions to remaining text
    for (const [shorthand, expansion] of Object.entries(this.expansions)) {
      const regex = new RegExp(`\\b${this.escapeRegex(shorthand)}\\b`, 'gi');
      if (regex.test(workingQuery)) {
        workingQuery = workingQuery.replace(regex, expansion);
        parsedTokens.push(`${shorthand} → ${expansion}`);
      }
    }

    // Clean up remaining text (collapse spaces once at the end)
    const remainingText = workingQuery
      .replace(/\s+/g, ' ')
      .replace(/[\u2018\u2019\u0027\u0060]/g, "'")
      .trim();

    // Whole-query card-TYPE phrases ("defense reactions", "red attack actions")
    // are category searches, not card names. Fires ONLY when nothing else
    // remains, so names containing a type word ("aura of ebano") stay name
    // searches. The optional leading color covers first-token colors, which
    // the standalone color rule deliberately skips (name-prefix guard).
    // Kept in sync with lib/fab-shorthand-parser.ts (pinned by shared tests).
    const typePhrase = remainingText.match(
      /^(?:(red|yellow|blue)\s+)?(defense reactions?|attack reactions?|attack actions?|actions?|instants?|equipment|weapons?|auras?|items?)(?:\s+(red|yellow|blue))?$/i
    );
    if (typePhrase) {
      const phraseColor = typePhrase[1] ?? typePhrase[3];
      if (phraseColor) filters.color = phraseColor.toLowerCase();
      const singular = typePhrase[2].toLowerCase().replace(/s$/, '');
      const patch: Partial<PrintingsSearchFilters> = {
        'defense reaction': { isDefenseReaction: true },
        'attack reaction': { types: ['attack reaction'] },
        'attack action': { isAttack: true },
        'action': { isAction: true },
        'instant': { isInstant: true },
        'equipment': { isEquipment: true },
        'weapon': { isWeapon: true },
        'aura': { types: ['aura'] },
        'item': { types: ['item'] },
      }[singular] ?? {};
      Object.assign(filters, patch);
      parsedTokens.push(`${typePhrase[0]} (card type)`);
      return {
        filters,
        remainingText: '',
        parsedTokens
      };
    }

    // Map remaining plain text to filters.name (typo-tolerant name search).
    // Rule text is intentionally excluded from the default — use text:"phrase" or
    // text:word to search rule text explicitly.
    if (remainingText && remainingText.length > 0) {
      filters.name = remainingText;
      parsedTokens.push(`"${remainingText}" (name search)`);
    }

    return {
      filters,
      remainingText,
      parsedTokens
    };
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getHelpText(): string {
    return `
FAB Shorthand Parser V3 - Optimized Pattern Order

ALL FIELDS REQUIRE EXPLICIT PREFIXES:

NUMERIC PATTERNS (High Priority):
  Price: p:<10, p:>50, p:25
  Power: power>3, power:1,4,5, power!2,3
  Cost: cost:0,1, cost>2, cost!0
  Defense: defense:2,3, def>1, defense!3

CATEGORICAL PATTERNS:
  Types: t:equipment, t:!generic, type:action,!attack
  Talents: tal:light, talent:i,e, tal:!shadow
  Rarities: r:l,f, rarity:!c, r:m,l,!f
  Sets: set:wtr, set:wtr,arc,!out
  Classes: class:guardian, c:wizard,!brute
  Heroes: hero:gravy, hero:marlynn

TEXT PATTERNS (Lower Priority):
  Keywords: keyword:"go again", keyword:dominate,!stealth
  Text: text:"create a gold"
  Format: format:blitz

PATTERN ORDER OPTIMIZED:
✅ Numeric patterns processed first (prevents comma conflicts)
✅ Categorical patterns second (specific syntax)  
✅ Text patterns last (most general)
✅ Improved text removal (prevents fragments)

EXAMPLES:
  "hero:levia cost:0,1 defense:2,3 keyword:stealth"
  "tal:light type:equipment p:>100 rarity:l"
  "hero:uzuri keyword:stealth,combo cost<3"
    `;
  }
}