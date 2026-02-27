import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * fab-section-header - Semantic section headers for articles
 *
 * Replaces standalone text blocks used as headers.
 * Provides consistent typography and semantic HTML structure.
 *
 * @element fab-section-header
 *
 * @attr {string} title - The section title
 * @attr {string} subtitle - Optional subtitle
 * @attr {string} level - Heading level: "2" or "3" (default: "2")
 *
 * @example
 * ```html
 * <fab-section-header
 *   title="The Core!"
 *   subtitle="Essential cards for the strategy"
 *   level="2">
 * </fab-section-header>
 * ```
 */
@customElement('fab-section-header')
export class FabSectionHeader extends LitElement {
  static styles = css`
    :host {
      /* CSS Variables for theming */
      --fab-header-title: #0f172a;
      --fab-header-title-dark: #f1f5f9;
      --fab-header-subtitle: #64748b;
      --fab-header-subtitle-dark: #94a3b8;
      --fab-header-border: #e2e8f0;

      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      margin: 2rem 0 1.5rem 0;
    }

    * {
      visibility: visible !important;
      opacity: 1 !important;
    }

    .header {
      border-bottom: 2px solid var(--fab-header-border);
      padding-bottom: 0.75rem;
    }

    h2, h3 {
      margin: 0 0 0.5rem 0;
      color: var(--fab-header-title);
      font-weight: 700;
      line-height: 1.2;
    }

    h2 {
      font-size: 1.875rem;
    }

    h3 {
      font-size: 1.5rem;
    }

    @media (prefers-color-scheme: dark) {
      h2, h3 {
        color: var(--fab-header-title-dark);
      }
    }

    /* Support Tailwind's class-based dark mode */
    :host-context(.dark) h2,
    :host-context(.dark) h3 {
      color: var(--fab-header-title-dark);
    }

    .subtitle {
      margin: 0.5rem 0 0 0;
      font-size: 1rem;
      color: var(--fab-header-subtitle);
      font-weight: 400;
      line-height: 1.5;
    }

    @media (prefers-color-scheme: dark) {
      .subtitle {
        color: var(--fab-header-subtitle-dark);
      }
    }

    :host-context(.dark) .subtitle {
      color: var(--fab-header-subtitle-dark);
    }

    /* Hide component if no content */
    :host(:empty) {
      display: none;
    }
  `;

  @property() title = '';
  @property() subtitle = '';
  @property() level = '2';

  render() {
    if (!this.title) {
      return html``;
    }

    return html`
      <div class="header">
        ${this.level === '3'
          ? html`<h3>${this.title}</h3>`
          : html`<h2>${this.title}</h2>`
        }
        ${this.subtitle ? html`
          <p class="subtitle">${this.subtitle}</p>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fab-section-header': FabSectionHeader;
  }
}
