/**
 * Firefox-safe dark mode for shadow-DOM components.
 *
 * The app toggles dark mode by putting a `dark` class on <html>. Inside a
 * shadow root the only selector that can see that is :host-context(.dark) —
 * which Firefox never implemented (it was dropped from the spec). So instead
 * every component mirrors the page theme onto a `dark` attribute on its own
 * host element and styles with :host([dark]), which works in every engine.
 *
 * One shared MutationObserver serves all mounted components.
 */

let observer: MutationObserver | null = null;
const hosts = new Set<HTMLElement>();

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

function syncAll() {
  const dark = isDark();
  for (const host of hosts) {
    host.toggleAttribute('dark', dark);
  }
}

/** Start mirroring the page theme onto `host[dark]`. Call in connectedCallback. */
export function watchTheme(host: HTMLElement): void {
  hosts.add(host);
  host.toggleAttribute('dark', isDark());

  if (!observer) {
    observer = new MutationObserver(syncAll);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }
}

/** Stop mirroring for this host. Call in disconnectedCallback. */
export function unwatchTheme(host: HTMLElement): void {
  hosts.delete(host);
}
