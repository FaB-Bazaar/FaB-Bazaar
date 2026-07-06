// lib/fab-constants/heroes-meta.ts
// External integrations + competitive meta + showcase artwork.
// Imports only from ./heroes-rosters (leaf) to keep the dependency graph acyclic.

// Talishar hero slug identifiers — the exact string keys Talishar uses internally.
// Source: https://github.com/Talishar/Talishar/blob/main/Libraries/LegalHeroesHelper.php ($ALL_HEROES_OF_RATHE)
// When new heroes are added to our roster, cross-check that file for their Talishar slug and add here.
// Heroes Talishar hasn't wired with an active card object yet (e.g. the librarian,
// magister of history; melody, sing-along; chane young) are omitted on purpose.
export const TALISHAR_HERO_SLUGS: Record<string, string> = {
  // Adult heroes (HERO_INFO)
  'arakni, 5l!p3d 7hru 7h3 cr4x':      'arakni_5lp3d_7hru_7h3_cr4x',
  'arakni, huntsman':                    'arakni_huntsman',
  'arakni, marionette':                  'arakni_marionette',
  'nuu, alluring desire':                'nuu_alluring_desire',
  'uzuri, switchblade':                  'uzuri_switchblade',
  'kayo, armed and dangerous':           'kayo_armed_and_dangerous',
  'levia, shadowborn abomination':       'levia_shadowborn_abomination',
  'rhinar, reckless rampage':            'rhinar_reckless_rampage',
  'tuffnut, bumbling hulkster':          'tuffnut_bumbling_hulkster',
  'kayo, underhanded cheat':             'kayo_underhanded_cheat',
  'betsy, skin in the game':             'betsy_skin_in_the_game',
  'bravo, showstopper':                  'bravo_showstopper',
  'bravo, star of the show':             'bravo_star_of_the_show',
  'jarl vetreiði':                       'jarl_vetreidi',
  'oldhim, grandfather of eternity':     'oldhim_grandfather_of_eternity',
  'valda, seismic impact':               'valda_seismic_impact',
  'victor goldmane, high and mighty':    'victor_goldmane_high_and_mighty',
  'lyath goldmane, vile savant':         'lyath_goldmane_vile_savant',
  'pleiades, superstar':                 'pleiades_superstar',
  'dromai, ash artist':                  'dromai_ash_artist',
  'enigma, ledger of ancestry':          'enigma_ledger_of_ancestry',
  'prism, awakener of sol':              'prism_awakener_of_sol',
  'prism, sculptor of arc light':        'prism_sculptor_of_arc_light',
  'dash i/o':                            'dash_io',
  'dash, inventor extraordinaire':       'dash_inventor_extraordinaire',
  "maxx 'the hype' nitro":              'maxx_the_hype_nitro',
  'puffin, hightail':                    'puffin_hightail',
  'teklovossen, esteemed magnate':       'teklovossen_esteemed_magnate',
  'gravy bones, shipwrecked looter':     'gravy_bones_shipwrecked_looter',
  'cindra, dracai of retribution':       'cindra_dracai_of_retribution',
  'fai, rising rebellion':               'fai_rising_rebellion',
  'ira, scarlet revenger':               'ira_scarlet_revenger',
  'katsu, the wanderer':                 'katsu_the_wanderer',
  'zen, tamer of purpose':               'zen_tamer_of_purpose',
  'azalea, ace in the hole':             'azalea_ace_in_the_hole',
  'lexi, livewire':                      'lexi_livewire',
  'marlynn, treasure hunter':            'marlynn_treasure_hunter',
  'riptide, lurker of the deep':         'riptide_lurker_of_the_deep',
  'aurora, shooting star':               'aurora_shooting_star',
  'aurora, legacy of tempest':           'aurora_legacy_of_tempest',
  'briar, warden of thorns':             'briar_warden_of_thorns',
  'chane, bound by shadow':              'chane_bound_by_shadow',
  'florian, rotwood harbinger':          'florian_rotwood_harbinger',
  'viserai, rune blood':                 'viserai_rune_blood',
  'vynnset, iron maiden':                'vynnset_iron_maiden',
  'dorinthea ironsong':                  'dorinthea_ironsong',
  'fang, dracai of blades':              'fang_dracai_of_blades',
  'hala, bladesaint of the vow':         'hala_bladesaint_of_the_vow',
  'kassai of the golden sand':           'kassai_of_the_golden_sand',
  'olympia, prized fighter':             'olympia_prized_fighter',
  'ser boltyn, breaker of dawn':         'ser_boltyn_breaker_of_dawn',
  'iyslander, stormbind':                'iyslander_stormbind',
  'kano, dracai of aether':              'kano_dracai_of_aether',
  'oscilio, constella intelligence':     'oscilio_constella_intelligence',
  'oscilio, forked continuum':           'oscilio_forked_continuum',
  'verdance, thorn of the rose':         'verdance_thorn_of_the_rose',
  'zyggy starlight':                     'zyggy_starlight',

  // Young heroes (YOUNG_HERO_INFO)
  'arakni':                              'arakni',
  'baalghor, omen of the end':           'baalghor_omen_of_the_end',
  'arakni, solitary confinement':        'arakni_solitary_confinement',
  'arakni, web of deceit':               'arakni_web_of_deceit',
  'nuu':                                 'nuu',
  'uzuri':                               'uzuri',
  'azalea':                              'azalea',
  'lexi':                                'lexi',
  'marlynn':                             'marlynn',
  'riptide':                             'riptide',
  'iyslander':                           'iyslander',
  'kano':                                'kano',
  'oscilio':                             'oscilio',
  'oscilio, scion of the third age':     'oscilio_scion_of_the_third_age',
  'verdance':                            'verdance',
  'boltyn':                              'boltyn',
  'dorinthea':                           'dorinthea',
  'fang':                                'fang',
  'kassai':                              'kassai',
  'kassai, cintari sellsword':           'kassai_cintari_sellsword',
  'olympia':                             'olympia',
  'scurv, stowaway':                     'scurv_stowaway',
  'aurora':                              'aurora',
  'aurora, emissary of lightning':       'aurora_emissary_of_lightning',
  'briar':                               'briar',
  'florian':                             'florian',
  'viserai':                             'viserai',
  'vynnset':                             'vynnset',
  'benji, the piercing wind':            'benji_the_piercing_wind',
  'cindra':                              'cindra',
  'fai':                                 'fai',
  'ira, crimson haze':                   'ira_crimson_haze',
  'katsu':                               'katsu',
  'zen':                                 'zen',
  'gravy bones':                         'gravy_bones',
  'kavdaen, trader of skins':            'kavdaen_trader_of_skins',
  'dash':                                'dash',
  'dash, database':                      'dash_database',
  'data doll mkii':                      'data_doll_mkii',
  'maxx nitro':                          'maxx_nitro',
  'puffin':                              'puffin',
  'teklovossen':                         'teklovossen',
  'dromai':                              'dromai',
  'enigma':                              'enigma',
  'prism':                               'prism',
  'betsy':                               'betsy',
  'bravo':                               'bravo',
  'bravo, flattering showman':           'bravo_flattering_showman',
  'lyath goldmane':                      'lyath_goldmane',
  'oldhim':                              'oldhim',
  'pleiades':                            'pleiades',
  'terra':                               'terra',
  'valda brightaxe':                     'valda_brightaxe',
  'victor goldmane':                     'victor_goldmane',
  'kayo':                                'kayo',
  'kayo, berserker runt':                'kayo_berserker_runt',
  'kayo, strong-arm':                    'kayo_strong-arm',
  'levia':                               'levia',
  'rhinar':                              'rhinar',
  'tuffnut':                             'tuffnut',
  'zyggy':                               'zyggy',
};

