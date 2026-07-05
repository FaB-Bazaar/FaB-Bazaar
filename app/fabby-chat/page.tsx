import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { canUseFabbyChat } from '@/lib/ai/fabby-chat-access';
import { syncSupporterTierIfStale } from '@/lib/metafy/sync-tier';
import { FabbyChatClient } from './FabbyChatClient';
import { DEFAULT_OPT_STATE, paramsToUiState, uiStateToParams, type OptUiState } from '@/lib/search/opt-url-state';
import { describeOptState, optStateToChips } from '@/lib/search/opt-state-describe';

export const dynamic = 'force-dynamic';

// Hosted AI tier: server-side agent loop over the lite MCP toolset, streamed to
// the browser. Access = superadmins + paid Metafy supporters, gated through the
// single source of truth (canUseFabbyChat), read fresh from the DB.
//
// On open we lazily re-verify the supporter's Metafy membership (throttled by a
// TTL): a lapsed/cancelled subscriber is downgraded here and then bounced to the
// home page by the gate below — so access reflects their CURRENT subscription,
// not just what it was at link time.
export default async function FabbyChatAdminPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect('/');
  }

  await syncSupporterTierIfStale(user.id);

  const access = await userService.getFabbyChatAccess(user.id);
  if (!access.success || !canUseFabbyChat(access.data)) {
    redirect('/');
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
    <div className="max-w-[1400px] mx-auto px-3 sm:px-4 md:px-8 py-2 sm:py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 mb-2 sm:mb-3">
        <h1 className="text-lg sm:text-2xl font-bold">Fabby Chat (prototype)</h1>
        {/* Prototype note is desktop-only — on mobile every row costs chat height */}
        <p className="hidden sm:block text-muted-foreground text-sm">
          Hosted agent loop over the lite MCP toolset — superadmin preview.
        </p>
      </div>
      <FabbyChatClient
        username={user.name || 'collector'}
        userId={user.id}
        mockMode={mockMode}
        models={models}
        initialContext={initialContext}
        initialData={initialData}
      />
    </div>
  );
}
