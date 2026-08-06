// Pure picker for the empty-state "Today's movers" strip: condenses the
// /api/daily payload (grouped by signal, one row per binder) into a short,
// deduped teaser list. Client-safe — types only from the contracts module.
import type {
  DailyMoverDTO,
  MoversInCollectionDTO,
  SignalType,
} from '@/lib/services/contracts/IDailyMoversService';

export interface LandingMover {
  printingId: string;
  displayName: string;
  price: number;
  pctChange: number | null;
  signalType: SignalType;
  imageUrl: string | null;
}

// Round-robin across signals (priority order below) so the teaser shows the
// spread of what moved — top gainer AND top decliner — instead of max copies
// of whichever section happens to be longest.
const SIGNAL_ORDER: Array<keyof Pick<MoversInCollectionDTO, 'gainers' | 'breakouts' | 'steadyRisers' | 'decliners'>> =
  ['gainers', 'breakouts', 'steadyRisers', 'decliners'];

// Same magnitude-scaled formatting rules as /daily (app/daily/page.tsx keeps
// its own private copies — that page is a client module we can't import from).
export function formatMoverPrice(p: number | null | undefined): string {
  if (p == null) return '—';
  if (p >= 100) return `$${p.toFixed(0)}`;
  if (p >= 10) return `$${p.toFixed(1)}`;
  return `$${p.toFixed(2)}`;
}

export function formatMoverPct(p: number | null | undefined): string {
  if (p == null) return '—';
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

export function pickLandingMovers(
  data: MoversInCollectionDTO | null | undefined,
  max = 4,
): LandingMover[] {
  if (!data) return [];
  const picked: LandingMover[] = [];
  const seen = new Set<string>();
  const lists: DailyMoverDTO[][] = SIGNAL_ORDER.map((k) => data[k] ?? []);
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest && picked.length < max; i++) {
    for (const list of lists) {
      if (picked.length >= max) break;
      const m = list[i];
      // Same printing can appear in several binders (one row each) or in
      // multiple signals — first (highest-priority) occurrence wins.
      if (!m || seen.has(m.printingId)) continue;
      seen.add(m.printingId);
      picked.push({
        printingId: m.printingId,
        displayName: m.displayName,
        price: m.pAtSignal,
        pctChange: m.pctChange,
        signalType: m.signalType,
        imageUrl: m.imageUrl,
      });
    }
  }
  return picked;
}