export function getTalisharHeroSlug(heroName: string): string | null {
  const key = heroName.toLowerCase();
  return TALISHAR_HERO_SLUGS[key] ?? null;
}

// Talishar collector number IDs — used as the `hero` field in the deck list API.
// Keys match HERO_INFO and YOUNG_HERO_INFO keys (lowercase).
export const TALISHAR_HERO_IDS: Record<string, string> = {
  // Adult heroes (HERO_INFO)
  'arakni, 5l!p3d 7hru 7h3 cr4x':      'HER130',
  'arakni, huntsman':                    'DYN113',
  'arakni, marionette':                  'HNT001',
  'nuu, alluring desire':                'MST001',
  'uzuri, switchblade':                  'OUT001',
  'kayo, armed and dangerous':           'HVY001',
  'kayo, underhanded cheat':             'SUP063',
  'levia, shadowborn abomination':       'MON119',
  'rhinar, reckless rampage':            'WTR001',
  'tuffnut, bumbling hulkster':          'SUP001',
  'betsy, skin in the game':             'HVY045',
  'bravo, showstopper':                  'WTR038',
  'bravo, star of the show':             'EVR017',
  'jarl vetreiði':                       'AJV001',
  'oldhim, grandfather of eternity':     'ELE001',
  'valda, seismic impact':               'MPG001',
  'victor goldmane, high and mighty':    'HVY047',
  'lyath goldmane, vile savant':         'SUP071',
  'pleiades, superstar':                 'SUP009',
  'dromai, ash artist':                  'UPR001',
  'enigma, ledger of ancestry':          'MST025',
  'prism, awakener of sol':              'DTD001',
  'prism, sculptor of arc light':        'MON001',
  'dash i/o':                            'EVO001',
  'dash, inventor extraordinaire':       'ARC001',
  "maxx 'the hype' nitro":              'EVO004',
  'puffin, hightail':                    'SEA001',
  'teklovossen, esteemed magnate':       'EVO007',
  'gravy bones, shipwrecked looter':     'SEA043',
  'cindra, dracai of retribution':       'HNT054',
  'fai, rising rebellion':               'UPR044',
  'ira, scarlet revenger':               'HER123',
  'katsu, the wanderer':                 'WTR076',
  'zen, tamer of purpose':               'MST046',
  'azalea, ace in the hole':             'ARC038',
  'lexi, livewire':                      'ELE031',
  'marlynn, treasure hunter':            'SEA082',
  'riptide, lurker of the deep':         'OUT091',
  'aurora, shooting star':               'ROS007',
  'aurora, legacy of tempest':           'OMN047',
  'briar, warden of thorns':             'ELE062',
  'chane, bound by shadow':              'MON153',
  'florian, rotwood harbinger':          'ROS001',
  'viserai, rune blood':                 'ARC075',
  'vynnset, iron maiden':                'DTD133',
  'dorinthea ironsong':                  'WTR113',
  'fang, dracai of blades':              'HNT098',
  'hala, bladesaint of the vow':         'AHA001',
  'kassai of the golden sand':           'HVY090',
  'olympia, prized fighter':             'HVY092',
  'ser boltyn, breaker of dawn':         'MON029',
  'iyslander, stormbind':                'EVR120',
  'kano, dracai of aether':              'ARC113',
  'oscilio, constella intelligence':     'ROS019',
  'oscilio, forked continuum':           'OMN094',
  'verdance, thorn of the rose':         'ROS013',
  'zyggy starlight':                     'OMN001',

  // Young heroes (YOUNG_HERO_INFO)
  'arakni':                              'DYN114',
  'baalghor, omen of the end':           'IAR159',
  'arakni, solitary confinement':        'OUT003',
  'arakni, web of deceit':               'HNT002',
  'nuu':                                 'MST002',
  'uzuri':                               'OUT002',
  'azalea':                              'ARC039',
  'lexi':                                'ELE032',
  'marlynn':                             'SEA083',
  'riptide':                             'OUT092',
  'iyslander':                           'UPR103',
  'kano':                                'ARC114',
  'oscilio':                             'ROS020',
  'oscilio, scion of the third age':     'OMN095',
  'verdance':                            'ROS014',
  'boltyn':                              'MON030',
  'dorinthea':                           'WTR114',
  'fang':                                'HNT099',
  'kassai':                              'HVY091',
  'kassai, cintari sellsword':           'CRU077',
  'olympia':                             'HVY093',
  'scurv, stowaway':                     'SEA123',
  'aurora':                              'ROS008',
  'aurora, emissary of lightning':       'OMN048',
  'briar':                               'ELE063',
  'florian':                             'ROS002',
  'viserai':                             'ARC076',
  'vynnset':                             'DTD134',
  'benji, the piercing wind':            'CRU047',
  'cindra':                              'HNT055',
  'fai':                                 'UPR045',
  'ira, crimson haze':                   'CRU046',
  'katsu':                               'WTR077',
  'zen':                                 'MST047',
  'gravy bones':                         'SEA044',
  'kavdaen, trader of skins':            'CRU118',
  'dash':                                'ARC002',
  'dash, database':                      'EVO002',
  'data doll mkii':                      'CRU099',
  'maxx nitro':                          'EVO005',
  'puffin':                              'SEA002',
  'teklovossen':                         'EVO008',
  'dromai':                              'UPR002',
  'enigma':                              'MST026',
  'prism':                               'MON002',
  'betsy':                               'HVY046',
  'bravo':                               'WTR039',
  'bravo, flattering showman':           'BDD001',
  'lyath goldmane':                      'SUP072',
  'oldhim':                              'ELE002',
  'pleiades':                            'SUP010',
  'terra':                               'TER001',
  'valda brightaxe':                     'EVR019',
  'victor goldmane':                     'HVY048',
  'kayo':                                'HVY002',
  'kayo, berserker runt':                'CRU002',
  'kayo, strong-arm':                    'SUP064',
  'levia':                               'MON120',
  'rhinar':                              'WTR002',
  'tuffnut':                             'SUP002',
  'zyggy':                               'OMN002',

  // Newer heroes — synced from Talishar-FE filter constants (2026-07). Values are
  // Talishar's canonical hero code (original set printing), which can differ from
  // our DB's earliest collector_number (e.g. Heralds "HER" reprints). Keys are the
  // lowercase card display_name as stored in our cards table.
  'blaze, firemind':                     'HER117',
  'brevant, civic protector':            'TCC027',
  'chane':                               'MON154',
  'dorinthea, quicksilver prodigy':      'DVR001',
  'emperor, dracai of aesir':            'DYN001',
  'enigma, new moon':                    'MST238',
  'genis wotchuneed':                    'EVR085',
  'hala':                                'MPW004',
  'melody, sing-along':                  'TCC049',
  'prism, advent of thrones':            'DTD002',
  'professor teklovossen':               'TCC001',
  'shiyana, diamond gemini':             'CRU097',
  'yoji, royal protector':               'DYN025',
};

