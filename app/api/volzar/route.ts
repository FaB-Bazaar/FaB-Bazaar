// Hosted Volzar chat — standard for every signed-in user.
//
// POST: gates (session → rate limit → body validation → daily quotas), then
// runs the agent loop (lib/ai) and streams AgentEvents as SSE data-frames. The
// loop executes tools through our own MCP endpoint (lib/ai/mcp-bridge), so every
// tool call is usage-captured in mcp_usage_daily with client='fabbazaar-hosted'.
//
// Pre-stream failures return plain JSON with real status codes; the SSE stream
// only starts once every gate has passed.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userService, oauthFlowService, llmUsageService } from '@/lib/services';
import { rateLimit } from '@/lib/rate-limit';
import { runAgentLoop } from '@/lib/ai/agent-loop';
import { createLlm, withFallback } from '@/lib/ai/openrouter';
import { fetchLiteTools, fetchToolsByName, executeTool } from '@/lib/ai/mcp-bridge';
import { waitForConfirmation } from '@/lib/ai/confirmations';
import { dailyLimitFor, globalDailyLimit, resolveChatModel } from '@/lib/ai/tiers';
import { assembleMessages } from './prompt';
import { languageForCountry, SUGGESTION_LANGUAGE_NAMES } from '@/lib/ai/volzar-suggestions';
import type { AgentEvent, ChatMessage } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

const RATE_LIMIT = { limit: 30, windowMs: 3_600_000 }; // 30 chat requests/hour/user

// Destructive tools pause mid-stream for an explicit user decision (the
// confirm endpoint next door resolves it). Anything that deletes user data
// belongs here.
const CONFIRM_REQUIRED_TOOLS = new Set(['remove_from_binder', 'remove_from_wants', 'remove_cards_from_deck']);

// Deck + game-results tools the hosted chat pulls in by name on top of the lite
// set (the shared lite advertisement stays lean for LM Studio / local hosts).
// Mix of writes (create/edit decks) and reads (game-result analysis). See
// lib/ai/mcp-bridge.fetchToolsByName.
const HOSTED_EXTRA_TOOLS: ReadonlySet<string> = new Set([
  'create_deck',
  'add_cards_to_deck',
  'remove_cards_from_deck',
  'update_deck',
  'list_results',
  'get_results',
  // Curated kit pools (public reads) — ground deck-building recommendations
  // in the curator's real picks instead of hallucinated card names.
  'list_curated_lists',
  'get_curated_list',
  // Featured tournament decks ("what are the decks to beat for X?") — public
  // read; without it the model can't answer meta questions in free text.
  'get_decks_to_beat',
  // SQL-backed aggregates: one deterministic call each for "which Decks to
  // Beat could I build from my collection?" and "how are my decks
  // performing?" — no decklist+binder inference in the model.
  'compare_collection_to_decks_to_beat',
  'get_deck_performance',
  // Ban/legality registry — public read (GET /api/banned-cards has no auth
  // gate; the superadmin check guards writes only). Answers "is X banned?".
  'list_card_restrictions',
]);
const MAX_BODY_BYTES = 200_000;
const VALID_ROLES = new Set(['system', 'user', 'assistant', 'tool']);
// Default model — what non-superadmins always run (resolveChatModel pins them
// here regardless of what the client sends; only superadmins can pick another
// model). tencent/hy3:free stays in the allowlist for superadmin bake-offs
// (free on OpenRouter until 2026-07-21) but is no longer the default — free
// tiers have 429'd on the first message under load; requests that do land on
// it still fall back (see createLlmWithFallback below).
const DEFAULT_PAID_MODEL = 'openai/gpt-oss-120b'; // $0.03/M in
const FALLBACK_MODEL = 'openai/gpt-oss-120b';

function modelAllowlist(): string[] {
  return [
    'mock',
    'tencent/hy3:free',         // $0/M in — superadmin bake-offs only (free until 2026-07-21)
    'openai/gpt-oss-120b',      // $0.03/M in — fallback / bake-off anchor
    'openai/gpt-5-nano',        // $0.05/M in
    'google/gemini-2.5-flash-lite', // $0.10/M in
    'anthropic/claude-haiku-4.5',   // $1/M in — quality anchor for bake-offs
    process.env.OPENROUTER_MODEL,
  ].filter((m): m is string => Boolean(m));
}

