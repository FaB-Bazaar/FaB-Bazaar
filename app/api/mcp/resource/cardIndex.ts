// app/api/mcp/resource/cardIndex.ts

/**
 * Hand-curated printingId overrides for common generic staples.
 * These take priority over the auto-computed sortPrintings() defaults.
 * Key format: "card name (lowercase)|pitch" where pitch 0 = no pitch.
 * Updated: 2026-03-22
 */
const CURATED_GENERICS: Record<string, string> = {
  'amulet of echoes|3':           'tDRtGtktggHNrtgjqDtb7', // EVR f s r
  'arcane lantern|0':             'LNGhR9bGMLMq88WnDfrhw', // EVR f s r
  'arcanite skullcap|0':          '7kMqDtwzcWgPpQNnCdWGn', // ARC u r l
  'back alley breakline|3':       'mj7wMfNPFRDmkGJgndPJj', // ARC u s c
  'balance of justice|0':         'W9db9PWKczJ7bQM9nQn9G', // HVY n r l
  'blade beckoner boots|0':       'NPm7gPNjgRcRgFwCdtN6Q', // HNT n s r
  'blade beckoner gauntlets|0':   'WRdtFkQT9gdKT8HWWdbfG', // FNG n s r
  'blade beckoner helm|0':        'krBBRP7b9pfgbBgfFHtJT', // HNT n s r
  'blade beckoner plating|0':     'h9MjdtKJRkH9Lhr9djtFq', // HNT n s r
  'blossom of spring|0':          'WfnLbRzdDKN68wQFPpcrf', // DVR n r c
  'call to the grave|3':          'wPGzqhc6njMLWdt6zHMHD', // ROS n s m
  'command and conquer|1':        'cLHGKMCjPb89zwNPmMFBp', // ARC u s m
  'crown of dominion|0':          '8JDp7zTGmfBNwT7gmqtPq', // DYN n r l
  'crown of providence|0':        'hgPwqQpFPqtKKBFqq6pRf', // DTD n s l
  'enlightened strike|1':         '8TWrBzGKFPwKkCL9jtpRg', // WTR u s m
  'erase face|1':                 'qRmjtLFj6gzrCDmBWGLk9', // UPR n s m
  'eye of ophidia|3':             'LFK7TmwkKLMQPLHfkLdmM', // ARC u r f
  'fate foreseen|1':              'WK7KrtnT9ddmnhDwMLL9r', // ARC u s c
  'fearless confrontation|3':     'KjNpfwhmk7G96R8QLzGnp', // MPG n s m
  'fiddler\'s green|1':           'MMrN7PkNmgDDzGbKRdJ8f', // SEA n s r
  'fyendal\'s spring tunic|0':    'JrkdqCNm8TWbQzWPJjbTD', // WTR u r l
  'heart of fyendal|3':           'fbKRcbmMGhHNjCkGkN8RW', // WTR u r f
  'last ditch effort|3':          'DpBgJCWqMmN7kFGFfgBW7', // WTR u s s
  'mage master boots|0':          '6mtJ6CjGNPW8LmtfpgrTT', // ARC u s c
  'midas touch|2':                'LPr7C6pcqGmpb8Ph8MWfL', // SEA n s m
  'nullrune boots|0':             'WBDzBcHnhFcGTNNdWN8pN', // ARC u s c
  'nullrune gloves|0':            'M7htcgqdF7pGfKRRfhfm7', // ARC u s c
  'nullrune hood|0':              'NQrGjMwCjTmGf9DgW7Hzq', // ARC u s c
  'nullrune robe|0':              'TN6MMhhDMHhNCj9hp8rLq', // ARC u s c
  'oasis respite|1':              'wphjdcRWFJkzNq9GfCBHT', // UPR n s c
  'old knocker|0':                'DqTbGzf6JJwTBzWQhCHPj', // SEA n s c
  'overcrowded|3':                'f9mKrf9RhRhQRzBz9RWrr', // SUP n s m
  'pearl amulet|3':               'kzTPff9tJgwJTJqCRmQhR', // SEA n s m
  'prismatic leyline|2':          'FBpQGTbmMH6NgjnK7bhhq', // MST n s m
  'pummel|1':                     'NrdPMgG8MdN8DrDNw8tJb', // WTR u s c
  'pummel|2':                     '8cPBQpKB6L6nr8ppRcwFK', // WTR u s c
  'pummel|3':                     'ng9zJtT9ddrWzt79f6cQB', // WTR u s c
  'quickdodge flexors|0':         'qBGPKRkkFQNcHTNNJCGf9', // HNT n r l
  'remembrance|2':                'mfdwqrrkWDtRPCLtdRBHG', // WTR u s s
  'riches of trōpal-dhani|2':     'fMfNfzQhwmQBzHzdHGGtR', // SEA n r f
  'ripple away|3':                '7p8kDMcRfW9Q7rKBFRwqC', // HVY n s m
  'rouse the ancients|3':         'NBrbHqM9rr8GNb8chmhm7', // MON u s m
  'shelter from the storm|1':     'cgDhbDLC8RRbBwrBQw9pp', // HNT n s m
  'sigil of solace|1':            'tFD8WWkJmgkHQtRrKNNkF', // WTR u s r
  'sink below|1':                 'WqgkrnT9ctJ68JpPBhrM9', // WTR u s c
  'springboard somersault|2':     'cdKfTPMWTMLdjrGkjPGrt', // SDO n s r
  'talisman of cremation|3':      'TL9PwKq978WwT89JFH7cW', // EVR f s r
  'warmonger\'s diplomacy|3':     'h8tQqgptDmDQwpcKzqbmK', // DTD n s m
};

export const cardIndexResource = {
  type: 'resource',
  name: 'fab_card_index',
  description: 'Pre-built lookup index mapping card name + pitch → default printingId. Read once per session to enable fast decklist imports via add_cards_to_deck without per-card DB queries.',
  uri: 'fab://card-index',

  handler() {
    return {
      version: '2026-03-22',
      total_entries: Object.keys(CURATED_GENERICS).length,
      index: CURATED_GENERICS,
      pitch_guide: {
        '0': 'no pitch (equipment, tokens, heroes, actions without pitch)',
        '1': 'red (pitch 1)',
        '2': 'yellow (pitch 2)',
        '3': 'blue (pitch 3)',
      },
      usage: "Deck-building index only — covers common generic staples. Look up by 'cardname|pitch' (all lowercase). For cards not in this index, add_cards_to_deck will fall back to a DB search automatically. For binder/collection use, always use search_printings to find the specific printing you want.",
    };
  },
};
