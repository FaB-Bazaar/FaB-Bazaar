// lib/browse/parsers/bulk-input-parser.ts
export interface ParsedCard {
  name: string;
  quantity: number;
  color: string;
  isPartialMatch: boolean;
  set: string;
  foiling: string;
  edition: string;
  // Set only when a "loose" leading/trailing color word was stripped off the
  // name (e.g. "Deep Blue" → name "deep", color "blue"). Holds the full,
  // un-stripped name so the search can retry without the color filter when the
  // color-filtered query returns nothing. Undefined when no loose strip happened
  // or when the color came from explicit "(blue)" parenthesis syntax.
  fallbackName?: string;
}

// --- NORMALIZATION MAPS (for converting user input to system codes) ---
const COLOR_MAP: Record<string, string> = {
  red: 'red', r: 'red',
  yellow: 'yellow', yel: 'yellow', y: 'yellow',
  blue: 'blue', blu: 'blue', b: 'blue',
};

const FOILING_MAP: Record<string, string> = {
  'cold foil': 'c', cf: 'c',
  'rainbow foil': 'r', rf: 'r',
  'gold foil': 'g', gf: 'g',
};

const EDITION_MAP: Record<string, string> = {
  alpha: 'a',
  'first edition': 'f', '1st': 'f',
  unlimited: 'u',
  unl: 'u',
  normal: 'n',
};

// A simple regex to validate 3-letter set codes.
const SET_CODE_PATTERN = /^[A-Z]{3}$/i;

// --- THE PRIMARY PARSING FUNCTION (REWRITTEN FOR SAFETY) ---
export function parseCardListFormat(lines: string[]): ParsedCard[] {
  return lines.map(line => {
      let currentLine = line;
      
      const result: ParsedCard = {
          name: '',
          quantity: 1,
          color: '',
          isPartialMatch: false,
          set: '',
          foiling: '',
          edition: '',
      };

      // 1. Handle Quantity
      const quantityMatch = currentLine.match(/^(\d+)(x)?\s*(.+)/i);
      if (quantityMatch) {
          result.quantity = parseInt(quantityMatch[1], 10);
          currentLine = quantityMatch[3].trim();
      }

      // 2. Handle Partial Match Wildcard '*'
      if (currentLine.startsWith('*')) {
          result.isPartialMatch = true;
          currentLine = currentLine.substring(1).trim();
      }

      // 3. Handle specific attributes inside parentheses FIRST
      const parenthesisMatch = currentLine.match(/(.*?)\s+\((.+)\)$/);
      if (parenthesisMatch) {
          currentLine = parenthesisMatch[1].trim();
          const tags = parenthesisMatch[2].split(',').map(tag => tag.trim().toLowerCase());
          
          for (const tag of tags) {
              if (COLOR_MAP[tag]) {
                  result.color = COLOR_MAP[tag];
              } else if (FOILING_MAP[tag]) {
                  result.foiling = FOILING_MAP[tag];
              } else if (EDITION_MAP[tag]) {
                  // ✅ CHECK EDITION FIRST (before set check)
                  result.edition = EDITION_MAP[tag];
              } else if (SET_CODE_PATTERN.test(tag)) {
                  // Only treat as set code if it's NOT an edition
                  result.set = tag.toUpperCase();
              }
          }
      }

      // 4. Handle "loose" color formats
      // A leading/trailing color word is ambiguous: it may be a pitch specifier
      // ("Wax On red") or part of the actual card name ("Deep Blue", which is
      // pitchless equipment). We strip it as a color but stash the full original
      // string in fallbackName so the search can retry without the color filter.
      if (!result.color) {
          const prefixMatch = currentLine.match(/^(red|yellow|blue)\s+(.+)/i);
          if (prefixMatch) {
              result.fallbackName = currentLine.toLowerCase();
              result.color = COLOR_MAP[prefixMatch[1].toLowerCase()];
              currentLine = prefixMatch[2].trim();
          } else {
              const suffixMatch = currentLine.match(/(.+?)\s+(red|yellow|blue)$/i);
              if (suffixMatch) {
                  result.fallbackName = currentLine.toLowerCase();
                  result.color = COLOR_MAP[suffixMatch[2].toLowerCase()];
                  currentLine = suffixMatch[1].trim();
              }
          }
      }
      
      // The remainder is the card name
      result.name = currentLine.toLowerCase();

      return result;
  });
}

// --- The other parsers remain unchanged as they handle different, specific formats ---
export function parseFabtcgFormat(lines: string[]): ParsedCard[] {
  return lines.map(line => {
      const quantityMatch = line.match(/^(\d+)\s{1,}(.*)$/i);
      if (quantityMatch) {
          const quantity = parseInt(quantityMatch[1]);
          let name = quantityMatch[2].trim();
          let color = "";
          const colorMatch = name.match(/^(.+?)\s*\((red|yellow|blue|blu|yel)\)$/i);
          if (colorMatch) {
              name = colorMatch[1].trim();
              let colorCode = colorMatch[2].toLowerCase();
              color = COLOR_MAP[colorCode] || "";
          }
          return { name: name.toLowerCase(), quantity, color, isPartialMatch: false, set: '', foiling: '', edition: '' };
      } else {
          return { name: line.toLowerCase(), quantity: 1, color: "", isPartialMatch: false, set: '', foiling: '', edition: '' };
      }
  });
}

export function parseFabraryFormat(lines: string[]): ParsedCard[] {
  return lines.map(line => {
      let name = line;
      let quantity = 1;
      const quantityMatch = line.match(/^(\d+)x\s*(.+)/i);
      if (quantityMatch) {
          quantity = parseInt(quantityMatch[1], 10);
          name = quantityMatch[2];
      }
      let color = "";
      const colorMatch = name.match(/^(.+?)\s*\((red|yellow|blue)\)$/i);
      if (colorMatch) {
          name = colorMatch[1].trim();
          color = COLOR_MAP[colorMatch[2].toLowerCase()] || "";
      }
      return { name: name.toLowerCase(), quantity, color, isPartialMatch: false, set: '', foiling: '', edition: '' };
  });
}

export function parseBulkInput(
  input: string,
  source: 'fabrary' | 'cardlist' | 'fabtcg'
): ParsedCard[] {
  const lines = input.split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//') && !line.startsWith('Sideboard'));

  let parsedCards: ParsedCard[];
  switch (source) {
      case 'fabrary':
          parsedCards = parseFabraryFormat(lines);
          break;
      case 'cardlist':
          parsedCards = parseCardListFormat(lines);
          break;
      case 'fabtcg':
          parsedCards = parseFabtcgFormat(lines);
          break;
      default:
          parsedCards = lines.map(line => ({ name: line.toLowerCase(), quantity: 1, color: "", isPartialMatch: false, set: '', foiling: '', edition: '' }));
  }

  return parsedCards.filter(card => card.name);
}
