import { auth } from '@/auth';
import { userService } from '@/lib/services';
import { syncSupporterTierIfStale } from '@/lib/metafy/sync-tier';
import { VolzarChat } from './VolzarChat';
import { AccessGate } from './AccessGate';
import { DEFAULT_OPT_STATE, paramsToUiState, uiStateToParams, type OptUiState } from '@/lib/search/opt-url-state';
import { describeOptState, optStateToChips } from '@/lib/search/opt-state-describe';

export const dynamic = 'force-dynamic';

// Hosted AI: server-side agent loop over the lite MCP toolset, streamed to
// the browser. Standard for every signed-in user (2026-07); usage limits are
// enforced by the API route (lib/ai/tiers.ts). The Metafy tier re-verify
// stays (TTL-throttled) — tier no longer gates access, but keeping the flag
// fresh serves every other supporter surface.
export default async function VolzarPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const user = session?.user;

  // Signed out → the gate with a sign-in CTA (callbackUrl brings them back
  // here), NOT an instant redirect: link crawlers (Discord/Twitter) are always
  // anonymous, and a 307 would hide this route's OG tags behind the login
  // page's.
  if (!user?.id) {
    return <AccessGate />;
  }

  await syncSupporterTierIfStale(user.id);

  // Flags feed only isSuperAdmin (model picker) now — a failed read degrades
  // to a standard user instead of blocking the page.
  const access = await userService.getVolzarAccess(user.id);

  // Bridge B: /opt hands its current search off via its own URL params plus
  // from=opt & total=N. The context string rides the pendingContext queue
  // (same mechanism as quick actions); the data card makes it visible.
  const sp = await searchParams;
  let initialContext: string[] | undefined;
  let initialData: { title: string; lines: string[] } | undefined;
  if (sp.from === 'opt') {
    const params = new URLSearchParams(
      Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
    const optState: OptUiState = { ...DEFAULT_OPT_STATE, ...paramsToUiState(params) };
    const qs = uiStateToParams(optState).toString();
    const optUrl = qs ? `/opt?${qs}` : '/opt';
    const total = Number(sp.total);
    const hasTotal = Number.isFinite(total) && total >= 0;
    initialContext = [describeOptState(optState, { optUrl, ...(hasTotal ? { total } : {}) })];
    const q = optState.query.trim();
    initialData = {
      title: 'Current /opt search',
      lines: [
        ...(q ? [`Query: "${q}"${optState.searchMode === 'text' ? ' (rule text)' : ''}`] : []),
        ...optStateToChips(optState).map(c => c.label),
        ...(hasTotal ? [`${total.toLocaleString()} results`] : []),
      ],
    };
  }

  const isSuperAdmin = access.success && !!access.data?.isSuperAdmin;
  const mockMode = !process.env.OPENROUTER_API_KEY;
  // Ordered cheapest → most expensive ($/M input); default (models[0]) is the
  // cheapest paid model. The free tier is intentionally omitted — it's
  // rate-limited upstream and 429s the first message. 'mock' last (offline dev).
  // TEMP: tencent/hy3:free added for local bake-off testing (free on OpenRouter
  // until 2026-07-21) — revert before deploying if not adopted.
  const models = mockMode
    ? ['mock']
    : [
        'openai/gpt-oss-120b',            // $0.03/M in — default
        'openai/gpt-5-nano',              // $0.05/M in
        'google/gemini-2.5-flash-lite',   // $0.10/M in
        'anthropic/claude-haiku-4.5',     // $1/M in
        'tencent/hy3:free',               // $0/M in — free until 2026-07-21, TEMP
        'mock',
      ];

  return (
    // Full-bleed app shell: the chat owns the viewport below the navbar (like a
    // dedicated chat app) instead of floating as a card in a centered gutter.
    // Height reserves navbar (4rem + 1px border = 65px) + the legal footer,
    // which wraps to TWO lines inside its max-w-5xl (≈47px) — so desktop chrome
    // is ~112.3px. Reserving less (the old 6.75rem) left the page 4px taller
    // than the viewport → a permanent window scrollbar on OSes with
    // non-overlay scrollbars ("4 scrollbars" report). Mobile reserves more:
    // bottom tab bar (~3.5rem) + the footer wrapping past two lines at narrow
    // widths — 10rem measured 39px short at 390×844 (e2e/volzar-ux-fixes
    // pins the no-overflow invariant), hence 12.5rem.
    <div className="mx-auto flex h-[calc(100dvh-12.5rem)] min-h-[24rem] w-full max-w-[1800px] flex-col px-2 pb-1 pt-2 sm:h-[calc(100dvh-7.125rem)] sm:px-4">
      <VolzarChat
        username={user.name || 'collector'}
        userId={user.id}
        mockMode={mockMode}
        models={models}
        isSuperAdmin={isSuperAdmin}
        initialContext={initialContext}
        initialData={initialData}
      />
    </div>
  );
}
