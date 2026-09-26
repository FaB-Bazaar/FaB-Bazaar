#!/usr/bin/env python3
"""
Tests for 011_warm_search_cache.py — the pipeline's last step, which asks the
app to refill the /opt search cache (POST /api/cron/warm-search-cache with the
CRON_SECRET bearer). The nightly price update invalidates every cached search,
so without this the first visitor of each common search pays the cold query.
"""

import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def _load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


warm = _load_module("warm_search_cache_011", "011_warm_search_cache.py")


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.text = str(payload)

    def json(self):
        return self._payload


class FakePost:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def __call__(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.response


OK = FakeResponse(200, {"success": True, "data": {
    "targets": 170, "warmed": 168, "alreadyCached": 1, "failed": [{"query": "classes=x", "error": "no results"}],
    "elapsedMs": 120500,
}})


class WarmSearchCacheTest(unittest.TestCase):
    def test_posts_to_the_cron_route_with_the_bearer_and_duration(self):
        post = FakePost(OK)
        rc = warm.run(base_url="http://nextjs:3000", secret="s3cret", duration_ms=120000, post=post)
        self.assertEqual(rc, 0)
        url, kwargs = post.calls[0]
        self.assertEqual(url, "http://nextjs:3000/api/cron/warm-search-cache")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer s3cret")
        self.assertEqual(kwargs["json"], {"durationMs": 120000})
        # The route paces itself over durationMs — the client must wait longer.
        self.assertGreater(kwargs["timeout"], 120)

    def test_fails_without_a_secret_and_does_not_call(self):
        post = FakePost(OK)
        self.assertEqual(warm.run(base_url="http://nextjs:3000", secret="", duration_ms=0, post=post), 1)
        self.assertEqual(post.calls, [])

    def test_fails_on_a_non_200(self):
        post = FakePost(FakeResponse(401, {"error": "Unauthorized"}))
        self.assertEqual(warm.run(base_url="http://nextjs:3000", secret="s3cret", duration_ms=0, post=post), 1)

    def test_summary_names_the_counts_and_failures(self):
        lines = warm.summarize(OK.json()["data"])
        self.assertIn("168 warmed, 1 already cached, 1 failed of 170", lines[0])
        self.assertIn("classes=x", lines[1])


if __name__ == "__main__":
    unittest.main()
