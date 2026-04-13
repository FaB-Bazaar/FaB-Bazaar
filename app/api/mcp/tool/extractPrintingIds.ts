// app/api/mcp/tool/extractPrintingIds.ts - UPDATED WITH MCP_RESPONSE SUPPORT
import { FABPrintingsSearchUtility } from '@/lib/fab-printings-search';
import type { PrintingsSearchFilters, PrintingsSearchOptions } from '@/lib/services/contracts/IPrintingsService';

// Create a single instance to reuse
const fabPrintingsSearch = new FABPrintingsSearchUtility();

// EMBEDDED MAPPINGS - All mappings directly in the tool for reliability
const FOILING_MAPPINGS = {
  'r': 'Rainbow Foil',
  'rf': 'Rainbow Foil', 
  'rainbow': 'Rainbow Foil', 
  'rainbow foil': 'Rainbow Foil',
  'c': 'Cold Foil',
  'cf': 'Cold Foil', 
  'cold': 'Cold Foil', 
  'cold foil': 'Cold Foil',
  's': 'Non-foil',
  'nf': 'Non-foil', 
  'n': 'Non-foil', 
  'standard': 'Non-foil', 
  'non-foil': 'Non-foil', 
  'nonfoil': 'Non-foil',
  'g': 'Gold Foil',
  'gf': 'Gold Foil',
  'gold': 'Gold Foil',
  'gold foil': 'Gold Foil'
} as const;

const EDITION_MAPPINGS = {
  'a': 'Alpha',
  'alpha': 'Alpha',
  'f': 'First Edition',
  'first': 'First Edition', 
  '1st': 'First Edition', 
  'first edition': 'First Edition',
  'u': 'Unlimited',
  'unl': 'Unlimited', 
  'unlimited': 'Unlimited', 
  'unlimited edition': 'Unlimited',
  'n': 'Normal',
  'normal': 'Normal', 
  'promo': 'Normal'
} as const;

const RARITY_MAPPINGS = {
  'c': 'Common',
  'common': 'Common',
  'r': 'Rare',
  'rare': 'Rare',
  's': 'Super Rare',
  'super rare': 'Super Rare', 
  'super': 'Super Rare',
  'm': 'Majestic',
  'majestic': 'Majestic', 
  'maj': 'Majestic',
  'l': 'Legendary',
  'legendary': 'Legendary', 
  'leg': 'Legendary',
  'f': 'Fabled',
  'fabled': 'Fabled', 
  'fab': 'Fabled',
  't': 'Token',
  'token': 'Token',
  'b': 'Basic',
  'basic': 'Basic',
  'v': 'Marvel',
  'marvel': 'Marvel',
  'p': 'Promo',
  'promo': 'Promo'
} as const;

const SET_MAPPINGS = {
  // Core sets
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
  'sea': 'High Seas',
  'sup': 'Super Slam',

  // History/Classic Packs
  '1hp': 'History Pack Vol.1',
  'dvr': 'Classic Battles: Rhinar vs Dorinthea',
  'aur': '1st Strike',

  // Promo sets
  'fab': 'Flesh and Blood: Promo Cards',
  'gem': 'GEM Pack 2',
  'tcc': 'Round the Table: TCCxLSS',

  // Welcome/Hero Decks
  'ira': 'Welcome Deck: Ira',
  'bvo': 'Hero Deck: Bravo',
  'rnr': 'Hero Deck: Rhinar',
  'ksu': 'Hero Deck: Katsu',
  'tea': 'Hero Deck: Dorinthea',

  // Blitz Decks - Monarch
  'psm': 'Blitz Deck: Monarch - Prism',
  'bol': 'Blitz Deck: Monarch - Boltyn',
  'chn': 'Blitz Deck: Monarch - Chane',
  'lev': 'Blitz Deck: Monarch - Levia',

  // Blitz Decks - Tales of Aria
  'lxi': 'Blitz Deck: Tales of Aria - Lexi',
  'old': 'Blitz Deck: Tales of Aria - Oldhim',
  'bri': 'Blitz Deck: Tales of Aria - Briar',

  // Blitz Decks - Uprising
  'fai': 'Blitz Deck: Uprising - Fai',
  'dro': 'Blitz Deck: Uprising - Dromai',

  // Blitz Decks - Outsiders
  'ara': 'Blitz Deck: Outsiders - Arakni',
  'azl': 'Blitz Deck: Outsiders - Azalea',
  'ben': 'Blitz Deck: Outsiders - Benji',
  'kat': 'Blitz Deck: Outsiders - Katsu',
  'rip': 'Blitz Deck: Outsiders - Riptide',
  'uzu': 'Blitz Deck: Outsiders - Uzuri',

  // Blitz Decks - Heavy Hitters
  'ksi': 'Blitz Deck: Heavy Hitters - Kassai',
  'kyo': 'Blitz Deck: Heavy Hitters - Kayo',
  'rhi': 'Blitz Deck: Heavy Hitters - Rhinar',
  'bet': 'Blitz Deck: Heavy Hitters - Betsy',
  'ola': 'Blitz Deck: Heavy Hitters - Olympia',
  'vic': 'Blitz Deck: Heavy Hitters - Victor',

  // Blitz Decks - Part the Mistveil
  'eng': 'Blitz Deck: Part the Mistveil - Enigma',
  'nuu': 'Blitz Deck: Part the Mistveil - Nuu',
  'zen': 'Blitz Deck: Part the Mistveil - Zen',

  // Blitz Decks - Rosetta
  'flr': 'Blitz Deck: Rosetta - Florian',
  'aua': 'Blitz Deck: Rosetta - Aurora',
  'osc': 'Blitz Deck: Rosetta - Oscilio',
  'ver': 'Blitz Deck: Rosetta - Verdance',

  // Blitz Decks - The Hunted
  'ark': 'Blitz Deck: The Hunted - Arakni',
  'fng': 'Blitz Deck: The Hunted - Fang',
  'wod': 'Blitz Deck: The Hunted - Arakni, Web of Deceit',
  'cin': 'Blitz Deck: The Hunted - Cindra',

  // Historic Pack Blitz Decks
  '1hb': 'Historic Pack 1 Blitz Deck: Bravo',
  '1hd': 'Historic Pack 1 Blitz Deck: Dash',
  '1ht': 'Historic Pack 1 Blitz Deck: Dorinthea',
  '1hk': 'Historic Pack 1 Blitz Deck: Kano',
  '1hr': 'Historic Pack 1 Blitz Deck: Rhinar',
  '1hv': 'Historic Pack 1 Blitz Deck: Viserai',

  // Armory Decks
  'ako': 'Armory Deck: Kayo',
  'asb': 'Armory Deck: Boltyn',
  'aaz': 'Armory Deck: Azalea',
  'aio': 'Armory Deck: Dash',
  'ajv': 'Armory Deck: Jarl Vetreidi',
  'ast': 'Armory Deck: Aurora',
  'amx': 'Armory Deck: Maxx Nitro',
  'agb': 'Armory Deck: Gravy Bones',
  'asr': 'Armory Deck: Ira',
  'aps': 'Armory Deck: Pleiades',

  // Mastery Pack
  'mpg': 'Mastery Pack Guardian'
} as const;

