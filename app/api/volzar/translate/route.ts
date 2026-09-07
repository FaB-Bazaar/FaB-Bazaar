/**
 * POST /api/volzar/translate — the /opt "Volzar" scope.
 *
 * Body { q }: a plain-English card request. Returns { state } — an OptUiState
 * patch (chips + query + scope) the page dispatches, so "blue ninja go again"
 * becomes Pitch: Blue + Ninja + go again chips instead of a name search.
 *
 * One non-streaming LLM call under the vocabulary prompt
 * (lib/search/volzar-translate), then the reply is sanitised against the real
 * vocabulary — nothing the model invents reaches the search. Same gates as
 * the chat route: signed-in session, per-user burst limit, the shared daily
 * quotas (this IS a Volzar message and is metered as one), server-side key.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userService, llmUsageService } from '@/lib/services';
import { rateLimit } from '@/lib/rate-limit';
import { createLlm } from '@/lib/ai/openrouter';
import { DEFAULT_CHAT_MODEL, dailyLimitFor, globalDailyLimit } from '@/lib/ai/tiers';
import { buildTranslateSystemPrompt, parseTranslation, translationToOptState } from '@/lib/search/volzar-translate';

const RATE_LIMIT = { limit: 30, windowMs: 3_600_000 }; // shares the chat's shape: 30/hour/user
const MAX_QUESTION_CHARS = 300;

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'Volzar is not configured on this deployment' }, { status: 503 });
  }

  let body: { q?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const q = typeof body?.q === 'string' ? body.q.trim() : '';
  if (!q) return NextResponse.json({ error: 'q is required' }, { status: 400 });
  if (q.length > MAX_QUESTION_CHARS) return NextResponse.json({ error: `Keep it under ${MAX_QUESTION_CHARS} characters` }, { status: 400 });

  const limitResult = await rateLimit({ key: `volzar:${user.id}`, limit: RATE_LIMIT.limit, window: RATE_LIMIT.windowMs });
  if (!limitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Daily quotas — identical policy to the chat route (superadmins exempt,
  // fails open on read errors).
  const access = await userService.getVolzarAccess(user.id);
  const isSuperAdmin = access.success && !!access.data?.isSuperAdmin;
  if (!isSuperAdmin) {
    const dailyLimit = dailyLimitFor(access.success ? access.data : undefined);
    const [usedToday, usedGlobally] = await Promise.all([
      llmUsageService.getTodayRequestCount(user.id),
      llmUsageService.getTodayGlobalRequestCount(),
    ]);
    if (usedToday.success && usedToday.data >= dailyLimit) {
      return NextResponse.json({ error: `Daily Volzar limit reached (${dailyLimit}/day) — resets at midnight UTC.` }, { status: 429 });
    }
    if (usedGlobally.success && usedGlobally.data >= globalDailyLimit()) {
      return NextResponse.json({ error: 'Volzar is at capacity today — try again after midnight UTC' }, { status: 429 });
    }
  }

  // One completion, no tools: collect the text and the usage frame.
  const model = DEFAULT_CHAT_MODEL;
  const llm = createLlm({ model });
  let reply = '';
  let usage = { prompt_tokens: 0, completion_tokens: 0 };
  try {
    for await (const delta of llm({
      messages: [
        { role: 'system', content: buildTranslateSystemPrompt() },
        { role: 'user', content: q },
      ],
      tools: [],
    })) {
      if (delta.kind === 'text') reply += delta.text;
      else if (delta.kind === 'usage') usage = delta.usage;
    }
  } catch (error) {
    console.error('[volzar/translate] LLM error:', error);
    return NextResponse.json({ error: 'Volzar could not answer right now — try again' }, { status: 502 });
  }

  void llmUsageService
    .recordTurn({ userId: user.id, model, promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens })
    .then((r) => { if (!r.success) console.error('[volzar/translate] usage record failed:', r.error); })
    .catch((error) => console.error('[volzar/translate] usage record failed:', error));

  const filters = parseTranslation(reply);
  if (!filters) {
    return NextResponse.json({ error: 'Volzar could not turn that into a search — try rephrasing' }, { status: 422 });
  }
  return NextResponse.json({ success: true, data: { state: translationToOptState(filters), filters } });
}
