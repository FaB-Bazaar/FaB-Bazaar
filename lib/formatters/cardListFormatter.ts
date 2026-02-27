// lib/formatters/cardListFormatter.ts
interface FormatOptions {
  format: 'discord' | 'plaintext' | 'csv' | 'json';
  includePrice?: boolean;
  priceField?: 'tcg_low' | 'tcg_market' | 'tcg_mid';
  includeCondition?: boolean;
  includeNotes?: boolean;
}

export const RARITY_NAME_MAP = {
  'C': 'Common', 'R': 'Rare', 'S': 'Super Rare', 'M': 'Majestic',
  'L': 'Legendary', 'F': 'Fabled', 'T': 'Token', 'V': 'Marvel', 'P': 'Promo'
};

export const FOILING_NAME_MAP = {
  'r': 'Rainbow Foil', 'c': 'Cold Foil', 's': 'Standard', 'g': 'Gold Foil'
};

export const EDITION_NAME_MAP = {
  'a': 'Alpha', 'f': 'First Edition', 'u': 'Unlimited'
};

export function formatCardList(inventoryItems: any[], options: FormatOptions) {
  switch (options.format) {
    case 'discord':
      return formatAsDiscord(inventoryItems, options);
    case 'plaintext':
      return formatAsPlaintext(inventoryItems, options);
    case 'csv':
      return formatAsCSV(inventoryItems, options);
    case 'json':
      return JSON.stringify(inventoryItems, null, 2);
    default:
      return formatAsDiscord(inventoryItems, options);
  }
}

function formatCardLine(item: any, options: FormatOptions, useMarkdown: boolean): string {
  const quantity = item.quantity || 1;
  const name = item.display_name || item.name || "Unknown Card";
  const price = getPriceString(item, options.priceField || 'tcg_low');
  const set = item.set?.toUpperCase() || null;

  // Use markdown bold for Discord, plain text for others
  const formattedName = useMarkdown ? `**${name}**` : name;
  const mainParts = [`${quantity}x ${formattedName}`];
  
  if (options.includePrice && price) mainParts.push(price);
  if (set) mainParts.push(set);
  
  const details = [];
  const rarityName = RARITY_NAME_MAP[item.rarity?.toUpperCase()];
  if (rarityName) details.push(rarityName);

  const foilingName = FOILING_NAME_MAP[item.foiling?.toLowerCase()];
  if (foilingName && item.foiling?.toLowerCase() !== 's') {
    details.push(foilingName);
  }

  const editionName = EDITION_NAME_MAP[item.edition?.toLowerCase()];
  if (editionName) details.push(editionName);

  if (options.includeCondition && item.condition) {
    details.push(item.condition);
  }

  let finalString = mainParts.join(' - ');
  if (details.length > 0) {
    finalString += ` (${details.join(', ')})`;
  }

  if (options.includeNotes && item.notes) {
    const notePrefix = useMarkdown ? '\n    *Note: ' : '\n    Note: ';
    const noteSuffix = useMarkdown ? '*' : '';
    finalString += `${notePrefix}${item.notes}${noteSuffix}`;
  }

  return finalString;
}

function formatAsDiscord(items: any[], options: FormatOptions): string {
  return items.map(item => formatCardLine(item, options, true)).join('\n');
}

function formatAsPlaintext(items: any[], options: FormatOptions): string {
  return items.map(item => formatCardLine(item, options, false)).join('\n');
}

function formatAsCSV(items: any[], options: FormatOptions): string {
  const headers = ['Quantity', 'Name'];
  if (options.includePrice) headers.push('Price');
  headers.push('Set', 'Rarity', 'Foiling', 'Edition');
  if (options.includeCondition) headers.push('Condition');
  if (options.includeNotes) headers.push('Notes');

  const csvLines = [headers.join(',')];

  items.forEach(item => {
    const row = [];
    row.push(item.quantity || 1);
    row.push(`"${(item.display_name || item.name || 'Unknown Card').replace(/"/g, '""')}"`);
    
    if (options.includePrice) {
      const price = getPriceString(item, options.priceField || 'tcg_low');
      row.push(price || '');
    }
    
    row.push(item.set?.toUpperCase() || '');
    row.push(RARITY_NAME_MAP[item.rarity?.toUpperCase()] || '');
    row.push(FOILING_NAME_MAP[item.foiling?.toLowerCase()] || '');
    row.push(EDITION_NAME_MAP[item.edition?.toLowerCase()] || '');
    
    if (options.includeCondition) {
      row.push(item.condition || '');
    }
    
    if (options.includeNotes) {
      row.push(`"${(item.notes || '').replace(/"/g, '""')}"`);
    }

    csvLines.push(row.join(','));
  });

  return csvLines.join('\n');
}

function getPriceString(item: any, priceField: string): string | null {
  const price = item[priceField];
  return price ? `$${price.toFixed(2)}` : null;
}