// SIMPLE: Helper function to format printing details using embedded mappings
function formatPrintingDetails(printing: any): string {
  try {
    const set = printing.set || '';
    const edition = printing.edition || '';
    const foiling = printing.foiling || '';
    const rarity = printing.rarity || '';

    // Build human-readable parts
    const parts = [];

    // Set name (e.g., "1hp" -> "History Pack Vol.1")
    if (set && SET_MAPPINGS[set]) {
      parts.push(SET_MAPPINGS[set]);
    } else if (set) {
      parts.push(set.toUpperCase()); // Fallback to uppercase
    }

    // Edition (e.g., "n" -> "Normal edition")
    if (edition && EDITION_MAPPINGS[edition]) {
      parts.push(`${EDITION_MAPPINGS[edition]} edition`);
    }

    // Foiling (e.g., "s" -> "Non-foil")
    if (foiling && FOILING_MAPPINGS[foiling]) {
      parts.push(FOILING_MAPPINGS[foiling]);
    }

    // Rarity (e.g., "m" -> "Majestic")
    if (rarity && RARITY_MAPPINGS[rarity]) {
      parts.push(RARITY_MAPPINGS[rarity]);
    }

    return parts.length > 0 ? parts.join(', ') : `${set}-${edition}-${foiling} [${rarity}]`;

  } catch (error) {
    console.error('Error formatting printing details:', error);
    // Fallback to original format if mapping fails
    const set = printing.set || '';
    const edition = printing.edition || '';
    const foiling = printing.foiling || '';
    const rarity = printing.rarity || '';
    return `${set}-${edition}-${foiling} [${rarity}]`;
  }
}

