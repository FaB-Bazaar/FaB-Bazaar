import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface SideboardCard {
  printingId: string;
  action: 'in' | 'out';
}

interface CardData {
  printing_id: string;
  display_name: string;
  image_url: string;
}

/**
 * fab-match-report - Tournament round writeup component
 *
 * Replaces spotlight-card misuse for match reports.
 * Designed specifically for tournament round-by-round reporting.
 *
 * @element fab-match-report
 *
 * @attr {string} round - Round identifier (e.g., "Round 1", "Top 8", "Finals")
 * @attr {string} opponent - Opponent's name (optional)
 * @attr {string} hero - Opponent's hero
 * @attr {string} result - Match result: "W", "L", or "D"
 * @attr {string} record - Current tournament record (e.g., "5-1")
 * @attr {string} summary - Key moments and strategy notes
 * @attr {string} sideboard - Optional sideboarding notes
 * @attr {string} sideboard-cards - JSON array of sideboard card changes
 *
 * @example
 * ```html
 * <fab-match-report
 *   round="Round 1"
 *   opponent="John Smith"
 *   hero="Briar"
 *   result="W"
 *   record="1-0"
 *   summary="Strong matchup. Managed to control the board early with Invoke Tomeltai."
 *   sideboard="Brought in 2x Sink Below, removed 2x Snatch"
 *   sideboard-cards='[{"printingId":"abc123","action":"in"}]'>
 * </fab-match-report>
 * ```
 */
@customElement('fab-match-report')
export class FabMatchReport extends LitElement {
  @state() private overlayImageUrl: string | null = null;
  @state() private overlayAlt: string = '';

