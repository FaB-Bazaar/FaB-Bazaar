import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { watchTheme, unwatchTheme } from './utils/theme';
import { laneItems, stepHoldMs, frameAt, type LaneItem } from './utils/combo-turn-timeline';

interface Ref { cardId: string; name: string; imageUrl: string | null }
interface Step extends Ref {
  kind: 'attack' | 'action' | 'activate' | 'hero' | 'instant' | 'play';
  outcome?: 'hit' | 'no-hit' | 'lethal';
  pitched: (Ref & { pitch: number | null })[];
}
interface Snapshot {
  turn: number;
  result: 'win' | 'loss';
  lethal: boolean;
  hero: Ref;
  opponent: Ref;
  opponentLife: { start: number | null; end: number | null };
  damage: { dealt: number | null; threatened: number | null };
  steps: Step[];
  takenAt?: string;
  deckName?: string;
}

const KIND_LABEL: Record<Step['kind'], string> = {
  attack: 'Attack', action: 'Action', activate: 'Activate', hero: 'Hero ability', instant: 'Instant', play: 'Play',
};
const OUTCOME_LABEL = { hit: 'HIT', 'no-hit': 'NO HIT', lethal: 'GAME' } as const;
const PITCH_COLOR: Record<number, string> = { 1: '#e03131', 2: '#f2b705', 3: '#3b82f6' };
// Life bar scale: the bigger of the opponent's starting life and 40 (CC hero life).
const LIFE_SCALE = 40;

/**
 * fab-combo-turn - replays one turn of a real game, step by step.
 *
 * The snapshot is frozen from the Talishar game log when the section is added
 * (lib/articles/combo-turn.ts). Rests on the finished turn (what a skimmer,
 * a thumbnail or a no-JS reader sees), then plays once from the start the
 * first time it scrolls into view. Reduced-motion readers get no autoplay.
 *
 * @element fab-combo-turn
 * @attr {string} snapshot - JSON ComboTurnSnapshot
 * @attr {string} captions - JSON string[]; captions[i] goes with step i
 * @attr {string} heading - optional heading (default "Turn N vs <opponent>")
 */
