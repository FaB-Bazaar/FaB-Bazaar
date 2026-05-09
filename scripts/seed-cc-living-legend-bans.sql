-- One-shot seed: register heroes who attained Living Legend status, plus their
-- signature weapons, as banned in Classic Constructed in the banned_cards
-- registry.
--
-- Plain-SQL counterpart to scripts/seed-cc-living-legend-bans.ts (used when
-- tsx is unavailable, e.g. inside the production Next.js container).
--
-- Idempotent: ON CONFLICT DO NOTHING against the (card_unique_id, format,
-- restriction_type) unique index. Refreshes cards.cc_banned cache at the end.

INSERT INTO banned_cards (id, card_unique_id, format, restriction_type, status_active, updated_at) VALUES
  ('98fcElfGj0bnwtEn6jPXR', 'mHBtPppktRTkWpnf69dHj', 'classic_constructed', 'banned', true, now()),
  ('bO464hW5XSUX4lNR5nbI1', 'PTFnJCdhWD9cFgMMNPqQj', 'classic_constructed', 'banned', true, now()),
  ('94KxMWkOUCby6CrwAIHPU', 'PFJnMWQNfr6jMMzJhjB9H', 'classic_constructed', 'banned', true, now()),
  ('xtxRPmsWHQIEBL29BCY51', 'cjDzkKdjNrGqL9tnDc7zd', 'classic_constructed', 'banned', true, now()),
  ('dutYMUalWKadfbeeY3jx1', 'MhBTRHCCft7RbrMmkwwGw', 'classic_constructed', 'banned', true, now()),
  ('1Wk2XVScIJXOIhJexNA1u', '6CcjWGnThrTmTQFQ9zHMN', 'classic_constructed', 'banned', true, now()),
  ('gjOf8MlBIcpTiSSpomlG1', 'PrJkWBKNgtNdzhqhWLGFw', 'classic_constructed', 'banned', true, now()),
  ('7jb0GphJmlLdp8vEBw9Y1', 'tJhRRN9kkMCnGQdQJ8TWg', 'classic_constructed', 'banned', true, now()),
  ('Ej8G1Sk9Ey29rREip46j4', 'hjMQGwKgDTh8LzFdnk8Rg', 'classic_constructed', 'banned', true, now()),
  ('chwgLup1gYVqzb9KUQ123', '8KRCDf6drqhFMKK7hJhbM', 'classic_constructed', 'banned', true, now()),
  ('pzt1hyuAESrx8QJsYgQGZ', 'kRPqHdCckKBKfRwjbfzNT', 'classic_constructed', 'banned', true, now()),
  ('oNpmWTE26ymOPaD3Gix5c', 'qdLHRPTdGkw6TjpMjPTW7', 'classic_constructed', 'banned', true, now()),
  ('Vwy1IETTzreu6a2VPbF21', 'PFmgFK9dFr8q6PrpJFpPG', 'classic_constructed', 'banned', true, now()),
  ('sn8IQtAhkAjB1r5Wpc9v1', 'MghLPDjq8CfBJ8RzNc7Ft', 'classic_constructed', 'banned', true, now()),
  ('MS3mXu5gVzdQ1hpp9DiJt', 'bh96L8jp69mNpjcGRCDbj', 'classic_constructed', 'banned', true, now()),
  ('RO5rCsW89Qkd2wT5oXhzw', 'F7rQpTDjHFWPgQhcGg7RT', 'classic_constructed', 'banned', true, now()),
  ('7SS4VfzDb4XYRgcCBDVr1', 'wJMCMFqcQfRJmK96kc8qM', 'classic_constructed', 'banned', true, now()),
  ('yVnKtltt5WgvJxaaJmHot', 'TKbRWjjBLJThMmLkTFb6q', 'classic_constructed', 'banned', true, now()),
  ('4HFiafqLqcsuuUaAQSUNp', 'GDbCgdDrFKCWWthrgD6h6', 'classic_constructed', 'banned', true, now()),
  ('O1nD3YbKrvaxt8TWMLnL1', 'm7NGBRdNftTh9ntBzppbB', 'classic_constructed', 'banned', true, now()),
  ('IVhuGbrxtyj4IsxROJb12', 'Nnmtz6GrR6MWMcptb6wD7', 'classic_constructed', 'banned', true, now()),
  ('p62tYQSDW6VNqlfurn2KJ', 'cbHrfwmLrMjWdhdBtzbff', 'classic_constructed', 'banned', true, now()),
  ('L3RvFNpAx1cKAsKWsCkm1', 'r8Bq8zBCNdzGPkmMcr6QL', 'classic_constructed', 'banned', true, now()),
  ('5I23OXM5oHgVWMTeLZZB1', 'fNFqtdWLq6tCPnnwjLLWL', 'classic_constructed', 'banned', true, now()),
  ('1mjgbA0jN1eCi3GOLAF12', 'PQm7zFjBPCzc68JDd8D6z', 'classic_constructed', 'banned', true, now()),
  ('9b1vD1Fz2adGLcDbkF0JC', 'zMC89pqnzTP7bkmfjmTzQ', 'classic_constructed', 'banned', true, now()),
  ('a4gTinteYxszvCoiNIUt1', 'HmQ8dbfPL8BLMkJDGGGm8', 'classic_constructed', 'banned', true, now()),
  ('yMBBqSJK4JQKSDVjHyVfI', 'Cd6PTGH6CqTHmt7LQmBMp', 'classic_constructed', 'banned', true, now()),
  ('jPMXgI6Pq071jhiVhduPN', 'nzDWrNMqGWgmJfgJhChNb', 'classic_constructed', 'banned', true, now()),
  ('yCovt3LFmhbzX0JiZ3Xlx', 'PRzqJ97HHdM6f8bLKhGzQ', 'classic_constructed', 'banned', true, now()),
  ('Qr7zHQUQQiPU883npnoL1', 'Nzpgn9HrbNfkzM8CkwCQp', 'classic_constructed', 'banned', true, now()),
  ('MyRr6Pyh63gtM65xNV123', 'wcm8kJNcrzDtt6zJm9c9R', 'classic_constructed', 'banned', true, now()),
  ('xyWrzSZlXZPHIdzYDgOG1', 'TQ7Twhtm6zfkTTHTKdpJK', 'classic_constructed', 'banned', true, now()),
  ('EIk90t3agEojEp1p0Wo91', 'PQgjdCTFwm89BmcWP9n7d', 'classic_constructed', 'banned', true, now()),
  ('O14E0SmYfPsR30AQWaqYY', 'RWwk8hgBdnRdWfjkrfJHt', 'classic_constructed', 'banned', true, now()),
  ('vjWhNYgyeLxMPfMXAg77v', 'M7nPGBJMNj6tbtDgzMNqc', 'classic_constructed', 'banned', true, now())
ON CONFLICT (card_unique_id, format, restriction_type) DO NOTHING;

-- Refresh the denormalized cards.cc_banned column so the cache stays
-- consistent with the registry (mirrors the recompute the service runs).
UPDATE cards c SET cc_banned = EXISTS (
  SELECT 1 FROM banned_cards bc
  WHERE bc.card_unique_id = c.card_unique_id
    AND bc.format = 'classic_constructed'
    AND bc.restriction_type = 'banned'
    AND bc.status_active = true
);
