import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * fab-decklist-block - Compact card grid decklist representation
 *
 * Displays deck cards in a visual grid with card images, quantities, and section headers.
 * Matches the compact view style from the decks page.
 *
 * Can either use manual `sections` JSON or fetch from a deck via `deck-id`.
 *
 * @element fab-decklist-block
 *
 * @attr {string} deck-id - Optional deck public ID to fetch from API (takes precedence over sections)
 * @attr {string} sections - JSON string of deck sections (see example)
 * @attr {string} export-url - Optional link to full decklist (Fabrary, etc.)
 * @attr {string} notes - Optional deck notes
 * @attr {string} title - Optional custom title (default: "Decklist")
 * @attr {string} article-slug - Optional article slug for context (allows private deck access in articles)
 * @attr {string} hero-slug - Optional hero slug for context (allows private deck access in heroes)
 *
 * @example Using deck-id (recommended)
 * ```html
 * <fab-decklist-block
 *   deck-id="abc123XYZ..."
 *   title="My Iyslander Deck">
 * </fab-decklist-block>
 * ```
 */
@customElement('fab-decklist-block')
export class FabDecklistBlock extends LitElement {
  static styles = css`
    /* ===== HOST SETUP ===== */
    :host {
      display: block;
      margin: 2rem 0;
    }

    /* ===== LIGHT MODE (default) ===== */
    .decklist {
      background: #fefce8;
      border: 1px solid #fde047;
      border-radius: 0.75rem;
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .export-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #3b82f6;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .export-link:hover {
      opacity: 0.7;
    }

    .export-icon {
      width: 1rem;
      height: 1rem;
    }

    .export-icon svg {
      width: 100%;
      height: 100%;
    }

    .content {
      padding: 1rem;
    }

    /* ===== SECTION STYLES ===== */
    .section {
      margin-bottom: 1.5rem;
    }

    .section:last-child {
      margin-bottom: 0;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.5rem 0.75rem;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 0.75rem;
    }

    .section-title {
      font-size: 1rem;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .section-count {
      font-size: 0.75rem;
      color: #64748b;
    }

    /* ===== CARD GRID ===== */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 0.75rem;
    }

    @media (min-width: 640px) {
      .cards-grid {
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      }
    }

    @media (min-width: 1024px) {
      .cards-grid {
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      }
    }

    /* ===== CARD ITEM ===== */
    .card-item {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .card-image-wrapper {
      position: relative;
      aspect-ratio: 5 / 7;
      border-radius: 6px;
      overflow: hidden;
      background: #1e293b;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .card-image-wrapper:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .card-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    /* Quantity badge */
    .quantity-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      background: rgba(0, 0, 0, 0.75);
      color: white;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      backdrop-filter: blur(4px);
    }

    /* Foiling indicator */
    .foil-badge {
      position: absolute;
      top: 4px;
      left: 4px;
      font-size: 0.65rem;
      font-weight: 600;
      padding: 2px 5px;
      border-radius: 3px;
      backdrop-filter: blur(4px);
    }

    .foil-badge.nf {
      background: rgba(100, 116, 139, 0.85);
      color: white;
    }

    .foil-badge.rf {
      background: rgba(234, 179, 8, 0.9);
      color: #1e293b;
    }

    .foil-badge.cf {
      background: linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4);
      color: white;
    }

    /* Card info below image */
    .card-info {
      padding: 0 2px;
    }

    .card-name {
      font-size: 0.75rem;
      font-weight: 500;
      color: #1e293b;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-meta {
      font-size: 0.65rem;
      color: #64748b;
      margin-top: 2px;
    }

    /* ===== NOTES ===== */
    .notes {
      background: #fef3c7;
      border-radius: 0.5rem;
      padding: 1rem;
      margin: 1rem 0.5rem 0.5rem;
    }

    .notes-title {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #0f172a;
    }

    .notes-text {
      font-size: 0.875rem;
      color: #1e293b;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    /* ===== LOADING STATE ===== */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      color: #64748b;
    }

    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #e2e8f0;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 0.75rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ===== DARK MODE ===== */
    :host-context(.dark) .decklist {
      background: #1e293b;
      border-color: #334155;
    }

    :host-context(.dark) .header {
      border-bottom-color: #334155;
    }

    :host-context(.dark) .title {
      color: #f1f5f9;
    }

    :host-context(.dark) .section-header {
      border-bottom-color: #334155;
    }

    :host-context(.dark) .section-title {
      color: #f1f5f9;
    }

    :host-context(.dark) .section-count {
      color: #94a3b8;
    }

    :host-context(.dark) .card-name {
      color: #e2e8f0;
    }

    :host-context(.dark) .card-meta {
      color: #94a3b8;
    }

    :host-context(.dark) .card-image-wrapper {
      background: #0f172a;
    }

    :host-context(.dark) .notes {
      background: #422006;
    }

    :host-context(.dark) .notes-title {
      color: #f1f5f9;
    }

    :host-context(.dark) .notes-text {
      color: #e2e8f0;
    }

    :host-context(.dark) .loading {
      color: #94a3b8;
    }

    :host-context(.dark) .loading-spinner {
      border-color: #334155;
      border-top-color: #60a5fa;
    }

    /* ===== SYSTEM DARK MODE (fallback for mobile) ===== */
    @media (prefers-color-scheme: dark) {
      .decklist {
        background: #1e293b;
        border-color: #334155;
      }

      .header {
        border-bottom-color: #334155;
      }

      .title {
        color: #f1f5f9;
      }

      .section-header {
        border-bottom-color: #334155;
      }

      .section-title {
        color: #f1f5f9;
      }

      .section-count {
        color: #94a3b8;
      }

      .card-name {
        color: #e2e8f0;
      }

      .card-meta {
        color: #94a3b8;
      }

      .card-image-wrapper {
        background: #0f172a;
      }

      .notes {
        background: #422006;
      }

      .notes-title {
        color: #f1f5f9;
      }

      .notes-text {
        color: #e2e8f0;
      }

      .loading {
        color: #94a3b8;
      }

      .loading-spinner {
        border-color: #334155;
        border-top-color: #60a5fa;
      }
    }
  `;

