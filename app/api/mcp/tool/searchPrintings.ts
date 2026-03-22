// app/api/mcp/tool/searchPrintings.ts - ENHANCED VERSION with human-readable output
import { printingsService } from '@/lib/services';
import { FABShorthandParser } from '@/lib/fab-shorthand-parser';
import type { PrintingsSearchFilters, PrintingsSearchOptions } from '@/lib/services/contracts/IPrintingsService';

// Create single instance to reuse
const shorthandParser = new FABShorthandParser();

// Human-readable translation maps
const FOILING_DISPLAY: { [key: string]: string } = {
  's': 'Non-foil',
  'r': 'Rainbow Foil',
  'c': 'Cold Foil',
  'g': 'Gold Foil'
};

const EDITION_DISPLAY: { [key: string]: string } = {
  'n': 'Normal',
  'f': 'First Edition',
  'u': 'Unlimited',
  'a': 'Alpha'
};

const RARITY_DISPLAY: { [key: string]: string } = {
  'c': 'Common',
  'r': 'Rare',
  's': 'Super Rare',
  'm': 'Majestic',
  'l': 'Legendary',
  'f': 'Fabled',
  't': 'Token',
  'p': 'Promo',
  'v': 'Marvel'
};

// Inline helper function to convert MCP filters to search filters
function convertMCPFiltersToSearchFilters(mcpFilters: any): PrintingsSearchFilters {
  const searchFilters: PrintingsSearchFilters = {};
  
  // Direct mappings for all the existing fields
  if (mcpFilters.name) searchFilters.name = mcpFilters.name;
  if (mcpFilters.text) searchFilters.text = mcpFilters.text;
  if (mcpFilters.searchableText) searchFilters.searchableText = mcpFilters.searchableText;
  if (mcpFilters.exact !== undefined) searchFilters.exact = mcpFilters.exact;
  
  // Handle printingCardId (can be string or comma-separated)
  if (mcpFilters.printingCardId) {
    if (typeof mcpFilters.printingCardId === 'string' && mcpFilters.printingCardId.includes(',')) {
      searchFilters.printingCardId = mcpFilters.printingCardId.split(',').map(s => s.trim());
    } else {
      searchFilters.printingCardId = mcpFilters.printingCardId;
    }
  }
  
  // Handle printingIds (comma-separated string to array)
  if (mcpFilters.printingIds) {
    if (typeof mcpFilters.printingIds === 'string') {
      searchFilters.printingIds = mcpFilters.printingIds.split(',').map(s => s.trim());
    } else {
      searchFilters.printingIds = mcpFilters.printingIds;
    }
  }
  
  // Basic fields
  if (mcpFilters.sets) searchFilters.sets = mcpFilters.sets;
  if (mcpFilters.types) searchFilters.types = mcpFilters.types;
  if (mcpFilters.classes) searchFilters.classes = mcpFilters.classes;
  if (mcpFilters.talents) searchFilters.talents = mcpFilters.talents;
  if (mcpFilters.talentsAll) (searchFilters as any).talentsAll = mcpFilters.talentsAll;
  if (mcpFilters.rarities) searchFilters.rarities = mcpFilters.rarities;
  if (mcpFilters.foilings) searchFilters.foilings = mcpFilters.foilings;
  if (mcpFilters.editions) searchFilters.editions = mcpFilters.editions;
  if (mcpFilters.color) searchFilters.color = mcpFilters.color;
  if (mcpFilters.traits) searchFilters.traits = mcpFilters.traits;
  if (mcpFilters.keywords) searchFilters.keywords = mcpFilters.keywords;
  if (mcpFilters.artists) searchFilters.artists = mcpFilters.artists;
  
  // Stats
  if (mcpFilters.power !== undefined) searchFilters.power = mcpFilters.power;
  if (mcpFilters.powerMin !== undefined) searchFilters.powerMin = mcpFilters.powerMin;
  if (mcpFilters.powerMax !== undefined) searchFilters.powerMax = mcpFilters.powerMax;
  if (mcpFilters.powerNot !== undefined) (searchFilters as any).powerNot = mcpFilters.powerNot;
  if (mcpFilters.cost !== undefined) searchFilters.cost = mcpFilters.cost;
  if (mcpFilters.costs !== undefined) (searchFilters as any).costs = mcpFilters.costs;
  if (mcpFilters.costMin !== undefined) searchFilters.costMin = mcpFilters.costMin;
  if (mcpFilters.costMax !== undefined) searchFilters.costMax = mcpFilters.costMax;
  if (mcpFilters.costNot !== undefined) (searchFilters as any).costNot = mcpFilters.costNot;
  if (mcpFilters.defense !== undefined) searchFilters.defense = mcpFilters.defense;
  if (mcpFilters.defenseMin !== undefined) searchFilters.defenseMin = mcpFilters.defenseMin;
  if (mcpFilters.defenseMax !== undefined) searchFilters.defenseMax = mcpFilters.defenseMax;
  if (mcpFilters.defenseNot !== undefined) (searchFilters as any).defenseNot = mcpFilters.defenseNot;
  if (mcpFilters.pitch !== undefined) searchFilters.pitch = mcpFilters.pitch;
  
  // Price filters
  if (mcpFilters.priceMin !== undefined) searchFilters.priceMin = mcpFilters.priceMin;
  if (mcpFilters.priceMax !== undefined) searchFilters.priceMax = mcpFilters.priceMax;
  if (mcpFilters.priceField) searchFilters.priceField = mcpFilters.priceField;
  if (mcpFilters.cardUniqueId) searchFilters.cardUniqueId = mcpFilters.cardUniqueId;
  if (mcpFilters.cardUniqueIds) searchFilters.cardUniqueIds = mcpFilters.cardUniqueIds;
  
  // Hero-based filtering
  if (mcpFilters.heroLegal) searchFilters.heroLegal = mcpFilters.heroLegal;
  if (mcpFilters.heroClasses) (searchFilters as any).heroClasses = mcpFilters.heroClasses;
  if (mcpFilters.heroTalents) (searchFilters as any).heroTalents = mcpFilters.heroTalents;
  if (mcpFilters.heroEssences) (searchFilters as any).heroEssences = mcpFilters.heroEssences;
  if (mcpFilters.excludeClasses) searchFilters.excludeClasses = mcpFilters.excludeClasses;
  if (mcpFilters.excludeTalents) searchFilters.excludeTalents = mcpFilters.excludeTalents;
  
  // Format legality
  if (mcpFilters.format) searchFilters.format = mcpFilters.format;
  if (mcpFilters.includeBanned !== undefined) searchFilters.includeBanned = mcpFilters.includeBanned;
  if (mcpFilters.includeSuspended !== undefined) searchFilters.includeSuspended = mcpFilters.includeSuspended;
  
  // Add all boolean filters
  const booleanFields = [
    'isAction', 'isAttack', 'isDefenseReaction', 'isInstant', 'isEquipment', 
    'isWeapon', 'isHero', 'isMentor', 'isToken',
    'isFirstEdition', 'isUnlimited', 'isNormalEdition',
    'isNormalFoil', 'isRainbowFoil', 'isColdFoil',
    'isCommon', 'isRare', 'isSuperRare', 'isMajestic', 'isLegendary', 'isFabled', 'isPromo',
    'isBudget', 'isUnder5', 'isUnder10', 'isUnder25', 'isUnder50', 'isUnder100', 'isExpensive', 'isPremium',
    'hasProductId',
    // Class boolean filters
    'isGeneric', 'isBrute', 'isGuardian', 'isMechanologist', 'isRanger', 'isRuneblade', 
    'isAssassin', 'isWarrior', 'isNinja', 'isWizard', 'isMerchant', 'isBard', 
    'isAdjudicator', 'isIllusionist', 'isThief', 'isShapeshifter', 'isNecromancer',
    // Talent boolean filters
    'hasChaos', 'hasLight', 'hasRoyal', 'hasDraconic', 'hasLightning', 'hasShadow', 
    'hasEarth', 'hasMystic', 'hasRevered', 'hasIce', 'hasReviled', 'hasPirate', 'hasElemental',
    // Combination filters
    'isGenericOnly', 'hasClassAndTalent', 'hasClassOnly', 'hasTalentOnly'
  ];
  
  booleanFields.forEach(field => {
    if (mcpFilters[field] !== undefined) {
      (searchFilters as any)[field] = mcpFilters[field];
    }
  });

  // Add negation filters
  const negationFields = [
    'colorNot', 'raritiesNot', 'setsNot', 'foilingsNot', 'editionsNot',
    'typesNot', 'keywordsNot', 'textNot', 'talentsNot', 'classesNot'
  ];
  
  negationFields.forEach(field => {
    if (mcpFilters[field] !== undefined) {
      (searchFilters as any)[field] = mcpFilters[field];
    }
  });
  
  return searchFilters;
}

