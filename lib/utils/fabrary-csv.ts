// lib/utils/fabrary-csv.ts
// Pure CSV parsing utility for Fabrary collection exports. No DB or service dependencies.

const EXPECTED_HEADERS = [
  'Identifier', 'Name', 'Pitch', 'Set', 'Set number', 'Edition',
  'Foiling', 'Treatment', 'Have', 'Want in trade', 'Want to buy',
  'Extra for trade', 'Extra to sell',
] as const;

const FOILING_MAP: Record<string, string> = {
  '': 's',
  'rainbow': 'r',
  'cold': 'c',
  'gold': 'g',
};

const EDITION_MAP: Record<string, string> = {
  '': 'n',
  'first': 'f',
  'unlimited': 'u',
  'alpha': 'a',
};

const TREATMENT_MAP: Record<string, string[]> = {
  '': [],
  'extended art': ['EA'],
  'full art': ['FA'],
  'alternate art': ['AA'],
  'alternate border': ['AB'],
  'alternate text': ['AT'],
};

export interface FabraryParsedRow {
  collectorNumber: string
  name: string
  foiling: string
  edition: string
  treatments: string[]
  inventoryQty: number
  forTrade: boolean
  wantsQty: number
  hasInventory: boolean
  hasWants: boolean
}

// Resolved row: printing_id is known
export interface FabraryInventoryItem {
  printingId: string
  quantity: number
  forTrade: boolean
}

export interface FabraryWantsItem {
  printingId: string
  quantity: number
}

export interface FabraryUnresolvedRow {
  collectorNumber: string
  name: string
  reason: string
}

// What the resolve endpoint returns (and the import endpoint accepts)
export interface FabraryResolveResult {
  inventory: FabraryInventoryItem[]
  wants: FabraryWantsItem[]
  unresolved: FabraryUnresolvedRow[]
  totalParsedRows: number
}

// What the import endpoint returns
export interface FabraryImportResult {
  binderId: string
  binderName: string
  inventoryAdded: number
  inventoryFailed: number
  wantsAdded: number
  wantsFailed: number
  unresolved: FabraryUnresolvedRow[]
}

export interface FabraryCsvParseResult {
  rows: FabraryParsedRow[]
  errors: string[]
}

function parseQty(val: string): number {
  const n = parseInt(val.trim(), 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

export function parseFabraryCsv(csvText: string): FabraryCsvParseResult {
  const errors: string[] = [];
  const rows: FabraryParsedRow[] = [];

  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) {
    return { rows, errors: ['CSV file is empty or has no data rows.'] };
  }

  const headers = parseCsvLine(lines[0]);

  const missingHeaders = EXPECTED_HEADERS.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return {
      rows,
      errors: [`Missing required columns: ${missingHeaders.join(', ')}. Is this a Fabrary collection export?`],
    };
  }

  const idx = (name: string) => headers.indexOf(name);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);

    const get = (name: string) => cols[idx(name)] ?? '';

    const have = parseQty(get('Have'));
    const wantInTrade = parseQty(get('Want in trade'));
    const wantToBuy = parseQty(get('Want to buy'));
    const extraForTrade = parseQty(get('Extra for trade'));
    const extraToSell = parseQty(get('Extra to sell'));

    const hasInventory = have > 0 || (extraForTrade + extraToSell) > 0;
    const hasWants = (wantInTrade + wantToBuy) > 0;

    if (!hasInventory && !hasWants) continue;

    const collectorNumber = get('Set number').trim().toUpperCase();
    const name = get('Name').trim();

    if (!collectorNumber) {
      errors.push(`Row ${i + 1}: missing Set number for "${name}", skipped.`);
      continue;
    }

    const foiling = FOILING_MAP[get('Foiling').trim().toLowerCase()] ?? 's';
    const edition = EDITION_MAP[get('Edition').trim().toLowerCase()] ?? 'n';
    const treatments = TREATMENT_MAP[get('Treatment').trim().toLowerCase()] ?? [];

    const extras = extraForTrade + extraToSell;
    const inventoryQty = have > 0 ? have : extras;

    rows.push({
      collectorNumber,
      name,
      foiling,
      edition,
      treatments,
      inventoryQty,
      forTrade: extras > 0,
      wantsQty: wantInTrade + wantToBuy,
      hasInventory,
      hasWants,
    });
  }

  return { rows, errors };
}

// Minimal RFC 4180 CSV line parser (handles quoted fields with embedded commas)
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { fields.push(current); current = ''; }
      else current += ch;
    }
  }

  fields.push(current);
  return fields;
}
