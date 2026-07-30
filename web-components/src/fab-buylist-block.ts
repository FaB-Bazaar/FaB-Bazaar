import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { buildTcgAffiliateLink } from './utils/affiliate-link-builder';
import { buildMassEntryText, buildPlainTextExport } from './utils/buylist-export';
import { watchTheme, unwatchTheme } from './utils/theme';

/**
 * fab-buylist-block - Grouped, priced shopping list for a hero or archetype.
 *
 * Unlike fab-decklist-block this is a *checklist*, not a deck: quantities are
 * ranges ("2-3x"), cards nest into purchasable groups ("3x Steel Soul Set"),
 * and every row carries money. Nothing is hidden behind a carousel — a buy list
 * is meant to be scanned top to bottom and printed.
 *
 * All arithmetic lives in lib/buylist/rollup.ts and runs server-side via
 * /api/buylist/rollup, which also supplies the signed-in reader's owned counts.
 *
 * @element fab-buylist-block
 *
 * @attr {string} tiers - JSON string of tiers: [{label, groups:[{label, cards:[{printingId, qty}]}]}]
 * @attr {string} prerolled - Optional server-rendered {rollup, cards} JSON.
 *   Painted immediately (no loading state); the client fetch still runs to
 *   layer in the signed-in reader's ownership, and its failure is silent when
 *   a prerolled list is already on screen.
 * @attr {string} heading - Optional heading (default: "Buy List"). A legacy
 *   `title` attribute is honoured too, but gets captured and stripped off the
 *   host — `title` is a global HTML attribute, so leaving it in place makes
 *   the browser pop a tooltip over the entire block.
 * @attr {string} note - Optional footnote rendered under the list
 */

interface RolledCard {
  printingId: string;
  qty: { min: number; max: number };
  unitPrice: number | null;
  priceIsFallback: boolean;
  subtotal: { min: number; max: number };
  owned: number;
  needed: { min: number; max: number };
  note?: string;
}

interface Totals {
  cost: { min: number; max: number };
  needCost: { min: number; max: number };
  ownedCopies: number;
  wantedCopies: { min: number; max: number };
  missingPrices: string[];
}

interface RolledGroup {
  label: string;
  note?: string;
  qtyLabel: string | null;
  cards: RolledCard[];
  totals: Totals;
}

interface RolledTier {
  label: string;
  note?: string;
  groups: RolledGroup[];
  totals: Totals;
}

interface CardMeta {
  name: string;
  collector_number: string;
  set: string;
  image_url?: string | null;
  tcgplayer_url?: string | null;
  tcg_low?: number | null;
  tcg_market?: number | null;
}

interface RollupResponse {
  rollup: { tiers: RolledTier[]; totals: Totals };
  cards: Record<string, CardMeta>;
  authenticated: boolean;
  prices_as_of?: string | null;
}

