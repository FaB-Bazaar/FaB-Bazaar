"""
fab_banned_cards.py
Ban lists for FaB formats — Python port of lib/fab-banned-cards.ts
Source: https://fabtcg.com/rules-and-policy-center/card-legality-policy/

Each entry has status_active: True (banned) or False (unbanned).
When a card has multiple entries, the latest date_in_effect determines current status.
"""

from datetime import datetime


# Classic Constructed banned list
CC_BAN_LIST = [
    {"card_unique_id": "9bQFfTFGQWJFWrcJnfQgz", "status_active": True,  "date_in_effect": "2021-03-26T00:00:00.000Z"},
    {"card_unique_id": "Nhmj8MBNCmWFC68JkhkNC", "status_active": True,  "date_in_effect": "2021-03-26T00:00:00.000Z"},
    {"card_unique_id": "hJt6FwT8mhQbcWQLzgHMT", "status_active": True,  "date_in_effect": "2021-03-26T00:00:00.000Z"},
    {"card_unique_id": "bkwMDWGMmKTMd9dKQMt76", "status_active": True,  "date_in_effect": "2021-09-24T00:00:00.000Z"},
    {"card_unique_id": "g9ckPjGmpNNkmbgChTQNR", "status_active": True,  "date_in_effect": "2021-09-24T00:00:00.000Z"},
    {"card_unique_id": "BnQtggKJtBNmpqKR7NWBH", "status_active": True,  "date_in_effect": "2021-09-24T00:00:00.000Z"},
    {"card_unique_id": "HkDzFgnhCBGn6K9w7RWtC", "status_active": True,  "date_in_effect": "2021-09-24T00:00:00.000Z"},
    {"card_unique_id": "TJdbQPDBpnLGpNmmN7fhg", "status_active": True,  "date_in_effect": "2022-01-17T00:00:00.000Z"},
    {"card_unique_id": "w77m97tB9GPDzK6ccgkjr", "status_active": True,  "date_in_effect": "2022-01-17T00:00:00.000Z"},
    {"card_unique_id": "QnKbrhtk7HFcckCBbFmkt", "status_active": True,  "date_in_effect": "2022-01-17T00:00:00.000Z"},
    {"card_unique_id": "fwF67FGHHq7rCKdPRz77f", "status_active": True,  "date_in_effect": "2022-01-17T00:00:00.000Z"},
    {"card_unique_id": "7MGt8wLQqdFk9F8LBQnD9", "status_active": True,  "date_in_effect": "2022-01-17T00:00:00.000Z"},
    {"card_unique_id": "rpFFbrjQdDFGHgtwmjqKP", "status_active": True,  "date_in_effect": "2022-01-17T00:00:00.000Z"},
    {"card_unique_id": "phCFwdjG8dKDCmr7d7F7M", "status_active": True,  "date_in_effect": "2022-05-02T00:00:00.000Z"},
    # Unbanned 2022-05-02
    {"card_unique_id": "bkwMDWGMmKTMd9dKQMt76", "status_active": False, "date_in_effect": "2022-05-02T00:00:00.000Z"},
    {"card_unique_id": "g9ckPjGmpNNkmbgChTQNR", "status_active": False, "date_in_effect": "2022-05-02T00:00:00.000Z"},
    {"card_unique_id": "BnQtggKJtBNmpqKR7NWBH", "status_active": False, "date_in_effect": "2022-05-02T00:00:00.000Z"},
    {"card_unique_id": "wj7qpMrzMjDbn8tmtfPL7", "status_active": True,  "date_in_effect": "2022-08-01T00:00:00.000Z"},
    {"card_unique_id": "rDLHG8PWgWpbJ87hRd6fD", "status_active": True,  "date_in_effect": "2022-10-07T00:00:00.000Z"},
    {"card_unique_id": "CtgLqKpjrGRtLnwbHjd9f", "status_active": True,  "date_in_effect": "2023-01-30T00:00:00.000Z"},
    {"card_unique_id": "8b9Fj6hL8WbNF6zDgzJFp", "status_active": True,  "date_in_effect": "2023-01-30T00:00:00.000Z"},
    {"card_unique_id": "dgBTMrWQ8F7gTCt6m7ngM", "status_active": True,  "date_in_effect": "2023-01-30T00:00:00.000Z"},
    {"card_unique_id": "pCdJMzmgBMD8Mt8qhM7nC", "status_active": True,  "date_in_effect": "2023-01-30T00:00:00.000Z"},
    {"card_unique_id": "FLfrm7mBczWhFLBTKmBgJ", "status_active": True,  "date_in_effect": "2023-07-07T00:00:00.000Z"},
    {"card_unique_id": "nGHhHDgKmGgb7gjwWjHJF", "status_active": True,  "date_in_effect": "2023-07-07T00:00:00.000Z"},
    # Unbanned 2023-07-07
    {"card_unique_id": "rDLHG8PWgWpbJ87hRd6fD", "status_active": False, "date_in_effect": "2023-07-07T00:00:00.000Z"},
    # Unbanned 2023-09-22
    {"card_unique_id": "FLfrm7mBczWhFLBTKmBgJ", "status_active": False, "date_in_effect": "2023-09-22T00:00:00.000Z"},
    {"card_unique_id": "mGqzLzjTgNjr7qJGMTjtW", "status_active": True,  "date_in_effect": "2024-03-25T00:00:00.000Z"},
    {"card_unique_id": "Lbp8pFhph9wMqMHDw8JWq", "status_active": True,  "date_in_effect": "2024-03-25T00:00:00.000Z"},
    {"card_unique_id": "dPTR67DTztNrb8wdFHnGW", "status_active": True,  "date_in_effect": "2024-07-08T00:00:00.000Z"},
    {"card_unique_id": "jrHMpbmnF6Hh97PffFzG8", "status_active": True,  "date_in_effect": "2024-07-08T00:00:00.000Z"},
    {"card_unique_id": "G7bRDqbhCJD76fH77Mfm7", "status_active": True,  "date_in_effect": "2024-09-09T00:00:00.000Z"},
    {"card_unique_id": "RMH9HdzcjCWdzLR7qwgbm", "status_active": True,  "date_in_effect": "2024-09-09T00:00:00.000Z"},
    {"card_unique_id": "Ld6twwNTNGTcWFw9rRWfh", "status_active": True,  "date_in_effect": "2024-09-09T00:00:00.000Z"},
    {"card_unique_id": "bwtjtjCqP6wTHtkR9HtGh", "status_active": True,  "date_in_effect": "2024-09-09T00:00:00.000Z"},
    {"card_unique_id": "cMM8DcmR9zCpcRPwrhbTc", "status_active": True,  "date_in_effect": "2024-09-09T00:00:00.000Z"},
    {"card_unique_id": "RHqhRWwFMkFRF9dLMkPtw", "status_active": True,  "date_in_effect": "2024-09-09T00:00:00.000Z"},
    {"card_unique_id": "MJFjT8CfpnpjtWTPgjPQ9", "status_active": True,  "date_in_effect": "2024-09-09T00:00:00.000Z"},
    {"card_unique_id": "nbKRgzWzF87HzTG8TWMBw", "status_active": True,  "date_in_effect": "2024-09-09T00:00:00.000Z"},
    {"card_unique_id": "BF7rFRwnNckBK8cMGpKHH", "status_active": True,  "date_in_effect": "2024-11-11T00:00:00.000Z"},
    {"card_unique_id": "7c9ChFNmpbPDdgD7DNKth", "status_active": True,  "date_in_effect": "2024-11-11T00:00:00.000Z"},
    {"card_unique_id": "DC8RfMDzMnthBkWJgmWpQ", "status_active": True,  "date_in_effect": "2025-01-31T00:00:00.000Z"},
    {"card_unique_id": "cP6jRNBkfK9L8HzGjgpmw", "status_active": True,  "date_in_effect": "2025-05-20T00:00:00.000Z"},
    {"card_unique_id": "gFm9BtgB7HbP6CkbjG8gC", "status_active": True,  "date_in_effect": "2025-05-20T00:00:00.000Z"},
    {"card_unique_id": "drgrrjBH9rz9k67qc6WnF", "status_active": True,  "date_in_effect": "2025-05-20T00:00:00.000Z"},
    {"card_unique_id": "jktJDQ97DD6rnkQjhNdD8", "status_active": True,  "date_in_effect": "2025-05-20T00:00:00.000Z"},
    # Unbanned 2025-05-20
    {"card_unique_id": "RMH9HdzcjCWdzLR7qwgbm", "status_active": False, "date_in_effect": "2025-05-20T00:00:00.000Z"},
    {"card_unique_id": "wJtCpBD9Hd8TzNRghPzFM", "status_active": True,  "date_in_effect": "2025-09-01T00:00:00.000Z"},
    {"card_unique_id": "6CpcdCrJKFkpkdkdLPQqT", "status_active": True,  "date_in_effect": "2025-09-01T00:00:00.000Z"},
    {"card_unique_id": "8QrD8rDCQWm78C9fq7tpr", "status_active": True,  "date_in_effect": "2025-09-01T00:00:00.000Z"},
    {"card_unique_id": "CRDtq9LpbDjKKbCkfcC7H", "status_active": True,  "date_in_effect": "2025-09-01T00:00:00.000Z"},
    {"card_unique_id": "Cqr7rhqq8hQPPhpHQBCHr", "status_active": True,  "date_in_effect": "2025-09-01T00:00:00.000Z"},
    # Unbanned 2025-09-01
    {"card_unique_id": "drgrrjBH9rz9k67qc6WnF", "status_active": False, "date_in_effect": "2025-09-01T00:00:00.000Z"},
    {"card_unique_id": "fGcBKBjTG9KFzbCmwNLhW", "status_active": True,  "date_in_effect": "2025-12-15T00:00:00.000Z"},
    {"card_unique_id": "FPphz9BckqMrmkrpLTN79", "status_active": True,  "date_in_effect": "2025-12-15T00:00:00.000Z"},
    {"card_unique_id": "KpmrMGn8pRtQnBbdCznbf", "status_active": True,  "date_in_effect": "2025-12-15T00:00:00.000Z"},
    {"card_unique_id": "jMMDM8cd7Dc8LdWWN7GzR", "status_active": True,  "date_in_effect": "2025-12-15T00:00:00.000Z"},
    {"card_unique_id": "T8Djg7CtcKNrhdbfBCb8t", "status_active": True,  "date_in_effect": "2025-12-15T00:00:00.000Z"},
    {"card_unique_id": "HDJFD6zmgqHN9jfNNMDCD", "status_active": True,  "date_in_effect": "2025-12-15T00:00:00.000Z"},
    {"card_unique_id": "DPFPrrNbJmtDHjBLtk6zz", "status_active": True,  "date_in_effect": "2025-12-15T00:00:00.000Z"},
    {"card_unique_id": "rHt7wrBkFcGCKBNq8BckW", "status_active": True,  "date_in_effect": "2025-12-15T00:00:00.000Z"},
    {"card_unique_id": "kj7bRzhn8wTj7CMJTtdDn", "status_active": True,  "date_in_effect": "2025-12-15T00:00:00.000Z"},
    {"card_unique_id": "7pkFmgqjTzWQnPg7PLHDw", "status_active": True,  "date_in_effect": "2025-12-15T00:00:00.000Z"},
]