// Inline helper function - quick fix to avoid import issues
function convertMCPFiltersToSearchFilters(mcpFilters: any): PrintingsSearchFilters {
  const searchFilters: PrintingsSearchFilters = {};
  
  // Direct mappings
  if (mcpFilters.name) searchFilters.name = mcpFilters.name;
  if (mcpFilters.text) searchFilters.text = mcpFilters.text;
  if (mcpFilters.searchableText) searchFilters.searchableText = mcpFilters.searchableText;
  if (mcpFilters.exact !== undefined) searchFilters.exact = mcpFilters.exact;
  
  // Handle collectorNumber (can be string or comma-separated)
  if (mcpFilters.collectorNumber) {
    if (typeof mcpFilters.collectorNumber === 'string' && mcpFilters.collectorNumber.includes(',')) {
      searchFilters.collectorNumber = mcpFilters.collectorNumber.split(',').map(s => s.trim());
    } else {
      searchFilters.collectorNumber = mcpFilters.collectorNumber;
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
  
  // Basic fields that are commonly used
  if (mcpFilters.sets) searchFilters.sets = mcpFilters.sets;
  if (mcpFilters.types) searchFilters.types = mcpFilters.types;
  if (mcpFilters.rarities) searchFilters.rarities = mcpFilters.rarities;
  if (mcpFilters.foilings) searchFilters.foilings = mcpFilters.foilings;
  if (mcpFilters.editions) searchFilters.editions = mcpFilters.editions;
  
  return searchFilters;
}

export const extractPrintingIdsTool = {
  name: 'extract_printing_ids',
  description: `STEP 2 OF 2 — Run search_printings FIRST. This tool is for selecting a specific printing version after the user has already seen search results and confirmed which card they want.

DO NOT use this tool to discover cards or search by name. Use search_printings for that.

Correct workflow:
1. search_printings (find the card, show options to user)
2. User confirms which version they want
3. extract_printing_ids (get the printingId for that specific version)
4. add_to_binder or add_to_wants (commit)

Present results to users as card name, set, edition, foiling, and price — never show raw printing ID strings to end users.`,
  parameters: {
    type: 'object',
    properties: {
      // REQUIRED: Setup confirmation parameter
      _resourcesConfirmed: {
        type: 'boolean',
        description: 'REQUIRED: Must be set to true after reading both fab://constants and searchable://card/fields resources via read_mandatory_constants_first tool. This confirms you have loaded the necessary abbreviations and search capabilities.',
        default: false
      },
      filters: {
        type: 'object',
        description: 'Narrow filters to match the specific card version the user confirmed from search_printings results (e.g. name + set + edition + foiling). Do not use broad filters here — this should already be narrowed down.'
      },
      options: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 100, maximum: 500 },
          idType: {
            type: 'string',
            enum: ['all', 'card_id', 'printing_id', 'selection_interface'],
            default: 'all',
            description: 'Type of IDs to extract: all, card_id (WTR216), printing_id (MongoDB), or selection_interface (numbered list for user selection)'
          },
          includeDetails: {
            type: 'boolean',
            default: false,
            description: 'Include detailed card information (set, edition, foiling, rarity, price) for selection interface'
          },
          show: {
            type: 'string',
            enum: ['all', 'summary', 'gameplay', 'identifiers', 'mcp_response'],
            default: 'mcp_response',
            description: 'Response mode for underlying search - mcp_response recommended for ID extraction'
          }
        }
      }
    },
    required: ['_resourcesConfirmed']
  },

  handler: async ({ filters = {}, options = {} }) => {
    console.log('🆔 EXTRACTING PRINTING IDS - ENHANCED INTERFACE WITH EMBEDDED MAPPINGS');
    
    // ⭐ NEW: Use mcp_response by default for better performance and essential fields only
    const searchOptions: PrintingsSearchOptions = { 
      ...options, 
      limit: options.limit || 100,
      show: options.show || 'mcp_response'  // ✅ Default to mcp_response for ID extraction
    };
    
    const searchFilters = convertMCPFiltersToSearchFilters(filters);
    const result = await fabPrintingsSearch.searchPrintings(searchFilters, searchOptions);
    
    if (!result.printings?.length) {
      return {
        printing_ids_csv: '',
        card_ids: [],
        printing_ids: [],
        total: 0,
        message: 'No printings found matching criteria'
      };
    }
    
    const cardIds = [];
    const printingIds = [];
    const selectionList = [];
    
    // ENHANCED: Process each printing with embedded mappings formatting
    for (let index = 0; index < result.printings.length; index++) {
      const printing = result.printings[index];
      const cardId = printing.collector_number;
      const printingId = printing.printing_id || printing._id;
      
      if (cardId) cardIds.push(cardId);
      if (printingId) printingIds.push(printingId);
      
      // Build selection interface entry with enhanced formatting
      if (options.idType === 'selection_interface' || options.includeDetails) {
        const name = printing.name || printing.display_name || 'Unknown';
        const price = printing.tcg_market || printing.tcg_mid || printing.tcg_low || 'No price';
        
        // NEW: Use embedded mappings for human-readable details
        const formattedDetails = formatPrintingDetails(printing);
        
        // FALLBACK: Keep original format as backup
        const originalDetails = (() => {
          const set = printing.set || '';
          const edition = printing.edition || '';
          const foiling = printing.foiling || '';
          const rarity = printing.rarity || '';
          let details = set;
          if (edition) details += `-${edition}`;
          if (foiling) details += `-${foiling}`;
          if (rarity) details += ` [${rarity}]`;
          return details;
        })();
        
        const letter = String.fromCharCode(97 + index); // a, b, c, d, etc.
        selectionList.push({
          letter: letter,
          name: name,
          details: formattedDetails, // NEW: Human-readable format
          originalDetails: originalDetails, // Keep original for compatibility
          price: price,
          printingId: printingId,
          cardId: cardId
        });
      }
    }
    
    // Create comma-separated string of printing IDs
    const printingIdsCsv = printingIds.join(',');
    
    let response = {
      printing_ids_csv: printingIdsCsv,
      total: result.total,
      returned: result.printings.length
    };
    
    switch (options.idType) {
      case 'card_id':
        response.ids = cardIds;
        response.message = `Extracted ${cardIds.length} card IDs (e.g., WTR216)\nCSV: ${cardIds.join(',')}`;
        break;
        
      case 'printing_id':
        response.ids = printingIds;
        response.message = `Extracted ${printingIds.length} printing IDs (MongoDB-style)\nCSV: ${printingIdsCsv}`;
        break;
        
      case 'selection_interface':
        response.selectionList = selectionList;
        response.printing_ids = printingIds;
        response.card_ids = cardIds;
        
        // ENHANCED: Build user-friendly selection interface with beautiful formatting
        let selectionText = `Found ${result.total} total printings for "${filters.name || 'your search'}" (showing ${selectionList.length}):\n\n`;
        selectionText += `📋 SELECTION INTERFACE FOR BINDER MANAGEMENT:\n\n`;
        
        selectionList.forEach(item => {
          // NEW: Display the beautiful formatted details instead of cryptic codes
          selectionText += `${item.letter}. ${item.name} (${item.cardId}) - ${item.details} - ${item.price}\n`;
        });
        
        selectionText += `\n🎯 TO ADD TO BINDER:\n`;
        selectionText += `Format options:\n`;
        selectionText += `• Letter codes: "2a,1b,3d" = 2x item a, 1x item b, 3x item d\n`;
        selectionText += `• Natural language: "3 of all non foil printings" or "1 cheapest alpha"\n`;
        selectionText += `• Voice examples: "2 cold foil", "first edition only", "3 commons"\n`;
        selectionText += `Or use "all" for one of everything\n\n`;
        selectionText += `📝 ALL PRINTING IDS (CSV): ${printingIdsCsv}\n\n`;
        selectionText += `💡 Use the format above to tell me which printings and quantities to add to your binder!\n`;
        selectionText += `Example: "2a,1c,3f" = 2 copies of (a), 1 copy of (c), 3 copies of (f)\n\n`;
        
        // Add traditional card IDs and MongoDB printing IDs for reference
        selectionText += `Traditional Card IDs (${cardIds.length}):\n${cardIds.join('\n')}\n\n`;
        selectionText += `MongoDB Printing IDs (${printingIds.length}):\n${printingIds.join('\n')}\n\n`;
        selectionText += `Data provided by FabBazaar.com`;
        
        response.message = selectionText;
        break;
        
      default:
        response.card_ids = cardIds;
        response.printing_ids = printingIds;
        response.selection_list = selectionList;
        response.message = `Extracted ${cardIds.length} card IDs and ${printingIds.length} printing IDs\nCSV: ${printingIdsCsv}`;
    }
    
    return response;
  }
};

