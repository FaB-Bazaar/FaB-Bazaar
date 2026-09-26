import { NextRequest, NextResponse } from 'next/server';
import { setsService, printingsService } from '@/lib/services';
import { runCachedSearch } from '@/lib/search/cached-search';
import { getRedisClient } from '@/lib/redis';
import { buildWarmTargets } from '@/lib/search/warm-targets';
import { optQueryToSearchRequest } from '@/lib/search/opt-search-request';

// Spread over ~2 minutes by default so the warm-up is a trickle on the shared
// Postgres pool, not a burst. Capped so a bad value can't park the request.
const DEFAULT_DURATION_MS = 120_000;
const MAX_DURATION_MS = 600_000;

/**
 * POST /api/cron/warm-search-cache — refill the /opt search cache after the
 * nightly price update (the price change invalidates every cached entry).
 * Called by the pipeline's last step with the CRON_SECRET bearer. Runs the
 * common /opt searches (lib/search/warm-targets.ts) through the same cached
 * search the public route uses, with the exact body the page sends.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Nothing to warm into: with Redis down every search would also wait out a
  // connection retry per cache read/write — bail before running any.
  const redis = getRedisClient();
  const redisUp = redis ? await redis.ping().then(() => true, () => false) : false;
  if (!redisUp) {
    return NextResponse.json({ error: 'Search cache (Redis) unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const requested = Number(body?.durationMs);
  const durationMs = Number.isFinite(requested) && requested >= 0
    ? Math.min(requested, MAX_DURATION_MS)
    : DEFAULT_DURATION_MS;

  // A failed lookup only drops the set-based targets; classes/talents still warm.
  const [setsResult, gemResult] = await Promise.all([
    setsService.listSets(),
    printingsService.getSetGroups('gem'),
  ]);
  const targets = buildWarmTargets({
    sets: setsResult.success ? setsResult.data : [],
    gemPacks: gemResult.success ? gemResult.data : [],
    today: new Date().toISOString().slice(0, 10),
  });

  const spacingMs = targets.length > 1 ? durationMs / targets.length : 0;
  const started = Date.now();
  let warmed = 0;
  let alreadyCached = 0;
  const failed: Array<{ query: string; error: string }> = [];

  for (let i = 0; i < targets.length; i++) {
    const wait = started + i * spacingMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    const query = targets[i];
    const req = optQueryToSearchRequest(query);
    if (!req) { failed.push({ query, error: 'no filters' }); continue; }
    try {
      const result = await runCachedSearch(req.filters, req.options);
      if (!result.success) failed.push({ query, error: result.error });
      else if (result.data.total === 0) failed.push({ query, error: 'no results' });
      else if (result.cached) alreadyCached++;
      else if (result.stored) warmed++;
      else failed.push({ query, error: 'not stored (cache unavailable)' });
    } catch (error) {
      failed.push({ query, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const elapsedMs = Date.now() - started;
  console.log(`[warm-search-cache] ${warmed} warmed, ${alreadyCached} already cached, ${failed.length} failed of ${targets.length} in ${elapsedMs}ms`);
  return NextResponse.json({
    success: true,
    data: { targets: targets.length, warmed, alreadyCached, failed, elapsedMs },
  });
}