  static styles = css`
    :host {
      display: block;
      margin: 1.5rem 0;
    }

    /* ===== LIGHT MODE (default) ===== */
    .match {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.625rem;
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    /* Subtle result color tint on header */
    .header.win  { background: rgba(34, 197, 94, 0.06);  border-bottom-color: rgba(34, 197, 94, 0.2); }
    .header.loss { background: rgba(239, 68, 68, 0.06);  border-bottom-color: rgba(239, 68, 68, 0.2); }
    .header.draw { background: rgba(234, 179, 8, 0.06);  border-bottom-color: rgba(234, 179, 8, 0.2); }

    .round-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    /* Round label — styled pill badge */
    .round {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #64748b;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 0.1875rem 0.5rem;
      border-radius: 0.25rem;
    }

    .hero {
      display: inline-flex;
      align-items: center;
      padding: 0.1875rem 0.625rem;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #334155;
    }

    .opponent-inline {
      font-size: 0.8125rem;
      color: #94a3b8;
      font-weight: 400;
    }

    /* Result pill — wider, shows full word */
    .result-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.875rem;
      border-radius: 99px;
      font-weight: 700;
      font-size: 0.8125rem;
      color: white;
      letter-spacing: 0.03em;
    }

    .result-badge.win  { background: #16a34a; }
    .result-badge.loss { background: #dc2626; }
    .result-badge.draw { background: #ca8a04; }

    .result-letter {
      font-size: 1rem;
      font-weight: 800;
      line-height: 1;
    }

    .result-word {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.85;
    }

    .result-right {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .record {
      font-size: 0.8125rem;
      color: #64748b;
      font-weight: 500;
    }

    .content {
      padding: 1.25rem 1.5rem;
    }

    .summary {
      color: #475569;
      line-height: 1.6;
      margin-bottom: 1rem;
      white-space: pre-wrap;
    }

    .sideboard {
      background: #fef3c7;
      border-radius: 0.375rem;
      padding: 1rem;
      margin-top: 1rem;
    }

    .sideboard-title {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #0f172a;
    }

    .sideboard-text {
      font-size: 0.875rem;
      color: #475569;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .sideboard-cards {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .card-group {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .card-group-label {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      min-width: 2rem;
      text-align: center;
      align-self: flex-start;
      margin-top: 0.25rem;
    }

    .card-group-label.in {
      background: #dcfce7;
      color: #166534;
    }

    .card-group-label.out {
      background: #fee2e2;
      color: #991b1b;
    }

    /* Sideboard card item: dual-crop thumbnail + name below */
    .sideboard-card-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      width: 52px;
      cursor: pointer;
    }

    .card-thumb-wrap {
      width: 52px;
      border-radius: 4px;
      overflow: hidden;
      aspect-ratio: 63/53;
      display: flex;
      flex-direction: column;
      gap: 1px;
      background: #111827;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      flex-shrink: 0;
    }

    .sideboard-card-item:hover .card-thumb-wrap {
      transform: scale(1.08);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }

    .card-thumb-top {
      width: 100%;
      object-fit: cover;
      object-position: top;
      flex: 0 0 81%;
      min-height: 0;
      display: block;
    }

    .card-thumb-bottom {
      width: 100%;
      object-fit: cover;
      object-position: bottom;
      flex: 1 0 0;
      min-height: 0;
      display: block;
    }

    .sideboard-card-name {
      font-size: 0.6rem;
      font-weight: 500;
      color: #475569;
      text-align: center;
      line-height: 1.2;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      width: 100%;
    }

    .card-thumbnail-placeholder {
      width: 52px;
      aspect-ratio: 63/53;
      border-radius: 4px;
      background: #e2e8f0;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .hero-card-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .hero-card-image {
      width: 64px;
      height: 90px;
      border-radius: 6px;
      object-fit: cover;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .hero-card-image:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    }

    .hero-card-placeholder {
      width: 64px;
      height: 90px;
      border-radius: 6px;
      background: #e2e8f0;
      animation: pulse 1.5s ease-in-out infinite;
    }

    .card-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      cursor: pointer;
      backdrop-filter: blur(4px);
    }

    .card-overlay img {
      max-width: 90vw;
      max-height: 90vh;
      width: auto;
      height: auto;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }

    .card-overlay-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      font-size: 1.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease;
    }

    .card-overlay-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .inline-card-name {
      font-weight: 600;
      color: #0f172a;
    }

    .inline-card-clickable {
      cursor: pointer;
      border-bottom: 1px dashed #94a3b8;
      transition: color 0.1s, border-color 0.1s;
    }

    .inline-card-clickable:hover {
      color: #6366f1;
      border-bottom-color: #6366f1;
    }

    /* ===== DARK MODE (via .dark class on html) ===== */
    :host-context(.dark) .match {
      background: #0f172a;
      border-color: #1e293b;
    }

    :host-context(.dark) .header {
      border-bottom-color: #1e293b;
    }

    :host-context(.dark) .header.win  { background: rgba(34, 197, 94, 0.08);  border-bottom-color: rgba(34, 197, 94, 0.2); }
    :host-context(.dark) .header.loss { background: rgba(239, 68, 68, 0.08);  border-bottom-color: rgba(239, 68, 68, 0.2); }
    :host-context(.dark) .header.draw { background: rgba(234, 179, 8, 0.08);  border-bottom-color: rgba(234, 179, 8, 0.2); }

    :host-context(.dark) .round {
      color: #94a3b8;
      background: #1e293b;
      border-color: #334155;
    }

    :host-context(.dark) .hero {
      background: #1e293b;
      border-color: #334155;
      color: #e2e8f0;
    }

    :host-context(.dark) .opponent-inline {
      color: #64748b;
    }

    :host-context(.dark) .record {
      color: #94a3b8;
    }

    :host-context(.dark) .summary {
      color: #cbd5e1;
    }

    :host-context(.dark) .sideboard {
      background: #422006;
    }

    :host-context(.dark) .sideboard-title {
      color: #fef3c7;
    }

    :host-context(.dark) .sideboard-text {
      color: #fcd34d;
    }

    :host-context(.dark) .card-group-label.in {
      background: #14532d;
      color: #86efac;
    }

    :host-context(.dark) .card-group-label.out {
      background: #450a0a;
      color: #fca5a5;
    }

    :host-context(.dark) .card-thumbnail-placeholder,
    :host-context(.dark) .hero-card-placeholder {
      background: #334155;
    }

    :host-context(.dark) .sideboard-card-name {
      color: #94a3b8;
    }

    :host-context(.dark) .inline-card-name {
      color: #f1f5f9;
    }

    :host-context(.dark) .inline-card-clickable:hover {
      color: #818cf8;
      border-bottom-color: #818cf8;
    }

    /* ===== DARK MODE (Safari/iOS fallback via OS preference) ===== */
    @media (prefers-color-scheme: dark) {
      .match {
        background: #0f172a;
        border-color: #1e293b;
      }
      .header { border-bottom-color: #1e293b; }
      .header.win  { background: rgba(34, 197, 94, 0.08); }
      .header.loss { background: rgba(239, 68, 68, 0.08); }
      .header.draw { background: rgba(234, 179, 8, 0.08); }
      .round { color: #94a3b8; background: #1e293b; border-color: #334155; }
      .hero { background: #1e293b; border-color: #334155; color: #e2e8f0; }
      .opponent-inline { color: #64748b; }
      .record { color: #94a3b8; }
      .opponent { color: #94a3b8; }
      .summary { color: #cbd5e1; }
      .sideboard { background: #422006; }
      .sideboard-title { color: #fef3c7; }
      .sideboard-text { color: #fcd34d; }
      .card-group-label.in { background: #14532d; color: #86efac; }
      .card-group-label.out { background: #450a0a; color: #fca5a5; }
      .card-thumbnail-placeholder,
      .hero-card-placeholder { background: #334155; }
      .sideboard-card-name { color: #94a3b8; }
      .inline-card-name { color: #f1f5f9; }
    }
  `;

