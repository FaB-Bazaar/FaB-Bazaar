#!/usr/bin/env python3
"""
Step 03B (003b_image_uploader.py) uploads art for printings that are NEW to
the DB that night. It reads the fab-cube source URL from the seed doc — but
003 rewrites `printing_data.image_url` to the Cloudflare delivery URL for
EVERY printing, and 03B skipped anything "already a Cloudflare URL". Net
effect: 03B never uploaded a single image, and every pipeline-inserted
printing (JDG052 Construct Bank Breaker, the HER/WIN hero promos, FAB promos…)
shipped with an image_url that 404s.

The contract pinned here: 003 keeps the upstream art URL in
`printing_data.source_image_url`, and 03B uploads from that field.

Run:
  python3 pipeline/scripts/test_image_uploader_source.py
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


transformer_module = _load_module("003_cards_to_printings_transformer.py", "transformer")
uploader_module = _load_module("003b_image_uploader.py", "uploader")

LSS_URL = "https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/JDG052-MV.webp"
CF_URL = "https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/HptgdhhkGm99CwqqtPCDT/public"


def make_card():
    return {
        "unique_id": "RNCWjkhhdhrHCNRncqznq",
        "name": "Construct Bank Breaker",
        "types": ["Mechanologist", "Action", "Item"],
        "pitch": "2",
        "printings": [
            {
                "unique_id": "HptgdhhkGm99CwqqtPCDT",
                "id": "JDG052",
                "set_id": "JDG",
                "edition": "N",
                "foiling": "C",
                "rarity": "P",
                "image_url": LSS_URL,
            }
        ],
    }


class TransformerKeepsSourceImage(unittest.TestCase):
    def setUp(self):
        self.t = transformer_module.CardsToPrintingsTransformer()

    def test_image_url_is_cloudflare_and_source_is_preserved(self):
        doc = self.t.transform_card_to_printings(make_card())[0]
        self.assertEqual(doc["printing_data"]["image_url"], CF_URL)
        self.assertEqual(doc["printing_data"]["source_image_url"], LSS_URL)

    def test_missing_upstream_art_leaves_source_empty(self):
        card = make_card()
        del card["printings"][0]["image_url"]
        doc = self.t.transform_card_to_printings(card)[0]
        self.assertEqual(doc["printing_data"].get("source_image_url", ""), "")


class UploaderReadsSourceImage(unittest.TestCase):
    def test_uses_source_image_url_even_when_image_url_is_cloudflare(self):
        doc = {"printing_data": {"image_url": CF_URL, "source_image_url": LSS_URL}}
        self.assertEqual(uploader_module.get_source_image_url(doc), LSS_URL)

    def test_never_returns_a_cloudflare_url_as_a_source(self):
        doc = {"printing_data": {"image_url": CF_URL}}
        self.assertEqual(uploader_module.get_source_image_url(doc), "")

    def test_legacy_seed_with_upstream_url_in_image_url_still_works(self):
        doc = {"printing_data": {"image_url": LSS_URL}}
        self.assertEqual(uploader_module.get_source_image_url(doc), LSS_URL)


if __name__ == "__main__":
    unittest.main()
