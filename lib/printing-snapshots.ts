// lib/printing-snapshots.ts
// NOTE: This file now uses the service layer - no direct MongoDB access.
// All functions delegate to printingsService and tradeService.

import { printingsService, tradeService } from '@/lib/services';

/** Object with toString() method - accepts ObjectId, string, or any ID type */
type StringableId = string | { toString(): string };

/** Helper to convert any ID type to string */
const toStr = (id: StringableId): string => (typeof id === 'string' ? id : id.toString());

/**
 * Capture printing snapshots for all cards in a trade
 * This preserves historical pricing and card details at the time of trade completion
 *
 * @param trade - Trade object with _id, initiatorWants, and targetWants
 */
export async function capturePrintingSnapshots(trade: {
  _id: StringableId;
  initiatorWants?: Array<{ printingId?: string; inventoryId?: StringableId }>;
  targetWants?: Array<{ printingId?: string; inventoryId?: StringableId }>;
}) {
  try {
    const tradeId = toStr(trade._id);
    console.log(`[Printing Snapshots] Capturing snapshots for trade ${tradeId}`);

    // Collect all unique printingIds from both initiatorWants and targetWants
    const printingIds = new Set<string>();

    const wantsArrays = [trade.initiatorWants, trade.targetWants];
    for (const wants of wantsArrays) {
      if (wants && Array.isArray(wants)) {
        wants.forEach((want) => {
          if (want.printingId) {
            printingIds.add(want.printingId);
          } else {
            // Add a warning for missing printingIds
            console.warn(
              `[Printing Snapshots] Missing printingId for inventoryId: ${want.inventoryId ? toStr(want.inventoryId) : 'unknown'} in trade ${tradeId}`
            );
          }
        });
      }
    }

    if (printingIds.size === 0) {
      console.warn(
        `[Printing Snapshots] No printingIds found for trade ${tradeId}. Skipping snapshot capture.`
      );
      return; // Exit gracefully
    }

    // Fetch all relevant printing documents using service layer
    const printingsResult = await printingsService.getPrintingsByIds(Array.from(printingIds));

    if (!printingsResult.success) {
      console.error(`[Printing Snapshots] Failed to fetch printings: ${printingsResult.error}`);
      return;
    }

    const printings = printingsResult.data.printings;
    console.log(
      `[Printing Snapshots] Found ${printings.length} printings for ${printingIds.size} unique IDs`
    );

    // Build snapshot object with essential fields
    const snapshots: Record<string, any> = {};
    const printingsMap = new Map(printings.map((p) => [p.printing_id, p]));

    for (const printingId of printingIds) {
      const printing = printingsMap.get(printingId);
      if (printing) {
        snapshots[printing.printing_id] = {
          printingId: printing.printing_id,
          name: printing.name,
          display_name: (printing as any).display_name, // May exist in DB but not in DTO
          set: printing.set,
          edition: printing.edition,
          foiling: printing.foiling,
          rarity: printing.rarity,
          image_url: printing.image_url,
          tcg_low: printing.tcg_low,
          tcg_mid: printing.tcg_mid,
          tcg_high: printing.tcg_high,
          tcg_market: printing.tcg_market,
          price_updated_at: printing.price_updated_at,
          card_unique_id: printing.card_unique_id,
          collector_number: (printing as any).collector_number,
          tcgplayer_url: printing.tcgplayer_url,
          snapshotCapturedAt: new Date(),
        };
      } else {
        console.warn(
          `[Printing Snapshots] Printing with ID ${printingId} not found in database for trade ${tradeId}`
        );
      }
    }

    // Save snapshots using trade service
    const saveResult = await tradeService.savePrintingSnapshots(tradeId, snapshots);

    if (!saveResult.success) {
      console.error(`[Printing Snapshots] Failed to save snapshots: ${saveResult.error}`);
      return;
    }

    console.log(
      `[Printing Snapshots] Successfully captured ${Object.keys(snapshots).length} snapshots for trade ${tradeId}`
    );
  } catch (error) {
    console.error(
      `[Printing Snapshots] Error capturing snapshots for trade ${trade._id}:`,
      error
    );
    // Do not throw, as we don't want to fail the entire trade completion process if snapshots fail.
  }
}
