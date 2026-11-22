/**
 * Bridge B — the /opt → Volzar handoff, as pure functions (the page supplies
 * the result names; see app/volzar/page.tsx).
 *
 * /opt links to /volzar with its own URL params plus from=opt & total=N. The
 * chat receives (a) a one-line description of the search and (b) the first
 * result NAMES, so a follow-up like "which of these fit my deck?" is answered
 * from context instead of re-running the search through a tool.
 */

import { DEFAULT_OPT_STATE, paramsToUiState, uiStateToParams, type OptUiState } from './opt-url-state';
import { describeOptState, optStateToChips } from './opt-state-describe';

/** How many result names ride along (the first page is 60; names are short). */
export const OPT_HANDOFF_RESULT_LIMIT = 25;

export interface OptHandoff {
  /** Queued as one-shot context for the first chat message. */
  context: string[];
  /** The visible data card announcing the handoff in the thread. */
  data: { title: string; lines: string[] };
  /** The /opt query string of this search (no from/total) — what to run to load the results. */
  optQuery: string;
}

/** "Name (pN, type)" per distinct card + pitch, in result order, capped. */
export function summarizeHandoffResults(
  rows: Array<{ display_name?: string | null; name?: string | null; pitch?: number | null; type_text_display?: string | null }>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const name = r.display_name || r.name;
    if (!name) continue;
    const key = `${name}|${r.pitch ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const meta = [r.pitch != null ? `p${r.pitch}` : '', r.type_text_display ?? ''].filter(Boolean).join(', ');
    out.push(meta ? `${name} (${meta})` : name);
    if (out.length >= OPT_HANDOFF_RESULT_LIMIT) break;
  }
  return out;
}

export function buildOptHandoff(
  sp: Record<string, string | string[] | undefined>,
  resultNames?: string[],
): OptHandoff | null {
  if (sp.from !== 'opt') return null;
  const params = new URLSearchParams(
    Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
  const optState: OptUiState = { ...DEFAULT_OPT_STATE, ...paramsToUiState(params) };
  const optQuery = uiStateToParams(optState).toString();
  const optUrl = optQuery ? `/opt?${optQuery}` : '/opt';
  const total = Number(sp.total);
  const hasTotal = typeof sp.total === 'string' && sp.total.trim() !== '' && Number.isFinite(total) && total >= 0;
  const q = optState.query.trim();

  const context = [describeOptState(optState, { optUrl, ...(hasTotal ? { total } : {}) })];
  const lines = [
    ...(q ? [`Query: "${q}"${optState.searchMode === 'text' ? ' (rule text)' : ''}`] : []),
    ...optStateToChips(optState).map((c) => c.label),
    ...(hasTotal ? [`${total.toLocaleString()} results`] : []),
  ];

  const names = resultNames ?? [];
  if (names.length > 0) {
    const coversAll = hasTotal && total <= names.length;
    const span = coversAll ? `all ${names.length}` : `first ${names.length}${hasTotal ? ` of ${total}` : ''}`;
    context.push(`Results of that search the user is looking at (${span}, in their sort order): ${names.join('; ')}`);
    lines.push(coversAll ? `Volzar can see all ${names.length} results` : `Volzar can see the first ${names.length} results`);
  }

  return { context, data: { title: 'Current /opt search', lines }, optQuery };
}
