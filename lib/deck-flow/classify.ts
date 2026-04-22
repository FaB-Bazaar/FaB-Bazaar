export type FlowCard = {
  name: string;
  quantity: number;
  types: string[];
  keywords: string[];
  classes: string[];
  talents: string[];
  pitch?: number | null;
  cost?: number | null;
  defense?: number | null;
  power?: number | null;
  printingId?: string;
  imageUrl?: string;
  foiling?: string;
};

export type FlowHero = {
  heroClass: string | null;
  talents: string[];
};

export type FlowBucket = {
  id: string;
  label: string;
  color: string;
};

export type FlowAxisId =
  | 'pitch'
  | 'supertype'
  | 'class'
  | 'talent'
  | 'keyword'
  | 'cost'
  | 'power6'
  | 'blocks'
  | 'subtype';

export type FlowContext = {
  hero: FlowHero;
  topKeywords: string[];
};

export const AXIS_LABELS: Record<FlowAxisId, string> = {
  pitch: 'Pitch',
  supertype: 'Supertype',
  class: 'Class',
  talent: 'Talent',
  keyword: 'Keyword',
  cost: 'Cost',
  power6: 'Power ≥ 6',
  blocks: 'Blocks',
  subtype: 'Subtype',
};

export const AXIS_IDS: FlowAxisId[] = [
  'pitch', 'supertype', 'blocks', 'power6',
  'keyword', 'class', 'talent', 'cost', 'subtype',
];

export const BUCKET_ORDER: Partial<Record<FlowAxisId, string[]>> = {
  pitch: ['red', 'yellow', 'blue', 'none'],
  supertype: ['aa', 'ar', 'naa', 'instant', 'dr', 'item', 'resource', 'landmark', 'ally', 'other'],
  blocks: ['y', 'n'],
  cost: ['0', '1', '2', '3', '4p', 'x'],
  power6: ['y', 'n', 'np'],
  class: ['in', 'generic', 'off'],
  talent: ['in', 'off', 'none'],
  subtype: ['aura', 'figment', 'landmark', 'gem', 'token', 'none'],
};

const KEYWORD_COLORS: Record<string, string> = {
  'go again': '#f97316',
  'phantasm': '#8b5cf6',
  'dominate': '#dc2626',
  'spectra': '#06b6d4',
  'legendary': '#eab308',
  'combo': '#ec4899',
  'crush': '#7c3aed',
  'intimidate': '#ef4444',
};

function colorForKeyword(kw: string): string {
  if (KEYWORD_COLORS[kw]) return KEYWORD_COLORS[kw];
  if (kw.includes('specialization')) return '#84cc16';
  return '#60a5fa';
}

export function tokenSet(types: string[]): Set<string> {
  const set = new Set<string>();
  for (const t of types || []) {
    const s = String(t).toLowerCase().trim();
    if (!s) continue;
    set.add(s);
    for (const w of s.split(/\s+/)) if (w) set.add(w);
  }
  return set;
}

function normalizeKeyword(k: string): string {
  return String(k).toLowerCase().replace(/\s+\d+$/, '').trim();
}