@customElement('fab-combo-turn')
export class FabComboTurn extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin: 2rem 0;
      --ct-surface: #ffffff;
      --ct-line: #e2e8f0;
      --ct-fg: #0f172a;
      --ct-muted: #64748b;
      --ct-track: #eef1f5;
      --ct-accent: #e8590c;
      --ct-accent-soft: rgba(232, 89, 12, 0.1);
      --ct-hit: #15803d;
      --ct-hit-soft: rgba(21, 128, 61, 0.12);
      --ct-miss: #94a3b8;
      --ct-life: #dc2626;
    }
    :host([dark]) {
      --ct-surface: #1e293b;
      --ct-line: #334155;
      --ct-fg: #e2e8f0;
      --ct-muted: #94a3b8;
      --ct-track: #2b3648;
      --ct-accent: #fb8a3c;
      --ct-accent-soft: rgba(251, 138, 60, 0.14);
      --ct-hit: #4ade80;
      --ct-hit-soft: rgba(74, 222, 128, 0.14);
      --ct-miss: #64748b;
      --ct-life: #f87171;
    }

    .ct { background: var(--ct-surface); color: var(--ct-fg); border: 1px solid var(--ct-line); border-radius: 0.75rem; overflow: hidden; }
    .head { display: flex; align-items: center; gap: 0.875rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--ct-line); }
    .hero { width: 48px; flex: none; aspect-ratio: 5 / 7; border-radius: 6px; overflow: hidden; background: var(--ct-track); }
    .hero img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%; display: block; }
    .title { min-width: 0; flex: 1; }
    .eyebrow { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ct-accent); }
    h3 { margin: 0.125rem 0 0; font-size: 1.2rem; line-height: 1.25; color: var(--ct-fg); text-wrap: balance; }
    .result { font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 999px; flex: none; }
    .result.win { background: var(--ct-hit-soft); color: var(--ct-hit); }
    .result.loss { background: var(--ct-track); color: var(--ct-muted); }

    .gauges { display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: end; padding: 0.875rem 1.25rem 0.25rem; }
    .label { font-size: 0.7rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ct-muted); display: flex; justify-content: space-between; gap: 0.5rem; }
    .label b { color: var(--ct-fg); font-variant-numeric: tabular-nums; text-transform: none; }
    .bar { height: 10px; border-radius: 999px; background: var(--ct-track); margin-top: 0.375rem; position: relative; overflow: hidden; }
    .bar .ghost, .bar .fill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--ct-life); }
    .bar .ghost { opacity: 0.22; }
    .bar .fill { transition: width 0.9s cubic-bezier(0.3, 0.7, 0.2, 1); }
    .totals { font-size: 0.75rem; color: var(--ct-muted); margin-top: 0.375rem; min-height: 1.2em; font-variant-numeric: tabular-nums; }
    .totals b { color: var(--ct-fg); }
    .counter { text-align: right; }
    .counter .num { font-size: 2.4rem; font-weight: 800; line-height: 0.95; color: var(--ct-accent); font-variant-numeric: tabular-nums; display: inline-block; }
    .bump { animation: bump 0.35s ease-out; }
    @keyframes bump { from { transform: scale(1.35); } to { transform: scale(1); } }

    .lane-wrap { overflow-x: auto; padding: 0.875rem 1.25rem 0.5rem; scrollbar-width: thin; }
    .lane { display: flex; gap: 0.625rem; align-items: flex-start; width: max-content; }
    .item { width: 88px; flex: none; display: grid; gap: 0.375rem; justify-items: center; opacity: 0.18; transform: translateY(6px); transition: opacity 0.35s, transform 0.35s; }
    .item.on { opacity: 1; transform: none; }
    .card { width: 88px; aspect-ratio: 5 / 7; border-radius: 6px; overflow: hidden; position: relative; background: var(--ct-track); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18); }
    .card img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .card .noimg { padding: 0.4rem; font-size: 0.7rem; color: var(--ct-muted); }
    .item.cur .card.top, .item.cur > .card { outline: 3px solid var(--ct-accent); outline-offset: 2px; }
    .tag { font-size: 0.66rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ct-muted); text-align: center; line-height: 1.25; }
    .badge { font-size: 0.62rem; font-weight: 700; padding: 0.125rem 0.375rem; border-radius: 4px; }
    .badge.hit { background: var(--ct-hit-soft); color: var(--ct-hit); }
    .badge.no-hit { background: var(--ct-track); color: var(--ct-muted); }
    .badge.lethal { background: var(--ct-accent-soft); color: var(--ct-accent); }
    .pitch { display: flex; align-items: center; gap: 0.25rem; font-size: 0.6rem; color: var(--ct-muted); }
    .pitch img { width: 32px; aspect-ratio: 5 / 7; border-radius: 3px; transform: rotate(-8deg); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }
    .gem { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }

    .item.stack { width: auto; min-width: 124px; }
    .stackbox { position: relative; width: 100px; aspect-ratio: 5 / 7; }
    .stackbox .card { position: absolute; inset: 0; width: 100%; }
    .stackbox .card.under { opacity: 0; transition: opacity 0.3s; }
    .stackbox .card.under.on { opacity: 0.5; }
    .x { position: absolute; right: -10px; top: -10px; z-index: 3; background: var(--ct-accent); color: #fff; font-weight: 800; font-size: 1.1rem; line-height: 1; padding: 0.3rem 0.45rem 0.25rem; border-radius: 8px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25); }
    .pips { display: flex; gap: 0.3rem; }
    .pip { width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid var(--ct-line); display: grid; place-items: center; font-size: 0.55rem; font-weight: 700; color: transparent; transition: background 0.25s, border-color 0.25s, color 0.25s; }
    .pip.on.hit { background: var(--ct-hit); border-color: var(--ct-hit); color: #fff; }
    .pip.on.no-hit { background: var(--ct-track); border-color: var(--ct-miss); color: var(--ct-muted); }
    .pip.on.lethal { background: var(--ct-accent); border-color: var(--ct-accent); color: #fff; }

    .caption { margin: 0.25rem 1.25rem 0; padding: 0.625rem 0.75rem; border-left: 3px solid var(--ct-accent); background: var(--ct-accent-soft); border-radius: 0 6px 6px 0; min-height: 3.2em; font-size: 0.92rem; line-height: 1.5; }
    .caption .step { display: block; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; color: var(--ct-accent); }

    .controls { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem 1rem; flex-wrap: wrap; }
    button { font: inherit; font-size: 0.78rem; font-weight: 700; border: 1px solid var(--ct-line); background: var(--ct-surface); color: var(--ct-fg); border-radius: 6px; padding: 0.375rem 0.7rem; cursor: pointer; }
    button:hover { border-color: var(--ct-accent); }
    button:focus-visible { outline: 2px solid var(--ct-accent); outline-offset: 2px; }
    button.primary { background: var(--ct-accent); border-color: var(--ct-accent); color: #fff; min-width: 80px; }
    .scrub { flex: 1; min-width: 120px; display: flex; gap: 3px; }
    .scrub button { flex: 1; height: 8px; padding: 0; border: none; border-radius: 2px; background: var(--ct-track); min-width: 0; }
    .scrub button.on { background: var(--ct-accent); }
    .source { font-size: 0.7rem; color: var(--ct-muted); padding: 0 1.25rem 0.875rem; }

    @media (max-width: 520px) {
      .gauges { grid-template-columns: 1fr; }
      .counter { text-align: left; }
    }
    @media (prefers-reduced-motion: reduce) {
      .item, .bar .fill, .pip, .stackbox .card.under { transition: none; }
      .bump { animation: none; }
    }
  `;

  @property({ type: String }) snapshot = '';
  @property({ type: String }) captions = '';
  @property({ type: String }) heading = '';

  /** Frame index 0..steps.length (steps.length = end of turn). Rests on the end. */
  @state() private frame = Number.MAX_SAFE_INTEGER;
  @state() private playing = false;
  @state() private bumpKey = 0;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private observer: IntersectionObserver | null = null;
  private autoplayed = false;

  connectedCallback() {
    super.connectedCallback();
    watchTheme(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    unwatchTheme(this);
    this.stop();
    this.observer?.disconnect();
  }

  firstUpdated() {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) return;
    this.observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5) && !this.autoplayed) {
        this.autoplayed = true;
        this.observer?.disconnect();
        this.play(true);
      }
    }, { threshold: [0.5] });
    this.observer.observe(this);
  }

  private get data(): Snapshot | null {
    try {
      const s = JSON.parse(this.snapshot);
      return s && Array.isArray(s.steps) && s.steps.length ? s : null;
    } catch {
      return null;
    }
  }

  private get captionList(): string[] {
    try {
      const c = JSON.parse(this.captions || '[]');
      return Array.isArray(c) ? c.map((x) => (typeof x === 'string' ? x : '')) : [];
    } catch {
      return [];
    }
  }

  private endText(s: Snapshot): string {
    const { start, end } = s.opponentLife;
    const parts: string[] = [];
    if (s.damage.dealt != null) parts.push(`${s.damage.dealt} damage dealt${s.damage.threatened != null ? ` out of ${s.damage.threatened} threatened` : ''}.`);
    if (start != null && end != null) parts.push(`${s.opponent.name} goes from ${start} to ${end}${s.lethal ? ' and the game ends' : ''}.`);
    return parts.join(' ') || 'End of turn.';
  }

  private stepText(s: Snapshot, i: number): string {
    const cap = this.captionList[i];
    if (cap) return cap;
    const st = s.steps[i];
    const out = st.outcome ? ` ${OUTCOME_LABEL[st.outcome] === 'GAME' ? 'The game ends on this one' : st.outcome === 'hit' ? 'Hit' : 'No hit'}.` : '';
    const paid = st.pitched.length ? ` Pitched ${st.pitched.map((p) => p.name).join(', ')}.` : '';
    return `${st.name}: ${KIND_LABEL[st.kind].toLowerCase()}.${paid}${out}`;
  }

  private show(i: number) {
    const s = this.data;
    if (!s) return;
    const next = Math.max(0, Math.min(s.steps.length, i));
    const prev = this.frame;
    this.frame = next;
    if (next !== prev && next < s.steps.length && s.steps[next].kind === 'attack') this.bumpKey++;
    this.updateComplete.then(() => this.scrollToCurrent());
  }

  private scrollToCurrent() {
    if (!this.playing) return;
    const wrap = this.renderRoot.querySelector('.lane-wrap') as HTMLElement | null;
    const cur = this.renderRoot.querySelector('.item.cur') as HTMLElement | null;
    if (!wrap || !cur) return;
    wrap.scrollTo({ left: cur.offsetLeft - wrap.clientWidth / 2 + cur.clientWidth / 2, behavior: 'smooth' });
  }

  private holdFor(s: Snapshot, i: number): number {
    if (i >= s.steps.length) return stepHoldMs(this.endText(s), false);
    const prev = s.steps[i - 1];
    const inStack = !!prev && prev.kind === 'attack' && s.steps[i].kind === 'attack' && prev.cardId === s.steps[i].cardId;
    return stepHoldMs(this.stepText(s, i), inStack);
  }

  private play(fromStart = false) {
    const s = this.data;
    if (!s) return;
    this.stop();
    if (fromStart || this.frame >= s.steps.length) this.show(0);
    this.playing = true;
    const tick = () => {
      if (this.frame >= s.steps.length) { this.stop(); return; }
      this.show(this.frame + 1);
      this.timer = setTimeout(tick, this.holdFor(s, this.frame));
    };
    this.timer = setTimeout(tick, this.holdFor(s, this.frame));
  }

  private stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.playing = false;
  }

  private renderCard(ref: Ref, cls = 'card') {
    return html`<div class=${cls}>${ref.imageUrl
      ? html`<img src=${ref.imageUrl} alt=${ref.name} loading="lazy">`
      : html`<div class="noimg">${ref.name}</div>`}</div>`;
  }

  private renderItem(s: Snapshot, it: LaneItem, visibleUpTo: number, atEnd: boolean) {
    const on = it.steps[0] <= visibleUpTo;
    const cur = !atEnd && it.steps.includes(this.frame);
    const first = s.steps[it.steps[0]];
    if (it.stack) {
      const seen = it.steps.filter((i) => i <= visibleUpTo).length;
      const under = it.steps.slice(1).map((_, k) => k + 1).reverse();
      return html`
        <div class="item stack ${on ? 'on' : ''} ${cur ? 'cur' : ''}">
          <div class="stackbox">
            ${under.map((k) => html`<div class="card under ${seen > k ? 'on' : ''}" style="transform:translate(${k * 4}px,${k * -4}px)">${first.imageUrl ? html`<img src=${first.imageUrl} alt="">` : nothing}</div>`)}
            ${this.renderCard(first, 'card top')}
            ${keyed(cur ? this.bumpKey : -1, html`<span class="x ${cur ? 'bump' : ''}">×${Math.max(seen, 1)}</span>`)}
          </div>
          <div class="pips" aria-label="${seen} of ${it.steps.length} attacks shown">
            ${it.steps.map((i, j) => html`<span class="pip ${s.steps[i].outcome ?? ''} ${j < seen ? 'on' : ''}">${j + 1}</span>`)}
          </div>
          <div class="tag">${first.name}</div>
        </div>`;
    }
    return html`
      <div class="item ${on ? 'on' : ''} ${cur ? 'cur' : ''}">
        ${this.renderCard(first)}
        <div class="tag">${KIND_LABEL[first.kind]}</div>
        ${first.outcome ? html`<span class="badge ${first.outcome}">${OUTCOME_LABEL[first.outcome]}</span>` : nothing}
        ${first.pitched.map((p) => html`
          <div class="pitch"><span class="gem" style="background:${PITCH_COLOR[p.pitch ?? 0] ?? 'var(--ct-miss)'}"></span>pitch
            ${p.imageUrl ? html`<img src=${p.imageUrl} alt="pitched ${p.name}">` : html`<span>${p.name}</span>`}</div>`)}
      </div>`;
  }

  render() {
    const s = this.data;
    if (!s) return nothing;
    const total = s.steps.length;
    const frame = Math.min(this.frame, total);
    const { visibleUpTo, atEnd, counterCardId, attackCount } = frameAt(s.steps, frame);
    const items = laneItems(s.steps);
    const scale = Math.max(LIFE_SCALE, s.opponentLife.start ?? 0);
    const life = atEnd ? s.opponentLife.end : s.opponentLife.start;
    const counterName = counterCardId ? s.steps.find((x) => x.cardId === counterCardId)?.name : null;

    return html`
      <section class="ct" aria-label=${this.heading || `Turn ${s.turn} vs ${s.opponent.name}`}>
        <div class="head">
          ${s.opponent.imageUrl ? html`<div class="hero"><img src=${s.opponent.imageUrl} alt=${s.opponent.name}></div>` : nothing}
          <div class="title">
            <div class="eyebrow">Combo turn</div>
            <h3>${this.heading || `Turn ${s.turn} vs ${s.opponent.name}`}</h3>
          </div>
          <span class="result ${s.result}">${s.result === 'win' ? 'WIN' : 'LOSS'}</span>
        </div>

        <div class="gauges">
          <div>
            ${s.opponentLife.start != null ? html`
              <div class="label"><span>${s.opponent.name.split(',')[0]} life</span>
                <b>${atEnd && life != null ? `${s.opponentLife.start} → ${life}` : s.opponentLife.start}</b></div>
              <div class="bar">
                <div class="ghost" style="width:${(s.opponentLife.start / scale) * 100}%"></div>
                <div class="fill" style="width:${((life ?? 0) / scale) * 100}%"></div>
              </div>` : nothing}
            <div class="totals">${atEnd && s.damage.dealt != null
              ? html`<b>${s.damage.dealt}</b> dealt${s.damage.threatened != null ? html` · ${s.damage.threatened} threatened` : nothing}`
              : 'Turn totals appear at end of turn'}</div>
          </div>
          ${counterName ? html`
            <div class="counter">
              <div class="label" style="justify-content:flex-end"><span>${counterName} attacks</span></div>
              ${keyed(this.bumpKey, html`<span class="num ${!atEnd && s.steps[frame]?.cardId === counterCardId ? 'bump' : ''}">×${attackCount}</span>`)}
            </div>` : nothing}
        </div>

        <div class="lane-wrap"><div class="lane">
          ${items.map((it) => this.renderItem(s, it, visibleUpTo, atEnd))}
        </div></div>

        <div class="caption" aria-live="polite">
          <span class="step">${atEnd ? 'END OF TURN' : `STEP ${frame + 1} OF ${total}`}</span>
          ${atEnd ? this.endText(s) : this.stepText(s, frame)}
        </div>

        <div class="controls">
          <button type="button" aria-label="Previous step" @click=${() => { this.stop(); this.show(frame - 1); }}>◀</button>
          <button type="button" class="primary" @click=${() => (this.playing ? this.stop() : this.play())}>
            ${this.playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}</button>
          <button type="button" aria-label="Next step" @click=${() => { this.stop(); this.show(frame + 1); }}>▶</button>
          <div class="scrub" role="group" aria-label="Jump to step">
            ${Array.from({ length: total + 1 }, (_, i) => html`
              <button type="button" class=${i <= frame ? 'on' : ''} aria-label=${i === total ? 'End of turn' : `Step ${i + 1}`}
                @click=${() => { this.stop(); this.show(i); }}></button>`)}
          </div>
        </div>
        <div class="source">From the Talishar game log${s.takenAt ? ` · saved ${s.takenAt}` : ''}</div>
      </section>`;
  }
}
