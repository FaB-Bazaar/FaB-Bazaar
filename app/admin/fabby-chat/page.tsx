import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { FabbyChatClient } from './FabbyChatClient';
import { DEFAULT_OPT_STATE, paramsToUiState, uiStateToParams, type OptUiState } from '@/lib/search/opt-url-state';
import { describeOptState, optStateToChips } from '@/lib/search/opt-state-describe';

export const dynamic = 'force-dynamic';

// Superadmin-only prototype of the hosted AI tier: server-side agent loop
// over the lite MCP toolset, streamed to the browser. Gate pattern copied
// from app/admin/user-access/page.tsx.
export default async function FabbyChatAdminPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect('/');
  }

  const roleCheck = await userService.hasRole(user.id, 'isSuperAdmin');
  if (!roleCheck.success || !roleCheck.data) {
    redirect('/admin/articles');
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
  // Ordered cheapest → most expensive ($/M input); default = cheapest (free
  // tier — rate-limited but $0). 'mock' last as the offline dev script.
  const models = mockMode
    ? ['mock']
    : [
        'openai/gpt-oss-120b:free',       // $0 (rate-limited free tier)
        'openai/gpt-oss-120b',            // $0.03/M in
        'openai/gpt-5-nano',              // $0.05/M in
        'google/gemini-2.5-flash-lite',   // $0.10/M in
        'anthropic/claude-haiku-4.5',     // $1/M in
        'mock',
      ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 mb-3">
        <h1 className="text-2xl font-bold">Fabby Chat (prototype)</h1>
        <p className="text-muted-foreground text-sm">
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