// ENHANCED: Helper function to convert user selection to printing IDs with quantities
// Now works with the enhanced selection list that has formatted details
export function parseUserSelection(selectionList, userInput) {
  const selections = [];
  
  if (userInput.toLowerCase() === 'all') {
    return selectionList.map(item => ({
      printingId: item.printingId,
      quantity: 1,
      name: item.name,
      details: item.details, // Now uses the beautiful formatted details
      originalDetails: item.originalDetails // Keep original for compatibility
    }));
  }
  
  // Try natural language parsing first
  const naturalLanguageResult = parseNaturalLanguage(selectionList, userInput);
  if (naturalLanguageResult.length > 0) {
    return naturalLanguageResult;
  }
  
  // Fall back to standard format parsing "2a,1b,3d"
  const parts = userInput.split(',').map(s => s.trim());
  
  for (const part of parts) {
    // Match pattern: optional number followed by letter
    const match = part.match(/^(\d*)([a-z])$/i);
    if (match) {
      const quantity = match[1] ? parseInt(match[1]) : 1;
      const letter = match[2].toLowerCase();
      
      // Find the item with this letter
      const item = selectionList.find(item => item.letter === letter);
      if (item) {
        selections.push({
          printingId: item.printingId,
          quantity: quantity,
          name: item.name,
          details: item.details, // Beautiful formatted details
          originalDetails: item.originalDetails, // Keep original for compatibility
          letter: letter
        });
      }
    }
  }
  
  return selections;
}

// ENHANCED: Natural language parser now works with formatted details
// Updated to work with both formatted and original details for better matching
function parseNaturalLanguage(selectionList, userInput) {
  const input = userInput.toLowerCase();
  const selections = [];
  
  // Extract quantity (default to 1)
  let quantity = 1;
  const quantityMatch = input.match(/(\d+)\s*(?:of|x|copies?|times?)?/);
  if (quantityMatch) {
    quantity = parseInt(quantityMatch[1]);
  }
  
  // Filter conditions - updated to work with both formatted and original details
  const conditions = {
    nonFoil: /non[\s-]?foil|standard|normal(?!\s+foil)/,
    foil: /foil(?!\s*(?:non|standard|normal))/,
    coldFoil: /cold[\s-]?foil/,
    rainbowFoil: /rainbow[\s-]?foil/,
    alpha: /alpha/,
    firstEdition: /first[\s-]?edition|1st[\s-]?edition/,
    unlimited: /unlimited/,
    normal: /normal[\s-]?edition/,
    common: /common/,
    rare: /rare(?!\s*foil)/,
    legendary: /legendary/,
    majestic: /majestic/,
    cheapest: /cheapest|lowest[\s-]?price|budget/,
    mostExpensive: /most[\s-]?expensive|highest[\s-]?price|premium/,
    wtr: /welcome[\s-]?to[\s-]?rathe|wtr/,
    historyPack: /history[\s-]?pack|1hp/,
    specific: /first|last|\d+(?:st|nd|rd|th)/
  };
  
  // Apply filters based on natural language
  let filteredItems = [...selectionList];
  
  // Enhanced filtering that works with both formatted and original details
  
  // Foiling filters - check both formatted and original details
  if (conditions.nonFoil.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('non-foil') || 
      item.details.toLowerCase().includes('standard') ||
      (!item.originalDetails.includes('-c') && !item.originalDetails.includes('-r') && !item.originalDetails.includes('-g'))
    );
  } else if (conditions.coldFoil.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('cold foil') ||
      item.originalDetails.includes('-c')
    );
  } else if (conditions.rainbowFoil.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('rainbow foil') ||
      item.originalDetails.includes('-r')
    );
  } else if (conditions.foil.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('foil') ||
      item.originalDetails.includes('-c') || item.originalDetails.includes('-r') || item.originalDetails.includes('-g')
    );
  }
  
  // Edition filters - check both formatted and original details
  if (conditions.alpha.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('alpha') ||
      item.originalDetails.includes('-a')
    );
  } else if (conditions.firstEdition.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('first edition') ||
      item.originalDetails.includes('-f')
    );
  } else if (conditions.unlimited.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('unlimited') ||
      item.originalDetails.includes('-u')
    );
  } else if (conditions.normal.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('normal edition') ||
      item.originalDetails.includes('-n')
    );
  }
  
  // Rarity filters - check both formatted and original details
  if (conditions.common.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('common') ||
      item.originalDetails.includes('[c]')
    );
  } else if (conditions.rare.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('rare') ||
      item.originalDetails.includes('[r]')
    );
  } else if (conditions.legendary.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('legendary') ||
      item.originalDetails.includes('[l]')
    );
  } else if (conditions.majestic.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('majestic') ||
      item.originalDetails.includes('[m]')
    );
  }
  
  // Set filters - check both formatted and original details
  if (conditions.wtr.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('welcome to rathe') ||
      item.originalDetails.startsWith('wtr')
    );
  } else if (conditions.historyPack.test(input)) {
    filteredItems = filteredItems.filter(item => 
      item.details.toLowerCase().includes('history pack') ||
      item.originalDetails.startsWith('1hp')
    );
  }
  
  // Price filters
  if (conditions.cheapest.test(input)) {
    filteredItems.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    filteredItems = [filteredItems[0]].filter(Boolean);
  } else if (conditions.mostExpensive.test(input)) {
    filteredItems.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    filteredItems = [filteredItems[0]].filter(Boolean);
  }
  
  // Position filters (first, last, specific position)
  if (input.includes('first')) {
    filteredItems = [filteredItems[0]].filter(Boolean);
  } else if (input.includes('last')) {
    filteredItems = [filteredItems[filteredItems.length - 1]].filter(Boolean);
  }
  
  // Convert filtered items to selections
  for (const item of filteredItems) {
    selections.push({
      printingId: item.printingId,
      quantity: quantity,
      name: item.name,
      details: item.details, // Use formatted details
      originalDetails: item.originalDetails, // Keep original for compatibility
      letter: item.letter
    });
  }
  
  return selections;
}

// Helper to get just the printing IDs (for CSV)
export function getSelectionPrintingIds(selections) {
  const printingIds = [];
  for (const selection of selections) {
    for (let i = 0; i < selection.quantity; i++) {
      printingIds.push(selection.printingId);
    }
  }
  return printingIds;
}
// // app/api/mcp/tool/extractPrintingIds.ts - SELF-CONTAINED WITH EMBEDDED MAPPINGS
// import { FABPrintingsSearchUtility } from '@/lib/services/contracts/IPrintingsService';
// import type { PrintingsSearchFilters, PrintingsSearchOptions } from '@/lib/services/contracts/IPrintingsService';

