// app/api/collection/fabrary-import/route.ts
// Step 2: Accept pre-resolved inventory/wants items and import them into a new unlisted binder.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { binderService, wantsService } from '@/lib/services';
import { generateUniqueBinderSlug } from '@/lib/utils';
import type {
  FabraryInventoryItem,
  FabraryWantsItem,
  FabraryUnresolvedRow,
  FabraryImportResult,
} from '@/lib/utils/fabrary-csv';

interface ImportRequestBody {
  inventory: FabraryInventoryItem[]
  wants: FabraryWantsItem[]
  unresolved?: FabraryUnresolvedRow[]
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  const userId = authResult.userId;

  let body: ImportRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { inventory = [], wants = [], unresolved = [] } = body;

  if (inventory.length === 0 && wants.length === 0) {
    return NextResponse.json({ error: 'No items to import.' }, { status: 400 });
  }

  // Create the import binder with unlisted visibility
  // Binders have a unique constraint on (user_id, name), so uniquify both name and slug.
  const existingBindersResult = await binderService.listUserBindersSummary(userId);
  const existingSlugs = existingBindersResult.success
    ? existingBindersResult.data.map(b => b.slug || b.discordExternalId).filter(Boolean) as string[]
    : [];
  const existingNames = existingBindersResult.success
    ? existingBindersResult.data.map(b => b.name)
    : [];

  const ts = new Date().toISOString().slice(0, 10); // e.g. "2026-04-15"
  const slug = generateUniqueBinderSlug(`csv-import-${ts}`, existingSlugs);

  let binderName = `CSV Import ${ts}`;
  const nameSet = new Set(existingNames.map(n => n.toLowerCase()));
  if (nameSet.has(binderName.toLowerCase())) {
    let counter = 2;
    while (nameSet.has(`${binderName} ${counter}`.toLowerCase())) counter++;
    binderName = `${binderName} ${counter}`;
  }

  const createResult = await binderService.createBinder(userId, {
    name: binderName,
    slug,
    visibility: {
      level: 'unlisted',
      allowInSearch: false,
      allowInMatching: false,
      allowWhoHas: false,
      allowWebhooks: false,
      allowDiscordCommands: false,
      allowApiExport: false,
    },
  });

  if (!createResult.success) {
    return NextResponse.json({ error: `Failed to create import binder: ${createResult.error}` }, { status: 500 });
  }

  const binderId = createResult.data._id;
  const finalBinderName = createResult.data.name;

  // Bulk-add inventory items
  let inventoryAdded = 0;
  let inventoryFailed = 0;
  if (inventory.length > 0) {
    const addResult = await binderService.addCardsToBinder(
      binderId,
      userId,
      inventory.map(r => ({
        printingId: r.printingId,
        quantity: r.quantity,
        condition: 'NM',
        language: 'EN',
        forTrade: r.forTrade,
      }))
    );
    if (addResult.success) {
      inventoryAdded = addResult.data.summary.added + addResult.data.summary.updated;
      inventoryFailed = addResult.data.summary.failed;
    } else {
      inventoryFailed = inventory.length;
    }
  }

  // Bulk-add wants items
  let wantsAdded = 0;
  let wantsFailed = 0;
  if (wants.length > 0) {
    const wantsResult = await wantsService.bulkAddWants(
      userId,
      wants.map(r => ({ printingId: r.printingId, quantity: r.quantity }))
    );
    if (wantsResult.success) {
      wantsAdded = wantsResult.data.summary.added + wantsResult.data.summary.updated;
      wantsFailed = wantsResult.data.summary.failed;
    } else {
      wantsFailed = wants.length;
    }
  }

  const result: FabraryImportResult = {
    binderId,
    binderName: finalBinderName,
    inventoryAdded,
    inventoryFailed,
    wantsAdded,
    wantsFailed,
    unresolved,
  };

  return NextResponse.json({ success: true, data: result });
}
