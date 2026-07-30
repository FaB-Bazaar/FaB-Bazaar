import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { marked } from 'marked';
import { buildTcgAffiliateLink, shouldShowAffiliateLink } from './utils/affiliate-link-builder';
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
      --fab-spotlight-bg: #eff6ff;
      --fab-spotlight-border: #93c5fd;
      --fab-spotlight-badge-bg: #6366f1;
      --fab-spotlight-badge-text: #ffffff;
      --fab-spotlight-text: #0f172a;
      --fab-spotlight-text-muted: #64748b;
      --fab-spotlight-commentary-bg: #f0f9ff;
      --fab-spotlight-commentary-border: #bae6fd;
      --fab-spotlight-action-bg: #f0f9ff;
      --fab-spotlight-action-hover-bg: #e0f2fe;
      --fab-spotlight-action-border: #bae6fd;
      --fab-spotlight-error-bg: #fef2f2;
      --fab-spotlight-error-border: #fca5a5;
      --fab-spotlight-error-text: #dc2626;

      display: block;
      margin: 1.5rem 0;
    }

    /* Dark Mode */
    @media (prefers-color-scheme: dark) {
      :host {
        --fab-spotlight-bg: #1e293b;
        --fab-spotlight-border: #475569;
        --fab-spotlight-badge-bg: #818cf8;
        --fab-spotlight-badge-text: #0f172a;
        --fab-spotlight-text: #f1f5f9;
        --fab-spotlight-text-muted: #94a3b8;
        --fab-spotlight-commentary-bg: #0f172a;
        --fab-spotlight-commentary-border: #334155;
        --fab-spotlight-action-bg: #0f172a;
        --fab-spotlight-action-hover-bg: #1e293b;
        --fab-spotlight-action-border: #334155;
        --fab-spotlight-error-bg: #450a0a;
        --fab-spotlight-error-border: #991b1b;
        --fab-spotlight-error-text: #fca5a5;
      }
    }

    /* Tailwind class-based dark mode */
    :host([dark]) {
      --fab-spotlight-bg: #1e293b;
      --fab-spotlight-border: #475569;
      --fab-spotlight-badge-bg: #818cf8;
      --fab-spotlight-badge-text: #0f172a;
      --fab-spotlight-text: #f1f5f9;
      --fab-spotlight-text-muted: #94a3b8;
      --fab-spotlight-commentary-bg: #0f172a;
      --fab-spotlight-commentary-border: #334155;
      --fab-spotlight-action-bg: #0f172a;
      --fab-spotlight-action-hover-bg: #1e293b;
      --fab-spotlight-action-border: #334155;
      --fab-spotlight-error-bg: #450a0a;
      --fab-spotlight-error-border: #991b1b;
      --fab-spotlight-error-text: #fca5a5;
    }

    .card {
      background: var(--fab-spotlight-bg);
      border: 2px solid var(--fab-spotlight-border);
      border-radius: 0.5rem;
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

    .card-image img {
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

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.75rem;
      background: var(--fab-spotlight-badge-bg);
      color: var(--fab-spotlight-badge-text);
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .badge svg {
      width: 1rem;
      height: 1rem;
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
      border-radius: 0.5rem;
      padding: 1rem;
    }

    .commentary-text {
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--fab-spotlight-text);
    }

    .card-mention {
      font-weight: 600;
      color: var(--fab-spotlight-badge-bg);
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
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem;
      background: var(--fab-spotlight-action-bg);
      border-radius: 0.375rem;
      margin-bottom: 0.5rem;
      transition: background-color 0.2s;
    }

    .action-row:hover {
      background: var(--fab-spotlight-action-hover-bg);
    }

    .action-row:last-child {
      margin-bottom: 0;
    }

    .action-label {
      flex: 1;
      font-size: 0.875rem;
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
      width: 28px;
      height: 39px;
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
      width: 28px;
      height: 39px;
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
    const editionDisplay = this.getEditionDisplay(this.card.edition);
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
                <span class="badge">
                  ${this.renderStarIcon()}
                  Card Spotlight
                </span>
              </div>

              <!-- Title -->
              <h3 class="title">${displayTitle}</h3>

              <!-- Meta -->
              <div class="meta">
                ${this.card.set ? html`<span>${this.card.set.toUpperCase()}</span>` : ''}
                ${editionDisplay ? html`<span>${editionDisplay}</span>` : ''}
                ${this.card.rarity ? html`<span>${this.card.rarity.toUpperCase()}</span>` : ''}
                ${this.card.foiling && foilingInfo ? html`<span>${foilingInfo}</span>` : ''}
              </div>

              <!-- Commentary -->
              ${this.commentary ? html`
                <div class="commentary">
                  <div class="commentary-text">
                    ${this.parseCommentary(this.commentary)}
                  </div>
                </div>
              ` : ''}

              <!-- Actions -->
              <div class="actions">
                ${this.card.printing_id ? html`
                  <div class="action-row">
                    <div class="action-label">
                      <div class="action-title">Who has this exact copy</div>
                      <div class="action-subtitle">Same set, edition, and foiling</div>
                    </div>
                  </div>
                ` : ''}
                ${this.card.card_unique_id ? html`
                  <div class="action-row">
                    <div class="action-label">
                      <div class="action-title">Who has other versions</div>
                      <div class="action-subtitle">Any set, edition, or foiling</div>
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private parseCommentary(text: string) {
    if (!text) return html``;

    // Phase 1: Extract **Card Name** mentions and replace with placeholders
    const cardMentions: string[] = [];
    const cardMentionRegex = /\*\*([^*]+)\*\*/g;

    const withPlaceholders = text.replace(cardMentionRegex, (match, cardName) => {
      // Check if this looks like markdown bold or a card mention
      // Heuristic: Card names are usually title-case, not all lowercase
      const isLikelyCardName = /[A-Z]/.test(cardName) || cardName.includes("'");

      if (isLikelyCardName) {
        const index = cardMentions.length;
        cardMentions.push(cardName);
        return `{{CARDMENTION${index}}}`;
      }

      // Leave as markdown bold
      return match;
    });

    // Phase 2: Parse markdown
    const htmlContent = marked.parse(withPlaceholders, {
      breaks: true,  // Convert \n to <br>
      gfm: true,     // GitHub Flavored Markdown
    }) as string;

    // Phase 3: Split HTML by placeholders and build mixed content
    const parts: any[] = [];
    let lastIndex = 0;

    cardMentions.forEach((cardName, index) => {
      const placeholder = `{{CARDMENTION${index}}}`;
      const placeholderIndex = htmlContent.indexOf(placeholder, lastIndex);

      if (placeholderIndex !== -1) {
        // Add HTML before placeholder
        if (placeholderIndex > lastIndex) {
          parts.push(unsafeHTML(htmlContent.substring(lastIndex, placeholderIndex)));
        }

        // Add interactive card mention
        const cardData = this.cardDataMap.get(cardName);
        const isLoading = this.loadingCards.has(cardName);

        if (cardData && cardData.image_url) {
          // Render as interactive thumbnail + text (both clickable)
          parts.push(html`
            <span class="inline-card-wrapper" @click="${() => this.openOverlay(cardData.image_url, cardName)}" title="Click to view full size">
              <img
                class="inline-card-thumbnail"
                src="${cardData.image_url}"
                alt="${cardName}"
              />
              <span class="inline-card-name">${cardName}</span>
            </span>
          `);
        } else if (isLoading) {
          // Show loading placeholder
          parts.push(html`
            <span class="inline-card-wrapper">
              <span class="inline-card-loading"></span>
              <span class="inline-card-name">${cardName}</span>
            </span>
          `);
        } else {
          // Fallback to styled text
          parts.push(html`<span class="card-mention">${cardName}</span>`);
        }

        lastIndex = placeholderIndex + placeholder.length;
      }
    });

    // Add remaining HTML after last placeholder
    if (lastIndex < htmlContent.length) {
      parts.push(unsafeHTML(htmlContent.substring(lastIndex)));
    }

    return parts;
  }

  private getEditionDisplay(code?: string): string {
    if (!code) return '';
    const lookupCode = code.toLowerCase();
    const editions: Record<string, string> = {
      a: 'Alpha',
      f: '1st',
      u: 'UNL',
      n: '',
      normal: '',
    };
    return editions[lookupCode] || code.toUpperCase();
  }

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

  private renderStarIcon() {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
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
