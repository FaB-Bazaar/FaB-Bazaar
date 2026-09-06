/**
 * Maps user-friendly deck format names to API format codes
 * Used when calling printings search API and other format-aware endpoints
 */
export const DECK_FORMAT_TO_API_CODE: Record<string, string> = {
  'Classic Constructed': 'cc',
  'Future Classic Constructed': 'future_cc',
  'Blitz': 'blitz',
  'Commoner': 'commoner',
  'Living Legend': 'll',
  'Silver Age': 'silver_age',
};

/**
 * Get API format code from deck format name
 * Returns undefined if format is not recognized
 */
export function getApiFormatCode(deckFormat: string | undefined): string | undefined {
  if (!deckFormat) return undefined;
  return DECK_FORMAT_TO_API_CODE[deckFormat];
}
