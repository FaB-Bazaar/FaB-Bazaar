// The rail deck page's main view lives in `?tab=`: linkable, survives a
// refresh, and Back returns to the deck. (The classic page reads the same
// param for notes / results and ignores the rest.)

export type MainMode = "deck" | "results" | "notes" | "import" | "prices";

const EDITOR_ONLY: ReadonlySet<string> = new Set(["results", "notes", "import"]);

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
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
