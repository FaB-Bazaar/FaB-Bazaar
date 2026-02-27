/**
 * FaB Bazaar UI Web Components
 *
 * Framework-agnostic article components for FaB Bazaar content.
 * Built with Lit for maximum compatibility and minimal bundle size.
 *
 * @packageDocumentation
 */

// Export reference components (Phase 1)
export { FabCallout } from './fab-callout';
export { FabCreatorSpotlight } from './fab-creator-spotlight';
export { FabSpotlightCard } from './fab-spotlight-card';

// Export new semantic components (Phase 3)
export { FabIntro } from './fab-intro';
export { FabByline } from './fab-byline';
export { FabSectionHeader } from './fab-section-header';
export { FabKeyTakeaways } from './fab-key-takeaways';
export { FabMatchReport } from './fab-match-report';
export { FabDecklistBlock } from './fab-decklist-block';

// Export video and opportunity components (Phase 4)
export { FabVideo } from './fab-video';
export { FabOpportunityCard } from './fab-opportunity-card';

// Version
export const version = '2.1.0'; // Incremented for video and opportunity-card components

// Type declarations for TypeScript users
declare global {
  interface HTMLElementTagNameMap {
    'fab-callout': import('./fab-callout').FabCallout;
    'fab-creator-spotlight': import('./fab-creator-spotlight').FabCreatorSpotlight;
    'fab-spotlight-card': import('./fab-spotlight-card').FabSpotlightCard;
    'fab-intro': import('./fab-intro').FabIntro;
    'fab-byline': import('./fab-byline').FabByline;
    'fab-section-header': import('./fab-section-header').FabSectionHeader;
    'fab-key-takeaways': import('./fab-key-takeaways').FabKeyTakeaways;
    'fab-match-report': import('./fab-match-report').FabMatchReport;
    'fab-decklist-block': import('./fab-decklist-block').FabDecklistBlock;
    'fab-video': import('./fab-video').FabVideo;
    'fab-opportunity-card': import('./fab-opportunity-card').FabOpportunityCard;
  }
}