// // Create a single instance to reuse
// const fabPrintingsSearch = new FABPrintingsSearchUtility();

// // EMBEDDED MAPPINGS - All mappings directly in the tool for reliability
// const FOILING_MAPPINGS = {
//   'r': 'Rainbow Foil',
//   'rf': 'Rainbow Foil', 
//   'rainbow': 'Rainbow Foil', 
//   'rainbow foil': 'Rainbow Foil',
//   'c': 'Cold Foil',
//   'cf': 'Cold Foil', 
//   'cold': 'Cold Foil', 
//   'cold foil': 'Cold Foil',
//   's': 'Non-foil',
//   'nf': 'Non-foil', 
//   'n': 'Non-foil', 
//   'standard': 'Non-foil', 
//   'non-foil': 'Non-foil', 
//   'nonfoil': 'Non-foil',
//   'g': 'Gold Foil',
//   'gf': 'Gold Foil',
//   'gold': 'Gold Foil',
//   'gold foil': 'Gold Foil'
// } as const;

// const EDITION_MAPPINGS = {
//   'a': 'Alpha',
//   'alpha': 'Alpha',
//   'f': 'First Edition',
//   'first': 'First Edition', 
//   '1st': 'First Edition', 
//   'first edition': 'First Edition',
//   'u': 'Unlimited',
//   'unl': 'Unlimited', 
//   'unlimited': 'Unlimited', 
//   'unlimited edition': 'Unlimited',
//   'n': 'Normal',
//   'normal': 'Normal', 
//   'promo': 'Normal'
// } as const;

// const RARITY_MAPPINGS = {
//   'c': 'Common',
//   'common': 'Common',
//   'r': 'Rare',
//   'rare': 'Rare',
//   's': 'Super Rare',
//   'super rare': 'Super Rare', 
//   'super': 'Super Rare',
//   'm': 'Majestic',
//   'majestic': 'Majestic', 
//   'maj': 'Majestic',
//   'l': 'Legendary',
//   'legendary': 'Legendary', 
//   'leg': 'Legendary',
//   'f': 'Fabled',
//   'fabled': 'Fabled', 
//   'fab': 'Fabled',
//   't': 'Token',
//   'token': 'Token',
//   'b': 'Basic',
//   'basic': 'Basic',
//   'v': 'Marvel',
//   'marvel': 'Marvel',
//   'p': 'Promo',
//   'promo': 'Promo'
// } as const;

// const SET_MAPPINGS = {
//   // Core sets
//   'wtr': 'Welcome to Rathe',
//   'arc': 'Arcane Rising', 
//   'cru': 'Crucible of War',
//   'mon': 'Monarch',
//   'ele': 'Tales of Aria',
//   'evr': 'Everfest',
//   'upr': 'Uprising',
//   'dyn': 'Dynasty',
//   'out': 'Outsiders',
//   'dtd': 'Dusk till Dawn',
//   'evo': 'Bright Lights',
//   'hvy': 'Heavy Hitters',
//   'mst': 'Part the Mistveil',
//   'ros': 'Rosetta',
//   'hnt': 'The Hunted',
//   'sea': 'High Seas',

//   // History/Classic Packs
//   '1hp': 'History Pack Vol.1',
//   'dvr': 'Classic Battles: Rhinar vs Dorinthea',
//   'aur': '1st Strike',

//   // Promo sets
//   'fab': 'Flesh and Blood: Promo Cards',
//   'gem': 'GEM Pack 2',
//   'tcc': 'Round the Table: TCCxLSS',
//   'sup': 'Super Slam',

//   // Welcome/Hero Decks
//   'ira': 'Welcome Deck: Ira',
//   'bvo': 'Hero Deck: Bravo',
//   'rnr': 'Hero Deck: Rhinar',
//   'ksu': 'Hero Deck: Katsu',
//   'tea': 'Hero Deck: Dorinthea',

//   // Blitz Decks - Monarch
//   'psm': 'Blitz Deck: Monarch - Prism',
//   'bol': 'Blitz Deck: Monarch - Boltyn',
//   'chn': 'Blitz Deck: Monarch - Chane',
//   'lev': 'Blitz Deck: Monarch - Levia',

//   // Blitz Decks - Tales of Aria
//   'lxi': 'Blitz Deck: Tales of Aria - Lexi',
//   'old': 'Blitz Deck: Tales of Aria - Oldhim',
//   'bri': 'Blitz Deck: Tales of Aria - Briar',

//   // Blitz Decks - Uprising
//   'fai': 'Blitz Deck: Uprising - Fai',
//   'dro': 'Blitz Deck: Uprising - Dromai',

//   // Blitz Decks - Outsiders
//   'ara': 'Blitz Deck: Outsiders - Arakni',
//   'azl': 'Blitz Deck: Outsiders - Azalea',
//   'ben': 'Blitz Deck: Outsiders - Benji',
//   'kat': 'Blitz Deck: Outsiders - Katsu',
//   'rip': 'Blitz Deck: Outsiders - Riptide',
//   'uzu': 'Blitz Deck: Outsiders - Uzuri',

//   // Blitz Decks - Heavy Hitters
//   'ksi': 'Blitz Deck: Heavy Hitters - Kassai',
//   'kyo': 'Blitz Deck: Heavy Hitters - Kayo',
//   'rhi': 'Blitz Deck: Heavy Hitters - Rhinar',
//   'bet': 'Blitz Deck: Heavy Hitters - Betsy',
//   'ola': 'Blitz Deck: Heavy Hitters - Olympia',
//   'vic': 'Blitz Deck: Heavy Hitters - Victor',

//   // Blitz Decks - Part the Mistveil
//   'eng': 'Blitz Deck: Part the Mistveil - Enigma',
//   'nuu': 'Blitz Deck: Part the Mistveil - Nuu',
//   'zen': 'Blitz Deck: Part the Mistveil - Zen',

