import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { buildTcgAffiliateLink, shouldShowAffiliateLink } from './utils/affiliate-link-builder';
import { buildCommentaryHtml, editionLabel, rarityLabel } from './utils/spotlight-commentary';
import { whoHasRows, whoHasUrl, type WhoHasRow, type WhoHasTarget } from './utils/who-has';
import { watchTheme, unwatchTheme } from './utils/theme';

/**
 * fab-spotlight-card - Featured card analysis component with rich commentary
 *
 * @element fab-spotlight-card
 *
 * @attr {string} printing-id - The printing ID to fetch and display
 * @attr {string} title - Optional custom title (defaults to card name)
 * @attr {string} commentary - Rich text commentary (supports **Card Name** mentions)
 * @attr {string} api-base - Optional API base URL (defaults to current origin)
 *
 * @example
 * ```html
 * <fab-spotlight-card
 *   printing-id="WTR001"
 *   title="Round 1 MVP"
 *   commentary="This card dominated the matchup. **Fyendal's Spring Tunic** enabled the combo.">
 * </fab-spotlight-card>
 * ```
 */
@customElement('fab-spotlight-card')
export class FabSpotlightCard extends LitElement {
  static styles = css`
    :host {
      /* CSS Variables for theming - Light Mode */
      --fab-spotlight-bg: #ffffff;
      --fab-spotlight-border: #d1d5db;
      --fab-spotlight-badge-bg: #1d4ed8; /* link / accent: the site's plain blue */
      --fab-spotlight-badge-text: #ffffff;
      --fab-spotlight-text: #111827;
      --fab-spotlight-text-muted: #6b7280;
      --fab-spotlight-commentary-bg: transparent;
      --fab-spotlight-commentary-border: transparent;
      --fab-spotlight-action-bg: transparent;
      --fab-spotlight-action-hover-bg: #f3f4f6;
      --fab-spotlight-action-border: #e5e7eb;
      --fab-spotlight-error-bg: #fef2f2;
      --fab-spotlight-error-border: #fca5a5;
      --fab-spotlight-error-text: #dc2626;

      display: block;
      margin: 1.5rem 0;
    }

    /* Dark Mode */
    @media (prefers-color-scheme: dark) {
      :host {
        --fab-spotlight-bg: #182132;
        --fab-spotlight-border: #374151;
        --fab-spotlight-badge-bg: #60a5fa;
        --fab-spotlight-badge-text: #111827;
        --fab-spotlight-text: #f3f4f6;
        --fab-spotlight-text-muted: #9ca3af;
        --fab-spotlight-commentary-bg: transparent;
        --fab-spotlight-commentary-border: transparent;
        --fab-spotlight-action-bg: transparent;
        --fab-spotlight-action-hover-bg: #263145;
        --fab-spotlight-action-border: #374151;
        --fab-spotlight-error-bg: #450a0a;
        --fab-spotlight-error-border: #991b1b;
        --fab-spotlight-error-text: #fca5a5;
      }
    }

    /* Tailwind class-based dark mode */
    :host([dark]) {
      --fab-spotlight-bg: #182132;
      --fab-spotlight-border: #374151;
      --fab-spotlight-badge-bg: #60a5fa;
      --fab-spotlight-badge-text: #111827;
      --fab-spotlight-text: #f3f4f6;
      --fab-spotlight-text-muted: #9ca3af;
      --fab-spotlight-commentary-bg: transparent;
      --fab-spotlight-commentary-border: transparent;
      --fab-spotlight-action-bg: transparent;
      --fab-spotlight-action-hover-bg: #263145;
      --fab-spotlight-action-border: #374151;
      --fab-spotlight-error-bg: #450a0a;
      --fab-spotlight-error-border: #991b1b;
      --fab-spotlight-error-text: #fca5a5;
    }

    .card {
      background: var(--fab-spotlight-bg);
      border: 1px solid var(--fab-spotlight-border);
      border-radius: 0.25rem;
      overflow: hidden;
    }

    .card-content {
      padding: 1.5rem;
    }

    .layout {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    @media (min-width: 1024px) {
      .layout {
        flex-direction: row;
      }
    }

    .card-image {
      flex-shrink: 0;
    }

    /* Direct child only: the TCGplayer logo is an <img> inside .card-image too,
       and this rule (more specific than .purchase-link-logo) blew it up to 300px. */
    .card-image > img {
      width: 100%;
      max-width: 300px;
      height: auto;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    .info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .badge-container {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    /* A plain label, not a coloured pill. */
    .badge {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--fab-spotlight-text-muted);
    }

    .title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--fab-spotlight-text);
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--fab-spotlight-text-muted);
    }

    .meta span::after {
      content: "•";
      margin-left: 0.5rem;
    }

    .meta span:last-child::after {
      content: "";
    }

    .commentary {
      background: var(--fab-spotlight-commentary-bg);
      border: 1px solid var(--fab-spotlight-commentary-border);
      border-radius: 0;
      padding: 0;
    }

    .commentary-text {
      font-size: 0.9375rem;
      line-height: 1.6;
      color: var(--fab-spotlight-text);
    }

    .card-mention {
      font-weight: 600;
      color: var(--fab-spotlight-text);
    }

    /* Markdown-specific styles */
    .commentary-text h1,
    .commentary-text h2,
    .commentary-text h3 {
      margin: 1em 0 0.5em 0;
      font-weight: 600;
      color: var(--fab-spotlight-text);
    }

    .commentary-text h1 { font-size: 1.5em; }
    .commentary-text h2 { font-size: 1.25em; }
    .commentary-text h3 { font-size: 1.1em; }

    .commentary-text ul,
    .commentary-text ol {
      margin: 0.5em 0;
      padding-left: 1.5em;
    }

    .commentary-text li {
      margin: 0.25em 0;
    }

    .commentary-text a {
      color: var(--fab-spotlight-badge-bg);
      text-decoration: underline;
    }

    .commentary-text a:hover {
      opacity: 0.8;
    }

    .commentary-text code {
      background: var(--fab-spotlight-action-bg);
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      font-family: monospace;
      font-size: 0.875em;
    }

    .commentary-text pre {
      background: var(--fab-spotlight-action-bg);
      padding: 1rem;
      border-radius: 0.375rem;
      overflow-x: auto;
      margin: 0.5em 0;
    }

    .commentary-text pre code {
      background: none;
      padding: 0;
    }

    .commentary-text blockquote {
      border-left: 3px solid var(--fab-spotlight-badge-bg);
      padding-left: 1rem;
      margin: 0.5em 0;
      color: var(--fab-spotlight-text-muted);
      font-style: italic;
    }

    .commentary-text p {
      margin: 0.5em 0;
    }

    .commentary-text p:first-child {
      margin-top: 0;
    }

    .commentary-text p:last-child {
      margin-bottom: 0;
    }

    .actions {
      padding-top: 0.75rem;
      margin-top: 0.75rem;
      border-top: 1px solid var(--fab-spotlight-action-border);
    }

    .action-row {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem;
      background: var(--fab-spotlight-action-bg);
      border: 0;
      border-bottom: 1px solid var(--fab-spotlight-action-border);
      border-radius: 0;
      font: inherit;
      text-align: left;
      color: inherit;
      cursor: pointer;
    }

    .action-row:focus-visible {
      outline: 2px solid var(--fab-spotlight-badge-bg);
      outline-offset: -2px;
    }

    .action-caret {
      color: var(--fab-spotlight-text-muted);
      font-size: 0.75rem;
    }

    .who-has-list {
      list-style: none;
      margin: 0;
      padding: 0.25rem 0.5rem 0.5rem;
      font-size: 0.875rem;
      color: var(--fab-spotlight-text);
    }

    .who-has-list li {
      padding: 0.25rem 0;
    }

    .who-has-list a {
      color: var(--fab-spotlight-badge-bg);
      text-decoration: underline;
    }

    .who-has-list a:hover {
      text-decoration: none;
    }

    .who-has-note {
      margin: 0;
      padding: 0.25rem 0.5rem 0.5rem;
      font-size: 0.875rem;
      color: var(--fab-spotlight-text-muted);
    }

    .action-row:hover {
      background: var(--fab-spotlight-action-hover-bg);
    }


    .action-label {
      flex: 1;
      font-size: 0.875rem;
    }

    .action-title,
    .action-subtitle {
      display: block;
    }

    .action-title {
      font-weight: 500;
      color: var(--fab-spotlight-text);
      margin-bottom: 0.125rem;
    }

    .action-subtitle {
      font-size: 0.75rem;
      color: var(--fab-spotlight-text-muted);
    }

    /* Loading state */
    .loading {
      padding: 1.5rem;
      text-align: center;
      color: var(--fab-spotlight-text-muted);
    }

    .spinner {
      display: inline-block;
      width: 1.5rem;
      height: 1.5rem;
      border: 3px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top-color: var(--fab-spotlight-badge-bg);
      animation: spinner 0.6s linear infinite;
    }

    @keyframes spinner {
      to { transform: rotate(360deg); }
    }

    /* Error state */
    .error {
      padding: 1.5rem;
      background: var(--fab-spotlight-error-bg);
      border: 1px solid var(--fab-spotlight-error-border);
      border-radius: 0.5rem;
      color: var(--fab-spotlight-error-text);
    }

    .error-title {
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    /* Interactive card mentions */
    .inline-card-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      vertical-align: middle;
      margin: 0 0.125rem;
      cursor: pointer;
      transition: opacity 0.15s ease;
    }

    .inline-card-wrapper:hover {
      opacity: 0.85;
    }

    .inline-card-thumbnail {
      width: 16px;
      height: 22px;
      border-radius: 2px;
      object-fit: cover;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      vertical-align: middle;
    }

    .inline-card-wrapper:hover .inline-card-thumbnail {
      transform: scale(1.15);
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
    }

    .inline-card-name {
      font-weight: 600;
      color: var(--fab-spotlight-text);
    }

    .inline-card-loading {
      display: inline-block;
      width: 16px;
      height: 22px;
      background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
      background-size: 200% 100%;
      animation: loading 1.5s ease-in-out infinite;
      border-radius: 2px;
    }

    @keyframes loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Card overlay modal */
    .card-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      cursor: pointer;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .card-overlay img {
      max-width: 90vw;
      max-height: 90vh;
      width: auto;
      height: auto;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      cursor: default;
      animation: zoomIn 0.2s ease;
    }

    @keyframes zoomIn {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .card-overlay-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.3);
      color: white;
      border-radius: 50%;
      font-size: 1.5rem;
      cursor: pointer;
      transition: background 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      font-weight: 300;
      z-index: 10000;
    }

    .card-overlay-close:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.5);
    }

    /* TCGPlayer Purchase Link */
    .purchase-link-container {
      margin-top: 0.375rem;
      padding-top: 0.375rem;
      border-top: 1px solid rgba(203, 213, 225, 0.3);
    }

    .purchase-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.6875rem;
      line-height: 1;
      color: #2563eb;
      text-decoration: none;
      transition: color 0.2s ease;
      opacity: 0.85;
    }

    .purchase-link:hover {
      color: #1d4ed8;
      opacity: 1;
    }

    @media (prefers-color-scheme: dark) {
      .purchase-link-container {
        border-top: 1px solid rgba(71, 85, 105, 0.3);
      }

      .purchase-link {
        color: #60a5fa;
      }

      .purchase-link:hover {
        color: #93c5fd;
      }
    }

    :host([dark]) .purchase-link-container {
      border-top: 1px solid rgba(71, 85, 105, 0.3);
    }

    :host([dark]) .purchase-link {
      color: #60a5fa;
    }

    :host([dark]) .purchase-link:hover {
      color: #93c5fd;
    }

    .purchase-link-text {
      white-space: nowrap;
    }

    .purchase-link-logo {
      height: 0.625rem;
      width: auto;
      flex-shrink: 0;
    }
  `;