@customElement('fab-buylist-block')
export class FabBuylistBlock extends LitElement {
  static styles = css`
    /* ===== HOST SETUP ===== */
    :host {
      display: block;
      margin: 2rem 0;
    }

    .buylist {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      overflow: hidden;
    }

    /* ===== HEADER ===== */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }

    .title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .totals {
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .total-cost {
      font-size: 1.125rem;
      font-weight: 700;
      color: #0f172a;
    }

    .total-need {
      font-size: 0.875rem;
      font-weight: 600;
      color: #047857;
    }

    .total-label {
      font-size: 0.875rem;
      color: #475569;
      font-weight: 500;
    }

    /* ===== TIERS ===== */
    .tier {
      border-top: 1px solid #e2e8f0;
    }

    .tier:first-of-type {
      border-top: none;
    }

    .tier-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      background: #f1f5f9;
      flex-wrap: wrap;
    }

    .tier-title {
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .tier-total {
      font-size: 0.875rem;
      font-weight: 600;
      color: #334155;
    }

    /* ===== GROUPS ===== */
    .group {
      border-top: 1px solid #e2e8f0;
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      width: 100%;
      padding: 0.75rem 1.25rem;
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      color: #0f172a;
    }

    .group-header:hover {
      background: #f1f5f9;
    }

    .group-header:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px #60a5fa;
    }

    .caret {
      flex-shrink: 0;
      width: 0.75rem;
      height: 0.75rem;
      transition: transform 0.15s;
      color: #475569;
    }

    .caret.collapsed {
      transform: rotate(-90deg);
    }

    .group-qty {
      flex-shrink: 0;
      font-size: 0.875rem;
      font-weight: 700;
      color: #1e293b;
      background: #e2e8f0;
      border-radius: 0.25rem;
      padding: 0.125rem 0.375rem;
      min-width: 2.25rem;
      text-align: center;
    }

    .group-label {
      font-size: 1rem;
      font-weight: 600;
      flex: 1;
      min-width: 0;
    }

    .group-cost {
      font-size: 0.875rem;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
    }

    /* ===== OWNERSHIP PILL ===== */
    .own-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.875rem;
      font-weight: 600;
      border-radius: 999px;
      padding: 0.125rem 0.5rem;
      white-space: nowrap;
      border: 1px solid transparent;
    }

    /* Shape + glyph carry the meaning, not colour alone (WCAG SC 1.4.1). */
    .own-pill.complete {
      color: #065f46;
      background: #d1fae5;
      border-color: #34d399;
    }

    .own-pill.partial {
      color: #854d0e;
      background: #fef3c7;
      border-color: #fbbf24;
    }

    .own-pill.none {
      color: #475569;
      background: transparent;
      border-style: dashed;
      border-color: #94a3b8;
    }

    /* ===== CARD ROWS ===== */
    .rows {
      list-style: none;
      margin: 0;
      padding: 0 0 0.5rem 0;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 0.5rem 1.25rem 0.5rem 2.75rem;
    }

    .row:hover {
      background: #f1f5f9;
    }

    /* Big enough to recognise the art at a glance — the whole point of showing
       card images in a shopping list. Click opens a full-size overlay. */
    .thumb {
      flex-shrink: 0;
      width: 3.75rem;
      height: 5.25rem;
      object-fit: cover;
      object-position: top;
      border-radius: 0.25rem;
      background: #e2e8f0;
      border: 1px solid #cbd5e1;
      display: block;
    }

    .thumb-btn {
      flex-shrink: 0;
      padding: 0;
      border: none;
      background: none;
      cursor: zoom-in;
      border-radius: 0.25rem;
      line-height: 0;
    }

    .thumb-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px #60a5fa;
    }

    .thumb-btn:hover .thumb {
      border-color: #60a5fa;
    }

    /* ===== ZOOM OVERLAY ===== */
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(2, 6, 23, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      cursor: zoom-out;
      border: none;
    }

    .overlay img {
      max-width: min(90vw, 26rem);
      max-height: 90vh;
      border-radius: 0.75rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
    }

    .row-main {
      flex: 1;
      min-width: 0;
    }

    .row-name {
      font-size: 1rem;
      color: #0f172a;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row-meta {
      font-size: 0.875rem;
      color: #475569;
      font-variant-numeric: tabular-nums;
    }

    /* ===== AUTHOR NOTES ===== */
    .card-note {
      display: block;
      font-size: 0.875rem;
      line-height: 1.45;
      color: #475569;
      margin-top: 0.1875rem;
      max-width: 46rem;
    }

    .group-note {
      font-size: 0.875rem;
      line-height: 1.5;
      color: #475569;
      margin: 0 1.25rem 0.5rem 2.75rem;
      max-width: 46rem;
      border-left: 2px solid #cbd5e1;
      padding-left: 0.75rem;
    }

    /* Its own block under the tier heading — never squeezed into the header
       row alongside the total. */
    .tier-note {
      font-size: 0.875rem;
      line-height: 1.5;
      color: #475569;
      /* Margin, not padding, so the text box aligns with the tier heading. */
      margin: 0.75rem 1.25rem;
      max-width: 52rem;
    }

    .row-qty {
      flex-shrink: 0;
      font-size: 0.875rem;
      font-weight: 700;
      color: #1e293b;
      font-variant-numeric: tabular-nums;
      min-width: 2.75rem;
      text-align: right;
    }

    .row-price {
      flex-shrink: 0;
      font-size: 0.875rem;
      color: #334155;
      font-variant-numeric: tabular-nums;
      min-width: 5rem;
      text-align: right;
    }

    .row-unit {
      display: block;
      font-size: 0.75rem;
      color: #64748b;
      font-variant-numeric: tabular-nums;
    }

    .buy-link {
      flex-shrink: 0;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #1d4ed8;
      text-decoration: none;
      border: 1px solid #93c5fd;
      border-radius: 0.375rem;
      padding: 0.25rem 0.5rem;
      white-space: nowrap;
    }

    .buy-link:hover {
      background: #dbeafe;
    }

    .buy-link:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px #60a5fa;
    }

    .row-own {
      flex-shrink: 0;
      min-width: 4.5rem;
      text-align: right;
      font-size: 0.875rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .row-own.have {
      color: #047857;
    }

    .row-own.need {
      color: #475569;
    }

    .fallback-flag {
      font-size: 0.875rem;
      color: #854d0e;
      font-weight: 600;
    }

    .no-price {
      color: #854d0e;
      font-weight: 600;
    }

    /* ===== FOOTER ===== */
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.875rem 1.25rem;
      border-top: 1px solid #e2e8f0;
      background: #f1f5f9;
      flex-wrap: wrap;
    }

    .footer-note {
      flex: 1;
      min-width: 12rem;
      display: flex;
      flex-direction: column;
      gap: 0.1875rem;
    }

    .note {
      font-size: 0.875rem;
      color: #475569;
      margin: 0;
    }

    .signin-link {
      color: #1d4ed8;
      font-weight: 600;
      text-decoration: underline;
    }

    .signin-link:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px #60a5fa;
      border-radius: 0.125rem;
    }

    .legend {
      font-size: 0.8125rem;
      color: #854d0e;
      margin: 0;
    }

    .prices-as-of {
      font-size: 0.8125rem;
      color: #64748b;
      margin: 0;
    }

    .retry-btn {
      font-family: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      margin-left: 0.75rem;
      padding: 0.375rem 0.75rem;
      border-radius: 0.375rem;
      border: 1px solid #cbd5e1;
      background: transparent;
      color: #334155;
      cursor: pointer;
    }

    .retry-btn:hover {
      background: #e2e8f0;
    }

    .retry-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px #60a5fa;
    }

    .add-btn {
      font-family: inherit;
      font-size: 1rem;
      font-weight: 600;
      padding: 0.5rem 0.875rem;
      border-radius: 0.375rem;
      border: 1px solid #0f172a;
      background: #0f172a;
      color: #ffffff;
      cursor: pointer;
      white-space: nowrap;
    }

    .add-btn:hover:not(:disabled) {
      background: #1e293b;
    }

    .add-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #60a5fa;
    }

    .add-btn:disabled {
      opacity: 1;
      background: #64748b;
      border-color: #64748b;
      cursor: not-allowed;
    }

    .add-status {
      font-size: 0.875rem;
      font-weight: 600;
      color: #047857;
    }

    .add-status.error {
      color: #b91c1c;
    }

    .copy-btn {
      font-family: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      border: 1px solid #cbd5e1;
      background: transparent;
      color: #334155;
      cursor: pointer;
      white-space: nowrap;
    }

    .copy-btn:hover {
      background: #e2e8f0;
    }

    .copy-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px #60a5fa;
    }

    .copy-status {
      font-size: 0.875rem;
      font-weight: 600;
      color: #047857;
    }

    /* ===== STATES ===== */
    .state {
      padding: 1.5rem 1.25rem;
      text-align: center;
      color: #475569;
      font-size: 1rem;
    }

    .state.error {
      color: #b91c1c;
    }

    /* ===== MOBILE ===== */
    @media (max-width: 640px) {
      .row {
        padding-left: 1.25rem;
        flex-wrap: wrap;
      }

      .row-main {
        flex-basis: calc(100% - 3rem);
      }

      .row-price,
      .row-own {
        min-width: 0;
      }

      .row-meta {
        display: none;
      }
    }

    /* ===== DARK MODE ===== */
    :host([dark]) .buylist {
      background: #0f172a;
      border-color: #334155;
    }

    :host([dark]) .header,
    :host([dark]) .tier,
    :host([dark]) .group,
    :host([dark]) .footer {
      border-color: #334155;
    }

    :host([dark]) .title,
    :host([dark]) .tier-title,
    :host([dark]) .group-header,
    :host([dark]) .row-name,
    :host([dark]) .row-qty,
    :host([dark]) .total-cost {
      color: #f1f5f9;
    }

    :host([dark]) .tier-header {
      background: #1e293b;
    }

    :host([dark]) .tier-total,
    :host([dark]) .group-cost,
    :host([dark]) .row-price {
      color: #cbd5e1;
    }

    :host([dark]) .total-label,
    :host([dark]) .row-meta,
    :host([dark]) .note,
    :host([dark]) .card-note,
    :host([dark]) .group-note,
    :host([dark]) .tier-note,
    :host([dark]) .state,
    :host([dark]) .caret,
    :host([dark]) .row-own.need {
      color: #cbd5e1;
    }

    :host([dark]) .group-note {
      border-left-color: #475569;
    }

    :host([dark]) .group-header:hover,
    :host([dark]) .row:hover {
      background: #1e293b;
    }

    :host([dark]) .group-qty {
      background: #334155;
      color: #f1f5f9;
    }

    :host([dark]) .footer {
      background: #1e293b;
    }

    :host([dark]) .thumb {
      background: #334155;
      border-color: #475569;
    }

    :host([dark]) .total-need,
    :host([dark]) .row-own.have,
    :host([dark]) .add-status,
    :host([dark]) .copy-status {
      color: #34d399;
    }

    :host([dark]) .copy-btn {
      border-color: #475569;
      color: #e2e8f0;
    }

    :host([dark]) .copy-btn:hover {
      background: #334155;
    }

    :host([dark]) .own-pill.complete {
      color: #d1fae5;
      background: #064e3b;
      border-color: #34d399;
    }

    :host([dark]) .own-pill.partial {
      color: #fef3c7;
      background: #78350f;
      border-color: #fbbf24;
    }

    :host([dark]) .own-pill.none {
      color: #cbd5e1;
      border-color: #64748b;
    }

    :host([dark]) .fallback-flag,
    :host([dark]) .no-price {
      color: #fbbf24;
    }

    :host([dark]) .row-unit,
    :host([dark]) .prices-as-of {
      color: #94a3b8;
    }

    :host([dark]) .legend {
      color: #fbbf24;
    }

    :host([dark]) .signin-link {
      color: #93c5fd;
    }

    :host([dark]) .retry-btn {
      border-color: #475569;
      color: #e2e8f0;
    }

    :host([dark]) .retry-btn:hover {
      background: #334155;
    }

    :host([dark]) .buy-link {
      color: #93c5fd;
      border-color: #1d4ed8;
    }

    :host([dark]) .buy-link:hover {
      background: #1e3a8a;
    }

    :host([dark]) .add-btn {
      background: #f1f5f9;
      border-color: #f1f5f9;
      color: #0f172a;
    }

    :host([dark]) .add-btn:hover:not(:disabled) {
      background: #ffffff;
    }

    :host([dark]) .add-btn:disabled {
      background: #475569;
      border-color: #475569;
      color: #e2e8f0;
    }

    :host([dark]) .state.error,
    :host([dark]) .add-status.error {
      color: #fca5a5;
    }
  `;

