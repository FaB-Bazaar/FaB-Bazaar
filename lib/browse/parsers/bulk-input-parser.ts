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
  // Set when the line is a collector number (e.g. "2 WTR001", "4x arc057",
  // "1HP001") instead of a card name. Uppercased to match printings storage.
  // `name` still holds the raw token so the empty-name filter keeps the line.
  collectorNumber?: string;
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

// A collector number: set prefix (letters, optionally digit-leading like 1HP)
// followed by a 3–4 digit number. Mirrors the DB's own detection regex.
const COLLECTOR_NUMBER_PATTERN = /^(?=.*[a-z])[a-z0-9]{2,5}\d{3,4}$/i;

// Two-word tags collapse to their short form before token splitting.
const MULTI_WORD_TAGS: Array<[RegExp, string]> = [
  [/\brainbow foil\b/g, 'rf'],
  [/\bcold foil\b/g, 'cf'],
  [/\bgold foil\b/g, 'gf'],
  [/\bfirst edition\b/g, '1st'],
];

// Apply one tag (color / foiling / edition / set) to the result. Returns false
// when the token isn't a known tag so callers can decline the reading.
function applyTag(tag: string, result: ParsedCard): boolean {
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
  } else {
      return false;
  }
  return true;
}

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

      // 1. Handle Quantity. A bare digit-leading collector number ("1HP001")
      // must not have its first digit read as a quantity.
      const quantityMatch = COLLECTOR_NUMBER_PATTERN.test(currentLine)
          ? null
          : currentLine.match(/^(\d+)(x)?\s*(.+)/i);
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
          for (const tag of tags) applyTag(tag, result);
      }

      // 3b. Bare tags after a collector number: "1 WTR123 RF", "ARC057 cold foil 1st".
      // Every trailing token must be a known tag, otherwise this is a name.
      const bareTagMatch = currentLine.match(/^(\S+)\s+(.+)$/);
      if (bareTagMatch && COLLECTOR_NUMBER_PATTERN.test(bareTagMatch[1])) {
          let rest = bareTagMatch[2].toLowerCase();
          for (const [pattern, short] of MULTI_WORD_TAGS) rest = rest.replace(pattern, short);
          const tokens = rest.split(/[\s,]+/).filter(Boolean);
          const trial: ParsedCard = { ...result };
          if (tokens.every(token => applyTag(token, trial))) {
              Object.assign(result, trial);
              currentLine = bareTagMatch[1];
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
      
      // The remainder is the card name — or a collector number
      result.name = currentLine.toLowerCase();
      if (COLLECTOR_NUMBER_PATTERN.test(currentLine)) {
          result.collectorNumber = currentLine.toUpperCase();
      }

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
