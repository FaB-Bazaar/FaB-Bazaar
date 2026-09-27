// "Card foil effects" preference — the hover tilt/shine on foil card images.
// Per device (localStorage), OFF by default: the effect read as "too many
// animations" to new visitors, so it is opt-in. Every access is guarded —
// storage throws in private mode and doesn't exist during SSR.

export const FOIL_EFFECTS_KEY = 'fabb:foil-effects'
const CHANGE_EVENT = 'fabb:foil-effects-change'

export function readFoilEffects(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(FOIL_EFFECTS_KEY) === '1'
  } catch {
    return false
  }
}

export function writeFoilEffects(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(FOIL_EFFECTS_KEY, '1')
    else window.localStorage.removeItem(FOIL_EFFECTS_KEY)
  } catch {
    // storage unavailable — the toggle just won't persist
  }
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    // no window (SSR)
  }
}

/** Fires on writes in this tab and on changes from other tabs. Returns unsubscribe. */
export function subscribeFoilEffects(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (e: Event) => {
    const key = (e as StorageEvent).key
    if (key === FOIL_EFFECTS_KEY || key === null) cb()
  }
  window.addEventListener(CHANGE_EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb)
    window.removeEventListener('storage', onStorage)
  }
}
