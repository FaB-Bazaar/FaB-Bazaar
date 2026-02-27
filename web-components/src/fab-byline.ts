import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * fab-byline - Author/contributor attribution
 *
 * Simple inline credit for article authors, decklist contributors, etc.
 * Replaces misuse of creator-spotlight for bylines.
 *
 * @element fab-byline
 *
 * @attr {string} role - The role/attribution type (e.g., "Written by", "Decklist by", "Contributed by")
 * @attr {string} name - The person's name
 * @attr {string} link - Optional link to profile/social
 *
 * @example
 * ```html
 * <fab-byline
 *   role="Decklist by"
 *   name="John Smith"
 *   link="https://twitter.com/johnsmith">
 * </fab-byline>
 * ```
 */
@customElement('fab-byline')
export class FabByline extends LitElement {
  static styles = css`
    :host {
      /* CSS Variables for theming */
      --fab-byline-text: #64748b;
      --fab-byline-text-dark: #94a3b8;
      --fab-byline-name: #0f172a;
      --fab-byline-name-dark: #f1f5f9;
      --fab-byline-link: #3b82f6;
      --fab-byline-link-hover: #2563eb;

      display: block;
      margin: 1rem 0;
    }

    .byline {
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .role {
      color: var(--fab-byline-text);
      font-style: italic;
    }

    @media (prefers-color-scheme: dark) {
      .role {
        color: var(--fab-byline-text-dark);
      }
    }

    .name {
      color: var(--fab-byline-name);
      font-weight: 500;
      margin-left: 0.25rem;
    }

    @media (prefers-color-scheme: dark) {
      .name {
        color: var(--fab-byline-name-dark);
      }
    }

    .name-link {
      color: var(--fab-byline-link);
      text-decoration: none;
      font-weight: 500;
      margin-left: 0.25rem;
      transition: color 0.2s;
    }

    .name-link:hover {
      color: var(--fab-byline-link-hover);
      text-decoration: underline;
    }

    /* Icon for external link */
    .link-icon {
      display: inline-block;
      width: 0.875rem;
      height: 0.875rem;
      margin-left: 0.25rem;
      vertical-align: baseline;
    }

    .link-icon svg {
      width: 100%;
      height: 100%;
    }

    /* Hide component if no content */
    :host(:empty) {
      display: none;
    }
  `;

  @property() role = 'By';
  @property() name = '';
  @property() link = '';

  render() {
    if (!this.name) return html``;

    return html`
      <div class="byline">
        <span class="role">${this.role}</span>
        ${this.link ? html`
          <a
            href="${this.link}"
            class="name-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${this.name}
            <span class="link-icon">${this.renderExternalLinkIcon()}</span>
          </a>
        ` : html`
          <span class="name">${this.name}</span>
        `}
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
    'fab-byline': FabByline;
  }
}
