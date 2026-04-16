// app/api/mcp/resource/cardIndex.ts

/**
 * Hand-curated printingId overrides for common generic staples.
 * These take priority over the auto-computed sortPrintings() defaults.
 * Key format: "card name (lowercase)|pitch" where pitch 0 = no pitch.
 * Updated: 2026-03-22
 */
export const CURATED_GENERICS: Record<string, string> = {
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

  // ── CC-legal heroes ────────────────────────────────────────────────────────
  'arakni, 5l!p3d 7hru 7h3 cr4x|0':        'KtjmrCkz9NLRqn7ffmct6', // HER n r
  'arakni, huntsman|0':                     'rbMRhbhc9GRcmw6Gkhd67', // DYN n s
  'arakni, marionette|0':                   'tGzd8dmzbfc9M6dMTRPRN', // HNT n s
  'betsy, skin in the game|0':             'WGg6cTRckfjL7jgpfNjMC', // HVY n s
  'bravo, showstopper|0':                  'hFCGDBDPccndtnkdmB9jh', // WTR u s
  'cindra, dracai of retribution|0':       'W9jcfrcKFrmBdMF8tH8fB', // HNT n s
  'dash i/o|0':                            'BFqPtPwHknCrmKmtTb7ww', // EVO n s
  'dorinthea ironsong|0':                  'TnWBzzDH9McMtddqbzCK9', // WTR u s
  'fai, rising rebellion|0':              'ncq89NkTPw6NTFh6kKDpc', // UPR n s
  'fang, dracai of blades|0':             'WjWGWhrRT7wQdmjRPjGz7', // HNT n s
  'gravy bones, shipwrecked looter|0':    'pwNcgwhktrBKkPrjN9Kp7', // SEA n s
  'hala, bladesaint of the vow|0':        'fmCKJLG8BJMmgN6LqDGHk', // AHA n r
  'ira, scarlet revenger|0':              'KWCQrPBTWJwrn8KGbRkGb', // HER n r
  'jarl vetreiði|0':                       '9zQDNKTzhjQ7PnckgFjhB', // GEM n s
  'kassai of the golden sand|0':          'r6BjNMkbPfggLLLffGNzk', // HVY n s
  'katsu, the wanderer|0':                'gFmfF8FTLG9M7KWbPc97C', // WTR u s
  'kayo, underhanded cheat|0':            'jmBr99LqHr7Gntgb9Q6Wj', // SUP n s
  'levia, shadowborn abomination|0':      'nhg9QWDnCgHRgBWPwbJHb', // MON u s
  'lyath goldmane, vile savant|0':        'Lz7nbGDHbhkPNKcJptgQr', // SUP n s
  'marlynn, treasure hunter|0':           'tHjDmqRMpqfDthtwChrPw', // SEA n s
  'maxx \'the hype\' nitro|0':            'H8pcpDMJkJgrKg9KwGdrh', // EVO n s
  'olympia, prized fighter|0':            'nGDHq8JpRGGmRj9mCjwmW', // HVY n s
  'oscilio, constella intelligence|0':    'KCTTM79RGBfrr6NmtMbMG', // ROS n s
  'pleiades, superstar|0':               'fjnzWwnMHHGdcR86CPpFz', // SUP n s
  'prism, awakener of sol|0':            'WfF8QtgHKWLrb6HpWbpDb', // DTD n s
  'puffin, hightail|0':                  'p9TDdg6wJjQ68PGBTMzNR', // SEA n s
  'rhinar, reckless rampage|0':          'RcT68bt6fmP6HCwrrPPt8', // WTR u s
  'riptide, lurker of the deep|0':       'bzbhhTKHjBNDDd9BfMBBd', // OUT n s
  'ser boltyn, breaker of dawn|0':       'fCgt9DFn8tFmbLB7QnqMn', // MON u s
  'teklovossen, esteemed magnate|0':     'HzzQknF6bNgbmnznJtgpW', // EVO n s
  'tuffnut, bumbling hulkster|0':        'zMzQznDgkkBMTLwTPd9Fd', // SUP n s
  'uzuri, switchblade|0':               'ctrCNh8jrpmrtDnF8JLTD', // OUT n s
  'valda, seismic impact|0':            'Lpmd98dRLm6cwdCLFjbJd', // MPG n s
  'victor goldmane, high and mighty|0': 'h8jjPkmRtjMDgKhkRMQzR', // HVY n s
  'vynnset, iron maiden|0':             'GWQ6Wt9mRFdtT6zGrDqKF', // HER n r

  // ── Silver Age heroes (young heroes) ──────────────────────────────────────
  'arakni|0':                    'bqWpM79CBDMMdThW7r78j', // DYN n s
  'arakni, solitary confinement|0': 'CrMrwzB7FNRpP8wzMdbK6', // OUT n s
  'arakni, web of deceit|0':     'HzwHK9bqdwWBfDdn9B8nf', // HNT n s
  'aurora|0':                    'pcHC7jCf8bJcmBHCHKcTn', // ROS n s
  'azalea|0':                    'HGdFkn9r8w7HWjMDwnNdW', // ARC u s
  'benji, the piercing wind|0':  'PqQRtQLP6pRtCznctghtq', // CRU u s
  'betsy|0':                     '9nhT7f6wqFTnWnKpGpGnh', // HVY n s
  'boltyn|0':                    'pTRkj6B7KDr7r89nqWPmz', // MON u s
  'bravo|0':                     'k9b6GFmgTmBDrj7gtRMrH', // WTR u s
  'bravo, flattering showman|0': 'frPQMkJqDFNFQgD9RL6bL', // GEM n s
  'briar|0':                     'wpPrrKKKjcbqMHGWcCfmc', // ELE f s
  'chane|0':                     '8gnTTBph8gTGDDbrr9Mkf', // MON u s
  'cindra|0':                    'ChFnf6fLg8qjdCqd9WQKq', // HNT n s
  'dash|0':                      'Cj6C9tJQnD8KpghLCzb7P', // ARC u s
  'dash, database|0':            'bmTWm9BR8hWcNwRF8FQb8', // EVO n s
  'data doll mkii|0':            'hjjcBJ6frDrPdNjrQKWRg', // CRU u s
  'dorinthea|0':                 'PNwBGPtjw6Fq9BzmJPNgp', // WTR u s
  'dromai|0':                    'rJ7F6nLrJw8qqRzdDRTNb', // UPR n s
  'enigma|0':                    'qdcCr8db7NbhMNtF8qdCK', // MST n s
  'fai|0':                       'nQqW7c87GKmKt7rNJRWPT', // UPR n s
  'fang|0':                      'TQwHW8QPfgDLN68CRDkQQ', // HNT n s
  'florian|0':                   'Lj8nqddPpq9whJKwktHFF', // ROS n s
  'gravy bones|0':               'HhJDHnTPnhhPhbpLMcpCc', // SEA n s
  'ira, crimson haze|0':         'QrnLFMdwTkrh6dMmdwdCw', // CRU u s
  'iyslander|0':                 'tmgGmpmgrKcKtzLMdPkRr', // UPR n s
  'kano|0':                      'fnc8WWRBBzK7K9GBf8tQj', // ARC u s
  'kassai|0':                    'c8W6MbTM9mfQqhdwHjwMK', // HVY n s
  'kassai, cintari sellsword|0': 'gdKG8BwkcrHFpmqzHMpFT', // CRU u s
  'katsu|0':                     'WbgGwnctFjwNQGHkHzt6f', // WTR u s
  'kavdaen, trader of skins|0':  'TKjgLCMMCBwNmKCQFjbbB', // CRU u s
  'kayo|0':                      'qwtffKTM6prpL8pGzTGjB', // HVY n s
  'kayo, berserker runt|0':      'Q7zgdCTFzrHz8CKnHTcHF', // CRU u s
  'kayo, strong-arm|0':          'THcPmjNB6P6qpnhT7dnPw', // SUP n s
  'levia|0':                     'fp8QBWGwtHdBFkcNTMtmw', // MON u s
  'lexi|0':                      'cLFk6w8F9gGcChztGmDbQ', // ELE f s
  'lyath goldmane|0':            'g7WgqrJDTGRJKpmrm9HM6', // SUP n s
  'marlynn|0':                   'k6PbjfPDWWP7LnGtNWKTr', // SEA n s
  'maxx nitro|0':                'TLktLHTFLgQcBqBqwRLc9', // EVO n s
  'nuu|0':                       'fQDDMcTjbqKwwbnmHqQF8', // MST n s
  'oldhim|0':                    'Qn6FLdKMLmBggzCQrHdPK', // ELE f s
  'olympia|0':                   'LmrDKHwrR7mwBcQ8mB7rt', // HVY n s
  'oscilio|0':                   '6GrrF8wg9gQtKBnRhzNrd', // ROS n s
  'pleiades|0':                  'BL7mWdjjJJk8qNqDn8CKK', // SUP n s
  'prism|0':                     'rRBFBkDTRDMMFD88Q6NQJ', // MON u s
  'puffin|0':                    'DH9kqqWkkRpmrqndc67DQ', // SEA n s
  'rhinar|0':                    'dRLBz6gG69cczznWMNjjP', // WTR u s
  'riptide|0':                   '8pBgMgRTnkDhkqtzNmqM6', // OUT n s
  'scurv, stowaway|0':           '7KcHWBh7tRn6rcWzRCnwj', // SEA n s
  'teklovossen|0':               'tTDjnrMDGhH786kJcGMb6', // EVO n s
  'terra|0':                     'JHcFWjrt6JJhpqwrHWCwR', // TER n s
  'tuffnut|0':                   'krkbfC6CQFhfPmGtCHN6R', // SUP n s
  'uzuri|0':                     'T88ghT69FPDhBLJ6bLCcz', // OUT n s
  'valda brightaxe|0':           'PtDp8pMgTqLLnhnHP7hgc', // EVR f s
  'verdance|0':                  'NTzjt9fLPTj6zM8mBPrTN', // ROS n s
  'victor goldmane|0':           'TnPLc88GKqMJtkNPdNpm9', // HVY n s
  'viserai|0':                   'WDjPjLDRBpWdwdtJPFNbR', // ARC u s
  'vynnset|0':                   'bnh7GmLDRMNhhB68mkDCq', // DTD n s
  'zen|0':                       'gpgtNrLRPfb7ktDLRJbgw', // MST n s
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
      usage: "Covers common generic staples and heroes. Look up by 'cardname|pitch' (all lowercase). Useful for: (1) deck building — add_cards_to_deck falls back to DB search for unlisted cards; (2) bulk curation — look up IDs here then pass to add_card_to_list to avoid per-card search_printings calls. For binder/collection use where the user wants a specific printing, always use search_printings instead.",
    };
  },
};
