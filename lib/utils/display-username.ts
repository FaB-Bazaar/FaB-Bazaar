/** Strip internal dc_/gh_ prefix for display. URLs should still use raw username. */
export function displayUsername(username: string): string {
  if (username.startsWith('dc_')) return username.slice(3);
  if (username.startsWith('gh_')) return username.slice(3);
  return username;
}

/** Build a URL-safe profile path. */
export function profileHref(username: string): string {
  return `/profile/${encodeURIComponent(username)}`;
}