  @property() tiers = '';
  @property() heading = '';
  @property() note = '';
  @property() prerolled = '';

  /**
   * Heading text taken from a legacy `title` attribute. Captured once in
   * connectedCallback and then removed from the host, because `title` is a
   * global HTML attribute and would otherwise render as a browser tooltip
   * over the whole block.
   */
  @state() private _legacyTitle = '';

  @state() private _loading = false;
  @state() private _error = '';
  @state() private _data: RollupResponse | null = null;
  @state() private _collapsed = new Set<string>();
  @state() private _adding = false;
  @state() private _addMessage = '';
  @state() private _addFailed = false;
  @state() private _copyMessage = '';
  @state() private _zoomed: { src: string; alt: string } | null = null;

  private _copyTimer: ReturnType<typeof setTimeout> | undefined;

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this._zoomed = null;
  };

  override connectedCallback() {
    super.connectedCallback();
    watchTheme(this);
    const legacyTitle = this.getAttribute('title');
    if (legacyTitle) {
      this._legacyTitle = legacyTitle;
      this.removeAttribute('title');
    }
    document.addEventListener('keydown', this._onKeyDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    unwatchTheme(this);
    document.removeEventListener('keydown', this._onKeyDown);
    clearTimeout(this._copyTimer);
  }

  private _lastFetched = '';

  protected firstUpdated() {
    this._adoptPrerolled();
    this._fetchRollup();
  }

  /** Paint the server-rendered rollup immediately, before any network. */
  private _adoptPrerolled() {
    if (!this.prerolled) return;
    try {
      const parsed = JSON.parse(this.prerolled);
      if (parsed?.rollup && parsed?.cards) {
        this._data = {
          rollup: parsed.rollup,
          cards: parsed.cards,
          authenticated: false,
          prices_as_of: parsed.prices_as_of ?? null,
        };
      }
    } catch {
      // Malformed payload — fall back to the client fetch.
    }
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('tiers') && this.tiers !== this._lastFetched) {
      this._fetchRollup();
    }
  }

  private _parseTiers(): unknown[] | null {
    if (!this.tiers) return null;
    try {
      const parsed = JSON.parse(this.tiers);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private async _fetchRollup() {
    const tiers = this._parseTiers();
    this._lastFetched = this.tiers;

    if (!tiers) {
      if (!this._data) this._error = 'This buy list is misconfigured.';
      return;
    }

    // With a prerolled list already painted, the fetch is a silent
    // enhancement (ownership overlay) — no spinner, no error takeover.
    this._loading = !this._data;
    this._error = '';

    try {
      const response = await fetch('/api/buylist/rollup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to price this buy list');
      }

      this._data = result.data;
    } catch (e) {
      if (!this._data) {
        this._error = e instanceof Error ? e.message : 'Failed to price this buy list';
      }
    } finally {
      this._loading = false;
    }
  }

  private _toggleGroup(key: string) {
    const next = new Set(this._collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this._collapsed = next;
  }

  private _money(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  private _range(range: { min: number; max: number }): string {
    return range.min === range.max
      ? this._money(range.min)
      : `${this._money(range.min)} – ${this._money(range.max)}`;
  }

  private _qtyText(qty: { min: number; max: number }): string {
    return qty.min === qty.max ? `${qty.min}x` : `${qty.min}-${qty.max}x`;
  }

  /** Every card the reader still needs at least one copy of. */
  private _missingCards(): { printingId: string; quantity: number }[] {
    if (!this._data) return [];
    return this._data.rollup.tiers
      .flatMap(tier => tier.groups)
      .flatMap(group => group.cards)
      .filter(card => card.needed.max > 0)
      .map(card => ({ printingId: card.printingId, quantity: card.needed.max }));
  }

  private async _addMissingToWants() {
    const printings = this._missingCards();
    if (printings.length === 0) return;

    this._adding = true;
    this._addMessage = '';
    this._addFailed = false;

    try {
      const response = await fetch('/api/wants/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printings }),
      });
      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Could not update your wants list');
      }

      this._addMessage = `Added ${printings.length} card${printings.length === 1 ? '' : 's'} to your wants`;
    } catch (e) {
      this._addFailed = true;
      this._addMessage = e instanceof Error ? e.message : 'Could not update your wants list';
    } finally {
      this._adding = false;
    }
  }

  private _heading(): string {
    return this.heading || this._legacyTitle || 'Buy List';
  }

  private async _copy(kind: 'list' | 'mass') {
    if (!this._data) return;

    // A signed-in reader's shopping list is what they still need; a signed-out
    // reader gets the full list.
    const text =
      kind === 'list'
        ? buildPlainTextExport(this._heading(), this._data.rollup, this._data.cards)
        : buildMassEntryText(this._data.rollup, this._data.cards, {
            onlyNeeded: this._data.authenticated,
          });

    if (!text) {
      this._flashCopyMessage('Nothing left to buy');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this._flashCopyMessage(kind === 'list' ? 'List copied' : 'Copied for Mass Entry');
    } catch {
      this._flashCopyMessage('Copy failed');
    }
  }

  private _flashCopyMessage(message: string) {
    this._copyMessage = message;
    clearTimeout(this._copyTimer);
    this._copyTimer = setTimeout(() => (this._copyMessage = ''), 2500);
  }

  private _anyFallbackPrice(): boolean {
    if (!this._data) return false;
    return this._data.rollup.tiers.some(tier =>
      tier.groups.some(group => group.cards.some(card => card.priceIsFallback))
    );
  }

  private _formatDate(iso: string): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private _renderOwnPill(totals: Totals) {
    if (!this._data?.authenticated) return null;

    const owned = totals.ownedCopies;
    const wanted = totals.wantedCopies.max;
    const cls = owned === 0 ? 'none' : owned >= wanted ? 'complete' : 'partial';
    // Glyph + text, never colour alone.
    const glyph = owned === 0 ? '✗' : owned >= wanted ? '✓' : '◐';

    return html`<span class="own-pill ${cls}">${glyph} own ${owned} / ${wanted}</span>`;
  }

  private _renderCard(card: RolledCard) {
    const meta = this._data?.cards[card.printingId];
    const name = meta?.name ?? card.printingId;
    const authenticated = this._data?.authenticated ?? false;

    return html`
      <li class="row">
        ${meta?.image_url
          ? html`<button
              class="thumb-btn"
              aria-label=${`Enlarge ${name}`}
              @click=${() => (this._zoomed = { src: meta.image_url!, alt: name })}
            >
              <img class="thumb" src=${meta.image_url} alt=${name} loading="lazy" />
            </button>`
          : html`<span class="thumb" aria-hidden="true"></span>`}
        <span class="row-main">
          <span class="row-name">${name}</span>
          ${meta?.collector_number
            ? html`<span class="row-meta"> ${meta.collector_number.toUpperCase()}</span>`
            : null}
          ${card.note ? html`<span class="card-note">${card.note}</span>` : null}
        </span>
        <span class="row-qty">${this._qtyText(card.qty)}</span>
        <span class="row-price">
          ${card.unitPrice == null
            ? html`<span class="no-price">no price</span>`
            : html`${this._range(card.subtotal)}${card.priceIsFallback
                ? html`<span class="fallback-flag" title="Priced from TCG Market — no low price available"> ·M</span>`
                : null}
              ${card.qty.max > 1
                ? html`<span class="row-unit">${this._money(card.unitPrice)} ea</span>`
                : null}`}
        </span>
        ${authenticated
          ? html`<span class="row-own ${card.owned > 0 ? 'have' : 'need'}">
              ${card.owned > 0 ? html`✓ ${card.owned}` : html`—`}
            </span>`
          : null}
        ${meta?.tcgplayer_url
          ? html`<a
              class="buy-link"
              href=${buildTcgAffiliateLink(meta.tcgplayer_url, 'BuylistPurchase')}
              target="_blank"
              rel="noopener"
              aria-label=${`Buy ${name} on TCGplayer`}
            >Buy</a>`
          : null}
      </li>
    `;
  }

  private _renderGroup(group: RolledGroup, key: string) {
    const collapsed = this._collapsed.has(key);

    return html`
      <div class="group">
        <button
          class="group-header"
          aria-expanded=${collapsed ? 'false' : 'true'}
          @click=${() => this._toggleGroup(key)}
        >
          <svg class="caret ${collapsed ? 'collapsed' : ''}" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          ${group.qtyLabel ? html`<span class="group-qty">${group.qtyLabel}</span>` : null}
          <span class="group-label">${group.label}</span>
          ${this._renderOwnPill(group.totals)}
          <span class="group-cost">${this._range(group.totals.cost)}</span>
        </button>
        ${collapsed
          ? null
          : html`
              ${group.note ? html`<p class="group-note">${group.note}</p>` : null}
              <ul class="rows">${group.cards.map(card => this._renderCard(card))}</ul>
            `}
      </div>
    `;
  }

  private _renderTier(tier: RolledTier, tierIndex: number) {
    return html`
      <section class="tier">
        <div class="tier-header">
          <h3 class="tier-title">${tier.label}</h3>
          <span class="tier-total">${this._range(tier.totals.cost)}</span>
        </div>
        ${tier.note ? html`<p class="tier-note">${tier.note}</p>` : null}
        ${tier.groups.map((group, i) => this._renderGroup(group, `${tierIndex}-${i}`))}
      </section>
    `;
  }

  override render() {
    if (this._loading) {
      return html`<div class="buylist"><div class="state">Pricing this buy list…</div></div>`;
    }

    if (this._error) {
      return html`<div class="buylist">
        <div class="state error">
          ${this._error}
          <button class="retry-btn" @click=${() => this._fetchRollup()}>Retry</button>
        </div>
      </div>`;
    }

    if (!this._data) {
      return html`<div class="buylist"><div class="state">No cards in this buy list yet.</div></div>`;
    }

    const { rollup, authenticated } = this._data;
    const missingCount = this._missingCards().length;
    // Only worth a line when something is actually outstanding AND it differs
    // from the headline total — otherwise it reads "you still need $0.00" to a
    // reader who owns the lot, or just repeats the total for one who owns none.
    const showNeed =
      authenticated &&
      rollup.totals.needCost.max > 0 &&
      rollup.totals.needCost.max < rollup.totals.cost.max;

    return html`
      <div class="buylist">
        <div class="header">
          <h2 class="title">${this._heading()}</h2>
          <div class="totals">
            <span class="total-cost">${this._range(rollup.totals.cost)}</span>
            <span class="total-label">
              ${rollup.totals.wantedCopies.max} cards
              ${rollup.totals.missingPrices.length > 0
                ? html`· <span class="no-price">${rollup.totals.missingPrices.length} unpriced</span>`
                : null}
            </span>
            ${showNeed
              ? html`<span class="total-need">you still need ${this._range(rollup.totals.needCost)}</span>`
              : null}
          </div>
        </div>

        ${rollup.tiers.map((tier, i) => this._renderTier(tier, i))}

        <div class="footer">
          <div class="footer-note">
            <p class="note">
              ${this.note ||
              (authenticated
                ? 'Ownership counts any printing of a card you already have.'
                : html`<a
                      class="signin-link"
                      href=${`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`}
                    >Sign in</a>
                    to see which of these you already own.`)}
            </p>
            ${this._anyFallbackPrice()
              ? html`<p class="legend">
                  ·M — priced from TCG Market (no low price available)
                </p>`
              : null}
            ${this._data.prices_as_of
              ? html`<p class="prices-as-of">Prices as of ${this._formatDate(this._data.prices_as_of)}</p>`
              : null}
          </div>
          ${this._copyMessage ? html`<span class="copy-status">${this._copyMessage}</span>` : null}
          ${this._addMessage
            ? html`<span class="add-status ${this._addFailed ? 'error' : ''}">${this._addMessage}</span>`
            : null}
          <button class="copy-btn" @click=${() => this._copy('list')}>Copy list</button>
          <button class="copy-btn" @click=${() => this._copy('mass')}>
            Copy for Mass Entry
          </button>
          ${authenticated && missingCount > 0
            ? html`<button class="add-btn" ?disabled=${this._adding} @click=${this._addMissingToWants}>
                ${this._adding ? 'Adding…' : `Add ${missingCount} missing to Wants`}
              </button>`
            : null}
        </div>
      </div>
      ${this._zoomed
        ? html`<button class="overlay" aria-label="Close enlarged card" @click=${() => (this._zoomed = null)}>
            <img src=${this._zoomed.src} alt=${this._zoomed.alt} />
          </button>`
        : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fab-buylist-block': FabBuylistBlock;
  }
}
