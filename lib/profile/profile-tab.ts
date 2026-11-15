// lib/profile/profile-tab.ts
//
// The profile page's active tab lives in the URL (?tab=decks) so a tab can be
// linked to. Collection is the default and has no param.

export type ProfileTab = 'collection' | 'decks';

export function parseProfileTab(search: string): ProfileTab {
  return new URLSearchParams(search).get('tab') === 'decks' ? 'decks' : 'collection';
}

export function profileTabUrl(pathname: string, search: string, tab: ProfileTab): string {
  const params = new URLSearchParams(search);
  if (tab === 'collection') params.delete('tab');
  else params.set('tab', tab);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