// Living Legend leaderboard snapshot — updated manually from fabtcg.com leaderboard.
// Keys must match HERO_INFO / YOUNG_HERO_INFO keys (lowercase). Omit heroes with 0 points.
export const LIVING_LEGEND_POINTS_UPDATED_AT = '2026-06-29';
export const LIVING_LEGEND_POINTS_SOURCE_LABEL = '2026 National Championships';

export const LIVING_LEGEND_POINTS: Record<string, number> = {
  // Active Classic Constructed heroes (LL points < 1000)
  'victor goldmane, high and mighty': 951,
  'kassai of the golden sand': 892,
  'dash i/o': 875,
  'fai, rising rebellion': 856,
  'cindra, dracai of retribution': 845,
  'bravo, showstopper': 776,
  'katsu, the wanderer': 746,
  'dorinthea ironsong': 743,
  'oscilio, constella intelligence': 666,
  'arakni, marionette': 644,
  'gravy bones, shipwrecked looter': 494,
  'ser boltyn, breaker of dawn': 417,
  'uzuri, switchblade': 405,
  'rhinar, reckless rampage': 362,
  'vynnset, iron maiden': 266,
  'arakni, huntsman': 244,
  'jarl vetreiði': 223,
  'levia, shadowborn abomination': 200,
  'arakni, 5l!p3d 7hru 7h3 cr4x': 193,
  'fang, dracai of blades': 153,
  'ira, scarlet revenger': 131,
  'riptide, lurker of the deep': 98,
  "maxx 'the hype' nitro": 85,
  'teklovossen, esteemed magnate': 49,
  'pleiades, superstar': 45,
  'kayo, underhanded cheat': 29,
  'valda, seismic impact': 28,
  'puffin, hightail': 28,
  'marlynn, treasure hunter': 21,
  'zyggy starlight': 8,
  'olympia, prized fighter': 7,
  'betsy, skin in the game': 7,
  'tuffnut, bumbling hulkster': 5,
  'lyath goldmane, vile savant': 3,

  // Graduated Living Legends (≥ 1000 points — no longer CC-legal)
  'bravo, star of the show': 1582,
  'lexi, livewire': 1276,
  'oldhim, grandfather of eternity': 1186,
  'briar, warden of thorns': 1158,
  'chane, bound by shadow': 1102,
  'prism, sculptor of arc light': 1098,
  'dromai, ash artist': 1096,
  'aurora, shooting star': 1051,
  'enigma, ledger of ancestry': 1046,
  'azalea, ace in the hole': 1036,
  'florian, rotwood harbinger': 1029,
  'kano, dracai of aether': 1028,
  'verdance, thorn of the rose': 1019,
  'viserai, rune blood': 1016,
  'kayo, armed and dangerous': 1014,
  'dash, inventor extraordinaire': 1013,
  'iyslander, stormbind': 1012,
  'prism, awakener of sol': 1010,
  'nuu, alluring desire': 1004,
  'zen, tamer of purpose': 1000,
};

