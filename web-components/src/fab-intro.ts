import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * fab-intro - Article lead/summary section
 *
 * Provides a clear 1-2 sentence explanation of what the article is about.
 * Addresses user feedback: "Needs clear intro/summary at the top"
 *
 * @element fab-intro
 *
 * @attr {string} text - The intro text (1-2 sentences)
 * @attr {string} tags - Optional comma-separated tags (e.g., "CC,Tournament Report,Dromai")
 *
 * @example
 * ```html
 * <fab-intro
 *   text="This is a tournament report from Road to Nationals Atlanta, piloting Dromai to a Top 8 finish."
 *   tags="CC,Tournament Report,Dromai">
 * </fab-intro>
 * ```
 */
@customElement('fab-intro')
export class FabIntro extends LitElement {
  static styles = css`
    :host {
      /* CSS Variables for theming */
      --fab-intro-text: #475569;
      --fab-intro-text-dark: #94a3b8;
      --fab-intro-border: #e2e8f0;
      --fab-intro-tag-bg: #f1f5f9;
      --fab-intro-tag-text: #475569;
      --fab-intro-tag-bg-dark: #334155;
      --fab-intro-tag-text-dark: #cbd5e1;

      display: block;
      margin: 1.5rem 0 2rem 0;
    }

    .intro {
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--fab-intro-border);
    }

    .intro-text {
      font-size: 1.125rem;
      line-height: 1.75;
      color: var(--fab-intro-text);
      margin: 0 0 1rem 0;
    }

    @media (prefers-color-scheme: dark) {
      .intro-text {
        color: var(--fab-intro-text-dark);
      }
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .tag {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: var(--fab-intro-tag-bg);
      color: var(--fab-intro-tag-text);
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    @media (prefers-color-scheme: dark) {
      .tag {
        background: var(--fab-intro-tag-bg-dark);
        color: var(--fab-intro-tag-text-dark);
      }
    }

    /* Hide component if no content */
    :host(:empty) {
      display: none;
    }
  `;

  @property() text = '';
  @property() tags = '';

  render() {
    if (!this.text) return html``;

    const tagArray = this.tags
      ? this.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    return html`
      <div class="intro">
        <p class="intro-text">${this.text}</p>
        ${tagArray.length > 0 ? html`
          <div class="tags">
            ${tagArray.map(tag => html`
              <span class="tag">${tag}</span>
            `)}
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fab-intro': FabIntro;
  }
}
