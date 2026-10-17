#!/usr/bin/env python3
"""
Tests for cardmarket_match.py — mapping Cardmarket price-guide products to our printings.

Cardmarket's product list has no set code or collector number: only a name,
an idExpansion and an idProduct. The cases below are real rows from the
2026-10-16 products_singles_16.json / price_guide_16.json files.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import cardmarket_match as cm  # noqa: E402


class CardKeyTests(unittest.TestCase):
    def test_pitch_suffix_kept_for_multi_pitch_card(self):
        self.assertEqual(cm.cm_card_key('Zipper Hit (Red)', {'zipper hit'}), ('zipper hit', 'red', None))

    def test_pitch_suffix_absent_for_single_pitch_card(self):
        # Cardmarket only appends "(Red)" when the card exists in several pitches
        self.assertEqual(cm.cm_card_key('Command and Conquer', set()), ('command and conquer', None, None))

    def test_double_faced_name_splits_front_and_back(self):
        self.assertEqual(cm.cm_card_key('Rising Sun, Setting Moon // Inner Chi', set()),
                         ('rising sun, setting moon', None, 'inner chi'))

    def test_cardmarket_pitch_typos_are_read_as_pitches(self):
        # all real product names: double space, "Yelllow", "Bleu"
        multi = {'sun kiss', "hold 'em", 'feisty locals'}
        self.assertEqual(cm.cm_card_key('Sun Kiss  (Yellow)', multi), ('sun kiss', 'yellow', None))
        self.assertEqual(cm.cm_card_key("Hold 'em (Yelllow)", multi), ("hold 'em", 'yellow', None))
        self.assertEqual(cm.cm_card_key('Feisty Locals (Bleu)', multi), ('feisty locals', 'blue', None))

    def test_accents_are_ignored(self):
        # Cardmarket: "Twelve Petal Kasaya", ours: "Twelve Petal Kāṣāya"
        self.assertEqual(cm.cm_card_key('Twelve Petal Kasaya', set())[0], cm.cm_card_key('Twelve Petal Kāṣāya', set())[0])

    def test_name_alias_maps_cardmarket_spelling_to_ours(self):
        aliases = cm.load_name_aliases()
        self.assertEqual(cm.cm_card_key('Arakni, Slipped Through The Cracks', set(), aliases)[0],
                         'arakni, 5l!p3d 7hru 7h3 cr4x')
        self.assertEqual(cm.cm_card_key('Voltic Bolts (Blue)', {'voltic bolt'}, aliases), ('voltic bolt', 'blue', None))

    def test_face_separator_without_spaces_still_splits(self):
        # Cardmarket's own spelling for UPR009
        self.assertEqual(cm.cm_card_key('Invoke Azvolai// Azvolai', set()), ('invoke azvolai', None, 'azvolai'))


class ExpansionMapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.emap = cm.load_expansion_map()

    def test_editions_are_separate_expansions(self):
        self.assertEqual(self.emap[4477], [('wtr', 'a')])
        self.assertEqual(self.emap[4479], [('wtr', 'u')])

    def test_untracked_expansion_maps_to_nothing(self):
        # History Pack 1 - Black Label: we hold no printings for it
        self.assertEqual(self.emap[5042], [])

    def test_one_expansion_can_span_two_of_our_sets(self):
        # Classic Battles: Rhinar vs Dorinthea is split into dvr + rvd on our side
        self.assertEqual(self.emap[5054], [('dvr', None), ('rvd', None)])

    def test_unknown_expansion_is_reported(self):
        products = [{'idProduct': 1, 'idExpansion': 4477}, {'idProduct': 2, 'idExpansion': 99999}]
        self.assertEqual(cm.unknown_expansions(products, self.emap), [99999])


def product(id_product, name, id_expansion):
    return {'idProduct': id_product, 'name': name, 'idExpansion': id_expansion}


def printing(pid, name, set_code, collector, *, pitch=None, edition='n', foiling='s', art='', low=None,
             tcgp=None, front=True, back=None):
    return {'printing_id': pid, 'name': name, 'pitch': pitch, 'set': set_code, 'edition': edition,
            'foiling': foiling, 'collector_number': collector, 'art_variations': art, 'tcg_low': low,
            'tcgplayer_product_id': tcgp, 'is_front_face': front, 'back_name': back}


def by_printing(results):
    return {r['printing_id']: r for r in results}


class OneToOneTests(unittest.TestCase):
    emap = {6464: [('sda', None)]}

    def test_single_product_pairs_with_single_printing(self):
        results = cm.match(
            [product(878461, 'Zipper Hit (Red)', 6464), product(878467, 'Zipper Hit (Yellow)', 6464)],
            {878461: {'trend': None, 'low': 0.03}},
            [printing('p-sda021', 'Zipper Hit', 'sda', 'SDA021', pitch='red', low=0.05),
             printing('p-sda022', 'Zipper Hit', 'sda', 'SDA022', pitch='yellow')],
            self.emap)
        r = by_printing(results)
        self.assertEqual(r['p-sda021']['product_id'], 878461)
        self.assertEqual(r['p-sda021']['status'], 'matched')
        self.assertEqual(r['p-sda022']['product_id'], 878467)

    def test_printing_in_unmapped_set_has_no_product(self):
        results = cm.match([], {}, [printing('p-win', 'Snatch', 'win', 'WIN001', pitch='red')], self.emap)
        self.assertEqual(by_printing(results)['p-win'], {'printing_id': 'p-win', 'product_id': None,
                                                         'status': 'no_cm_product'})


class RankPairingTests(unittest.TestCase):
    def test_unpriced_cold_foil_still_gets_the_expensive_product(self):
        # ARC005 1st edition: our cold foil has no TCGplayer price. Ranking by our
        # price alone handed it the €0.74 non-foil product.
        results = cm.match(
            [product(601000, 'Achilles Accelerator', 4480), product(601001, 'Achilles Accelerator', 4480)],
            {601000: {'trend': 341, 'low': 250}, 601001: {'trend': 0.74, 'low': 0.66}},
            [printing('p-cf', 'Achilles Accelerator', 'arc', 'ARC005', edition='f', foiling='c'),
             printing('p-nf', 'Achilles Accelerator', 'arc', 'ARC005', edition='f', foiling='s', low=0.45)],
            {4480: [('arc', 'f')], 4481: [('arc', 'u')]})
        r = by_printing(results)
        self.assertEqual(r['p-cf']['product_id'], 601000)
        self.assertEqual(r['p-nf']['product_id'], 601001)

    def test_newer_set_pairs_by_price_not_product_id_order(self):
        # HNT lists the non-foil first (ARC 1st lists the foil first), so id order can't be trusted.
        results = cm.match(
            [product(807073, 'Shelter from the Storm', 5959), product(807074, 'Shelter from the Storm', 5959),
             product(807163, 'Shelter from the Storm', 5959)],
            {807073: {'trend': 83.73, 'low': 71.1}, 807074: {'trend': 99.75, 'low': 90},
             807163: {'trend': 229.14, 'low': 210}},
            [printing('p-s', 'Shelter from the Storm', 'hnt', 'HNT222', foiling='s', low=88.99),
             printing('p-r', 'Shelter from the Storm', 'hnt', 'HNT222', foiling='r', low=90),
             printing('p-ea', 'Shelter from the Storm', 'hnt', 'HNT222', foiling='r', art='EA', low=289.71)],
            {5959: [('hnt', None)]})
        r = by_printing(results)
        self.assertEqual((r['p-s']['product_id'], r['p-r']['product_id'], r['p-ea']['product_id']),
                         (807073, 807074, 807163))


class PromoOrderTests(unittest.TestCase):
    def test_fab_promos_pair_by_release_order(self):
        # FAB promo numbers and Cardmarket product ids both grow with release date.
        # Rank pairing would give the cold-foil FAB515 the €343 product (that's FAB359).
        results = cm.match(
            [product(819649, 'Sink Below (Red)', 4503), product(843954, 'Sink Below (Red)', 4503),
             product(916440, 'Sink Below (Red)', 4503)],
            {819649: {'trend': 60.68}, 843954: {'trend': 343}, 916440: {'trend': 340.39}},
            [printing('p-515', 'Sink Below', 'fab', 'FAB515', pitch='red', foiling='c', low=312),
             printing('p-332', 'Sink Below', 'fab', 'FAB332', pitch='red', foiling='r', art='AA,EA', low=109.01),
             printing('p-359', 'Sink Below', 'fab', 'FAB359', pitch='red', foiling='r', art='AA,EA', low=574.89),
             printing('p-wtr', 'Sink Below', 'wtr', 'WTR216', pitch='yellow')],
            {4503: [('fab', None)]})
        r = by_printing(results)
        self.assertEqual((r['p-332']['product_id'], r['p-359']['product_id'], r['p-515']['product_id']),
                         (819649, 843954, 916440))


class MissingPitchSuffixTests(unittest.TestCase):
    emap = {4476: [('ira', None)]}
    elsewhere = [printing('p-wtr-y', 'Torrent of Tempo', 'wtr', 'WTR108', pitch='yellow')]

    def test_unsuffixed_product_matches_the_sets_only_pitch(self):
        # Torrent of Tempo has three pitches, but the Ira Welcome Deck product carries no "(Red)"
        results = cm.match(
            [product(600006, 'Torrent of Tempo', 4476)], {600006: {'trend': 0.11}},
            [printing('p-ira006', 'Torrent of Tempo', 'ira', 'IRA006', pitch='red', low=0.1)] + self.elsewhere,
            self.emap)
        self.assertEqual(by_printing(results)['p-ira006']['product_id'], 600006)

    def test_unsuffixed_product_is_not_shared_by_two_pitches_of_one_set(self):
        results = cm.match(
            [product(600006, 'Torrent of Tempo', 4476)], {600006: {'trend': 0.11}},
            [printing('p-red', 'Torrent of Tempo', 'ira', 'IRA006', pitch='red'),
             printing('p-yellow', 'Torrent of Tempo', 'ira', 'IRA007', pitch='yellow')],
            self.emap)
        r = by_printing(results)
        self.assertEqual((r['p-red']['product_id'], r['p-yellow']['product_id']), (None, None))


class AliasMatchTests(unittest.TestCase):
    def test_aliased_cardmarket_name_pairs_with_our_printing(self):
        results = cm.match(
            [product(822771, 'Sawbones, Dockhand', 6118)], {822771: {'trend': 0.5}},
            [printing('p-agb019', 'Sawbones, Dock Hand', 'agb', 'AGB019', pitch='yellow', low=0.49)],
            {6118: [('agb', None)]}, cm.load_name_aliases())
        self.assertEqual(by_printing(results)['p-agb019']['product_id'], 822771)


class OurDuplicateRowTests(unittest.TestCase):
    emap = {5959: [('hnt', None)], 5756: [('mst', None)]}

    def test_rows_sharing_tcgplayer_product_and_foiling_share_one_product(self):
        # HNT263 Arakni, Huntsman is two rows of ours ({} and {FA}) for one physical card
        results = cm.match(
            [product(807253, 'Arakni, Huntsman', 5959)], {807253: {'trend': 198.69}},
            [printing('p-a', 'Arakni, Huntsman', 'hnt', 'HNT263', foiling='c', low=270, tcgp='614358'),
             printing('p-b', 'Arakni, Huntsman', 'hnt', 'HNT263', foiling='c', art='FA', low=270, tcgp='614358')],
            self.emap)
        r = by_printing(results)
        self.assertEqual((r['p-a']['product_id'], r['p-b']['product_id']), (807253, 807253))

    def test_foilings_of_one_tcgplayer_product_are_not_folded(self):
        # One TCGplayer product spans every foiling (they're subtypes), Cardmarket splits them
        results = cm.match(
            [product(807073, 'Shelter from the Storm', 5959), product(807074, 'Shelter from the Storm', 5959)],
            {807073: {'trend': 83.73}, 807074: {'trend': 99.75}},
            [printing('p-s', 'Shelter from the Storm', 'hnt', 'HNT222', foiling='s', low=88.99, tcgp='1'),
             printing('p-r', 'Shelter from the Storm', 'hnt', 'HNT222', foiling='r', low=90, tcgp='1')],
            self.emap)
        r = by_printing(results)
        self.assertEqual((r['p-s']['product_id'], r['p-r']['product_id']), (807073, 807074))

    def test_different_collector_numbers_are_not_folded(self):
        # KSU003 / KSU004 Harmonized Kodachi share TCGplayer product 225746 but are two printings
        results = cm.match(
            [product(600506, 'Harmonized Kodachi', 4491), product(600507, 'Harmonized Kodachi', 4491)],
            {600506: {'trend': 2.9}, 600507: {'trend': 3.5}},
            [printing('p-003', 'Harmonized Kodachi', 'ksu', 'KSU003', low=5.25, tcgp='225746'),
             printing('p-004', 'Harmonized Kodachi', 'ksu', 'KSU004', low=5.25, tcgp='225746')],
            {4491: [('ksu', None)]})
        r = by_printing(results)
        self.assertEqual({r['p-003']['product_id'], r['p-004']['product_id']}, {600506, 600507})

    def test_back_faces_are_skipped(self):
        results = cm.match(
            [product(768916, 'Rising Sun, Setting Moon // Inner Chi', 5756)], {},
            [printing('p-back', 'Inner Chi', 'mst', 'MST100', front=False)], self.emap)
        self.assertEqual(by_printing(results)['p-back']['status'], 'back_face')


class DoubleFacedTests(unittest.TestCase):
    def test_front_back_product_pairs_on_the_front_name(self):
        results = cm.match(
            [product(768916, 'Rising Sun, Setting Moon // Inner Chi', 5756),
             product(768917, 'Rising Sun, Setting Moon // Inner Chi', 5756)],
            {768916: {'trend': 0.15}, 768917: {'trend': 108.86}},
            [printing('p-s', 'Rising Sun, Setting Moon', 'mst', 'MST100', low=0.05, back='inner chi'),
             printing('p-cf', 'Rising Sun, Setting Moon', 'mst', 'MST100', foiling='c', art='FA', low=95.99,
                      back='inner chi')],
            {5756: [('mst', None)]})
        r = by_printing(results)
        self.assertEqual((r['p-s']['product_id'], r['p-cf']['product_id']), (768916, 768917))

    def test_our_double_faced_name_matches_on_its_front(self):
        # our cards.name carries both faces ("Burn Up // Shock"), like Cardmarket's
        results = cm.match(
            [product(787702, 'Burn Up // Shock', 5801), product(787703, 'Burn Up // Shock', 5801)],
            {787702: {'trend': 0.31}, 787703: {'trend': 1.47}},
            [printing('p-s', 'Burn Up // Shock', 'ros', 'ROS012', pitch='red', low=0.07, tcgp='561265'),
             printing('p-r', 'Burn Up // Shock', 'ros', 'ROS012', pitch='red', foiling='r', low=1.73,
                      tcgp='561265')],
            {5801: [('ros', None)]})
        r = by_printing(results)
        self.assertEqual((r['p-s']['product_id'], r['p-r']['product_id']), (787702, 787703))

    def test_random_back_products_all_belong_to_our_one_printing(self):
        # WTR Alpha Romping Club came with random backs; Cardmarket sells each back
        # as its own product, we have one printing. Show the cheapest priced one.
        results = cm.match(
            [product(605412, 'Romping Club // Bravo', 4477), product(605416, 'Romping Club // Katsu, the Wanderer', 4477),
             product(605428, 'Romping Club // Quicken', 4477), product(666443, 'Romping Club // Dawnblade', 4477)],
            {605412: {'trend': 1.11, 'low': 1}, 605416: {'trend': 2.54, 'low': 1.71},
             605428: {'trend': 1.39, 'low': 0.76}, 666443: {'trend': None, 'low': None}},
            [printing('p-wtr003', 'Romping Club', 'wtr', 'WTR003', edition='a', low=0.1)],
            {4477: [('wtr', 'a')]})
        r = by_printing(results)['p-wtr003']
        self.assertEqual(r['product_id'], 605412)
        self.assertEqual(r['all_product_ids'], [605412, 605416, 605428, 666443])
        self.assertEqual(r['status'], 'matched')


class SoldAsBackFaceTests(unittest.TestCase):
    def test_card_sold_only_as_a_back_face_takes_the_cheapest_of_those_products(self):
        # MON 1st edition Ravenous Meataxe is printed on the back of Prism / Levia / Soul Shackle
        results = cm.match(
            [product(605738, 'Prism // Ravenous Meataxe', 4484), product(605749, 'Levia // Ravenous Meataxe', 4484),
             product(605753, 'Soul Shackle // Ravenous Meataxe', 4484)],
            {605738: {'trend': 0.16}, 605749: {'trend': 0.19}, 605753: {'trend': 0.09}},
            [printing('p-mon221', 'Ravenous Meataxe', 'mon', 'MON221', edition='f', low=0.01)],
            {4484: [('mon', 'f')], 4485: [('mon', 'u')]})
        r = by_printing(results)['p-mon221']
        self.assertEqual((r['product_id'], r['status']), (605753, 'matched'))
        self.assertEqual(r['all_product_ids'], [605738, 605749, 605753])


class ReviewTests(unittest.TestCase):
    emap = {4479: [('wtr', 'u')], 4491: [('ksu', None)]}

    def test_rank_pairing_on_near_equal_prices_is_flagged_for_review(self):
        # WTR Unlimited Snatch (Yellow): €0.24 vs €0.23 can't tell the rainbow foil from the non-foil
        results = cm.match(
            [product(600881, 'Snatch (Yellow)', 4479), product(600882, 'Snatch (Yellow)', 4479)],
            {600881: {'trend': 0.24}, 600882: {'trend': 0.23}},
            [printing('p-r', 'Snatch', 'wtr', 'WTR168', pitch='yellow', edition='u', foiling='r', low=0.14),
             printing('p-s', 'Snatch', 'wtr', 'WTR168', pitch='yellow', edition='u', foiling='s', low=0.04),
             printing('p-red', 'Snatch', 'wtr', 'WTR167', pitch='red', edition='u')],
            self.emap)
        r = by_printing(results)
        self.assertEqual((r['p-r']['product_id'], r['p-r']['status']), (600881, 'review'))
        self.assertEqual((r['p-s']['product_id'], r['p-s']['status']), (600882, 'review'))

    def test_clear_price_gap_is_not_flagged(self):
        results = cm.match(
            [product(600881, 'Snatch (Yellow)', 4479), product(600882, 'Snatch (Yellow)', 4479)],
            {600881: {'trend': 0.56}, 600882: {'trend': 0.17}},
            [printing('p-r', 'Snatch', 'wtr', 'WTR168', pitch='yellow', edition='u', foiling='r'),
             printing('p-s', 'Snatch', 'wtr', 'WTR168', pitch='yellow', edition='u', foiling='s'),
             printing('p-red', 'Snatch', 'wtr', 'WTR167', pitch='red', edition='u')],
            self.emap)
        self.assertEqual({r['status'] for r in results if r['printing_id'] != 'p-red'}, {'matched'})

    def test_count_mismatch_is_left_unpaired_for_review(self):
        results = cm.match(
            [product(1, 'Harmonized Kodachi', 4491), product(2, 'Harmonized Kodachi', 4491)],
            {1: {'trend': 5}, 2: {'trend': 9}},
            [printing('p-ksu004', 'Harmonized Kodachi', 'ksu', 'KSU004', low=5.25)], self.emap)
        self.assertEqual(by_printing(results)['p-ksu004'],
                         {'printing_id': 'p-ksu004', 'product_id': None, 'status': 'count_mismatch',
                          'candidate_product_ids': [1, 2]})


class ProductUrlTests(unittest.TestCase):
    """Every expected URL below was opened on cardmarket.com by hand (2026-10-16)."""

    BASE = 'https://www.cardmarket.com/en/FleshAndBlood/Products/Singles/'

    def check(self, expected_path, cm_name, expansion_name, id_expansion, collector='X001', rarity=None, **kw):
        p = printing('p', 'x', 'x', collector, **kw)
        p['rarity'] = rarity
        self.assertEqual(cm.cardmarket_url(cm_name, expansion_name, id_expansion, p), self.BASE + expected_path)

    def test_old_sets_use_edition_collector_number_and_foil_code(self):
        self.check('Arcane-Rising-First/Zipper-Hit-Red-ARC029-RF', 'Zipper Hit (Red)', 'Arcane Rising - First', 4480,
                   'ARC029', edition='f', foiling='r')
        self.check('Arcane-Rising-Unlimited/Zipper-Hit-Red-U-ARC029', 'Zipper Hit (Red)', 'Arcane Rising - Unlimited',
                   4481, 'ARC029', edition='u')
        self.check('Welcome-to-Rathe-Alpha/Fyendals-Spring-Tunic-WTR150-CF', "Fyendal's Spring Tunic",
                   'Welcome to Rathe - Alpha', 4477, 'WTR150', edition='a', foiling='c')
        self.check('Monarch-Unlimited/Blinding-Beam-Red-U-MON084-RF', 'Blinding Beam (Red)', 'Monarch - Unlimited',
                   4485, 'MON084', edition='u', foiling='r')

    def test_newer_sets_name_the_finish(self):
        self.check('The-Hunted/Blade-Beckoner-Boots-Regular', 'Blade Beckoner Boots', 'The Hunted', 5959)
        self.check('Rosetta/Burn-Up-Shock-Rainbow-Foil', 'Burn Up // Shock', 'Rosetta', 5801, foiling='r')
        self.check('Dynasty/Imperial-Warhorn-Cold-Foil', 'Imperial Warhorn', 'Dynasty', 5147, foiling='c')
        self.check('Everfest-First/Smashing-Good-Time-Red-Rainbow-Foil', 'Smashing Good Time (Red)', 'Everfest - First',
                   4500, edition='f', foiling='r')
        self.check('Armory-Deck-Dash-IO/Zipper-Hit-Red-Regular', 'Zipper Hit (Red)', 'Armory Deck: Dash I/O', 5918)
        self.check('Round-the-Table-TCC-x-LSS/Zipper-Hit-Red-Regular', 'Zipper Hit (Red)', 'Round the Table: TCC x LSS',
                   5473)

    def test_extended_art_prefixes_the_finish(self):
        self.check('High-Seas/Sealace-Sarong-Extended-Art-Cold-Foil', 'Sealace Sarong', 'High Seas', 6098,
                   foiling='c', art='EA')
        self.check('Compendium-of-Rathe-Antiquity-Pack/Fyendals-Spring-Tunic-Extended-Art-Rainbow-Foil',
                   "Fyendal's Spring Tunic", 'Compendium of Rathe - Antiquity Pack', 6459, foiling='r', art='AA,AB,EA')

    def test_marvels_and_full_art_are_marvel(self):
        self.check('Part-the-Mistveil/Enigma-Ledger-of-Ancestry-Marvel', 'Enigma, Ledger of Ancestry',
                   'Part the Mistveil', 5756, foiling='c', rarity='v')
        self.check('Tournament-Pack/Zipper-Hit-Red-Marvel', 'Zipper Hit (Red)', 'Tournament Pack', 6490,
                   foiling='c', art='FA', rarity='p')

    def test_history_pack_1_says_normal(self):
        self.check('History-Pack-1/Zipper-Hit-Red-Normal', 'Zipper Hit (Red)', 'History Pack 1', 5041)
        self.check('History-Pack-1-Black-Label/Zipper-Hit-Red-Regular', 'Zipper Hit (Red)',
                   'History Pack 1 - Black Label', 5042)

    def test_unverified_label_scheme_falls_back_to_search(self):
        # FAB Promos number products by collector number, but not always the way we do (FAB001 vs FAB002)
        p = printing('p', "Fyendal's Spring Tunic", 'fab', 'FAB002', foiling='r', art='EA')
        p['rarity'] = 'p'
        self.assertEqual(cm.cardmarket_url("Fyendal's Spring Tunic", 'FAB Promos', 4503, p),
                         'https://www.cardmarket.com/en/FleshAndBlood/Products/Search?searchString=Fyendal%27s+Spring+Tunic')


if __name__ == '__main__':
    unittest.main()
