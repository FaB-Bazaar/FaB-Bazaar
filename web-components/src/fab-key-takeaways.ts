import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * fab-key-takeaways - Bullet highlights for article scanning
 *
 * Provides 3-5 bullet point highlights for quick scanning.
 * Improves scanability and SEO.
 *
 * @element fab-key-takeaways
 *
 * @attr {string} items - Pipe-separated list of takeaways (e.g., "Item 1|Item 2|Item 3")
 * @attr {string} title - Optional custom title (default: "Key Takeaways")
 *
 * @example
 * ```html
 * <fab-key-takeaways
 *   title="TL;DR"
 *   items="Dromai went 6-2 at the event|Sideboarding was crucial in 3 matchups|Key card: Invoke Tomeltai">
 * </fab-key-takeaways>
 * ```
 */
@customElement('fab-key-takeaways')
export class FabKeyTakeaways extends LitElement {
  static styles = css`
    :host {
      /* CSS Variables for theming */
      --fab-takeaways-bg: #f0f9ff;
      --fab-takeaways-bg-dark: #1e3a5f;
      --fab-takeaways-border: #3b82f6;
      --fab-takeaways-title: #1e40af;
      --fab-takeaways-title-dark: #93c5fd;
      --fab-takeaways-text: #1e293b;
      --fab-takeaways-text-dark: #e2e8f0;
      --fab-takeaways-bullet: #3b82f6;

      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      margin: 2rem 0;
    }

    * {
      visibility: visible !important;
      opacity: 1 !important;
    }

    .takeaways {
      background: var(--fab-takeaways-bg);
      border-left: 4px solid var(--fab-takeaways-border);
      border-radius: 0.5rem;
      padding: 1.5rem;
    }

    @media (prefers-color-scheme: dark) {
      .takeaways {
        background: var(--fab-takeaways-bg-dark);
      }
    }

    .title {
      margin: 0 0 1rem 0;
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--fab-takeaways-title);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    @media (prefers-color-scheme: dark) {
      .title {
        color: var(--fab-takeaways-title-dark);
      }
    }

    .title-icon {
      width: 1.25rem;
      height: 1.25rem;
      flex-shrink: 0;
    }

    .title-icon svg {
      width: 100%;
      height: 100%;
    }

    .items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      color: var(--fab-takeaways-text);
      line-height: 1.6;
    }

    @media (prefers-color-scheme: dark) {
      .item {
        color: var(--fab-takeaways-text-dark);
      }
    }

    .bullet {
      flex-shrink: 0;
      width: 0.375rem;
      height: 0.375rem;
      border-radius: 50%;
      background: var(--fab-takeaways-bullet);
      margin-top: 0.5rem;
    }

    .item-text {
      flex: 1;
    }

    /* Hide component if no content */
    :host(:empty) {
      display: none;
    }
  `;

  @property() items = '';
  @property() title = 'Key Takeaways';

  render() {
    if (!this.items) {
      return html``;
    }

    const itemArray = this.items
      .split('|')
      .map(item => item.trim())
      .filter(Boolean);

    if (itemArray.length === 0) {
      return html``;
    }

    return html`
      <div class="takeaways">
        <h3 class="title">
          <span class="title-icon">${this.renderListIcon()}</span>
          ${this.title}
        </h3>
        <ul class="items">
          ${itemArray.map(item => html`
            <li class="item">
              <span class="bullet"></span>
              <span class="item-text">${item}</span>
            </li>
          `)}
        </ul>
      </div>
    `;
  }

  private renderListIcon() {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" x2="21" y1="6" y2="6"/>
        <line x1="8" x2="21" y1="12" y2="12"/>
        <line x1="8" x2="21" y1="18" y2="18"/>
        <line x1="3" x2="3.01" y1="6" y2="6"/>
        <line x1="3" x2="3.01" y1="12" y2="12"/>
        <line x1="3" x2="3.01" y1="18" y2="18"/>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fab-key-takeaways': FabKeyTakeaways;
  }
}
