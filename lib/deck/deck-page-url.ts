// The rail deck page's main view lives in `?tab=`: linkable, survives a
// refresh, and Back returns to the deck. (The classic page reads the same
// param for notes / results and ignores the rest.)
//
// `?version=N` is separate from the view: it picks WHICH LIST the page shows —
// the deck itself, or one of its saved versions (read-only) — and stays picked
// as the view changes, so Deck, Stats and Prices all show the same list.

export type MainMode = "deck" | "results" | "notes" | "import" | "prices" | "versions";

const EDITOR_ONLY: ReadonlySet<string> = new Set(["results", "notes", "import", "versions"]);

/**
 * The main view a `?tab=` value opens for this viewer; anything else is the
 * deck. Import list adds cards to the current deck, so it is not offered while
 * a saved version is showing.
 */
export function resolveMainMode(tab: string | null, canEdit: boolean, viewingVersion = false): MainMode {
  if (tab === "prices") return "prices";
  if (tab === "import" && viewingVersion) return "deck";
  if (tab && EDITOR_ONLY.has(tab) && canEdit) return tab as MainMode;
  return "deck";
}

const href = (pathname: string, params: URLSearchParams) => {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};

/** The page URL for a main view — the deck itself carries no `tab`. A viewed version stays picked. */
export function mainModeHref(pathname: string, search: string, mode: MainMode): string {
  const params = new URLSearchParams(search);
  if (mode === "deck") params.delete("tab");
  else params.set("tab", mode);
  return href(pathname, params);
}

/** The version `?version=` asks the page to show; anything but a positive whole number is none. */
export function resolveOpenVersion(value: string | null): number | null {
  return value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : null;
}

/** The same view showing one saved version, or (null) the current deck again. */
export function versionHref(pathname: string, search: string, version: number | null): string {
  const params = new URLSearchParams(search);
  if (version == null) params.delete("version");
  else params.set("version", String(version));
  return href(pathname, params);
}

/** The Versions view on the current deck — where a new version is saved. */
export function saveVersionHref(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.set("tab", "versions");
  params.delete("version");
  return href(pathname, params);
}