//   // Blitz Decks - Rosetta
//   'flr': 'Blitz Deck: Rosetta - Florian',
//   'aua': 'Blitz Deck: Rosetta - Aurora',
//   'osc': 'Blitz Deck: Rosetta - Oscilio',
//   'ver': 'Blitz Deck: Rosetta - Verdance',

//   // Blitz Decks - The Hunted
//   'ark': 'Blitz Deck: The Hunted - Arakni',
//   'fng': 'Blitz Deck: The Hunted - Fang',
//   'wod': 'Blitz Deck: The Hunted - Arakni, Web of Deceit',
//   'cin': 'Blitz Deck: The Hunted - Cindra',

//   // Historic Pack Blitz Decks
//   '1hb': 'Historic Pack 1 Blitz Deck: Bravo',
//   '1hd': 'Historic Pack 1 Blitz Deck: Dash',
//   '1ht': 'Historic Pack 1 Blitz Deck: Dorinthea',
//   '1hk': 'Historic Pack 1 Blitz Deck: Kano',
//   '1hr': 'Historic Pack 1 Blitz Deck: Rhinar',
//   '1hv': 'Historic Pack 1 Blitz Deck: Viserai',

//   // Armory Decks
//   'ako': 'Armory Deck: Kayo',
//   'asb': 'Armory Deck: Boltyn',
//   'aaz': 'Armory Deck: Azalea',
//   'aio': 'Armory Deck: Dash',
//   'ajv': 'Armory Deck: Jarl Vetreidi',
//   'ast': 'Armory Deck: Aurora',
//   'amx': 'Armory Deck: Maxx Nitro',
//   'agb': 'Armory Deck: Gravy Bones',
//   'asr': 'Armory Deck: Ira',
//   'aps': 'Armory Deck: Pleiades',

//   // Mastery Pack
//   'mpg': 'Mastery Pack Guardian'
// } as const;

// // SIMPLE: Helper function to format printing details using embedded mappings
// function formatPrintingDetails(printing: any): string {
//   try {
//     const set = printing.set || '';
//     const edition = printing.edition || '';
//     const foiling = printing.foiling || '';
//     const rarity = printing.rarity || '';

//     // Build human-readable parts
//     const parts = [];

//     // Set name (e.g., "1hp" -> "History Pack Vol.1")
//     if (set && SET_MAPPINGS[set]) {
//       parts.push(SET_MAPPINGS[set]);
//     } else if (set) {
//       parts.push(set.toUpperCase()); // Fallback to uppercase
//     }

//     // Edition (e.g., "n" -> "Normal edition")
//     if (edition && EDITION_MAPPINGS[edition]) {
//       parts.push(`${EDITION_MAPPINGS[edition]} edition`);
//     }

//     // Foiling (e.g., "s" -> "Non-foil")
//     if (foiling && FOILING_MAPPINGS[foiling]) {
//       parts.push(FOILING_MAPPINGS[foiling]);
//     }

//     // Rarity (e.g., "m" -> "Majestic")
//     if (rarity && RARITY_MAPPINGS[rarity]) {
//       parts.push(RARITY_MAPPINGS[rarity]);
//     }

//     return parts.length > 0 ? parts.join(', ') : `${set}-${edition}-${foiling} [${rarity}]`;

//   } catch (error) {
//     console.error('Error formatting printing details:', error);
//     // Fallback to original format if mapping fails
//     const set = printing.set || '';
//     const edition = printing.edition || '';
//     const foiling = printing.foiling || '';
//     const rarity = printing.rarity || '';
//     return `${set}-${edition}-${foiling} [${rarity}]`;
//   }
// }

// // Inline helper function - quick fix to avoid import issues
// function convertMCPFiltersToSearchFilters(mcpFilters: any): PrintingsSearchFilters {
//   const searchFilters: PrintingsSearchFilters = {};
  
//   // Direct mappings
//   if (mcpFilters.name) searchFilters.name = mcpFilters.name;
//   if (mcpFilters.text) searchFilters.text = mcpFilters.text;
//   if (mcpFilters.searchableText) searchFilters.searchableText = mcpFilters.searchableText;
//   if (mcpFilters.exact !== undefined) searchFilters.exact = mcpFilters.exact;
  
//   // Handle collectorNumber (can be string or comma-separated)
//   if (mcpFilters.collectorNumber) {
//     if (typeof mcpFilters.collectorNumber === 'string' && mcpFilters.collectorNumber.includes(',')) {
//       searchFilters.collectorNumber = mcpFilters.collectorNumber.split(',').map(s => s.trim());
//     } else {
//       searchFilters.collectorNumber = mcpFilters.collectorNumber;
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
  
//   // Basic fields that are commonly used
//   if (mcpFilters.sets) searchFilters.sets = mcpFilters.sets;
//   if (mcpFilters.types) searchFilters.types = mcpFilters.types;
//   if (mcpFilters.rarities) searchFilters.rarities = mcpFilters.rarities;
//   if (mcpFilters.foilings) searchFilters.foilings = mcpFilters.foilings;
//   if (mcpFilters.editions) searchFilters.editions = mcpFilters.editions;
  
//   return searchFilters;
// }

// export const extractPrintingIdsTool = {
//   name: 'extract_printing_ids',
//   description: 'Extract printing IDs from search results with user-friendly selection interface for binder management.',
//   parameters: {
//     type: 'object',
//     properties: {
//       filters: {
//         type: 'object',
//         description: 'Same filters as search_printings'
//       },
//       options: {
//         type: 'object',
//         properties: {
//           limit: { type: 'number', default: 100, maximum: 500 },
//           idType: {
//             type: 'string',
//             enum: ['all', 'card_id', 'printing_id', 'selection_interface'],
//             default: 'all',
//             description: 'Type of IDs to extract: all, card_id (WTR216), printing_id (MongoDB), or selection_interface (numbered list for user selection)'
//           },
//           includeDetails: {
//             type: 'boolean',
//             default: false,
//             description: 'Include detailed card information (set, edition, foiling, rarity, price) for selection interface'
//           }
//         }
//       }
//     }
//   },

