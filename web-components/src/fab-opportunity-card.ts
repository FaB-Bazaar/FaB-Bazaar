import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

type OpportunityReason = 'underpriced' | 'trending' | 'supply-issue' | 'correction' | 'outlier';
type ConfidenceLevel = 'low' | 'medium' | 'high';

interface PriceChange {
  old: number;
  new: number;
  percentage: number;
}

/**
 * fab-opportunity-card - Card opportunity analysis component for price movements
 *
 * @element fab-opportunity-card
 *
 * @attr {string} printing-id - The printing ID to fetch and display
 * @attr {string} reason - Opportunity reason: underpriced, trending, supply-issue, correction, outlier
 * @attr {string} confidence - Confidence level: low, medium, high
 * @attr {string} price-change - JSON string with {old, new, percentage}
 * @attr {string} note - Editorial note/commentary
 * @attr {string} api-base - Optional API base URL (defaults to current origin)
 *
 * @example
 * ```html
 * <fab-opportunity-card
 *   printing-id="WTR001"
 *   reason="underpriced"
 *   confidence="high"
 *   price-change='{"old": 10.00, "new": 8.50, "percentage": -15}'
 *   note="Recent reprint has driven prices down temporarily">
 * </fab-opportunity-card>
 * ```
 */
@customElement('fab-opportunity-card')
export class FabOpportunityCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin: 1.5rem 0;
    }

    .card {
      border: 2px solid;
      border-radius: 0.5rem;
      overflow: hidden;
    }

    /* Reason-based styling */
    .card.underpriced {
      background: #f0fdf4;
      border-color: #86efac;
    }
    .card.trending {
      background: #eff6ff;
      border-color: #93c5fd;
    }
    .card.supply-issue {
      background: #fff7ed;
      border-color: #fdba74;
    }
    .card.correction {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
    .card.outlier {
      background: #faf5ff;
      border-color: #d8b4fe;
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

    /* Badge container */
    .badges {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .badge svg {
      width: 1rem;
      height: 1rem;
    }

    /* Reason badges */
    .badge.underpriced {
      background: #22c55e;
      color: white;
    }
    .badge.trending {
      background: #6366f1;
      color: white;
    }
    .badge.supply-issue {
      background: #f97316;
      color: white;
    }
    .badge.correction {
      background: #64748b;
      color: white;
    }
    .badge.outlier {
      background: #a855f7;
      color: white;
    }

    /* Confidence indicator */
    .confidence {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #64748b;
    }

    .confidence-dot {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 50%;
    }

    .confidence-dot.high { background: #22c55e; }
    .confidence-dot.medium { background: #eab308; }
    .confidence-dot.low { background: #ef4444; }

    .confidence-label {
      font-weight: 500;
      text-transform: capitalize;
    }

    /* Card title and meta */
    .title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #0f172a;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #64748b;
    }

    .meta span::after {
      content: "•";
      margin-left: 0.5rem;
    }

    .meta span:last-child::after {
      content: "";
    }

    /* Price change */
    .price-change {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.875rem;
    }

    .price-old {
      text-decoration: line-through;
      color: #94a3b8;
    }

    .price-arrow {
      color: #64748b;
    }

    .price-new {
      font-weight: 600;
      color: #0f172a;
    }

    .price-badge {
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .price-badge.positive {
      background: #dcfce7;
      color: #166534;
    }

    .price-badge.negative {
      background: #fee2e2;
      color: #991b1b;
    }

    .price-badge.neutral {
      background: #f1f5f9;
      color: #475569;
    }

    /* Note */
    .note {
      background: rgba(255, 255, 255, 0.5);
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1rem;
    }

    .note-text {
      font-size: 0.875rem;
      line-height: 1.6;
      color: #334155;
    }

    /* Actions */
    .actions {
      padding-top: 0.75rem;
      margin-top: 0.75rem;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }

    .action-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 0.375rem;
      margin-bottom: 0.5rem;
    }

    .action-row:last-child {
      margin-bottom: 0;
    }

    .action-title {
      font-size: 0.875rem;
      font-weight: 500;
      color: #0f172a;
    }

    .action-subtitle {
      font-size: 0.75rem;
      color: #64748b;
    }

    /* Loading state */
    .loading {
      padding: 1.5rem;
      text-align: center;
      color: #64748b;
    }

    .spinner {
      display: inline-block;
      width: 1.5rem;
      height: 1.5rem;
      border: 3px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top-color: #3b82f6;
      animation: spinner 0.6s linear infinite;
    }

    @keyframes spinner {
      to { transform: rotate(360deg); }
    }

    /* Error state */
    .error {
      padding: 1.5rem;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 0.5rem;
      color: #dc2626;
    }

    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .card.underpriced { background: rgba(34, 197, 94, 0.1); border-color: #166534; }
      .card.trending { background: rgba(99, 102, 241, 0.1); border-color: #4338ca; }
      .card.supply-issue { background: rgba(249, 115, 22, 0.1); border-color: #c2410c; }
      .card.correction { background: rgba(100, 116, 139, 0.1); border-color: #475569; }
      .card.outlier { background: rgba(168, 85, 247, 0.1); border-color: #7c3aed; }

      .title { color: #f1f5f9; }
      .meta { color: #94a3b8; }
      .price-new { color: #f1f5f9; }
      .note { background: rgba(30, 41, 59, 0.5); border-color: #334155; }
      .note-text { color: #cbd5e1; }
      .action-row { background: rgba(30, 41, 59, 0.3); }
      .action-title { color: #f1f5f9; }
    }
  `;

  @property({ attribute: 'printing-id' }) printingId = '';
  @property() reason: OpportunityReason = 'underpriced';
  @property() confidence: ConfidenceLevel = 'medium';
  @property({ attribute: 'price-change' }) priceChangeJson = '';
  @property() note = '';
  @property({ attribute: 'api-base' }) apiBase = '';

  @state() private card: any = null;
  @state() private loading = true;
  @state() private error: string | null = null;

  private get priceChange(): PriceChange | null {
    if (!this.priceChangeJson) return null;
    try {
      return JSON.parse(this.priceChangeJson);
    } catch {
      return null;
    }
  }

  async connectedCallback() {
    super.connectedCallback();
    await this.fetchCard();
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
      console.error('Failed to fetch card data:', err);
      this.error = err instanceof Error ? err.message : 'Failed to load card data';
    } finally {
      this.loading = false;
    }
  }

  render() {
    if (this.loading) {
      return html`
        <div class="card ${this.reason}">
          <div class="loading">
            <div class="spinner"></div>
            <p>Loading opportunity analysis...</p>
          </div>
        </div>
      `;
    }

    if (this.error || !this.card) {
      return html`
        <div class="error">
          <strong>Failed to load card</strong>
          <div>${this.error || `Card not found: ${this.printingId}`}</div>
        </div>
      `;
    }

    return this.renderCard();
  }

  private renderCard() {
    const editionDisplay = this.getEditionDisplay(this.card.edition);
    const foilingInfo = this.getFoilingInfo(this.card.foiling);
    const reasonConfig = this.getReasonConfig(this.reason);
    const priceChange = this.priceChange;

    // Normalize percentage
    const normalizedPercentage = priceChange
      ? (Math.abs(priceChange.percentage) <= 1 ? priceChange.percentage * 100 : priceChange.percentage)
      : 0;

    return html`
      <div class="card ${this.reason}">
        <div class="card-content">
          <div class="layout">
            <!-- Card Image -->
            <div class="card-image">
              ${this.card.image_url ? html`
                <img src="${this.card.image_url}" alt="${this.card.display_name || this.card.name}" />
              ` : ''}
            </div>

            <!-- Card Info -->
            <div class="info">
              <!-- Badges -->
              <div class="badges">
                <span class="badge ${this.reason}">
                  ${this.renderReasonIcon(this.reason)}
                  ${reasonConfig.label}
                </span>
                <div class="confidence">
                  <span>Confidence:</span>
                  <div class="confidence-dot ${this.confidence}"></div>
                  <span class="confidence-label">${this.confidence}</span>
                </div>
              </div>

              <!-- Title -->
              <h3 class="title">${this.card.display_name || this.card.name}</h3>

              <!-- Meta -->
              <div class="meta">
                ${this.card.set ? html`<span>${this.card.set.toUpperCase()}</span>` : ''}
                ${editionDisplay ? html`<span>${editionDisplay}</span>` : ''}
                ${this.card.rarity ? html`<span>${this.card.rarity.toUpperCase()}</span>` : ''}
                ${foilingInfo ? html`<span>${foilingInfo}</span>` : ''}
              </div>

              <!-- Price Change -->
              ${priceChange ? html`
                <div class="price-change">
                  <div>
                    <span>Price: </span>
                    <span class="price-old">$${priceChange.old.toFixed(2)}</span>
                    <span class="price-arrow"> → </span>
                    <span class="price-new">$${priceChange.new.toFixed(2)}</span>
                  </div>
                  <span class="price-badge ${normalizedPercentage > 0 ? 'positive' : normalizedPercentage < 0 ? 'negative' : 'neutral'}">
                    ${normalizedPercentage > 0 ? '+' : ''}${normalizedPercentage.toFixed(1)}%
                  </span>
                </div>
              ` : ''}

              <!-- Note -->
              ${this.note ? html`
                <div class="note">
                  <div class="note-text">${this.note}</div>
                </div>
              ` : ''}

              <!-- Actions -->
              <div class="actions">
                <div class="action-row">
                  <div>
                    <div class="action-title">Who has this exact copy</div>
                    <div class="action-subtitle">Same set, edition, and foiling</div>
                  </div>
                </div>
                <div class="action-row">
                  <div>
                    <div class="action-title">Who has other versions</div>
                    <div class="action-subtitle">Any set, edition, or foiling</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private getReasonConfig(reason: OpportunityReason) {
    const configs = {
      underpriced: { label: 'Potential Buy' },
      trending: { label: 'Trending Up' },
      'supply-issue': { label: 'Supply Constraint' },
      correction: { label: 'Price Correction' },
      outlier: { label: 'Unusual Movement' },
    };
    return configs[reason] || configs.underpriced;
  }

  private renderReasonIcon(reason: OpportunityReason) {
    const icons: Record<OpportunityReason, ReturnType<typeof html>> = {
      underpriced: html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`,
      trending: html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
      'supply-issue': html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      correction: html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`,
      outlier: html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    };
    return icons[reason];
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
    return code ? (foilingMap[code] || '') : '';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fab-opportunity-card': FabOpportunityCard;
  }
}
