/**
 * TypeScript declarations for FaB Bazaar Web Components
 *
 * This allows TypeScript to recognize our custom elements in JSX/TSX files
 * without throwing type errors.
 */

declare namespace JSX {
  interface IntrinsicElements {
    // Phase 1: Reference components
    'fab-callout': {
      title?: string;
      text?: string;
      'link-href'?: string;
      'link-text'?: string;
      children?: React.ReactNode;
    };

    'fab-creator-spotlight': {
      'image-url'?: string;
      name?: string;
      bio?: string;
      links?: string; // JSON string
      children?: React.ReactNode;
    };

    'fab-spotlight-card': {
      'printing-id'?: string;
      title?: string;
      commentary?: string;
      'api-base'?: string;
      children?: React.ReactNode;
    };

    // Phase 3: New semantic components
    'fab-intro': {
      text?: string;
      tags?: string; // Comma-separated
      children?: React.ReactNode;
    };

    'fab-byline': {
      role?: string;
      name?: string;
      link?: string;
      children?: React.ReactNode;
    };

    'fab-section-header': {
      title?: string;
      subtitle?: string;
      level?: string; // "2" or "3"
      children?: React.ReactNode;
    };

    'fab-key-takeaways': {
      items?: string; // Pipe-separated
      title?: string;
      children?: React.ReactNode;
    };

    'fab-match-report': {
      round?: string;
      opponent?: string;
      hero?: string;
      result?: string; // "W", "L", or "D"
      record?: string;
      summary?: string;
      sideboard?: string;
      children?: React.ReactNode;
    };

    'fab-decklist-block': {
      sections?: string; // JSON string
      'export-url'?: string;
      notes?: string;
      title?: string;
      children?: React.ReactNode;
    };

    'fab-buylist-block': {
      tiers?: string; // JSON string
      heading?: string;
      title?: string; // legacy alias for heading; stripped by the component
      note?: string;
      children?: React.ReactNode;
    };
  }
}

// Also declare for React 19+ (if using)
declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      // Phase 1: Reference components
      'fab-callout': {
        title?: string;
        text?: string;
        'link-href'?: string;
        'link-text'?: string;
        children?: React.ReactNode;
      };

      'fab-creator-spotlight': {
        'image-url'?: string;
        name?: string;
        bio?: string;
        links?: string;
        children?: React.ReactNode;
      };

      'fab-spotlight-card': {
        'printing-id'?: string;
        title?: string;
        commentary?: string;
        'api-base'?: string;
        children?: React.ReactNode;
      };

      // Phase 3: New semantic components
      'fab-intro': {
        text?: string;
        tags?: string;
        children?: React.ReactNode;
      };

      'fab-byline': {
        role?: string;
        name?: string;
        link?: string;
        children?: React.ReactNode;
      };

      'fab-section-header': {
        title?: string;
        subtitle?: string;
        level?: string;
        children?: React.ReactNode;
      };

      'fab-key-takeaways': {
        items?: string;
        title?: string;
        children?: React.ReactNode;
      };

      'fab-match-report': {
        round?: string;
        opponent?: string;
        hero?: string;
        result?: string;
        record?: string;
        summary?: string;
        sideboard?: string;
        children?: React.ReactNode;
      };

      'fab-decklist-block': {
        sections?: string;
        'export-url'?: string;
        notes?: string;
        title?: string;
        children?: React.ReactNode;
      };

      'fab-buylist-block': {
        tiers?: string;
        heading?: string;
        title?: string; // legacy alias for heading; stripped by the component
        note?: string;
        children?: React.ReactNode;
      };
    }
  }
}

export {};