//   handler: async ({ filters = {}, options = {} }) => {
//     console.log('🆔 EXTRACTING PRINTING IDS - ENHANCED INTERFACE WITH EMBEDDED MAPPINGS');
    
//     const searchOptions: PrintingsSearchOptions = { 
//       ...options, 
//       limit: options.limit || 100,
//       show: 'all'
//     };
    
//     const searchFilters = convertMCPFiltersToSearchFilters(filters);
//     const result = await fabPrintingsSearch.searchPrintings(searchFilters, searchOptions);
    
//     if (!result.printings?.length) {
//       return {
//         printing_ids_csv: '',
//         card_ids: [],
//         printing_ids: [],
//         total: 0,
//         message: 'No printings found matching criteria'
//       };
//     }
    
//     const cardIds = [];
//     const printingIds = [];
//     const selectionList = [];
    
//     // ENHANCED: Process each printing with embedded mappings formatting
//     for (let index = 0; index < result.printings.length; index++) {
//       const printing = result.printings[index];
//       const cardId = printing.collector_number;
//       const printingId = printing.printing_id || printing._id;
      
//       if (cardId) cardIds.push(cardId);
//       if (printingId) printingIds.push(printingId);
      
//       // Build selection interface entry with enhanced formatting
//       if (options.idType === 'selection_interface' || options.includeDetails) {
//         const name = printing.name || 'Unknown';
//         const price = printing.tcg_market || printing.tcg_mid || printing.tcg_low || 'No price';
        
//         // NEW: Use embedded mappings for human-readable details
//         const formattedDetails = formatPrintingDetails(printing);
        
//         // FALLBACK: Keep original format as backup
//         const originalDetails = (() => {
//           const set = printing.set || '';
//           const edition = printing.edition || '';
//           const foiling = printing.foiling || '';
//           const rarity = printing.rarity || '';
//           let details = set;
//           if (edition) details += `-${edition}`;
//           if (foiling) details += `-${foiling}`;
//           if (rarity) details += ` [${rarity}]`;
//           return details;
//         })();
        
//         const letter = String.fromCharCode(97 + index); // a, b, c, d, etc.
//         selectionList.push({
//           letter: letter,
//           name: name,
//           details: formattedDetails, // NEW: Human-readable format
//           originalDetails: originalDetails, // Keep original for compatibility
//           price: price,
//           printingId: printingId,
//           cardId: cardId
//         });
//       }
//     }
    
//     // Create comma-separated string of printing IDs
//     const printingIdsCsv = printingIds.join(',');
    
//     let response = {
//       printing_ids_csv: printingIdsCsv,
//       total: result.total,
//       returned: result.printings.length
//     };
    
//     switch (options.idType) {
//       case 'card_id':
//         response.ids = cardIds;
//         response.message = `Extracted ${cardIds.length} card IDs (e.g., WTR216)\nCSV: ${cardIds.join(',')}`;
//         break;
        
//       case 'printing_id':
//         response.ids = printingIds;
//         response.message = `Extracted ${printingIds.length} printing IDs (MongoDB-style)\nCSV: ${printingIdsCsv}`;
//         break;
        
//       case 'selection_interface':
//         response.selectionList = selectionList;
//         response.printing_ids = printingIds;
//         response.card_ids = cardIds;
        
//         // ENHANCED: Build user-friendly selection interface with beautiful formatting
//         let selectionText = `Found ${result.total} total printings for "${filters.name || 'your search'}" (showing ${selectionList.length}):\n\n`;
//         selectionText += `📋 SELECTION INTERFACE FOR BINDER MANAGEMENT:\n\n`;
        
//         selectionList.forEach(item => {
//           // NEW: Display the beautiful formatted details instead of cryptic codes
//           selectionText += `${item.letter}. ${item.name} (${item.cardId}) - ${item.details} - ${item.price}\n`;
//         });
        
//         selectionText += `\n🎯 TO ADD TO BINDER:\n`;
//         selectionText += `Format options:\n`;
//         selectionText += `• Letter codes: "2a,1b,3d" = 2x item a, 1x item b, 3x item d\n`;
//         selectionText += `• Natural language: "3 of all non foil printings" or "1 cheapest alpha"\n`;
//         selectionText += `• Voice examples: "2 cold foil", "first edition only", "3 commons"\n`;
//         selectionText += `Or use "all" for one of everything\n\n`;
//         selectionText += `📝 ALL PRINTING IDS (CSV): ${printingIdsCsv}\n\n`;
//         selectionText += `💡 Use the format above to tell me which printings and quantities to add to your binder!\n`;
//         selectionText += `Example: "2a,1c,3f" = 2 copies of (a), 1 copy of (c), 3 copies of (f)\n\n`;
        
//         // Add traditional card IDs and MongoDB printing IDs for reference
//         selectionText += `Traditional Card IDs (${cardIds.length}):\n${cardIds.join('\n')}\n\n`;
//         selectionText += `MongoDB Printing IDs (${printingIds.length}):\n${printingIds.join('\n')}\n\n`;
//         selectionText += `Data provided by FabBazaar.com`;
        
//         response.message = selectionText;
//         break;
        
//       default:
//         response.card_ids = cardIds;
//         response.printing_ids = printingIds;
//         response.selection_list = selectionList;
//         response.message = `Extracted ${cardIds.length} card IDs and ${printingIds.length} printing IDs\nCSV: ${printingIdsCsv}`;
//     }
    
//     return response;
//   }
// };

// // ENHANCED: Helper function to convert user selection to printing IDs with quantities
// // Now works with the enhanced selection list that has formatted details
// export function parseUserSelection(selectionList, userInput) {
//   const selections = [];
  
//   if (userInput.toLowerCase() === 'all') {
//     return selectionList.map(item => ({
//       printingId: item.printingId,
//       quantity: 1,
//       name: item.name,
//       details: item.details, // Now uses the beautiful formatted details
//       originalDetails: item.originalDetails // Keep original for compatibility
//     }));
//   }
  
//   // Try natural language parsing first
//   const naturalLanguageResult = parseNaturalLanguage(selectionList, userInput);
//   if (naturalLanguageResult.length > 0) {
//     return naturalLanguageResult;
//   }
  
