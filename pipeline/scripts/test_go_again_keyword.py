#!/usr/bin/env python3
"""
"Go again" is the most-searched keyword, and the fab-cube feed's
`card_keywords` omits it whenever it belongs to an activated ability
("Action -- destroy this: ... Go again") rather than the card's top line —
190 cards on 2026-09-07 (Potion of Strength, Goliath Gauntlet, Restless
Corporal once it reaches the feed). The transformer owns `cards.keywords`
(005 upserts it nightly), so the augmentation must live here: add 'go again'
when the rules text carries it as the card's OWN keyword, never when another
card is merely granted it ("your next attack gets go again").

Run:
  python3 pipeline/scripts/test_go_again_keyword.py
"""
import importlib.util
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent


def _load_module(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


transformer = _load_module('003_cards_to_printings_transformer.py', 'transformer_003')


class GoAgainKeywordTest(unittest.TestCase):
    def setUp(self):
        self.fn = transformer.augment_go_again_keyword

    def test_activated_ability_go_again_is_the_cards_own_keyword(self):
        text = "Action -- {t}: Put a card from your banished zone into your graveyard. Go again\nDecay"
        self.assertEqual(self.fn([], text), ['go again'])

    def test_top_line_go_again_already_in_feed_is_not_duplicated(self):
        self.assertEqual(self.fn(['go again'], "Go again"), ['go again'])

    def test_granted_go_again_is_not_the_cards_keyword(self):
        for text in [
            "At the start of your turn, destroy this, then your next attack this turn gets go again.",
            "This card's attacks get go again.",
            "If you do, this gets +1{p} and go again.",
            "Target attack action card gains go again.",
            "Your weapon attacks have go again this turn.",
            "Attack action cards with cost 0 you control lose go again.",
        ]:
            self.assertEqual(self.fn([], text), [], text)

    def test_existing_keywords_are_preserved_and_go_again_appended(self):
        self.assertEqual(self.fn(['battleworn'], "Action - {r}, destroy this: your weapon attacks get +1{p} this turn. Go again\nBattleworn"), ['battleworn', 'go again'])

    def test_no_text_no_change(self):
        self.assertEqual(self.fn(['ward 2'], None), ['ward 2'])
        self.assertEqual(self.fn([], ''), [])


class GoAgainThroughTransformerTest(unittest.TestCase):
    """End to end through transform_card_to_printings: the feed's text field is
    functional_text_plain and card_keywords is the feed's list."""

    def _doc(self, text, card_keywords):
        t = transformer.CardsToPrintingsTransformer()
        docs = t.transform_card_to_printings({
            'unique_id': 'test-card-uid', 'name': 'Potion of Strength',
            'types': ['Generic', 'Action', 'Item'], 'pitch': '',
            'functional_text_plain': text, 'card_keywords': card_keywords,
            'printings': [{'unique_id': 'test-printing-uid', 'id': 'WTR170', 'set_id': 'WTR',
                           'edition': 'U', 'foiling': 'S', 'rarity': 'C'}],
        })
        self.assertEqual(len(docs), 1)
        return docs[0]

    def test_item_with_go_again_on_its_ability_gets_the_keyword(self):
        doc = self._doc("Action - destroy this: Your next attack this turn gets +2{p}. Go again", [])
        self.assertEqual(doc['keywords'], ['go again'])

    def test_feed_keywords_kept_and_grant_ignored(self):
        doc = self._doc("At the start of your turn, your next attack gets go again.", ['Ward 1'])
        self.assertEqual(doc['keywords'], ['ward 1'])


if __name__ == '__main__':
    unittest.main()