  @property() round = '';
  @property() opponent = '';
  @property() hero = '';
  @property({ attribute: 'hero-printing-id' }) heroPrintingId = '';
  @property() result = '';
  @property() record = '';
  @property() summary = '';
  @property() sideboard = '';
  @property({ attribute: 'sideboard-cards' }) sideboardCardsJson = '';

  @state() private cardDataMap: Map<string, CardData> = new Map();
  @state() private loadingCards: Set<string> = new Set();
  @state() private heroCardData: CardData | null = null;
  @state() private loadingHeroCard = false;

  private get parsedSideboardCards(): SideboardCard[] {
    if (!this.sideboardCardsJson) return [];
    try {
      return JSON.parse(this.sideboardCardsJson);
    } catch {
      return [];
    }
  }

  // Parse InlineCard tags from summary text
  // Format: <InlineCard printingId="abc123">Card Name</InlineCard>
  private get inlineCardIds(): string[] {
    if (!this.summary) return [];
    const regex = /<InlineCard\s+printingId="([^"]+)"[^>]*>/g;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(this.summary)) !== null) {
      ids.push(match[1]);
    }
    return ids;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.fetchCardData();
    this.fetchHeroCard();
    // Close overlay on Escape key
    document.addEventListener('keydown', this.handleKeyDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.overlayImageUrl) {
      this.closeOverlay();
    }
  };

  override updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('sideboardCardsJson') || changedProperties.has('summary')) {
      this.fetchCardData();
    }
    if (changedProperties.has('heroPrintingId')) {
      this.fetchHeroCard();
    }
  }

  private openOverlay(imageUrl: string, alt: string) {
    this.overlayImageUrl = imageUrl;
    this.overlayAlt = alt;
  }

  private closeOverlay() {
    this.overlayImageUrl = null;
    this.overlayAlt = '';
  }

  private async fetchHeroCard() {
    if (!this.heroPrintingId) {
      this.heroCardData = null;
      return;
    }

    this.loadingHeroCard = true;
    try {
      const response = await fetch(
        `/api/printings/search?printingIds=${encodeURIComponent(this.heroPrintingId)}&show=all&limit=1`
      );
      if (response.ok) {
        const json = await response.json();
        const printings = json?.data?.printings || [];
        if (printings.length > 0) {
          this.heroCardData = printings[0];
        }
      }
    } catch (error) {
      console.error('Failed to fetch hero card:', error);
    } finally {
      this.loadingHeroCard = false;
    }
  }

  private async fetchCardData() {
    // Collect all printing IDs from sideboard cards and inline cards in summary
    const sideboardIds = this.parsedSideboardCards.map(c => c.printingId);
    const inlineIds = this.inlineCardIds;
    const allIds = [...new Set([...sideboardIds, ...inlineIds])];

    if (allIds.length === 0) return;

    const newPrintingIds = allIds
      .filter(id => !this.cardDataMap.has(id) && !this.loadingCards.has(id));

    if (newPrintingIds.length === 0) return;

    // Mark as loading
    newPrintingIds.forEach(id => this.loadingCards.add(id));
    this.requestUpdate();

    try {
      const response = await fetch(
        `/api/printings/search?printingIds=${encodeURIComponent(newPrintingIds.join(','))}&show=all&limit=${newPrintingIds.length}`
      );
      if (response.ok) {
        const json = await response.json();
        const printings = json?.data?.printings || [];
        printings.forEach((p: CardData) => {
          this.cardDataMap.set(p.printing_id, p);
        });
      }
    } catch (error) {
      console.error('Failed to fetch card data:', error);
    } finally {
      newPrintingIds.forEach(id => this.loadingCards.delete(id));
      this.requestUpdate();
    }
  }

  private renderCardThumbnails() {
    const cards = this.parsedSideboardCards;
    if (cards.length === 0) return null;

    const cardsIn = cards.filter(c => c.action === 'in');
    const cardsOut = cards.filter(c => c.action === 'out');

    return html`
      <div class="sideboard-cards">
        ${cardsIn.length > 0 ? html`
          <div class="card-group">
            <span class="card-group-label in">+In (${cardsIn.length})</span>
            ${cardsIn.map(card => this.renderSingleCard(card.printingId))}
          </div>
        ` : ''}
        ${cardsOut.length > 0 ? html`
          <div class="card-group">
            <span class="card-group-label out">-Out (${cardsOut.length})</span>
            ${cardsOut.map(card => this.renderSingleCard(card.printingId))}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderSingleCard(printingId: string) {
    const cardData = this.cardDataMap.get(printingId);
    const isLoading = this.loadingCards.has(printingId);

    if (isLoading || !cardData) {
      return html`
        <div class="sideboard-card-item">
          <div class="card-thumbnail-placeholder"></div>
        </div>
      `;
    }

    return html`
      <div class="sideboard-card-item" @click="${() => this.openOverlay(cardData.image_url, cardData.display_name)}" title="${cardData.display_name} — click to enlarge">
        <div class="card-thumb-wrap">
          <img class="card-thumb-top" src="${cardData.image_url}" alt="${cardData.display_name}" />
          <img class="card-thumb-bottom" src="${cardData.image_url}" alt="" aria-hidden="true" />
        </div>
        <div class="sideboard-card-name">${cardData.display_name}</div>
      </div>
    `;
  }

  private renderHeroCard() {
    if (this.loadingHeroCard) {
      return html`<div class="hero-card-placeholder"></div>`;
    }

    if (!this.heroCardData) {
      // Fall back to text-only hero display
      return html`<span class="hero">vs ${this.hero}</span>`;
    }

    return html`
      <div class="hero-card-container">
        <img
          class="hero-card-image"
          src="${this.heroCardData.image_url}"
          alt="${this.heroCardData.display_name}"
          title="${this.heroCardData.display_name} - Click to enlarge"
          @click="${() => this.openOverlay(this.heroCardData!.image_url, this.heroCardData!.display_name)}"
        />
        <span class="hero">vs ${this.hero}</span>
      </div>
    `;
  }

  private renderOverlay() {
    if (!this.overlayImageUrl) return null;

    return html`
      <div class="card-overlay" @click="${this.closeOverlay}">
        <button class="card-overlay-close" @click="${this.closeOverlay}">&times;</button>
        <img src="${this.overlayImageUrl}" alt="${this.overlayAlt}" @click="${(e: Event) => e.stopPropagation()}" />
      </div>
    `;
  }

  // Render summary text with inline card thumbnails
  private renderSummaryWithInlineCards() {
    if (!this.summary) return null;

    // Regex to match <InlineCard printingId="...">CardName</InlineCard>
    const regex = /<InlineCard\s+printingId="([^"]+)"[^>]*>([^<]*)<\/InlineCard>/g;

    // Split summary into parts (text and cards)
    const parts: (string | { printingId: string; cardName: string })[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(this.summary)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(this.summary.substring(lastIndex, match.index));
      }
      // Add the card reference
      parts.push({ printingId: match[1], cardName: match[2] });
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last match
    if (lastIndex < this.summary.length) {
      parts.push(this.summary.substring(lastIndex));
    }

    // If no inline cards found, just return the text
    if (parts.length === 1 && typeof parts[0] === 'string') {
      return html`${parts[0]}`;
    }

    // Render parts with inline card thumbnails
    return html`${parts.map(part => {
      if (typeof part === 'string') {
        return html`${part}`;
      }
      // Render inline card
      const cardData = this.cardDataMap.get(part.printingId);
      const isLoading = this.loadingCards.has(part.printingId);

      if (isLoading) {
        return html`<span class="inline-card-name">${part.cardName}</span>`;
      }

      if (!cardData) {
        return html`<span class="inline-card-name">${part.cardName}</span>`;
      }

      return html`<span
        class="inline-card-name inline-card-clickable"
        title="${cardData.display_name} — click to view"
        @click="${() => this.openOverlay(cardData.image_url, cardData.display_name)}"
      >${part.cardName}</span>`;
    })}`;
  }

  render() {
    if (!this.round || !this.hero || !this.result) {
      return html``;
    }

    const resultClass = this.result.toUpperCase() === 'W' ? 'win'
      : this.result.toUpperCase() === 'L' ? 'loss'
      : 'draw';

    const resultLabel = this.result.toUpperCase() === 'W' ? 'W'
      : this.result.toUpperCase() === 'L' ? 'L'
      : 'D';

    const resultWord = resultClass === 'win' ? 'Win' : resultClass === 'loss' ? 'Loss' : 'Draw';

    return html`
      ${this.renderOverlay()}
      <div class="match">
        <div class="header ${resultClass}">
          <div class="round-info">
            <span class="round">${this.round}</span>
            ${this.renderHeroCard()}
            ${this.opponent ? html`<span class="opponent-inline">${this.opponent}</span>` : ''}
          </div>
          <div class="result-right">
            ${this.record ? html`<span class="record">${this.record}</span>` : ''}
            <div class="result-badge ${resultClass}">
              <span class="result-letter">${resultLabel}</span>
              <span class="result-word">${resultWord}</span>
            </div>
          </div>
        </div>
        <div class="content">
          ${this.summary ? html`
            <div class="summary">${this.renderSummaryWithInlineCards()}</div>
          ` : ''}
          ${this.parsedSideboardCards.length > 0 || this.sideboard ? html`
            <div class="sideboard">
              <div class="sideboard-title">Sideboard Notes</div>
              ${this.renderCardThumbnails()}
              ${this.sideboard ? html`
                <div class="sideboard-text">${this.sideboard}</div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fab-match-report': FabMatchReport;
  }
}
