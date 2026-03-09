// app/api/mcp/tool/scanPrinting.ts
import { printingsService } from '@/lib/services';

const PITCH_COLOR_MAP: Record<string, number> = {
  red: 1,
  yellow: 2,
  blue: 3,
};

const FOILING_WORD_MAP: Record<string, string> = {
  'non-foil': 's',
  'standard': 's',
  'rainbow': 'r',
  'rainbow foil': 'r',
  'cold': 'c',
  'cold foil': 'c',
  'gold': 'g',
  'gold foil': 'g',
};

const FOILING_DISPLAY: Record<string, string> = {
  s: 'Non-foil',
  r: 'Rainbow Foil',
  c: 'Cold Foil',
  g: 'Gold Foil',
};

const EDITION_DISPLAY: Record<string, string> = {
  n: 'Normal',
  f: 'First Edition',
  u: 'Unlimited',
  a: 'Alpha',
};

export const scanPrintingTool = {
  name: 'scan_printing',
  description: `🔍 IDENTIFY CARDS FROM IMAGES — EXTRACT THEN SEARCH

Use this tool after visually inspecting a FaB card image. You extract card details from the image yourself; this tool searches for matching printings and returns what it finds.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 HOW TO READ A FaB CARD BEFORE CALLING THIS TOOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. CARD NAME — large text at the top of the card.
   Example: "Liquid-Cooled Mayhem"

2. COLLECTOR NUMBER — printed at the BOTTOM of the card (bottom-left or bottom-center).
   Format: 3-letter set code + 3-digit number. Example: "EVO066"
   This is the most reliable identifier — always use it when visible.

3. PITCH COLOR — the colored gem/circle in the TOP-LEFT corner of the card.
   • Red gem    → pitchColor: "red"    (pitch value 1)
   • Yellow gem → pitchColor: "yellow" (pitch value 2)
   • Blue gem   → pitchColor: "blue"   (pitch value 3)
   • No gem     → omit pitchColor      (equipment, token, non-pitch action)

4. SET CODE — the first 3 letters of the collector number (e.g. EVO, WTR, MON, ELE, CRU, EVR, DTD).

5. EDITION — small text or stamp near the collector number.
   • "1st" mark or gold stamp → "first edition"
   • No mark                  → "normal" (standard/unlimited run)

6. FOILING — inspect the card's surface:
   • Flat finish, no shimmer         → "non-foil"
   • Full-card rainbow color shift   → "rainbow foil"
   • Metallic silver art area only   → "cold foil"
   • Gold metallic treatment         → "gold foil"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔁 WORKFLOW FOR MULTIPLE CARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Step 1: User shares card image(s)
  Step 2: Visually read each card — name, collector number, pitch gem, foiling
  Step 3: Call scan_printing once per UNIQUE card with what you found
  Step 4: Return all results to the user — they decide what to do next`,

  parameters: {
    type: 'object',
    properties: {
      cardName: {
        type: 'string',
        description: 'Card name as printed on the card.',
      },
      collectorNumber: {
        type: 'string',
        description: 'Collector number from the bottom of the card (e.g. "EVO066"). Most reliable identifier — provide whenever visible.',
      },
      pitchColor: {
        type: 'string',
        enum: ['red', 'yellow', 'blue'],
        description: 'Color of the pitch gem in the top-left corner. Omit if no gem is present.',
      },
      foiling: {
        type: 'string',
        enum: ['non-foil', 'rainbow foil', 'cold foil', 'gold foil'],
        description: 'Foiling treatment visible on the card surface.',
      },
      edition: {
        type: 'string',
        enum: ['first edition', 'unlimited', 'alpha', 'normal'],
        description: 'Print edition. Use "normal" if no edition stamp is visible.',
      },
    },
    required: ['cardName'],
  },

  async handler(params: any) {
    const { cardName, collectorNumber, pitchColor, foiling, edition } = params;

    try {
      const filters: Record<string, any> = {};

      if (collectorNumber) {
        // Collector number is the most precise filter — use it directly
        filters.printingCardId = collectorNumber.trim().toUpperCase();
      } else {
        // Fall back to name + optional pitch
        filters.name = cardName.trim();
        filters.exact = false;

        if (pitchColor) {
          const pitchValue = PITCH_COLOR_MAP[pitchColor.toLowerCase()];
          if (pitchValue !== undefined) {
            filters.pitch = pitchValue;
          }
        }

        if (foiling) {
          const foilingCode = FOILING_WORD_MAP[foiling.toLowerCase()];
          if (foilingCode) filters.foilings = [foilingCode];
        }

        if (edition) {
          const editionCodeMap: Record<string, string> = {
            'first edition': 'f',
            'unlimited': 'u',
            'alpha': 'a',
            'normal': 'n',
          };
          const editionCode = editionCodeMap[edition.toLowerCase()];
          if (editionCode) filters.editions = [editionCode];
        }
      }

      const result = await printingsService.searchPrintings(filters, { limit: 10 });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Search failed',
          scanned: { cardName, collectorNumber: collectorNumber || null },
        };
      }

      const printings = result.data?.printings || result.data || [];

      if (!Array.isArray(printings) || printings.length === 0) {
        return {
          success: false,
          error: `No printings found for "${cardName}"${collectorNumber ? ` (${collectorNumber})` : ''}.`,
          hint: collectorNumber
            ? 'Verify the collector number was read correctly — try omitting it to search by name only.'
            : 'Check the card name spelling or use search_printings for broader filters.',
          scanned: { cardName, collectorNumber: collectorNumber || null, pitchColor: pitchColor || null },
        };
      }

      const formattedPrintings = printings.map((p: any) => ({
        printingId: p.id || p._id || p.printingId,
        printingCardId: p.printingCardId || p.printing_card_id,
        name: p.name || p.display_name,
        set: p.set,
        edition: p.edition ? (EDITION_DISPLAY[p.edition] || p.edition) : undefined,
        foiling: p.foiling ? (FOILING_DISPLAY[p.foiling] || p.foiling) : undefined,
        rarity: p.rarity,
        pitch: p.pitch ?? null,
        pitchColor: p.pitch === 1 ? 'red' : p.pitch === 2 ? 'yellow' : p.pitch === 3 ? 'blue' : null,
        tcg_market: p.tcg_market ?? null,
        tcg_low: p.tcg_low ?? null,
        image_url: p.image_url ?? null,
      }));

      return {
        success: true,
        scanned: {
          cardName,
          collectorNumber: collectorNumber || null,
          pitchColor: pitchColor || null,
          foiling: foiling || null,
          edition: edition || null,
        },
        printings: formattedPrintings,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error during printing search',
        scanned: { cardName, collectorNumber: collectorNumber || null },
      };
    }
  },
};

export default scanPrintingTool;