// Helper function to format printing for human-readable output
function formatPrintingForDisplay(printing: any): string {
  const name = printing.name || 'Unknown Card';
  const printingCardId = printing.printing_card_id || 'N/A';
  const set = printing.set?.toUpperCase() || 'N/A';
  const edition = EDITION_DISPLAY[printing.edition] || printing.edition || 'N/A';
  const foiling = FOILING_DISPLAY[printing.foiling] || printing.foiling || 'N/A';
  const rarity = RARITY_DISPLAY[printing.rarity] || printing.rarity || 'N/A';
  const price = printing.tcg_market ? `$${printing.tcg_market.toFixed(2)}` : 'N/A';
  
  return `• ${name} (${printingCardId})
    Printing ID: ${printing.printing_id}
    Card Unique ID: ${printing.card_unique_id})
    Set: ${set} • Edition: ${edition} • Foiling: ${foiling}
    Rarity: ${rarity} • Price: ${price}`;
}

export const searchPrintingsTool = {
  name: 'search_printings',
  description: `🔍 ENHANCED SEARCH: Natural language and shorthand query support!

⚡ NEW FEATURES:
- Natural shorthand queries: "talent:light p:<25 rarity:m type:equipment"
- Intelligent query parsing with abbreviations and operators
- Enhanced talent/essence system support
- Flexible negation syntax (!, -, "Not" operators)

🎯 QUERY FORMATS SUPPORTED:

1️⃣ SHORTHAND QUERIES (Recommended):
   Use the "query" parameter for natural language searches:
   • "rf cnc alpha wtr" → Rainbow foil Command and Conquer from Alpha WTR
   • "talent:light,ice type:equipment p:>50" → Light/Ice elemental equipment over $50
   • "hero:gravy p:<100 rarity:!c" → Gravy-legal cards under $100, exclude commons
   • "set:wtr,arc talent:!shadow foil:rf" → WTR/ARC sets, exclude shadow, rainbow foil

2️⃣ STRUCTURED FILTERS (Advanced):
   Use individual filter parameters for programmatic searches

📚 SHORTHAND SYNTAX GUIDE:
- Price: p:<10, p:>50, p:25 
- Types: type:equipment, t:!generic, type:necromancer,!weapon
- Talents: talent:light, tal:i,e, talent:!shadow
- Rarities: r:m,l, rarity:!c, r!f
- Sets: set:wtr,arc, set:!out
- Foiling: foil:rf,cf, f:!s
- Heroes: hero:gravy, hero:oldhim
- Colors: color:red, color:!blue
- Stats: power>3, cost:2, defense<4

🚨 REQUIREMENTS: Complete setup first!
1️⃣ read_mandatory_constants_first({"uri": "fab://constants"})
2️⃣ read_mandatory_constants_first({"uri": "searchable://card/fields"})

💡 The shorthand parser automatically handles abbreviations, operators, and converts natural queries into optimized database searches.

⭐ Use shorthand for human-readable queries, structured filters for programmatic access.`,
  
  parameters: {
    type: 'object',
    properties: {
      // REQUIRED: Setup confirmation parameter
      _resourcesConfirmed: {
        type: 'boolean',
        description: 'REQUIRED: Must be set to true after reading both fab://constants and searchable://card/fields resources via read_mandatory_constants_first tool. This confirms you have loaded the necessary abbreviations and search capabilities.',
        default: false
      },

      // NEW: Primary shorthand query parameter
      query: {
        type: 'string',
        description: `Natural language shorthand query string. Examples:
        • "talent:light p:<25 rarity:m type:equipment"
        • "rf cnc alpha wtr" 
        • "hero:gravy p:<100 rarity:!c"
        • "set:wtr,arc talent:!shadow foil:rf"
        • "blue wizard instant under $10"
        
        Supports all shorthand syntax from FABShorthandParser including:
        - Price operators: p:<10, p:>50, p:25
        - Type filters: type:equipment, t:!generic  
        - Talent filters: talent:light, tal:i,e
        - Negation: !, -, "not" keywords
        - Abbreviations: rf=rainbow foil, cnc=command and conquer, etc.`
      },
      
      // EXISTING: All structured filter parameters (unchanged for backward compatibility)
      filters: {
        type: 'object',
        properties: {
          // Text searches
          name: { type: 'string', description: 'Card name' },
          text: { type: 'string', description: 'Search in card text' },
          searchableText: { type: 'string', description: 'Search across all text fields' },
          exact: { type: 'boolean', description: 'Exact name match' },
          
          // Card identification
          printingCardId: { type: 'string', description: 'Traditional printing ID (e.g. WTR216, ARC000) or comma-separated list' },
          printingIds: { type: 'string', description: 'MongoDB-style printing IDs or comma-separated list' },
          cardUniqueId: { type: 'string', description: 'Unique card identifier' },
          cardUniqueIds: { type: 'string', description: 'Comma-separated list of unique card identifiers' },
          
          // Card attributes
          types: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Card types including classes'
          },
          classes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific classes (guardian, necromancer, etc.)'
          },
          talents: {
            type: 'array',
            items: { type: 'string' },
            description: 'Talents/essences — card must have ANY of these (OR logic). Use talentsAll for AND logic.'
          },
          talentsAll: {
            type: 'array',
            items: { type: 'string' },
            description: 'Card must have ALL of these talents (AND logic / subset match). Use for multi-talent requirements like ["light", "ice"].'
          },
          traits: {
            type: 'array',
            items: { type: 'string' },
            description: 'Card traits'
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Card keywords (go again, dominate, stealth, phantasm, etc.)'
          },
          color: {
            type: 'string', 
            enum: ['blue', 'red', 'yellow'],
            description: 'Card color'
          },
          
          // Stats
          power: { type: ['number', 'array'], description: 'Exact power value(s)' },
          powerMin: { type: 'number', description: 'Minimum power' },
          powerMax: { type: 'number', description: 'Maximum power' },
          powerNot: { type: 'array', items: { type: 'number' }, description: 'Power values to exclude' },
          cost: { type: ['number', 'array'], description: 'Exact cost value(s)' },
          costs: { type: 'array', items: { type: 'number' }, description: 'Match any of these exact cost values (e.g. [0,1,2] for budget cards)' },
          costMin: { type: 'number', description: 'Minimum cost' },
          costMax: { type: 'number', description: 'Maximum cost' },
          costNot: { type: 'array', items: { type: 'number' }, description: 'Cost values to exclude' },
          defense: { type: ['number', 'array'], description: 'Exact defense value(s)' },
          defenseMin: { type: 'number', description: 'Minimum defense' },
          defenseMax: { type: 'number', description: 'Maximum defense' },
          defenseNot: { type: 'array', items: { type: 'number' }, description: 'Defense values to exclude' },
          pitch: { type: ['number', 'array'], description: 'Pitch value(s) — 1=red, 2=yellow, 3=blue' },
          
          // Printing attributes
          sets: { type: 'array', items: { type: 'string' }, description: 'Set codes' },
          editions: { type: 'array', items: { type: 'string' }, description: 'Edition types' },
          foilings: { type: 'array', items: { type: 'string' }, description: 'Foiling types' },
          rarities: { type: 'array', items: { type: 'string' }, description: 'Rarity codes' },
          artists: { type: 'array', items: { type: 'string' }, description: 'Artist names' },
          
          // Price filters
          priceMin: { type: 'number', description: 'Minimum price in USD' },
          priceMax: { type: 'number', description: 'Maximum price in USD' },
          priceField: {
            type: 'string',
            enum: ['tcg_low', 'tcg_mid', 'tcg_high', 'tcg_market'],
            description: 'Price field to use for filtering'
          },
          
          // Hero-based filtering
          heroLegal: { type: 'string', description: 'Hero name — returns cards legal for that hero (OR logic across hero classes/talents)' },
          heroClasses: { type: 'array', items: { type: 'string' }, description: 'Precise hero filtering: card classes must overlap with these (use with heroTalents for deck legality)' },
          heroTalents: { type: 'array', items: { type: 'string' }, description: 'Precise hero filtering: card talents must be a subset of these' },
          heroEssences: { type: 'array', items: { type: 'string' }, description: 'Elemental essences the hero supports' },
          excludeClasses: { type: 'array', items: { type: 'string' }, description: 'Classes to exclude from results' },
          excludeTalents: { type: 'array', items: { type: 'string' }, description: 'Talents to exclude from results' },

          // Format legality
          format: {
            type: 'string',
            enum: ['blitz', 'cc', 'commoner', 'll', 'silver_age'],
            description: 'Format legality filter'
          },
          includeBanned: { type: 'boolean', description: 'Include banned cards' },
          includeSuspended: { type: 'boolean', description: 'Include suspended cards' },
          
          // Negation filters
          colorNot: { type: 'array', items: { type: 'string' }, description: 'Colors to exclude' },
          raritiesNot: { type: 'array', items: { type: 'string' }, description: 'Rarities to exclude' },
          setsNot: { type: 'array', items: { type: 'string' }, description: 'Sets to exclude' },
          foilingsNot: { type: 'array', items: { type: 'string' }, description: 'Foilings to exclude' },
          editionsNot: { type: 'array', items: { type: 'string' }, description: 'Editions to exclude' },
          typesNot: { type: 'array', items: { type: 'string' }, description: 'Types to exclude' },
          classesNot: { type: 'array', items: { type: 'string' }, description: 'Classes to exclude' },
          keywordsNot: { type: 'array', items: { type: 'string' }, description: 'Keywords to exclude' },
          textNot: { type: 'string', description: 'Text to exclude (substring match)' },
          talentsNot: { type: 'array', items: { type: 'string' }, description: 'Talents to exclude' },
          
          // Boolean convenience filters (extensive list maintained for backward compatibility)
          isAction: { type: 'boolean' },
          isAttack: { type: 'boolean' },
          isDefenseReaction: { type: 'boolean' },
          isInstant: { type: 'boolean' },
          isEquipment: { type: 'boolean' },
          isWeapon: { type: 'boolean' },
          isHero: { type: 'boolean' },
          isMentor: { type: 'boolean' },
          isToken: { type: 'boolean' },
          
          // Boolean class filters
          isGeneric: { type: 'boolean' },
          isBrute: { type: 'boolean' },
          isGuardian: { type: 'boolean' },
          isMechanologist: { type: 'boolean' },
          isRanger: { type: 'boolean' },
          isRuneblade: { type: 'boolean' },
          isAssassin: { type: 'boolean' },
          isWarrior: { type: 'boolean' },
          isNinja: { type: 'boolean' },
          isWizard: { type: 'boolean' },
          isMerchant: { type: 'boolean' },
          isBard: { type: 'boolean' },
          isAdjudicator: { type: 'boolean' },
          isIllusionist: { type: 'boolean' },
          isThief: { type: 'boolean' },
          isShapeshifter: { type: 'boolean' },
          isNecromancer: { type: 'boolean' },
          
          // Boolean talent filters
          hasChaos: { type: 'boolean' },
          hasLight: { type: 'boolean' },
          hasRoyal: { type: 'boolean' },
          hasDraconic: { type: 'boolean' },
          hasLightning: { type: 'boolean' },
          hasShadow: { type: 'boolean' },
          hasEarth: { type: 'boolean' },
          hasMystic: { type: 'boolean' },
          hasRevered: { type: 'boolean' },
          hasIce: { type: 'boolean' },
          hasReviled: { type: 'boolean' },
          hasPirate: { type: 'boolean' },
          hasElemental: { type: 'boolean' },
          
          // Boolean combination filters
          isGenericOnly: { type: 'boolean' },
          hasClassAndTalent: { type: 'boolean' },
          hasClassOnly: { type: 'boolean' },
          hasTalentOnly: { type: 'boolean' },
          
          // Boolean edition filters
          isFirstEdition: { type: 'boolean' },
          isUnlimited: { type: 'boolean' },
          isNormalEdition: { type: 'boolean' },
          
          // Boolean foiling filters
          isNormalFoil: { type: 'boolean' },
          isRainbowFoil: { type: 'boolean' },
          isColdFoil: { type: 'boolean' },
          
          // Boolean rarity filters
          isCommon: { type: 'boolean' },
          isRare: { type: 'boolean' },
          isSuperRare: { type: 'boolean' },
          isMajestic: { type: 'boolean' },
          isLegendary: { type: 'boolean' },
          isFabled: { type: 'boolean' },
          isPromo: { type: 'boolean' },
          
          // Boolean price filters
          isBudget: { type: 'boolean' },
          isUnder5: { type: 'boolean' },
          isUnder10: { type: 'boolean' },
          isUnder25: { type: 'boolean' },
          isUnder50: { type: 'boolean' },
          isUnder100: { type: 'boolean' },
          isExpensive: { type: 'boolean' },
          isPremium: { type: 'boolean' },
          
          // Data availability filters
          hasProductId: { type: 'boolean' }
        }
      },
      
      options: {
        type: 'object',
        properties: {
          limit: { 
            type: 'number', 
            default: 12, 
            minimum: 1,
            maximum: 100,
            description: 'Number of results to return (1-100)' 
          },
          page: { 
            type: 'number', 
            default: 1, 
            minimum: 1,
            description: 'Page number for pagination' 
          },
          sortBy: {
            type: 'string',
            enum: ['name', 'price', 'power', 'cost', 'defense', 'set', 'rarity', 'printing_card_id', 'relevance'],
            description: 'Field to sort results by'
          },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: 'Sort order: ascending or descending'
          },
          show: {
            type: 'string',
            enum: ['all', 'summary', 'gameplay', 'identifiers'],
            default: 'summary',
            description: 'Hint for response verbosity (note: currently all modes return full data — use limit to control token usage)'
          }
        }
      }
    },
    required: ['_resourcesConfirmed']
  },

  handler: async ({ query, filters = {}, options = {} }) => {
    console.log('🔍 ENHANCED SEARCH PRINTINGS TOOL EXECUTION START');
    console.log('📥 Raw query string:', query);
    console.log('📥 Structured filters:', JSON.stringify(filters, null, 2));
    console.log('📥 Options:', JSON.stringify(options, null, 2));

    try {
      const startTime = Date.now();
      let finalFilters: PrintingsSearchFilters = {};
      let parseInfo = '';

      // PRIMARY: Handle shorthand query if provided
      if (query && query.trim()) {
        console.log('🎯 Processing shorthand query:', query);
        
        try {
          const parseResult = shorthandParser.parseQuery(query.trim());
          finalFilters = parseResult.filters;
          
          parseInfo = `
🎯 Shorthand Query Parsed: "${query}"
📝 Extracted Filters: ${JSON.stringify(parseResult.parsedTokens, null, 2)}
${parseResult.remainingText ? `📋 Remaining Text: "${parseResult.remainingText}"` : ''}
`;

          console.log('✅ Shorthand parsing successful:', parseResult);
        } catch (parseError) {
          console.warn('⚠️ Shorthand parsing failed, falling back to name search:', parseError);
          // Fallback: treat query as name search
          finalFilters = { name: query.trim() };
          parseInfo = `
⚠️ Shorthand parsing failed, using as name search: "${query}"
`;
        }
      }

      // SECONDARY: Merge with structured filters (structured filters override shorthand)
      if (Object.keys(filters).length > 0) {
        console.log('🔧 Merging with structured filters');
        const structuredFilters = convertMCPFiltersToSearchFilters(filters);
        
        // Structured filters take precedence over shorthand
        finalFilters = {
          ...finalFilters,
          ...structuredFilters
        };
        
        console.log('🔄 Final merged filters:', JSON.stringify(finalFilters, null, 2));
      }

      // Search options
      const searchOptions: PrintingsSearchOptions = {
        limit: options.limit || 12,
        page: options.page || 1,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
        show: options.show,
        returnSimplified: options.returnSimplified
      };
      
      console.log('🔄 Search options:', JSON.stringify(searchOptions, null, 2));

      // Execute search using the service layer (PostgreSQL)
      const serviceResult = await printingsService.searchPrintings(finalFilters, searchOptions);

      if (!serviceResult.success) {
        throw new Error(serviceResult.error || 'Search failed');
      }

      const result = serviceResult.data;
      const duration = Date.now() - startTime;
      
      console.log('✅ ENHANCED SEARCH COMPLETED');
      console.log('📈 Performance metrics:', {
        totalResults: result.total,
        returnedResults: result.printings.length,
        searchDuration: duration,
        dbQueryTime: result.queryInfo.executionTime,
        responseMode: options.show || 'all',
        hadShorthandQuery: !!query,
        hadStructuredFilters: Object.keys(filters).length > 0
      });
      
      // 🎯 NEW: Format printings with human-readable output
      const formattedPrintings = result.printings.map(formatPrintingForDisplay).join('\n\n');
      
      // Create user-friendly response
      const responseMessage = result.total === 0 
        ? `✅ Search completed! Found 0 results.

                    ${parseInfo}

                    📊 Query info: ${query ? 'Shorthand query' : 'Direct search'}`
        : `✅ Search completed! Found ${result.total} result${result.total !== 1 ? 's' : ''}.

                    ${formattedPrintings}

                    📊 Query info: ${query ? 'Shorthand query' : 'Direct search'}`;
      
      return {
        content: [
          {
            type: 'text',
            text: responseMessage
          }
        ],
        // Also include raw data for programmatic access
        _metadata: {
          printings: result.printings,
          total: result.total,
          page: result.page,
          pages: result.pages,
          queryInfo: {
            ...result.queryInfo,
            parseInfo: parseInfo.trim(),
            searchType: query ? 'shorthand' : 'structured',
            originalQuery: query || null,
            finalFilters: finalFilters
          },
          searchDuration: duration
        }
      };

    } catch (error) {
      console.error('💥 Error in enhanced search_printings:', error);
      throw new Error(`Enhanced search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};
// // app/api/mcp/tool/searchPrintings.ts - ENHANCED VERSION with shorthand support
// import { FABPrintingsSearchUtility } from '@/lib/services/contracts/IPrintingsService';
// import { FABShorthandParser } from '@/lib/fab-shorthand-parser';
// import type { PrintingsSearchFilters, PrintingsSearchOptions } from '@/lib/services/contracts/IPrintingsService';

// // Create single instances to reuse
// const fabPrintingsSearch = new FABPrintingsSearchUtility();
// const shorthandParser = new FABShorthandParser();

// // Inline helper function to convert MCP filters to search filters
// function convertMCPFiltersToSearchFilters(mcpFilters: any): PrintingsSearchFilters {
//   const searchFilters: PrintingsSearchFilters = {};
  
//   // Direct mappings for all the existing fields
//   if (mcpFilters.name) searchFilters.name = mcpFilters.name;
//   if (mcpFilters.text) searchFilters.text = mcpFilters.text;
//   if (mcpFilters.searchableText) searchFilters.searchableText = mcpFilters.searchableText;
//   if (mcpFilters.exact !== undefined) searchFilters.exact = mcpFilters.exact;
  
//   // Handle printingCardId (can be string or comma-separated)
//   if (mcpFilters.printingCardId) {
//     if (typeof mcpFilters.printingCardId === 'string' && mcpFilters.printingCardId.includes(',')) {
//       searchFilters.printingCardId = mcpFilters.printingCardId.split(',').map(s => s.trim());
//     } else {
//       searchFilters.printingCardId = mcpFilters.printingCardId;
//     }
//   }
  
//   // Handle printingIds (comma-separated string to array)
//   if (mcpFilters.printingIds) {
//     if (typeof mcpFilters.printingIds === 'string') {
//       searchFilters.printingIds = mcpFilters.printingIds.split(',').map(s => s.trim());
//     } else {
//       searchFilters.printingIds = mcpFilters.printingIds;
//     }
//   }
  
//   // Basic fields
//   if (mcpFilters.sets) searchFilters.sets = mcpFilters.sets;
//   if (mcpFilters.types) searchFilters.types = mcpFilters.types;
//   if (mcpFilters.classes) searchFilters.classes = mcpFilters.classes;
//   if (mcpFilters.talents) searchFilters.talents = mcpFilters.talents;
//   if (mcpFilters.rarities) searchFilters.rarities = mcpFilters.rarities;
//   if (mcpFilters.foilings) searchFilters.foilings = mcpFilters.foilings;
//   if (mcpFilters.editions) searchFilters.editions = mcpFilters.editions;
//   if (mcpFilters.color) searchFilters.color = mcpFilters.color;
//   if (mcpFilters.traits) searchFilters.traits = mcpFilters.traits;
//   if (mcpFilters.keywords) searchFilters.keywords = mcpFilters.keywords;
//   if (mcpFilters.textKeywords) searchFilters.textKeywords = mcpFilters.textKeywords;
//   if (mcpFilters.artists) searchFilters.artists = mcpFilters.artists;
  
//   // Stats
//   if (mcpFilters.power !== undefined) searchFilters.power = mcpFilters.power;
//   if (mcpFilters.powerMin !== undefined) searchFilters.powerMin = mcpFilters.powerMin;
//   if (mcpFilters.powerMax !== undefined) searchFilters.powerMax = mcpFilters.powerMax;
//   if (mcpFilters.cost !== undefined) searchFilters.cost = mcpFilters.cost;
//   if (mcpFilters.costMin !== undefined) searchFilters.costMin = mcpFilters.costMin;
//   if (mcpFilters.costMax !== undefined) searchFilters.costMax = mcpFilters.costMax;
//   if (mcpFilters.defense !== undefined) searchFilters.defense = mcpFilters.defense;
//   if (mcpFilters.defenseMin !== undefined) searchFilters.defenseMin = mcpFilters.defenseMin;
//   if (mcpFilters.defenseMax !== undefined) searchFilters.defenseMax = mcpFilters.defenseMax;
//   if (mcpFilters.pitch !== undefined) searchFilters.pitch = mcpFilters.pitch;
  
//   // Price filters
//   if (mcpFilters.priceMin !== undefined) searchFilters.priceMin = mcpFilters.priceMin;
//   if (mcpFilters.priceMax !== undefined) searchFilters.priceMax = mcpFilters.priceMax;
//   if (mcpFilters.priceField) searchFilters.priceField = mcpFilters.priceField;
//   if (mcpFilters.cardUniqueId) searchFilters.cardUniqueId = mcpFilters.cardUniqueId;
//   if (mcpFilters.cardUniqueIds) searchFilters.cardUniqueIds = mcpFilters.cardUniqueIds;
  
//   // Hero-based filtering
//   if (mcpFilters.heroLegal) searchFilters.heroLegal = mcpFilters.heroLegal;
//   if (mcpFilters.excludeClasses) searchFilters.excludeClasses = mcpFilters.excludeClasses;
//   if (mcpFilters.excludeTalents) searchFilters.excludeTalents = mcpFilters.excludeTalents;
  
//   // Format legality
//   if (mcpFilters.format) searchFilters.format = mcpFilters.format;
//   if (mcpFilters.includeBanned !== undefined) searchFilters.includeBanned = mcpFilters.includeBanned;
//   if (mcpFilters.includeSuspended !== undefined) searchFilters.includeSuspended = mcpFilters.includeSuspended;
  
//   // Add all boolean filters
//   const booleanFields = [
//     'isAction', 'isAttack', 'isDefenseReaction', 'isInstant', 'isEquipment', 
//     'isWeapon', 'isHero', 'isMentor', 'isToken',
//     'isFirstEdition', 'isUnlimited', 'isNormalEdition',
//     'isNormalFoil', 'isRainbowFoil', 'isColdFoil',
//     'isCommon', 'isRare', 'isSuperRare', 'isMajestic', 'isLegendary', 'isFabled', 'isPromo',
//     'isBudget', 'isUnder5', 'isUnder10', 'isUnder25', 'isUnder50', 'isUnder100', 'isExpensive', 'isPremium',
//     'hasProductId',
//     // Class boolean filters
//     'isGeneric', 'isBrute', 'isGuardian', 'isMechanologist', 'isRanger', 'isRuneblade', 
//     'isAssassin', 'isWarrior', 'isNinja', 'isWizard', 'isMerchant', 'isBard', 
//     'isAdjudicator', 'isIllusionist', 'isThief', 'isShapeshifter', 'isNecromancer',
//     // Talent boolean filters
//     'hasChaos', 'hasLight', 'hasRoyal', 'hasDraconic', 'hasLightning', 'hasShadow', 
//     'hasEarth', 'hasMystic', 'hasRevered', 'hasIce', 'hasReviled', 'hasPirate', 'hasElemental',
//     // Combination filters
//     'isGenericOnly', 'hasClassAndTalent', 'hasClassOnly', 'hasTalentOnly'
//   ];
  
//   booleanFields.forEach(field => {
//     if (mcpFilters[field] !== undefined) {
//       (searchFilters as any)[field] = mcpFilters[field];
//     }
//   });

//   // Add negation filters
//   const negationFields = [
//     'colorNot', 'raritiesNot', 'setsNot', 'foilingsNot', 'editionsNot', 
//     'typesNot', 'keywordsNot', 'textNot', 'talentsNot'
//   ];
  
//   negationFields.forEach(field => {
//     if (mcpFilters[field] !== undefined) {
//       (searchFilters as any)[field] = mcpFilters[field];
//     }
//   });
  
//   return searchFilters;
// }

// export const searchPrintingsTool = {
//   name: 'search_printings',
//   description: `🔍 ENHANCED SEARCH: Natural language and shorthand query support!

// ⚡ NEW FEATURES:
// • Natural shorthand queries: "talent:light p:<25 rarity:m type:equipment"
// • Intelligent query parsing with abbreviations and operators
// • Enhanced talent/essence system support
// • Flexible negation syntax (!, -, "Not" operators)

// 🎯 QUERY FORMATS SUPPORTED:

// 1️⃣ SHORTHAND QUERIES (Recommended):
//    Use the "query" parameter for natural language searches:
//    • "rf cnc alpha wtr" → Rainbow foil Command and Conquer from Alpha WTR
//    • "talent:light,ice type:equipment p:>50" → Light/Ice elemental equipment over $50
//    • "hero:gravy p:<100 rarity:!c" → Gravy-legal cards under $100, exclude commons
//    • "set:wtr,arc talent:!shadow foil:rf" → WTR/ARC sets, exclude shadow, rainbow foil

// 2️⃣ STRUCTURED FILTERS (Advanced):
//    Use individual filter parameters for programmatic searches

// 📚 SHORTHAND SYNTAX GUIDE:
// • Price: p:<10, p:>50, p:25 
// • Types: type:equipment, t:!generic, type:necromancer,!weapon
// • Talents: talent:light, tal:i,e, talent:!shadow
// • Rarities: r:m,l, rarity:!c, r!f
// • Sets: set:wtr,arc, set:!out
// • Foiling: foil:rf,cf, f:!s
// • Heroes: hero:gravy, hero:oldhim
// • Colors: color:red, color:!blue
// • Stats: power>3, cost:2, defense<4

// 🚨 REQUIREMENTS: Complete setup first!
// 1️⃣ read_mandatory_constants_first({"uri": "fab://constants"})
// 2️⃣ read_mandatory_constants_first({"uri": "searchable://card/fields"})

// 💡 The shorthand parser automatically handles abbreviations, operators, and converts natural queries into optimized database searches.

// ⭐ Use shorthand for human-readable queries, structured filters for programmatic access.`,
  
//   parameters: {
//     type: 'object',
//     properties: {
//       // NEW: Primary shorthand query parameter
//       query: {
//         type: 'string',
//         description: `Natural language shorthand query string. Examples:
//         • "talent:light p:<25 rarity:m type:equipment"
//         • "rf cnc alpha wtr" 
//         • "hero:gravy p:<100 rarity:!c"
//         • "set:wtr,arc talent:!shadow foil:rf"
//         • "blue wizard instant under $10"
        
//         Supports all shorthand syntax from FABShorthandParser including:
//         - Price operators: p:<10, p:>50, p:25
//         - Type filters: type:equipment, t:!generic  
//         - Talent filters: talent:light, tal:i,e
//         - Negation: !, -, "not" keywords
//         - Abbreviations: rf=rainbow foil, cnc=command and conquer, etc.`
//       },
      
//       // EXISTING: All structured filter parameters (unchanged for backward compatibility)
//       filters: {
//         type: 'object',
//         properties: {
//           // Text searches
//           name: { type: 'string', description: 'Card name' },
//           text: { type: 'string', description: 'Search in card text' },
//           searchableText: { type: 'string', description: 'Search across all text fields' },
//           exact: { type: 'boolean', description: 'Exact name match' },
          
//           // Card identification
//           printingCardId: { type: 'string', description: 'Traditional printing ID (e.g. WTR216, ARC000) or comma-separated list' },
//           printingIds: { type: 'string', description: 'MongoDB-style printing IDs or comma-separated list' },
//           cardUniqueId: { type: 'string', description: 'Unique card identifier' },
//           cardUniqueIds: { type: 'string', description: 'Comma-separated list of unique card identifiers' },
          
//           // Card attributes
//           types: { 
//             type: 'array', 
//             items: { type: 'string' },
//             description: 'Card types including classes'
//           },
//           classes: {
//             type: 'array',
//             items: { type: 'string' },
//             description: 'Specific classes (guardian, necromancer, etc.)'
//           },
//           talents: {
//             type: 'array',
//             items: { type: 'string' },
//             description: 'Talents/essences (light, ice, earth, lightning, pirate, etc.)'
//           },
//           traits: {
//             type: 'array',
//             items: { type: 'string' },
//             description: 'Card traits'
//           },
//           keywords: { 
//             type: 'array', 
//             items: { type: 'string' },
//             description: 'Card keywords (go again, dominate, etc.)'
//           },
//           textKeywords: {
//             type: 'array',
//             items: { type: 'string' },
//             description: 'Keywords that appear in card text'
//           },
//           color: { 
//             type: 'string', 
//             enum: ['blue', 'red', 'yellow'],
//             description: 'Card color'
//           },
          
//           // Stats
//           power: { type: ['number', 'array'], description: 'Exact power value(s)' },
//           powerMin: { type: 'number', description: 'Minimum power' },
//           powerMax: { type: 'number', description: 'Maximum power' },
//           cost: { type: ['number', 'array'], description: 'Exact cost value(s)' },
//           costMin: { type: 'number', description: 'Minimum cost' },
//           costMax: { type: 'number', description: 'Maximum cost' },
//           defense: { type: ['number', 'array'], description: 'Exact defense value(s)' },
//           defenseMin: { type: 'number', description: 'Minimum defense' },
//           defenseMax: { type: 'number', description: 'Maximum defense' },
//           pitch: { type: ['number', 'array'], description: 'Pitch value(s)' },
          
//           // Printing attributes
//           sets: { type: 'array', items: { type: 'string' }, description: 'Set codes' },
//           editions: { type: 'array', items: { type: 'string' }, description: 'Edition types' },
//           foilings: { type: 'array', items: { type: 'string' }, description: 'Foiling types' },
//           rarities: { type: 'array', items: { type: 'string' }, description: 'Rarity codes' },
//           artists: { type: 'array', items: { type: 'string' }, description: 'Artist names' },
          
//           // Price filters
//           priceMin: { type: 'number', description: 'Minimum price in USD' },
//           priceMax: { type: 'number', description: 'Maximum price in USD' },
//           priceField: {
//             type: 'string',
//             enum: ['tcg_low', 'tcg_mid', 'tcg_high', 'tcg_market'],
//             description: 'Price field to use for filtering'
//           },
          
//           // Hero-based filtering
//           heroLegal: { type: 'string', description: 'Hero name for legal filtering' },
//           excludeClasses: { type: 'array', items: { type: 'string' }, description: 'Classes to exclude' },
//           excludeTalents: { type: 'array', items: { type: 'string' }, description: 'Talents to exclude' },
          
//           // Format legality
//           format: { 
//             type: 'string', 
//             enum: ['blitz', 'cc', 'commoner', 'll'],
//             description: 'Format legality'
//           },
//           includeBanned: { type: 'boolean', description: 'Include banned cards' },
//           includeSuspended: { type: 'boolean', description: 'Include suspended cards' },
          
//           // Negation filters
//           colorNot: { type: 'array', items: { type: 'string' }, description: 'Colors to exclude' },
//           raritiesNot: { type: 'array', items: { type: 'string' }, description: 'Rarities to exclude' },
//           setsNot: { type: 'array', items: { type: 'string' }, description: 'Sets to exclude' },
//           foilingsNot: { type: 'array', items: { type: 'string' }, description: 'Foilings to exclude' },
//           editionsNot: { type: 'array', items: { type: 'string' }, description: 'Editions to exclude' },
//           typesNot: { type: 'array', items: { type: 'string' }, description: 'Types to exclude' },
//           keywordsNot: { type: 'array', items: { type: 'string' }, description: 'Keywords to exclude' },
//           textNot: { type: 'string', description: 'Text to exclude' },
//           talentsNot: { type: 'array', items: { type: 'string' }, description: 'Talents to exclude' },
          
//           // Boolean convenience filters (extensive list maintained for backward compatibility)
//           isAction: { type: 'boolean' },
//           isAttack: { type: 'boolean' },
//           isDefenseReaction: { type: 'boolean' },
//           isInstant: { type: 'boolean' },
//           isEquipment: { type: 'boolean' },
//           isWeapon: { type: 'boolean' },
//           isHero: { type: 'boolean' },
//           isMentor: { type: 'boolean' },
//           isToken: { type: 'boolean' },
          
//           // Boolean class filters
//           isGeneric: { type: 'boolean' },
//           isBrute: { type: 'boolean' },
//           isGuardian: { type: 'boolean' },
//           isMechanologist: { type: 'boolean' },
//           isRanger: { type: 'boolean' },
//           isRuneblade: { type: 'boolean' },
//           isAssassin: { type: 'boolean' },
//           isWarrior: { type: 'boolean' },
//           isNinja: { type: 'boolean' },
//           isWizard: { type: 'boolean' },
//           isMerchant: { type: 'boolean' },
//           isBard: { type: 'boolean' },
//           isAdjudicator: { type: 'boolean' },
//           isIllusionist: { type: 'boolean' },
//           isThief: { type: 'boolean' },
//           isShapeshifter: { type: 'boolean' },
//           isNecromancer: { type: 'boolean' },
          
//           // Boolean talent filters
//           hasChaos: { type: 'boolean' },
//           hasLight: { type: 'boolean' },
//           hasRoyal: { type: 'boolean' },
//           hasDraconic: { type: 'boolean' },
//           hasLightning: { type: 'boolean' },
//           hasShadow: { type: 'boolean' },
//           hasEarth: { type: 'boolean' },
//           hasMystic: { type: 'boolean' },
//           hasRevered: { type: 'boolean' },
//           hasIce: { type: 'boolean' },
//           hasReviled: { type: 'boolean' },
//           hasPirate: { type: 'boolean' },
//           hasElemental: { type: 'boolean' },
          
//           // Boolean combination filters
//           isGenericOnly: { type: 'boolean' },
//           hasClassAndTalent: { type: 'boolean' },
//           hasClassOnly: { type: 'boolean' },
//           hasTalentOnly: { type: 'boolean' },
          
//           // Boolean edition filters
//           isFirstEdition: { type: 'boolean' },
//           isUnlimited: { type: 'boolean' },
//           isNormalEdition: { type: 'boolean' },
          
//           // Boolean foiling filters
//           isNormalFoil: { type: 'boolean' },
//           isRainbowFoil: { type: 'boolean' },
//           isColdFoil: { type: 'boolean' },
          
//           // Boolean rarity filters
//           isCommon: { type: 'boolean' },
//           isRare: { type: 'boolean' },
//           isSuperRare: { type: 'boolean' },
//           isMajestic: { type: 'boolean' },
//           isLegendary: { type: 'boolean' },
//           isFabled: { type: 'boolean' },
//           isPromo: { type: 'boolean' },
          
//           // Boolean price filters
//           isBudget: { type: 'boolean' },
//           isUnder5: { type: 'boolean' },
//           isUnder10: { type: 'boolean' },
//           isUnder25: { type: 'boolean' },
//           isUnder50: { type: 'boolean' },
//           isUnder100: { type: 'boolean' },
//           isExpensive: { type: 'boolean' },
//           isPremium: { type: 'boolean' },
          
//           // Data availability filters
//           hasProductId: { type: 'boolean' }
//         }
//       },
      
//       options: {
//         type: 'object',
//         properties: {
//           limit: { 
//             type: 'number', 
//             default: 12, 
//             minimum: 1,
//             maximum: 100,
//             description: 'Number of results to return (1-100)' 
//           },
//           page: { 
//             type: 'number', 
//             default: 1, 
//             minimum: 1,
//             description: 'Page number for pagination' 
//           },
//           sortBy: {
//             type: 'string',
//             enum: ['name', 'price', 'power', 'cost', 'defense', 'set', 'rarity', 'printing_card_id', 'relevance'],
//             description: 'Field to sort results by'
//           },
//           sortOrder: {
//             type: 'string',
//             enum: ['asc', 'desc'],
//             description: 'Sort order: ascending or descending'
//           },
//           show: {
//             type: 'string',
//             enum: ['all', 'summary', 'gameplay', 'identifiers'],
//             default: 'summary',
//             description: 'Response mode: summary (highly optimized for MCP client), all (full data), gameplay (deck building), identifiers (IDs only)'
//           },
//           returnSimplified: { 
//             type: 'boolean',
//             description: 'Return simplified response format for compatibility'
//           }
//         }
//       }
//     },
//     required: []
//   },

//   handler: async ({ query, filters = {}, options = {} }) => {
//     console.log('🔍 ENHANCED SEARCH PRINTINGS TOOL EXECUTION START');
//     console.log('📥 Raw query string:', query);
//     console.log('📥 Structured filters:', JSON.stringify(filters, null, 2));
//     console.log('📥 Options:', JSON.stringify(options, null, 2));

//     try {
//       const startTime = Date.now();
//       let finalFilters: PrintingsSearchFilters = {};
//       let parseInfo = '';

//       // PRIMARY: Handle shorthand query if provided
//       if (query && query.trim()) {
//         console.log('🎯 Processing shorthand query:', query);
        
//         try {
//           const parseResult = shorthandParser.parseQuery(query.trim());
//           finalFilters = parseResult.filters;
          
//           parseInfo = `
// 🎯 Shorthand Query Parsed: "${query}"
// 📝 Extracted Filters: ${JSON.stringify(parseResult.parsedTokens, null, 2)}
// ${parseResult.remainingText ? `📋 Remaining Text: "${parseResult.remainingText}"` : ''}
// `;

//           console.log('✅ Shorthand parsing successful:', parseResult);
//         } catch (parseError) {
//           console.warn('⚠️ Shorthand parsing failed, falling back to name search:', parseError);
//           // Fallback: treat query as name search
//           finalFilters = { name: query.trim() };
//           parseInfo = `
// ⚠️ Shorthand parsing failed, using as name search: "${query}"
// `;
//         }
//       }

//       // SECONDARY: Merge with structured filters (structured filters override shorthand)
//       if (Object.keys(filters).length > 0) {
//         console.log('🔧 Merging with structured filters');
//         const structuredFilters = convertMCPFiltersToSearchFilters(filters);
        
//         // Structured filters take precedence over shorthand
//         finalFilters = {
//           ...finalFilters,
//           ...structuredFilters
//         };
        
//         console.log('🔄 Final merged filters:', JSON.stringify(finalFilters, null, 2));
//       }

//       // Search options
//       const searchOptions: PrintingsSearchOptions = {
//         limit: options.limit || 12,
//         page: options.page || 1,
//         sortBy: options.sortBy,
//         sortOrder: options.sortOrder,
//         show: options.show,
//         returnSimplified: options.returnSimplified
//       };
      
//       console.log('🔄 Search options:', JSON.stringify(searchOptions, null, 2));
      
//       // Execute search using the enhanced search utility
//       const result = await fabPrintingsSearch.searchPrintings(finalFilters, searchOptions);
//       const duration = Date.now() - startTime;
      
//       console.log('✅ ENHANCED SEARCH COMPLETED');
//       console.log('📈 Performance metrics:', {
//         totalResults: result.total,
//         returnedResults: result.printings.length,
//         searchDuration: duration,
//         dbQueryTime: result.queryInfo.executionTime,
//         responseMode: options.show || 'all',
//         hadShorthandQuery: !!query,
//         hadStructuredFilters: Object.keys(filters).length > 0
//       });
      
//       return {
//         printings: result.printings,
//         total: result.total,
//         page: result.page,
//         pages: result.pages,
//         queryInfo: {
//           ...result.queryInfo,
//           parseInfo: parseInfo.trim(),
//           searchType: query ? 'shorthand' : 'structured',
//           originalQuery: query || null,
//           finalFilters: finalFilters
//         },
//         searchDuration: duration
//       };

//     } catch (error) {
//       console.error('💥 Error in enhanced search_printings:', error);
//       throw new Error(`Enhanced search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }
// };