  @property({ attribute: 'printing-id' }) printingId = '';
  @property() title = '';
  @property() commentary = '';
  @property({ attribute: 'api-base' }) apiBase = '';

  @state() private card: any = null;
  @state() private loading = true;
  @state() private error: string | null = null;
  @state() private cardDataMap: Map<string, any> = new Map();
  @state() private loadingCards: Set<string> = new Set();
  @state() private overlayImageUrl: string | null = null;
  @state() private overlayAlt: string = '';
  @state() private whoHasOpen: 'exact' | 'any' | null = null;
  @state() private whoHas: Partial<Record<'exact' | 'any', WhoHasRow[] | 'loading'>> = {};

  async connectedCallback() {
    super.connectedCallback();
    watchTheme(this);
    await this.fetchCard();
    await this.fetchCardDataByNames();
    document.addEventListener('keydown', this.handleKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    unwatchTheme(this);
    document.removeEventListener('keydown', this.handleKeydown);
  }

  async updated(changedProperties: Map<string, any>) {
    // Refetch if printingId changes
    if (changedProperties.has('printingId') && !changedProperties.get('printingId')) {
      await this.fetchCard();
    }

    // Refetch card data if commentary changes
    if (changedProperties.has('commentary')) {
      await this.fetchCardDataByNames();
    }
  }

  private async fetchCard() {
    if (!this.printingId) {
      this.error = 'No printing ID provided';
      this.loading = false;
      return;
    }

    try {
      this.loading = true;
      this.error = null;

      const base = this.apiBase || window.location.origin;
      const url = `${base}/api/printings/search?printingIds=${this.printingId}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.data?.printings?.length > 0) {
        this.card = data.data.printings[0];
      } else {
        throw new Error('Card not found in response');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load card data';
    } finally {
      this.loading = false;
    }
  }

  private extractCardNames(): string[] {
    if (!this.commentary) return [];

    const cardNames: string[] = [];
    const cardMentionRegex = /\*\*([^*]+)\*\*/g;
    let match;

    while ((match = cardMentionRegex.exec(this.commentary)) !== null) {
      const cardName = match[1];
      const isLikelyCardName = /[A-Z]/.test(cardName) || cardName.includes("'");
      if (isLikelyCardName) {
        cardNames.push(cardName);
      }
    }

    return [...new Set(cardNames)]; // Remove duplicates
  }

  private async fetchCardDataByNames() {
    const cardNames = this.extractCardNames();

    for (const cardName of cardNames) {
      // Skip if already loaded or loading
      if (this.cardDataMap.has(cardName) || this.loadingCards.has(cardName)) {
        continue;
      }

      this.loadingCards.add(cardName);

      try {
        const base = this.apiBase || window.location.origin;
        const url = `${base}/api/printings/search?name=${encodeURIComponent(cardName)}&show=all&limit=1`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data?.printings?.length > 0) {
          const cardData = data.data.printings[0];
          this.cardDataMap.set(cardName, cardData);
          this.requestUpdate(); // Trigger re-render
        }
      } catch (err) {
        // Silently handle fetch errors for card mentions
      } finally {
        this.loadingCards.delete(cardName);
        this.requestUpdate(); // Trigger re-render after fetch completes
      }
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

  private handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.overlayImageUrl) {
      this.closeOverlay();
    }
  };

  render() {
    let mainContent;

    if (this.loading) {
      mainContent = this.renderLoading();
    } else if (this.error || !this.card) {
      mainContent = this.renderError();
    } else {
      mainContent = this.renderCard();
    }

    return html`
      ${mainContent}
      ${this.renderOverlay()}
    `;
  }

  private renderLoading() {
    return html`
      <div class="card">
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading spotlight card...</p>
        </div>
      </div>
    `;
  }

  private renderError() {
    return html`
      <div class="card">
        <div class="error">
          <div class="error-title">Failed to load card</div>
          <div>${this.error || `Card not found: ${this.printingId}`}</div>
        </div>
      </div>
    `;
  }

  private renderCard() {
    const displayTitle = this.title || this.card.display_name || this.card.name;
    const editionDisplay = editionLabel(this.card.edition);
    const rarityDisplay = rarityLabel(this.card.rarity);
    const foilingInfo = this.getFoilingInfo(this.card.foiling);

    return html`
      <div class="card">
        <div class="card-content">
          <div class="layout">
            <!-- Card Image -->
            <div class="card-image">
              ${this.card.image_url ? html`
                <img src="${this.card.image_url}" alt="${displayTitle}" />
              ` : html`
                <div class="placeholder">No image available</div>
              `}
              ${this.renderPurchaseLink()}
            </div>

            <!-- Card Info -->
            <div class="info">
              <!-- Badge -->
              <div class="badge-container">
                <span class="badge">Card spotlight</span>
              </div>

              <!-- Title -->
              <h3 class="title">${displayTitle}</h3>

              <!-- Meta -->
              <div class="meta">
                ${this.card.set ? html`<span>${this.card.set.toUpperCase()}</span>` : ''}
                ${editionDisplay ? html`<span>${editionDisplay}</span>` : ''}
                ${rarityDisplay ? html`<span>${rarityDisplay}</span>` : ''}
                ${this.card.foiling && foilingInfo ? html`<span>${foilingInfo}</span>` : ''}
              </div>

              <!-- Commentary -->
              ${this.commentary ? html`
                <div class="commentary">
                  <div
                    class="commentary-text"
                    @click="${this.onCommentaryActivate}"
                    @keydown="${this.onCommentaryActivate}"
                  >${unsafeHTML(buildCommentaryHtml(this.commentary, this.cardDataMap, this.loadingCards))}</div>
                </div>
              ` : ''}

              <!-- Actions -->
              <div class="actions">
                ${this.card.printing_id ? this.renderWhoHas('exact', 'Who has this exact copy', 'Same set, edition, and foiling', { printingId: this.card.printing_id }) : ''}
                ${this.card.card_unique_id ? this.renderWhoHas('any', 'Who has other versions', 'Any set, edition, or foiling', { cardUniqueId: this.card.card_unique_id }) : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Card mentions are plain markup inside the commentary HTML — open the
  // full-size image on click / Enter / Space via delegation.
  private onCommentaryActivate = (e: Event) => {
    if (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ') return;
    const mention = (e.target as Element | null)?.closest?.('[data-card-img]') as HTMLElement | null;
    if (!mention) return;
    e.preventDefault();
    this.openOverlay(mention.dataset.cardImg!, mention.dataset.cardName ?? '');
  };

  private getFoilingInfo(foiling?: string): string {
    const foilingMap: Record<string, string> = {
      'R': 'Rainbow Foil',
      'C': 'Cold Foil',
      'G': 'Gold Foil',
      'S': 'Non-foil',
    };
    const code = foiling?.toUpperCase();
    return code ? (foilingMap[code] || 'Non-foil') : '';
  }

  private renderOverlay() {
    if (!this.overlayImageUrl) return html``;

    return html`
      <div class="card-overlay" @click="${this.closeOverlay}">
        <button
          class="card-overlay-close"
          @click="${this.closeOverlay}"
          aria-label="Close"
        >
          ×
        </button>
        <img
          src="${this.overlayImageUrl}"
          alt="${this.overlayAlt}"
          @click="${(e: Event) => e.stopPropagation()}"
        />
      </div>
    `;
  }

  // "Who has": the same for-trade lookup as the React WhoHasDropdown, loaded
  // when a row is first opened and listed as plain binder links.
  private async toggleWhoHas(key: 'exact' | 'any', target: WhoHasTarget) {
    const open = this.whoHasOpen === key ? null : key;
    this.whoHasOpen = open;
    if (!open || this.whoHas[key]) return;
    this.whoHas = { ...this.whoHas, [key]: 'loading' };
    try {
      const res = await fetch(whoHasUrl(target, this.apiBase || window.location.origin));
      this.whoHas = { ...this.whoHas, [key]: whoHasRows(res.ok ? await res.json() : null) };
    } catch {
      this.whoHas = { ...this.whoHas, [key]: [] };
    }
  }

  private renderWhoHas(key: 'exact' | 'any', title: string, subtitle: string, target: WhoHasTarget) {
    const open = this.whoHasOpen === key;
    const rows = this.whoHas[key];
    return html`
      <button type="button" class="action-row" aria-expanded="${open}" @click="${() => this.toggleWhoHas(key, target)}">
        <span class="action-label">
          <span class="action-title">${title}</span>
          <span class="action-subtitle">${subtitle}</span>
        </span>
        <span class="action-caret" aria-hidden="true">${open ? '▲' : '▼'}</span>
      </button>
      ${!open ? '' : rows === 'loading' || !rows ? html`<p class="who-has-note">Loading…</p>`
        : rows.length === 0 ? html`<p class="who-has-note">Nobody has this listed for trade.</p>`
        : html`<ul class="who-has-list">${rows.map(r => html`
            <li><a href="${r.href}">${r.name}</a> — ${r.count} in ${r.binderName}</li>`)}</ul>`}
    `;
  }

  private renderPurchaseLink() {
    // Check if we have a TCGPlayer URL and should show it
    if (!shouldShowAffiliateLink(this.card.tcgplayer_url)) {
      return html``;
    }

    // Build affiliate link with tracking (or direct link if no consent)
    const affiliateUrl = buildTcgAffiliateLink(
      this.card.tcgplayer_url,
      'SpotlightCardPurchase',
      { pageContext: 'Article' } // Override page context since this is in article content
    );

    return html`
      <div class="purchase-link-container">
        <a
          href="${affiliateUrl}"
          class="purchase-link"
          target="_blank"
          rel="noopener noreferrer"
          title="Purchase this card on TCGPlayer"
          @click="${(e: Event) => e.stopPropagation()}"
        >
          <span class="purchase-link-text">Available for purchase here</span>
          <img
            src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
            alt="TCGPlayer"
            class="purchase-link-logo"
          />
        </a>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fab-spotlight-card': FabSpotlightCard;
  }
}