export const LIVING_LEGEND_THRESHOLD = 1000;

export function getLivingLegendPoints(heroName: string): number | null {
  const key = heroName.toLowerCase();
  return LIVING_LEGEND_POINTS[key] ?? null;
}

export function isLivingLegendGraduated(heroName: string): boolean {
  const pts = getLivingLegendPoints(heroName);
  return pts !== null && pts >= LIVING_LEGEND_THRESHOLD;
}

// Marvel (rarity='v') printings used for hero portraits on the Starter Kits page.
// The Starter Kits index is decorative — unlike decklists it has no printing-legality
// constraint, so we can surface the dramatic Marvel artwork. Adult hero cards only
// (types do NOT include 'young'). Heroes without an adult Marvel fall back to their
// regular printing in consumers.
export const HERO_MARVEL_PRINTING_IDS: Record<string, string> = {
  // Assassins
  'arakni, huntsman': 'GkTQBCJzmJHgMTrKNd6qH',
  'arakni, marionette': 'cMjgCqfBRmkwtGR6gCgt6',
  'arakni, 5l!p3d 7hru 7h3 cr4x': 'ndhzmwPDnPNhRJBpPKWCd',
  'nuu, alluring desire': 'QtMtcMzmcmbDpMJqcQLtW',

  // Brutes
  'kayo, armed and dangerous': 'FRC6K6BTNtzrrF6RRcwKc',
  'kayo, underhanded cheat': 'hjN6TnDDzqJGBFmhmQR8N',
  'tuffnut, bumbling hulkster': 'zkwNKBrhHmTnwMBrzhdfj',

  // Guardians
  'betsy, skin in the game': 't6MBPQL8MT7GBMTDcjPKb',
  'valda, seismic impact': 'WCGGk8MTgKTBKzDMkwwqj',
  'victor goldmane, high and mighty': 'RkQMDqD7TMffNzCBmzNMw',
  'lyath goldmane, vile savant': 'wJHKFwtNgKwGcT6WcQWGg',

  // Illusionists / Shapeshifters
  'pleiades, superstar': '6qBpKJrfzhmgJhNRGrcbn',
  'enigma, ledger of ancestry': 'HPKKdcJLbBRrpcKQt69gD',

  // Mechanologists
  'puffin, hightail': 'nfjHwhBfrKMKgwkFTCTmM',

  // Ninjas
  'gravy bones, shipwrecked looter': 'BFftmnPWFFTtNJTmRgw8W',
  'cindra, dracai of retribution': 'zbnPRKjnn9HT8WphKjngw',
  'zen, tamer of purpose': 'tQPKCjzwfPr7HMNtRWgCH',

  // Rangers
  'marlynn, treasure hunter': 'm8HzgzM789KRHdzfLkNz7',

  // Runeblades
  'aurora, shooting star': 'wT6TMjkLGcJ98HqCzwMdj',
  'aurora, legacy of tempest': '8ttHnDjQjjLkrT9QtBcGT',
  'briar, warden of thorns': 'B9TBh6dTQwQNnfqLfPpK9',
  'florian, rotwood harbinger': 'mF7Tqd8J7Rnn6wLcNHq9D',

  // Warriors
  'fang, dracai of blades': 'Mph7NpNLFFLjB7wTMmbDb',
  'kassai of the golden sand': 'JCFgtBGRdKtHDrQwQHLfD',
  'olympia, prized fighter': '6KgBNNDCww6WL98w7CTTF',
  'jarl vetreiði': 't8tntqfjrbbmCRdPnWGBL',

  // Bards
  'oscilio, constella intelligence': 'phb8MM8rg8gjtmJt6DTG6',
  'oscilio, forked continuum': 'bWBMqq7qHpDhwwg6gbBpf',
  'verdance, thorn of the rose': 'qKHDTdmJkCKnCj6WWT7Tf',
};

const MARVEL_IMAGE_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';

export function getHeroMarvelImageUrl(heroName: string): string | null {
  const key = heroName.toLowerCase();
  const printingId = HERO_MARVEL_PRINTING_IDS[key];
  if (!printingId) return null;
  return `${MARVEL_IMAGE_BASE}/${printingId}/public`;
}
