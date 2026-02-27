import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * fab-callout - Info box component for tips, warnings, and contextual information
 *
 * @element fab-callout
 *
 * @attr {string} title - The callout title
 * @attr {string} text - The callout body text
 * @attr {string} link-href - Optional link URL
 * @attr {string} link-text - Optional link label
 *
 * @example
 * ```html
 * <fab-callout
 *   title="New to Dromai?"
 *   text="This guide assumes basic hero knowledge"
 *   link-href="/guides/dromai-intro"
 *   link-text="View Beginner's Guide">
 * </fab-callout>
 * ```
 */
@customElement('fab-callout')
export class FabCallout extends LitElement {
  static styles = css`
    :host {
      /* CSS Variables for theming */
      --fab-callout-bg: #f0f9ff;
      --fab-callout-border: #3b82f6;
      --fab-callout-text: #1e293b;
      --fab-callout-text-muted: #64748b;
      --fab-callout-icon-color: #3b82f6;
      --fab-callout-link-bg: #3b82f6;
      --fab-callout-link-text: #ffffff;
      --fab-callout-link-hover-bg: #2563eb;

      display: block;
      margin: 2rem 0;
    }

    .callout {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 1.5rem;
      background: var(--fab-callout-bg);
      border: 1px solid var(--fab-callout-border);
      border-radius: 0.5rem;
    }

    @media (min-width: 640px) {
      .callout {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }

    .content {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      flex: 1;
    }

    .icon {
      flex-shrink: 0;
      margin-top: 0.25rem;
      color: var(--fab-callout-icon-color);
    }

    .icon svg {
      width: 1.5rem;
      height: 1.5rem;
    }

    .text-content h4 {
      margin: 0 0 0.25rem 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--fab-callout-text);
    }

    .text-content p {
      margin: 0;
      font-size: 0.875rem;
      color: var(--fab-callout-text-muted);
    }

    .link {
      flex-shrink: 0;
      width: 100%;
    }

    @media (min-width: 640px) {
      .link {
        width: auto;
      }
    }

    .link a {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: var(--fab-callout-link-bg);
      color: var(--fab-callout-link-text);
      text-decoration: none;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background-color 0.2s;
      width: 100%;
      justify-content: center;
    }

    @media (min-width: 640px) {
      .link a {
        width: auto;
      }
    }

    .link a:hover {
      background: var(--fab-callout-link-hover-bg);
    }

    .link svg {
      width: 1rem;
      height: 1rem;
    }
  `;

  @property() title = '';
  @property() text = '';
  @property({ attribute: 'link-href' }) linkHref = '';
  @property({ attribute: 'link-text' }) linkText = '';

  render() {
    return html`
      <div class="callout">
        <div class="content">
          <div class="icon">
            ${this.renderLightbulbIcon()}
          </div>
          <div class="text-content">
            <h4>${this.title}</h4>
            <p>${this.text}</p>
          </div>
        </div>
        ${this.linkHref && this.linkText ? html`
          <div class="link">
            <a href="${this.linkHref}" target="_blank" rel="noopener noreferrer">
              ${this.linkText}
              ${this.renderExternalLinkIcon()}
            </a>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderLightbulbIcon() {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
        <path d="M9 18h6"/>
        <path d="M10 22h4"/>
      </svg>
    `;
  }

  private renderExternalLinkIcon() {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" x2="21" y1="14" y2="3"/>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fab-callout': FabCallout;
  }
}