# Silver Age banned list
SAGE_BAN_LIST = [
    {"card_unique_id": "jJchLwfJKhdhk8Hw7R6KP", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "zgkKwhBtRQf9zWz6kpPJR", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "bbGgprKNzmQPQP9P6CQkL", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "wd9TtjtPGfbWKQPprJfj9", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "t6MkmHjPRNghmMcMQbqch", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "TJdbQPDBpnLGpNmmN7fhg", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "w77m97tB9GPDzK6ccgkjr", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "QnKbrhtk7HFcckCBbFmkt", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "CtgLqKpjrGRtLnwbHjd9f", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "8b9Fj6hL8WbNF6zDgzJFp", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "dgBTMrWQ8F7gTCt6m7ngM", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "RMH9HdzcjCWdzLR7qwgbm", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "dPTR67DTztNrb8wdFHnGW", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "jrHMpbmnF6Hh97PffFzG8", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "Ld6twwNTNGTcWFw9rRWfh", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "cP6jRNBkfK9L8HzGjgpmw", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "gFm9BtgB7HbP6CkbjG8gC", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "7c9ChFNmpbPDdgD7DNKth", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "r7fBPzjnf99MPwFc6F8b6", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "N9QrfGfPbL9NHPcRT6Nd7", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "jMq8ttGz9DCqPMjQRRmdF", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "9bQFfTFGQWJFWrcJnfQgz", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "Nhmj8MBNCmWFC68JkhkNC", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "hJt6FwT8mhQbcWQLzgHMT", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "BM6cWKkWT7zRBLb7P77pg", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "dGtzm9PwqTkFGcJwFNzPM", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "TjdM8c7NpJjpjdLDbt7KG", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "rHQbwp8qrzCcfGm9GQFqp", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "w8QN7hhNck8pQJHcc9rFj", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "mbF7WMCnnpGHh9bwBwBKf", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "6dNCtnqWjTwr88JCckKDG", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "bR7C7tbtGczDWnbDHjTD7", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "7bLzzWQGtNWkHWzjkcdQn", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "WtGtPtHBQMNnjzBdcdLNd", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "NWTPMPpLT7TL7qzkBLTHF", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "tNwNjDkrznjwrPP6bHBtD", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "bPGmQFC976CBt9cTGc88t", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "666mgFjKrrLQhdkpGzNzf", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "zc8n8JQRfBTPHGfnBmw8L", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "pdCLkLqDkmFhBtp7MFMfP", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "TwN6BKbDJDrJBf7DPGcP8", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "7HzdfH8DD7cMhzKpCfDRG", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "6wDLWfBNH8rPfhKPNtT8L", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "KTh89nLtmJWQcQQJPwgDW", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "fwF67FGHHq7rCKdPRz77f", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "7MGt8wLQqdFk9F8LBQnD9", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "rpFFbrjQdDFGHgtwmjqKP", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "W6R6JDdMT8g77qmHJCDhG", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "ctP6TMfCKqwK6QpjG7wLH", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "pP7GCzgTjQPMNLBFfRbBw", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "bfbfWCWnHw6zP7bfrPGdC", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "T8JJgk7GLGpcDQWWN9RH7", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "DPFPrrNbJmtDHjBLtk6zz", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "rHt7wrBkFcGCKBNq8BckW", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "kj7bRzhn8wTj7CMJTtdDn", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "cbHrfwmLrMjWdhdBtzbff", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "bkwMDWGMmKTMd9dKQMt76", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "g9ckPjGmpNNkmbgChTQNR", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "BnQtggKJtBNmpqKR7NWBH", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "kzW8BKdWcm9LwtTCTdqRK", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "FDdnD9zhdgCkJFTQdLbbp", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "QgFnmwphgLtnNmrHF8B6w", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "LfddJTKKb9HwPzHMBH9w9", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "7RzTp9JnTprz6fjnhRJLM", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "bHRdHqLRCthfzcrffPNQH", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "gGmbgrQrzhKpFdtcRTF9h", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "wj7qpMrzMjDbn8tmtfPL7", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "dcMMQNzjpzQ76GQPpnQwz", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "C8KwDBgMJ9rrbpdgkFTNm", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "Rjg6tLjCGKhfGJkcnJFQD", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "NdwNmwRFRBQ8hFnrRTJcG", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "kzzwCj8LJwfMf9MTntgtt", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
    {"card_unique_id": "DC8RfMDzMnthBkWJgmWpQ", "status_active": True, "date_in_effect": "2025-10-19T00:00:00.000Z"},
]


def compute_active_bans(ban_list):
    """
    Compute the currently-banned card_unique_ids from a ban list.
    Groups entries by card_unique_id, takes the latest date_in_effect,
    and returns a set of cards where the latest entry has status_active: True.
    """
    latest_by_card = {}

    for entry in ban_list:
        card_id = entry["card_unique_id"]
        existing = latest_by_card.get(card_id)
        entry_date = datetime.fromisoformat(entry["date_in_effect"].replace("Z", "+00:00"))
        if existing is None:
            latest_by_card[card_id] = entry
        else:
            existing_date = datetime.fromisoformat(existing["date_in_effect"].replace("Z", "+00:00"))
            if entry_date >= existing_date:
                latest_by_card[card_id] = entry

    banned = set()
    for card_id, entry in latest_by_card.items():
        if entry["status_active"]:
            banned.add(card_id)
    return banned


# Pre-computed sets for fast lookup
CC_BANNED_CARD_IDS = compute_active_bans(CC_BAN_LIST)
SAGE_BANNED_CARD_IDS = compute_active_bans(SAGE_BAN_LIST)