//   // Fall back to standard format parsing "2a,1b,3d"
//   const parts = userInput.split(',').map(s => s.trim());
  
//   for (const part of parts) {
//     // Match pattern: optional number followed by letter
//     const match = part.match(/^(\d*)([a-z])$/i);
//     if (match) {
//       const quantity = match[1] ? parseInt(match[1]) : 1;
//       const letter = match[2].toLowerCase();
      
//       // Find the item with this letter
//       const item = selectionList.find(item => item.letter === letter);
//       if (item) {
//         selections.push({
//           printingId: item.printingId,
//           quantity: quantity,
//           name: item.name,
//           details: item.details, // Beautiful formatted details
//           originalDetails: item.originalDetails, // Keep original for compatibility
//           letter: letter
//         });
//       }
//     }
//   }
  
//   return selections;
// }

// // ENHANCED: Natural language parser now works with formatted details
// // Updated to work with both formatted and original details for better matching
// function parseNaturalLanguage(selectionList, userInput) {
//   const input = userInput.toLowerCase();
//   const selections = [];
  
//   // Extract quantity (default to 1)
//   let quantity = 1;
//   const quantityMatch = input.match(/(\d+)\s*(?:of|x|copies?|times?)?/);
//   if (quantityMatch) {
//     quantity = parseInt(quantityMatch[1]);
//   }
  
//   // Filter conditions - updated to work with both formatted and original details
//   const conditions = {
//     nonFoil: /non[\s-]?foil|standard|normal(?!\s+foil)/,
//     foil: /foil(?!\s*(?:non|standard|normal))/,
//     coldFoil: /cold[\s-]?foil/,
//     rainbowFoil: /rainbow[\s-]?foil/,
//     alpha: /alpha/,
//     firstEdition: /first[\s-]?edition|1st[\s-]?edition/,
//     unlimited: /unlimited/,
//     normal: /normal[\s-]?edition/,
//     common: /common/,
//     rare: /rare(?!\s*foil)/,
//     legendary: /legendary/,
//     majestic: /majestic/,
//     cheapest: /cheapest|lowest[\s-]?price|budget/,
//     mostExpensive: /most[\s-]?expensive|highest[\s-]?price|premium/,
//     wtr: /welcome[\s-]?to[\s-]?rathe|wtr/,
//     historyPack: /history[\s-]?pack|1hp/,
//     specific: /first|last|\d+(?:st|nd|rd|th)/
//   };
  
//   // Apply filters based on natural language
//   let filteredItems = [...selectionList];
  
//   // Enhanced filtering that works with both formatted and original details
  
//   // Foiling filters - check both formatted and original details
//   if (conditions.nonFoil.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('non-foil') || 
//       item.details.toLowerCase().includes('standard') ||
//       (!item.originalDetails.includes('-c') && !item.originalDetails.includes('-r') && !item.originalDetails.includes('-g'))
//     );
//   } else if (conditions.coldFoil.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('cold foil') ||
//       item.originalDetails.includes('-c')
//     );
//   } else if (conditions.rainbowFoil.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('rainbow foil') ||
//       item.originalDetails.includes('-r')
//     );
//   } else if (conditions.foil.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('foil') ||
//       item.originalDetails.includes('-c') || item.originalDetails.includes('-r') || item.originalDetails.includes('-g')
//     );
//   }
  
//   // Edition filters - check both formatted and original details
//   if (conditions.alpha.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('alpha') ||
//       item.originalDetails.includes('-a')
//     );
//   } else if (conditions.firstEdition.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('first edition') ||
//       item.originalDetails.includes('-f')
//     );
//   } else if (conditions.unlimited.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('unlimited') ||
//       item.originalDetails.includes('-u')
//     );
//   } else if (conditions.normal.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('normal edition') ||
//       item.originalDetails.includes('-n')
//     );
//   }
  
//   // Rarity filters - check both formatted and original details
//   if (conditions.common.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('common') ||
//       item.originalDetails.includes('[c]')
//     );
//   } else if (conditions.rare.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('rare') ||
//       item.originalDetails.includes('[r]')
//     );
//   } else if (conditions.legendary.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('legendary') ||
//       item.originalDetails.includes('[l]')
//     );
//   } else if (conditions.majestic.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('majestic') ||
//       item.originalDetails.includes('[m]')
//     );
//   }
  
//   // Set filters - check both formatted and original details
//   if (conditions.wtr.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('welcome to rathe') ||
//       item.originalDetails.startsWith('wtr')
//     );
//   } else if (conditions.historyPack.test(input)) {
//     filteredItems = filteredItems.filter(item => 
//       item.details.toLowerCase().includes('history pack') ||
//       item.originalDetails.startsWith('1hp')
//     );
//   }
  
//   // Price filters
//   if (conditions.cheapest.test(input)) {
//     filteredItems.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
//     filteredItems = [filteredItems[0]].filter(Boolean);
//   } else if (conditions.mostExpensive.test(input)) {
//     filteredItems.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
//     filteredItems = [filteredItems[0]].filter(Boolean);
//   }
  
//   // Position filters (first, last, specific position)
//   if (input.includes('first')) {
//     filteredItems = [filteredItems[0]].filter(Boolean);
//   } else if (input.includes('last')) {
//     filteredItems = [filteredItems[filteredItems.length - 1]].filter(Boolean);
//   }
  
//   // Convert filtered items to selections
//   for (const item of filteredItems) {
//     selections.push({
//       printingId: item.printingId,
//       quantity: quantity,
//       name: item.name,
//       details: item.details, // Use formatted details
//       originalDetails: item.originalDetails, // Keep original for compatibility
//       letter: item.letter
//     });
//   }
  
//   return selections;
// }

// // Helper to get just the printing IDs (for CSV)
// export function getSelectionPrintingIds(selections) {
//   const printingIds = [];
//   for (const selection of selections) {
//     for (let i = 0; i < selection.quantity; i++) {
//       printingIds.push(selection.printingId);
//     }
//   }
//   return printingIds;
// }