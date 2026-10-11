// lib/navbar/mobile-tab-bar-visibility.ts — pages where the floating mobile tab bar (components/navbar/MobileTabBar)
// is hidden: the deck editor renders its own floating tab pill, and on /scan the bar covers the review rows and buttons.
export function hidesMobileTabBar(pathname: string): boolean {
  // /decks/community and /decks/to-beat are listing pages, not the editor
  const deckSeg = /^\/decks\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (deckSeg && deckSeg !== "community" && deckSeg !== "to-beat") return true;
  return pathname === "/scan" || pathname.startsWith("/scan/");
}
