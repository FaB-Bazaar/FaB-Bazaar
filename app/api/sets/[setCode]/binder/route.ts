// app/api/sets/[setCode]/binder/route.ts
// Create a "{username} - {SETCODE}" binder holding 1 copy of each card in the
// set, filtered by the caller's foiling (s/r/c) and edition selection.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { binderService, printingsService } from '@/lib/services';
import { generateUniqueBinderSlug } from '@/lib/utils';
import { buildSetBinderName, dedupeSetPrintings } from '@/lib/binder/set-binder';

const ALLOWED_FOILINGS = ['s', 'r', 'c'] as const;
const ALLOWED_EDITIONS = ['a', 'f', 'u', 'n'] as const;

// Well above the largest set's printing count across 3 foilings + art variants.
const SET_SEARCH_LIMIT = 5000;

interface SetBinderRequestBody {
  foilings?: string[];
  edition?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ setCode: string }> }
) {
  const { setCode } = await params;

  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  const userId = authResult.userId;
  const username = authResult.username;
  if (!userId || !username) {
    return NextResponse.json({ error: 'Could not resolve user.' }, { status: 500 });
  }

  let body: SetBinderRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const foilings = body.foilings;
  if (!Array.isArray(foilings) || foilings.length === 0) {
    return NextResponse.json(
      { error: 'Select at least one foiling (s, r, or c).' },
      { status: 400 }
    );
  }
  const badFoiling = foilings.find(
    f => !ALLOWED_FOILINGS.includes(f as (typeof ALLOWED_FOILINGS)[number])
  );
  if (badFoiling) {
    return NextResponse.json(
      { error: `Invalid foiling code "${badFoiling}". Allowed: s, r, c.` },
      { status: 400 }
    );
  }

  const edition = body.edition;
  if (
    edition !== undefined &&
    !ALLOWED_EDITIONS.includes(edition as (typeof ALLOWED_EDITIONS)[number])
  ) {
    return NextResponse.json(
      { error: `Invalid edition code "${edition}". Allowed: a, f, u, n.` },
      { status: 400 }
    );
  }

  // Binders are unique on (user_id, name) — surface an existing set binder as
  // a conflict the page can prompt about instead of failing on the constraint.
  const binderName = buildSetBinderName(username, setCode);
  const existingResult = await binderService.listUserBindersSummary(userId);
  if (!existingResult.success) {
    return NextResponse.json({ error: existingResult.error }, { status: 500 });
  }
  const existing = existingResult.data.find(
    b => b.name.toLowerCase() === binderName.toLowerCase()
  );
  if (existing) {
    return NextResponse.json(
      {
        error: `A binder for this set already exists: "${existing.name}".`,
        data: { binderId: existing._id, binderName: existing.name, slug: existing.slug },
      },
      { status: 409 }
    );
  }

  const searchResult = await printingsService.searchPrintings(
    {
      sets: [setCode.toUpperCase()],
      foilings,
      ...(edition ? { editions: [edition] } : {}),
      languages: ['en'],
    },
    { limit: SET_SEARCH_LIMIT, sortBy: 'collector_number', sortOrder: 'asc' }
  );
  if (!searchResult.success) {
    return NextResponse.json({ error: searchResult.error }, { status: 500 });
  }

  const items = dedupeSetPrintings(searchResult.data.printings);
  if (items.length === 0) {
    return NextResponse.json(
      { error: 'No printings found for this set with the selected foilings/edition.' },
      { status: 404 }
    );
  }

  const existingSlugs = existingResult.data
    .map(b => b.slug || b.discordExternalId)
    .filter(Boolean) as string[];
  const createResult = await binderService.createBinder(userId, {
    name: binderName,
    slug: generateUniqueBinderSlug(binderName, existingSlugs),
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
    return NextResponse.json(
      { error: `Failed to create binder: ${createResult.error}` },
      { status: 500 }
    );
  }
  const binderId = createResult.data._id;

  const addResult = await binderService.addCardsToBinder(
    binderId,
    userId,
    items.map(p => ({
      printingId: p.printing_id,
      quantity: 1,
      condition: 'NM',
      language: 'EN',
    }))
  );
  if (!addResult.success) {
    return NextResponse.json(
      { error: `Binder created but adding cards failed: ${addResult.error}` },
      { status: 500 }
    );
  }

  const { summary } = addResult.data;
  return NextResponse.json({
    success: true,
    data: {
      binderId,
      binderName: createResult.data.name,
      slug: createResult.data.slug,
      summary: {
        total: summary.total,
        added: summary.added + summary.updated,
        failed: summary.failed,
      },
    },
  });
}