function validateBody(raw: unknown): { ok: true; messages: ChatMessage[]; model: string } | { ok: false; error: string } {
  const body = raw as { model?: unknown; messages?: unknown };
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, error: 'messages must be a non-empty array' };
  }
  for (const message of body.messages) {
    if (!message || typeof message !== 'object' || !VALID_ROLES.has((message as any).role)) {
      return { ok: false, error: 'invalid message role' };
    }
  }
  const last = body.messages[body.messages.length - 1] as { role?: string };
  if (last.role !== 'user') {
    return { ok: false, error: 'last message must be from the user' };
  }
  const model = typeof body.model === 'string' ? body.model : 'mock';
  if (!modelAllowlist().includes(model)) {
    return { ok: false, error: `model must be one of: ${modelAllowlist().join(', ')}` };
  }
  return { ok: true, messages: body.messages as ChatMessage[], model };
}

export async function POST(req: Request) {
  // 1–2. Session. Volzar is standard for all signed-in users — the flags
  // read only feeds isSuperAdmin (model picking + quota exemption), so a
  // failed read degrades to a capped standard user instead of blocking.
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const access = await userService.getVolzarAccess(user.id);
  if (!access.success) console.error('[volzar] access-flags read failed:', access.error);
  const isSuperAdmin = access.success && !!access.data?.isSuperAdmin;

  // 3. Rate limit
  const limitResult = await rateLimit({
    key: `volzar:${user.id}`,
    limit: RATE_LIMIT.limit,
    window: RATE_LIMIT.windowMs,
  });
  if (!limitResult.success) {
    const retryAfterSec = limitResult.resetTime
      ? Math.max(1, Math.ceil((limitResult.resetTime - Date.now()) / 1000))
      : 60;
    return NextResponse.json({ error: 'Rate limit exceeded' }, {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(RATE_LIMIT.limit),
        'X-RateLimit-Remaining': String(limitResult.remaining),
        'X-RateLimit-Reset': limitResult.resetTime ? String(limitResult.resetTime) : '',
        'Retry-After': String(retryAfterSec),
      },
    });
  }

  // 4. Body validation
  const rawText = await req.text();
  if (rawText.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Conversation too large — start a new chat' }, { status: 400 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const validated = validateBody(parsed);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  // Superadmins pick their model; everyone else is pinned to the default
  // (the UI hides the picker — this is the server-side enforcement). Keyless
  // deployments run mock regardless of what the client asked for.
  const model = resolveChatModel({
    hasApiKey: !!process.env.OPENROUTER_API_KEY,
    isSuperAdmin,
    requested: validated.model,
    defaultModel: DEFAULT_PAID_MODEL,
  });

  // 4.5. Daily quotas (reset midnight UTC): a uniform per-user budget plus a
  // site-wide backstop that bounds worst-case spend. Checked after validation
  // so malformed requests don't cost DB reads; recorded on the done event
  // below. Fails open on read errors — availability over enforcement (per-day
  // cost is bounded and the reads are loudly logged). Superadmins are exempt
  // (operator accounts; whoever diagnoses a tripped backstop must not be
  // locked out by it).
  if (!isSuperAdmin) {
    // Standard budget for everyone; a manual volzar_access grant
    // (/admin/user-access) boosts it — the escalation path the message names.
    const dailyLimit = dailyLimitFor(access.success ? access.data : undefined);
    const [usedToday, usedGlobally] = await Promise.all([
      llmUsageService.getTodayRequestCount(user.id),
      llmUsageService.getTodayGlobalRequestCount(),
    ]);
    if (usedToday.success && usedToday.data >= dailyLimit) {
      return NextResponse.json(
        { error: `Daily message limit reached (${dailyLimit}/day) — resets at midnight UTC. Contact mistercakes on the Discord server to increase your limit.` },
        { status: 429 },
      );
    }
    if (usedGlobally.success && usedGlobally.data >= globalDailyLimit()) {
      return NextResponse.json(
        { error: 'Volzar is at capacity today — try again after midnight UTC' },
        { status: 429 },
      );
    }
    if (!usedToday.success) console.error('[volzar] quota read failed (failing open):', usedToday.error);
    if (!usedGlobally.success) console.error('[volzar] global quota read failed (failing open):', usedGlobally.error);
  }

  // 5. Mint a stateless JWT for the internal MCP calls. This (not
  // generateBearerToken's opaque tokens) is what the usage wrapper can
  // attribute via its JWT `sub` claim.
  const bearer = oauthFlowService.generateAccessToken(user.id, 'fabbazaar-hosted', 'read write');

  // 6. Tool discovery (pre-stream — failures are plain JSON). The chat runs the
  // lite collector set PLUS the deck-write tools, pulled in by name so the
  // shared lite advertisement stays lean for other clients.
  let tools: Awaited<ReturnType<typeof fetchLiteTools>>['tools'];
  let validNames: Set<string>;
  try {
    const [lite, deckWrite] = await Promise.all([
      fetchLiteTools(bearer),
      fetchToolsByName(bearer, HOSTED_EXTRA_TOOLS),
    ]);
    tools = [...lite.tools, ...deckWrite.tools];
    validNames = new Set([...lite.validNames, ...deckWrite.validNames]);
  } catch (error) {
    console.error('[volzar] tool discovery failed:', error);
    return NextResponse.json({ error: 'Tool discovery failed — try again shortly' }, { status: 502 });
  }

  // 7. Messages: always our system prompt; client-sent system messages are dropped
  // Reply-language preference: country-set users get answers in their
  // language (best-effort — a failed read just means English).
  const basicInfo = await userService.getBasicInfo(user.id).catch(() => null);
  const replyLanguage = SUGGESTION_LANGUAGE_NAMES[
    languageForCountry(basicInfo?.success ? basicInfo.data?.countryCode : undefined)
  ];
  const messages = assembleMessages(validated.messages, user.name || 'a collector', replyLanguage);

  // Non-superadmins pinned to the free trial model get an automatic fallback
  // to FALLBACK_MODEL if it errors before streaming anything (see
  // withFallback). Superadmins picking it manually via the bake-off picker
  // see its raw, unmodified behavior — that's the point of testing it.
  const useFallback = model === 'tencent/hy3:free' && !isSuperAdmin;
  const { llm, getActualModel } = useFallback
    ? (() => {
        const { llm, usedFallback } = withFallback({
          primary: createLlm({ model }),
          fallback: createLlm({ model: FALLBACK_MODEL }),
        });
        return { llm, getActualModel: () => (usedFallback() ? FALLBACK_MODEL : model) };
      })()
    : { llm: createLlm({ model }), getActualModel: () => model };

  // 8. SSE stream — one JSON AgentEvent per data frame
  const abortController = new AbortController();
  req.signal?.addEventListener?.('abort', () => abortController.abort());
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: AgentEvent) => {
        if (event.type === 'done') {
          // Meter the turn (fire-and-forget — capture must never affect the
          // stream). One request per turn; token counts are provider-reported
          // and already summed across loop iterations (0 when omitted).
          void llmUsageService
            .recordTurn({
              userId: user.id!,
              model: getActualModel(),
              promptTokens: event.usage?.prompt_tokens ?? 0,
              completionTokens: event.usage?.completion_tokens ?? 0,
            })
            .then((r) => {
              if (!r.success) console.error('[volzar] usage record failed:', r.error);
            })
            .catch((error) => console.error('[volzar] usage record failed:', error));
        }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller already closed (client gone) — loop abort handles the rest
        }
      };

      runAgentLoop({
        messages,
        tools,
        llm,
        executeTool: ({ name, args, signal }) => executeTool({ name, args, bearer, validNames, signal }),
        confirmation: {
          required: (name) => CONFIRM_REQUIRED_TOOLS.has(name),
          // Keyed to the session user: only their own confirm POST can release it.
          wait: ({ id, signal }) => waitForConfirmation({ userId: user.id!, id, signal }),
        },
        signal: abortController.signal,
        onEvent: send,
      })
        .catch((error) => {
          send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
        })
        .finally(() => {
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
