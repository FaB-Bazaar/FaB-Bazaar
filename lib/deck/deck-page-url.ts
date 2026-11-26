// The rail deck page's main view lives in `?tab=`: linkable, survives a
// refresh, and Back returns to the deck. (The classic page reads the same
// param for notes / results and ignores the rest.)

export type MainMode = "deck" | "results" | "notes" | "import" | "prices" | "versions";

const EDITOR_ONLY: ReadonlySet<string> = new Set(["results", "notes", "import", "versions"]);

/** The main view a `?tab=` value opens for this viewer; anything else is the deck. */
export function resolveMainMode(tab: string | null, canEdit: boolean): MainMode {
  if (tab === "prices") return "prices";
  if (tab && EDITOR_ONLY.has(tab) && canEdit) return tab as MainMode;
  return "deck";
}

/** The page URL for a main view — the deck itself carries no `tab`. */
export function mainModeHref(pathname: string, search: string, mode: MainMode): string {
  const params = new URLSearchParams(search);
  if (mode === "deck") params.delete("tab");
  else params.set("tab", mode);
  // The open version belongs to the Versions view only.
  if (mode !== "versions") params.delete("version");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** The version `?version=` asks the Versions view to open; anything but a positive whole number is none. */
export function resolveOpenVersion(value: string | null): number | null {
  return value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : null;
}

/** The Versions view with one version open (the header's version picker), or with none. */
export function versionHref(pathname: string, search: string, version: number | null): string {
  const params = new URLSearchParams(search);
  params.set("tab", "versions");
  if (version == null) params.delete("version");
  else params.set("version", String(version));
  return `${pathname}?${params.toString()}`;
}
