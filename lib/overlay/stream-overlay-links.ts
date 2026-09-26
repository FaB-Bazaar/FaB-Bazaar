export interface StreamOverlayLink {
  layout: 'pages' | 'spotlight' | 'list';
  label: string;
  url: string;
  /** Suggested OBS browser-source size. */
  width: number;
  height: number;
}

const LAYOUTS: Omit<StreamOverlayLink, 'url'>[] = [
  { layout: 'pages', label: 'Side panel — one pitch group at a time', width: 260, height: 480 },
  { layout: 'spotlight', label: 'Card spotlight — cycles card art', width: 260, height: 480 },
  { layout: 'list', label: 'Full decklist — pop-up or full scene', width: 1000, height: 900 },
];

/** Copyable OBS browser-source URLs for a user's profile-level overlay. */
export function buildStreamOverlayLinks(origin: string, overlayPath: string): StreamOverlayLink[] {
  const base = origin.replace(/\/+$/, '') + overlayPath;
  return LAYOUTS.map(l => ({ ...l, url: `${base}?layout=${l.layout}` }));
}
