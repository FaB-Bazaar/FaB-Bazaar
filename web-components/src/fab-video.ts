import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * fab-video - YouTube video embed component with title, description, and creator attribution
 *
 * @element fab-video
 *
 * @attr {string} video-id - The YouTube video ID
 * @attr {string} title - The video title
 * @attr {string} description - Brief description of the video content
 * @attr {string} creator-name - Optional creator/channel name for attribution
 * @attr {string} creator-url - Optional link to the creator's channel/site
 *
 * @example
 * ```html
 * <fab-video
 *   video-id="dQw4w9WgXcQ"
 *   title="How to Play Dromai"
 *   description="A comprehensive guide to mastering the Draconic Illusionist"
 *   creator-name="FaB Content Creator"
 *   creator-url="https://youtube.com/@creator">
 * </fab-video>
 * ```
 */
@customElement('fab-video')
export class FabVideo extends LitElement {
  static styles = css`
    :host {
      /* CSS Variables for theming */
      --fab-video-bg: #fef2f2;
      --fab-video-border: #fca5a5;
      --fab-video-text: #0f172a;
      --fab-video-text-muted: #64748b;
      --fab-video-youtube-color: #ef4444;
      --fab-video-link-hover: #3b82f6;

      display: block;
      margin: 3rem 0;
    }

    .video-container {
      background: var(--fab-video-bg);
      border: 1px solid var(--fab-video-border);
      border-radius: 0.5rem;
      overflow: hidden;
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    }

    .video-wrapper {
      position: relative;
      width: 100%;
      padding-bottom: 56.25%; /* 16:9 aspect ratio */
    }

    .video-wrapper iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
    }

    .video-info {
      padding: 1rem 1.5rem;
    }

    @media (min-width: 768px) {
      .video-info {
        padding: 1.5rem;
      }
    }

    .info-content {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .youtube-icon {
      flex-shrink: 0;
      margin-top: 0.25rem;
      color: var(--fab-video-youtube-color);
    }

    .youtube-icon svg {
      width: 1.5rem;
      height: 1.5rem;
    }

    .text-content {
      flex: 1;
      min-width: 0;
    }

    .title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--fab-video-text);
    }

    .description {
      margin: 0.25rem 0 0 0;
      font-size: 0.875rem;
      color: var(--fab-video-text-muted);
    }

    .creator-link {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      margin-top: 0.75rem;
      font-size: 0.75rem;
      color: var(--fab-video-text-muted);
      text-decoration: none;
      transition: color 0.2s;
    }

    .creator-link:hover {
      color: var(--fab-video-link-hover);
    }

    .creator-link svg {
      width: 0.75rem;
      height: 0.75rem;
    }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      :host {
        --fab-video-bg: rgba(30, 41, 59, 0.5);
        --fab-video-border: #334155;
        --fab-video-text: #f1f5f9;
        --fab-video-text-muted: #94a3b8;
      }
    }
  `;

  @property({ attribute: 'video-id' }) videoId = '';
  @property() title = '';
  @property() description = '';
  @property({ attribute: 'creator-name' }) creatorName = '';
  @property({ attribute: 'creator-url' }) creatorUrl = '';

  render() {
    const embedUrl = `https://www.youtube.com/embed/${this.videoId}`;

    return html`
      <div class="video-container">
        <div class="video-wrapper">
          <iframe
            src="${embedUrl}"
            title="${this.title}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
        <div class="video-info">
          <div class="info-content">
            <div class="youtube-icon">
              ${this.renderYoutubeIcon()}
            </div>
            <div class="text-content">
              <h3 class="title">${this.title}</h3>
              ${this.description ? html`
                <p class="description">${this.description}</p>
              ` : ''}
              ${this.creatorName && this.creatorUrl ? html`
                <a class="creator-link" href="${this.creatorUrl}" target="_blank" rel="noopener noreferrer">
                  ${this.renderLinkIcon()}
                  <span>Credit: ${this.creatorName}</span>
                </a>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderYoutubeIcon() {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
        <path d="m10 15 5-3-5-3z"/>
      </svg>
    `;
  }

  private renderLinkIcon() {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fab-video': FabVideo;
  }
}
