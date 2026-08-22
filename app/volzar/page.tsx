import { auth } from '@/auth';
import { userService } from '@/lib/services';
import { getVolzarSuggestedPrompts, resolveUserLanguage } from '@/lib/ai/volzar-suggestions';
import { DEFAULT_CHAT_MODEL, defaultChatModelFor } from '@/lib/ai/tiers';
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

  // Fire-and-forget: nothing on this page reads the sync result (access only
  // feeds isSuperAdmin, which the sync never changes), and the Metafy fetch
  // has no timeout — awaiting it held the whole page behind an external
  // round-trip. It swallows its own errors, so a dangling rejection can't
  // surface here.
  void syncSupporterTierIfStale(user.id);

  const [access, suggestedPrompts, basicInfo] = await Promise.all([
    // Flags feed only isSuperAdmin (model picker) now — a failed read degrades
    // to a standard user instead of blocking the page.
    userService.getVolzarAccess(user.id),
    // Empty-state launcher prompts, personalized from a snapshot of the user's
    // collection/decks/results (falls back to static defaults on any failure).
    getVolzarSuggestedPrompts(user.id),
    // First-visit language nudge: shown only when the user has given us NO
    // language signal at all — neither an explicit preferred_language (the
    // nudge/profile setting) nor a country_code (the legacy auto mapping).
    // Fully guarded: the logged-in home page must render even if this read
    // throws synchronously (nudge simply doesn't show).
    Promise.resolve()
      .then(() => userService.getBasicInfo(user.id))
      .catch(() => null),
  ]);
  const needsLanguage = !!basicInfo?.success
    && !basicInfo.data?.preferredLanguage
    && !basicInfo.data?.countryCode;
  const language = resolveUserLanguage(basicInfo?.success ? basicInfo.data ?? {} : {});

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
  // models[0] is what the chat sends, and it comes from the same
  // lib/ai/tiers constants the server resolves against: superadmins run the
  // stealth bake-off model, everyone else the cheapest paid one (the server
  // pins non-superadmins there regardless of what's sent). No picker renders
  // for anyone — the rest of the list is the superadmin bake-off allowlist.
  const models = mockMode
    ? ['mock']
    : [
        defaultChatModelFor(isSuperAdmin),
        ...(isSuperAdmin ? [DEFAULT_CHAT_MODEL] : []), // $0.03/M in — what everyone else runs
        'tencent/hy3:free',               // $0/M in — bake-offs (free until 2026-07-21)
        'openai/gpt-5-nano',              // $0.05/M in
        'google/gemini-2.5-flash-lite',   // $0.10/M in
        'anthropic/claude-haiku-4.5',     // $1/M in
        'mock',
      ];

  return (
    // Full-bleed app shell: the chat owns the viewport below the navbar (like a
    // dedicated chat app) instead of floating as a card in a centered gutter.
    // Desktop reserves navbar (4rem + 1px border = 65px) + the legal footer,
    // which wraps to TWO lines inside its max-w-5xl (≈47px) — so desktop chrome
    // is ~112.3px. Reserving less (the old 6.75rem) left the page 4px taller
    // than the viewport → a permanent window scrollbar on OSes with
    // non-overlay scrollbars ("4 scrollbars" report).
    // Mobile reserves ONLY navbar + floating nav clearance (4rem + 1px +
    // 5.5rem + safe-area, matching the root layout spacer): the legal footer
    // is deliberately a soft floor BELOW the fold — the chat fills the screen
    // and scrolling past the thread reveals the footer (chat-app norm; the old
    // 12.5rem reservation left a dead band above the footer, worst on iOS
    // where 100vh ≠ 100dvh). e2e/volzar-ux-fixes pins the invariant.
    <div className="mx-auto flex h-[calc(100dvh-9.5rem-1px-env(safe-area-inset-bottom))] min-h-[24rem] w-full max-w-[1800px] flex-col px-2 pb-1 pt-2 sm:h-[calc(100dvh-7.125rem)] sm:px-4">
      <VolzarChat
        username={user.name || 'collector'}
        userId={user.id}
        mockMode={mockMode}
        models={models}
        isSuperAdmin={isSuperAdmin}
        suggestedPrompts={suggestedPrompts}
        needsLanguage={needsLanguage}
        language={language}
        initialContext={initialContext}
        initialData={initialData}
      />
    </div>
  );
}
