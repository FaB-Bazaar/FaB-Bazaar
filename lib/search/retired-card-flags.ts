// Card boolean columns the app no longer reads or filters on (2026-11), ahead
// of dropping them. The DB columns stay, and pipeline 003/005 and the CardVault
// ingest still write them, until usage has been checked: search_printings logs
// `[retired-card-flag]` whenever a client still sends one.
//
// Each class/type flag is derived from an array column (003: `is_<class>` =
// class in `classes`, `is_token`/`is_mentor` = type in `types`), so the array
// filter is an exact replacement. playedHorizontally has no filter equivalent.
export const RETIRED_CARD_FLAGS = [
  'isAssassin', 'isMerchant', 'isBard', 'isAdjudicator', 'isIllusionist',
  'isThief', 'isShapeshifter', 'isMentor', 'isToken', 'playedHorizontally',
] as const;

export type RetiredCardFlag = typeof RETIRED_CARD_FLAGS[number];

export function retiredFlagReplacement(flag: RetiredCardFlag): string | null {
  if (flag === 'playedHorizontally') return null;
  if (flag === 'isToken' || flag === 'isMentor') return `types: ["${flag.slice(2).toLowerCase()}"]`;
  return `classes: ["${flag.slice(2).toLowerCase()}"]`;
}