  @property({ attribute: 'deck-id' }) deckId = '';
  @property() sections = '';
  @property({ attribute: 'export-url' }) exportUrl = '';
  @property() notes = '';
  @property() title = 'Decklist';
  @property({ attribute: 'article-public-id' }) articlePublicId = '';
  @property({ attribute: 'hero-public-id' }) heroPublicId = '';

  // Internal state for deck fetching
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _deckData: {
    sections: Array<{
      label: string;
      totalCards: number;
      uniqueCards: number;
      cards: Array<{
        cardName: string;
        printingId: string;
        quantity: number;
        foiling?: string;
      }>;
    }>;
    title?: string;
    exportUrl?: string;
    notes?: string;
  } | null = null;

  // Track the last fetched deck-id to avoid duplicate fetches
  private _lastFetchedDeckId = '';

  // Lifecycle: Initial fetch when component first renders
  protected firstUpdated() {
    if (this.deckId && !this._lastFetchedDeckId) {
      this._fetchDeck();
    }
  }

  // Lifecycle: React to property changes after initial render
  protected updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('deckId') && this.deckId && this.deckId !== this._lastFetchedDeckId) {
      this._fetchDeck();
    }
  }

  // Fetch deck data from API
  private async _fetchDeck() {
    if (!this.deckId) return;

    this._loading = true;
    this._error = '';
    this._lastFetchedDeckId = this.deckId;

    try {
      // Build query parameters for article/hero context
      const params = new URLSearchParams();
      if (this.articlePublicId) {
        params.set('articlePublicId', this.articlePublicId);
      } else if (this.heroPublicId) {
        params.set('heroPublicId', this.heroPublicId);
      }

      const queryString = params.toString();
      const url = `/api/decks/${this.deckId}${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch deck');
      }

      const deck = result.data;
      this._deckData = this._transformDeckToSections(deck);
    } catch (e) {
      this._error = e instanceof Error ? e.message : 'Failed to fetch deck';
    } finally {
      this._loading = false;
    }
  }

  // Transform deck API response to sections format with aggregated quantities
  private _transformDeckToSections(deck: any): {
    sections: Array<{
      label: string;
      totalCards: number;
      uniqueCards: number;
      cards: Array<{ cardName: string; printingId: string; quantity: number; foiling?: string }>;
    }>;
    title: string;
    exportUrl?: string;
    notes?: string;
  } {
    const sections: Array<{
      label: string;
      totalCards: number;
      uniqueCards: number;
      cards: Array<{ cardName: string; printingId: string; quantity: number; foiling?: string }>;
    }> = [];

    // Define category order and display labels
    const categories: Array<{ key: string; label: string }> = [
      { key: 'hero', label: 'Hero' },
      { key: 'equipment', label: 'Equipment' },
      { key: 'maindeck', label: 'Main Deck' },
      { key: 'inventory', label: 'Inventory' },
      { key: 'maybeboard', label: 'Maybeboard' },
      { key: 'tokens', label: 'Tokens' },
    ];

    for (const { key, label } of categories) {
      const categoryCards = deck[key];
      if (Array.isArray(categoryCards) && categoryCards.length > 0) {
        // Aggregate cards by printingId
        const cardMap = new Map<string, {
          cardName: string;
          printingId: string;
          quantity: number;
          foiling?: string;
        }>();

        for (const card of categoryCards) {
          const printingId = card.printingId;
          const cardName = card.printingDetails?.display_name || card.printingDetails?.name || 'Unknown Card';
          const foiling = card.printingDetails?.foiling || card.foiling;

          if (cardMap.has(printingId)) {
            cardMap.get(printingId)!.quantity += 1;
          } else {
            cardMap.set(printingId, {
              cardName,
              printingId,
              quantity: 1,
              foiling,
            });
          }
        }

        const aggregatedCards = Array.from(cardMap.values());
        const totalCards = categoryCards.length;
        const uniqueCards = aggregatedCards.length;

        sections.push({ label, totalCards, uniqueCards, cards: aggregatedCards });
      }
    }

    return {
      sections,
      title: deck.name || 'Decklist',
      exportUrl: deck.fabraryUrl,
      notes: deck.description,
    };
  }

  // Helper to get image URL from printingId
  private getCardImageUrl(printingId: string): string {
    return `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${printingId}/public`;
  }

  // Helper to get foiling badge class
  private getFoilingClass(foiling?: string): string {
    if (!foiling) return 'nf';
    const f = foiling.toLowerCase();
    if (f.includes('rainbow') || f.includes('rf')) return 'rf';
    if (f.includes('cold') || f.includes('cf')) return 'cf';
    return 'nf';
  }

  // Helper to get foiling display text
  private getFoilingText(foiling?: string): string {
    if (!foiling) return 'NF';
    const f = foiling.toLowerCase();
    if (f.includes('rainbow') || f.includes('rf')) return 'RF';
    if (f.includes('cold') || f.includes('cf')) return 'CF';
    return 'NF';
  }

  render() {
    // Handle loading state
    if (this._loading) {
      return html`
        <div class="decklist">
          <div class="header">
            <h3 class="title">${this.title}</h3>
          </div>
          <div class="loading">
            <div class="loading-spinner"></div>
            <span>Loading deck...</span>
          </div>
        </div>
      `;
    }

    // Handle error state
    if (this._error) {
      return html`
        <div class="decklist">
          <div class="header">
            <h3 class="title">${this.title}</h3>
          </div>
          <div style="color: #ef4444; padding: 1.5rem; text-align: center;">
            Error: ${this._error}
          </div>
        </div>
      `;
    }

    // Determine data source
    let sectionsData: Array<{
      label: string;
      totalCards?: number;
      uniqueCards?: number;
      cards: Array<{ cardName: string; printingId: string; quantity: number; foiling?: string }>;
    }> = [];
    let effectiveTitle = this.title;
    let effectiveExportUrl = this.exportUrl;
    let effectiveNotes = this.notes;

    if (this._deckData) {
      // Use fetched deck data
      sectionsData = this._deckData.sections;
      effectiveTitle = this.title !== 'Decklist' ? this.title : (this._deckData.title || 'Decklist');
      effectiveExportUrl = this.exportUrl || this._deckData.exportUrl || '';
      effectiveNotes = this.notes || this._deckData.notes || '';
    } else if (this.sections) {
      // Use manual sections prop - parse and normalize
      try {
        const parsed = JSON.parse(this.sections);
        // Convert manual format to aggregated format
        sectionsData = parsed.map((section: any) => ({
          label: section.label,
          totalCards: section.cards?.length || 0,
          uniqueCards: section.cards?.length || 0,
          cards: (section.cards || []).map((card: any) => {
            if (typeof card === 'string') {
              // Parse "3x Card Name" format
              const match = card.match(/^(\d+)x\s+(.+)$/);
              if (match) {
                return { cardName: match[2], printingId: '', quantity: parseInt(match[1], 10) };
              }
              return { cardName: card, printingId: '', quantity: 1 };
            }
            return { ...card, quantity: card.quantity || 1 };
          }),
        }));
      } catch (e) {
        return html`<div style="color: #ef4444; padding: 1rem;">Error: Invalid sections data</div>`;
      }
    } else if (this.deckId) {
      // deck-id provided but not yet loaded
      return html``;
    } else {
      // No data source
      return html``;
    }

    if (sectionsData.length === 0) {
      return html``;
    }

    return html`
      <div class="decklist">
        <div class="header">
          <h3 class="title">${effectiveTitle}</h3>
          ${effectiveExportUrl ? html`
            <a
              href="${effectiveExportUrl}"
              class="export-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Full List
              <span class="export-icon">${this.renderExternalLinkIcon()}</span>
            </a>
          ` : ''}
        </div>
        <div class="content">
          ${sectionsData.map(section => html`
            <div class="section">
              <div class="section-header">
                <h4 class="section-title">${section.label}</h4>
                ${section.totalCards ? html`
                  <span class="section-count">
                    ${section.totalCards} cards${section.uniqueCards && section.uniqueCards !== section.totalCards
                      ? html` • ${section.uniqueCards} unique`
                      : ''}
                  </span>
                ` : ''}
              </div>
              <div class="cards-grid">
                ${(section.cards || []).map(card => html`
                  <div class="card-item">
                    <div class="card-image-wrapper">
                      ${card.printingId ? html`
                        <img
                          class="card-image"
                          src="${this.getCardImageUrl(card.printingId)}"
                          alt="${card.cardName}"
                          loading="lazy"
                          @error=${(e: Event) => {
                            const img = e.target as HTMLImageElement;
                            img.src = '/cardback.webp';
                          }}
                        />
                      ` : html`
                        <img class="card-image" src="/cardback.webp" alt="${card.cardName}" />
                      `}
                      ${card.quantity > 1 ? html`
                        <span class="quantity-badge">${card.quantity}x</span>
                      ` : ''}
                      <span class="foil-badge ${this.getFoilingClass(card.foiling)}">
                        ${this.getFoilingText(card.foiling)}
                      </span>
                    </div>
                    <div class="card-info">
                      <div class="card-name">${card.cardName}</div>
                      <div class="card-meta">
                        ${card.quantity > 1 ? `${card.quantity} ${this.getFoilingText(card.foiling)}` : this.getFoilingText(card.foiling)}
                      </div>
                    </div>
                  </div>
                `)}
              </div>
            </div>
          `)}
          ${effectiveNotes ? html`
            <div class="notes">
              <div class="notes-title">Notes</div>
              <div class="notes-text">${effectiveNotes}</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderExternalLinkIcon() {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" x2="21" y1="14" y2="3"/>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fab-decklist-block': FabDecklistBlock;
  }
}