export function computeTopKeywords(cards: FlowCard[], n = 5): string[] {
  const counts = new Map<string, number>();
  for (const c of cards) {
    const qty = c.quantity || 1;
    const seen = new Set<string>();
    for (const kw of c.keywords || []) {
      const k = normalizeKeyword(kw);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      counts.set(k, (counts.get(k) || 0) + qty);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

export function classify(
  card: FlowCard,
  axis: FlowAxisId,
  ctx: FlowContext
): FlowBucket {
  const set = tokenSet(card.types);
  const has = (...ws: string[]) => ws.every(w => set.has(w));

  switch (axis) {
    case 'pitch': {
      const p = card.pitch ?? 0;
      if (p === 1) return { id: 'red', label: 'Red', color: '#dc2626' };
      if (p === 2) return { id: 'yellow', label: 'Yellow', color: '#eab308' };
      if (p === 3) return { id: 'blue', label: 'Blue', color: '#2563eb' };
      return { id: 'none', label: 'No pitch', color: '#6b7280' };
    }
    case 'supertype': {
      const isReaction = set.has('reaction');
      const isAction = set.has('action');
      const isAttack = set.has('attack');
      if (isAttack && isReaction) return { id: 'ar', label: 'Attack Reaction', color: '#f97316' };
      if (set.has('defense') && isReaction) return { id: 'dr', label: 'Defense Reaction', color: '#14b8a6' };
      if (has('instant')) return { id: 'instant', label: 'Instant', color: '#8b5cf6' };
      if (isAction && isAttack) return { id: 'aa', label: 'Attack Action', color: '#d946ef' };
      if (isAction) return { id: 'naa', label: 'Non-attack Action', color: '#10b981' };
      if (has('item')) return { id: 'item', label: 'Item', color: '#a16207' };
      if (has('resource')) return { id: 'resource', label: 'Resource', color: '#9ca3af' };
      if (has('landmark')) return { id: 'landmark', label: 'Landmark', color: '#84cc16' };
      if (has('ally')) return { id: 'ally', label: 'Ally', color: '#ec4899' };
      return { id: 'other', label: 'Other', color: '#6b7280' };
    }
    case 'class': {
      const heroClass = ctx.hero.heroClass?.toLowerCase() ?? null;
      const classes = (card.classes || []).map(c => c.toLowerCase());
      if (heroClass && classes.includes(heroClass)) return { id: 'in', label: 'In-class', color: '#8b5cf6' };
      if (classes.includes('generic')) return { id: 'generic', label: 'Generic', color: '#9ca3af' };
      return { id: 'off', label: 'Off-class', color: '#6b7280' };
    }
    case 'talent': {
      const heroTalents = new Set(ctx.hero.talents.map(t => t.toLowerCase()));
      const cardTalents = (card.talents || []).map(t => t.toLowerCase());
      if (!cardTalents.length) return { id: 'none', label: 'Untalented', color: '#9ca3af' };
      if (cardTalents.some(t => heroTalents.has(t))) return { id: 'in', label: 'In-talent', color: '#fbbf24' };
      return { id: 'off', label: 'Off-talent', color: '#6b7280' };
    }
    case 'keyword': {
      const cardKws = new Set((card.keywords || []).map(normalizeKeyword));
      for (const topKw of ctx.topKeywords) {
        if (cardKws.has(topKw)) {
          const label = topKw.replace(/\b\w/g, c => c.toUpperCase());
          return { id: topKw, label, color: colorForKeyword(topKw) };
        }
      }
      return { id: 'none', label: 'No keyword', color: '#6b7280' };
    }
    case 'cost': {
      const c = card.cost;
      if (c == null) return { id: 'x', label: 'X / none', color: '#6b7280' };
      if (c === 0) return { id: '0', label: '0', color: '#6b7280' };
      if (c === 1) return { id: '1', label: '1', color: '#a3e635' };
      if (c === 2) return { id: '2', label: '2', color: '#06b6d4' };
      if (c === 3) return { id: '3', label: '3', color: '#fb923c' };
      return { id: '4p', label: '4+', color: '#d946ef' };
    }
    case 'power6': {
      if (card.power == null) return { id: 'np', label: 'No power', color: '#9ca3af' };
      if (card.power >= 6) return { id: 'y', label: '6+ power', color: '#d946ef' };
      return { id: 'n', label: '<6 power', color: '#6b7280' };
    }
    case 'blocks': {
      const d = card.defense ?? 0;
      if (d > 0) return { id: 'y', label: 'Blocks', color: '#14b8a6' };
      return { id: 'n', label: 'No block', color: '#6b7280' };
    }
    case 'subtype': {
      if (has('aura')) return { id: 'aura', label: 'Aura', color: '#8b5cf6' };
      if (has('figment')) return { id: 'figment', label: 'Figment', color: '#ec4899' };
      if (has('landmark')) return { id: 'landmark', label: 'Landmark', color: '#84cc16' };
      if (has('gem')) return { id: 'gem', label: 'Gem', color: '#f59e0b' };
      if (has('token')) return { id: 'token', label: 'Token', color: '#9ca3af' };
      return { id: 'none', label: 'None', color: '#6b7280' };
    }
  }
}
