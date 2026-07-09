import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { canUseVolzar } from '@/lib/ai/volzar-access';
import { syncSupporterTierIfStale } from '@/lib/metafy/sync-tier';
import { VolzarChat } from './VolzarChat';
import { AccessGate } from './AccessGate';
import { DEFAULT_OPT_STATE, paramsToUiState, uiStateToParams, type OptUiState } from '@/lib/search/opt-url-state';
import { describeOptState, optStateToChips } from '@/lib/search/opt-state-describe';

export const dynamic = 'force-dynamic';

// Hosted AI tier: server-side agent loop over the lite MCP toolset, streamed to
// the browser. Access = superadmins + paid Metafy supporters, gated through the
// single source of truth (canUseVolzar), read fresh from the DB.
//
// On open we lazily re-verify the supporter's Metafy membership (throttled by a
// TTL): a lapsed/cancelled subscriber is downgraded here and then bounced to the
// home page by the gate below — so access reflects their CURRENT subscription,
// not just what it was at link time.
export default async function VolzarPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const user = session?.user;

  // Signed out → sign-in with a way back here (a shared /volzar link should
  // survive the round-trip). No access → an explanatory gate, NOT a silent
  // bounce: lapsed supporters get downgraded by the re-verify below and need
  // to see why the page "stopped working".
  if (!user?.id) {
    redirect('/auth/login?callbackUrl=%2Fvolzar');
  }

  await syncSupporterTierIfStale(user.id);

  const access = await userService.getVolzarAccess(user.id);
  if (!access.success || !canUseVolzar(access.data)) {
    return <AccessGate />;
  }

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

  const isSuperAdmin = !!access.data?.isSuperAdmin;
  const mockMode = !process.env.OPENROUTER_API_KEY;
  // Ordered cheapest → most expensive ($/M input); default (models[0]) is the
  // cheapest paid model. The free tier is intentionally omitted — it's
  // rate-limited upstream and 429s the first message. 'mock' last (offline dev).
  const models = mockMode
    ? ['mock']
    : [
        'openai/gpt-oss-120b',            // $0.03/M in — default
        'openai/gpt-5-nano',              // $0.05/M in
        'google/gemini-2.5-flash-lite',   // $0.10/M in
        'anthropic/claude-haiku-4.5',     // $1/M in
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
