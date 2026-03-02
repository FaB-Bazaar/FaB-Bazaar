// lib/fab-banned-cards.ts
// Banned card lists and Living Legend hero exclusions for FaB formats.
// Run `npx ts-node scripts/sync-banned-cards.ts` to refresh from upstream.
// Source: https://github.com/the-fab-cube/flesh-and-blood-cards
//
// Each BanEntry has status_active: true (banned) or false (unbanned).
// When a card has multiple entries, the latest date_in_effect determines current status.

interface BanEntry {
  card_unique_id: string;
  status_active: boolean;
  date_in_effect: string;
}

// Classic Constructed banned list
// Source: json/english/banned-cc.json
const CC_BAN_LIST: BanEntry[] = [
  { card_unique_id: "9bQFfTFGQWJFWrcJnfQgz", status_active: true, date_in_effect: "2021-03-26T00:00:00.000Z" },
  { card_unique_id: "Nhmj8MBNCmWFC68JkhkNC", status_active: true, date_in_effect: "2021-03-26T00:00:00.000Z" },
  { card_unique_id: "hJt6FwT8mhQbcWQLzgHMT", status_active: true, date_in_effect: "2021-03-26T00:00:00.000Z" },
  { card_unique_id: "bkwMDWGMmKTMd9dKQMt76", status_active: true, date_in_effect: "2021-09-24T00:00:00.000Z" },
  { card_unique_id: "g9ckPjGmpNNkmbgChTQNR", status_active: true, date_in_effect: "2021-09-24T00:00:00.000Z" },
  { card_unique_id: "BnQtggKJtBNmpqKR7NWBH", status_active: true, date_in_effect: "2021-09-24T00:00:00.000Z" },
  { card_unique_id: "HkDzFgnhCBGn6K9w7RWtC", status_active: true, date_in_effect: "2021-09-24T00:00:00.000Z" },
  { card_unique_id: "TJdbQPDBpnLGpNmmN7fhg", status_active: true, date_in_effect: "2022-01-17T00:00:00.000Z" },
  { card_unique_id: "w77m97tB9GPDzK6ccgkjr", status_active: true, date_in_effect: "2022-01-17T00:00:00.000Z" },
  { card_unique_id: "QnKbrhtk7HFcckCBbFmkt", status_active: true, date_in_effect: "2022-01-17T00:00:00.000Z" },
  { card_unique_id: "fwF67FGHHq7rCKdPRz77f", status_active: true, date_in_effect: "2022-01-17T00:00:00.000Z" },
  { card_unique_id: "7MGt8wLQqdFk9F8LBQnD9", status_active: true, date_in_effect: "2022-01-17T00:00:00.000Z" },
  { card_unique_id: "rpFFbrjQdDFGHgtwmjqKP", status_active: true, date_in_effect: "2022-01-17T00:00:00.000Z" },
  { card_unique_id: "phCFwdjG8dKDCmr7d7F7M", status_active: true, date_in_effect: "2022-05-02T00:00:00.000Z" },
  { card_unique_id: "bkwMDWGMmKTMd9dKQMt76", status_active: false, date_in_effect: "2022-05-02T00:00:00.000Z" },
  { card_unique_id: "g9ckPjGmpNNkmbgChTQNR", status_active: false, date_in_effect: "2022-05-02T00:00:00.000Z" },
  { card_unique_id: "BnQtggKJtBNmpqKR7NWBH", status_active: false, date_in_effect: "2022-05-02T00:00:00.000Z" },
  { card_unique_id: "wj7qpMrzMjDbn8tmtfPL7", status_active: true, date_in_effect: "2022-08-01T00:00:00.000Z" },
  { card_unique_id: "rDLHG8PWgWpbJ87hRd6fD", status_active: true, date_in_effect: "2022-10-07T00:00:00.000Z" },
  { card_unique_id: "CtgLqKpjrGRtLnwbHjd9f", status_active: true, date_in_effect: "2023-01-30T00:00:00.000Z" },
  { card_unique_id: "8b9Fj6hL8WbNF6zDgzJFp", status_active: true, date_in_effect: "2023-01-30T00:00:00.000Z" },
  { card_unique_id: "dgBTMrWQ8F7gTCt6m7ngM", status_active: true, date_in_effect: "2023-01-30T00:00:00.000Z" },
  { card_unique_id: "pCdJMzmgBMD8Mt8qhM7nC", status_active: true, date_in_effect: "2023-01-30T00:00:00.000Z" },
  { card_unique_id: "FLfrm7mBczWhFLBTKmBgJ", status_active: true, date_in_effect: "2023-07-07T00:00:00.000Z" },
  { card_unique_id: "rDLHG8PWgWpbJ87hRd6fD", status_active: false, date_in_effect: "2023-07-07T00:00:00.000Z" },
  { card_unique_id: "nGHhHDgKmGgb7gjwWjHJF", status_active: true, date_in_effect: "2023-07-07T00:00:00.000Z" },
  { card_unique_id: "FLfrm7mBczWhFLBTKmBgJ", status_active: false, date_in_effect: "2023-09-22T00:00:00.000Z" },
  { card_unique_id: "mGqzLzjTgNjr7qJGMTjtW", status_active: true, date_in_effect: "2024-03-25T00:00:00.000Z" },
  { card_unique_id: "Lbp8pFhph9wMqMHDw8JWq", status_active: true, date_in_effect: "2024-03-25T00:00:00.000Z" },
  { card_unique_id: "dPTR67DTztNrb8wdFHnGW", status_active: true, date_in_effect: "2024-07-08T00:00:00.000Z" },
  { card_unique_id: "jrHMpbmnF6Hh97PffFzG8", status_active: true, date_in_effect: "2024-07-08T00:00:00.000Z" },
  { card_unique_id: "G7bRDqbhCJD76fH77Mfm7", status_active: true, date_in_effect: "2024-09-09T00:00:00.000Z" },
  { card_unique_id: "RMH9HdzcjCWdzLR7qwgbm", status_active: true, date_in_effect: "2024-09-09T00:00:00.000Z" },
  { card_unique_id: "Ld6twwNTNGTcWFw9rRWfh", status_active: true, date_in_effect: "2024-09-09T00:00:00.000Z" },
  { card_unique_id: "bwtjtjCqP6wTHtkR9HtGh", status_active: true, date_in_effect: "2024-09-09T00:00:00.000Z" },
  { card_unique_id: "cMM8DcmR9zCpcRPwrhbTc", status_active: true, date_in_effect: "2024-09-09T00:00:00.000Z" },
  { card_unique_id: "RHqhRWwFMkFRF9dLMkPtw", status_active: true, date_in_effect: "2024-09-09T00:00:00.000Z" },
  { card_unique_id: "MJFjT8CfpnpjtWTPgjPQ9", status_active: true, date_in_effect: "2024-09-09T00:00:00.000Z" },
  { card_unique_id: "nbKRgzWzF87HzTG8TWMBw", status_active: true, date_in_effect: "2024-09-09T00:00:00.000Z" },
  { card_unique_id: "BF7rFRwnNckBK8cMGpKHH", status_active: true, date_in_effect: "2024-11-11T00:00:00.000Z" },
  { card_unique_id: "7c9ChFNmpbPDdgD7DNKth", status_active: true, date_in_effect: "2024-11-11T00:00:00.000Z" },
  { card_unique_id: "DC8RfMDzMnthBkWJgmWpQ", status_active: true, date_in_effect: "2025-01-31T00:00:00.000Z" },
  { card_unique_id: "cP6jRNBkfK9L8HzGjgpmw", status_active: true, date_in_effect: "2025-05-20T00:00:00.000Z" },
  { card_unique_id: "gFm9BtgB7HbP6CkbjG8gC", status_active: true, date_in_effect: "2025-05-20T00:00:00.000Z" },
  { card_unique_id: "drgrrjBH9rz9k67qc6WnF", status_active: true, date_in_effect: "2025-05-20T00:00:00.000Z" },
  { card_unique_id: "jktJDQ97DD6rnkQjhNdD8", status_active: true, date_in_effect: "2025-05-20T00:00:00.000Z" },
  { card_unique_id: "RMH9HdzcjCWdzLR7qwgbm", status_active: false, date_in_effect: "2025-05-20T00:00:00.000Z" },
  { card_unique_id: "wJtCpBD9Hd8TzNRghPzFM", status_active: true, date_in_effect: "2025-09-01T00:00:00.000Z" },
  { card_unique_id: "6CpcdCrJKFkpkdkdLPQqT", status_active: true, date_in_effect: "2025-09-01T00:00:00.000Z" },
  { card_unique_id: "8QrD8rDCQWm78C9fq7tpr", status_active: true, date_in_effect: "2025-09-01T00:00:00.000Z" },
  { card_unique_id: "CRDtq9LpbDjKKbCkfcC7H", status_active: true, date_in_effect: "2025-09-01T00:00:00.000Z" },
  { card_unique_id: "Cqr7rhqq8hQPPhpHQBCHr", status_active: true, date_in_effect: "2025-09-01T00:00:00.000Z" },
  { card_unique_id: "drgrrjBH9rz9k67qc6WnF", status_active: false, date_in_effect: "2025-09-01T00:00:00.000Z" },
  { card_unique_id: "fGcBKBjTG9KFzbCmwNLhW", status_active: true, date_in_effect: "2025-12-15T00:00:00.000Z" },
  { card_unique_id: "FPphz9BckqMrmkrpLTN79", status_active: true, date_in_effect: "2025-12-15T00:00:00.000Z" },
  { card_unique_id: "KpmrMGn8pRtQnBbdCznbf", status_active: true, date_in_effect: "2025-12-15T00:00:00.000Z" },
  { card_unique_id: "jMMDM8cd7Dc8LdWWN7GzR", status_active: true, date_in_effect: "2025-12-15T00:00:00.000Z" },
  { card_unique_id: "T8Djg7CtcKNrhdbfBCb8t", status_active: true, date_in_effect: "2025-12-15T00:00:00.000Z" },
  { card_unique_id: "HDJFD6zmgqHN9jfNNMDCD", status_active: true, date_in_effect: "2025-12-15T00:00:00.000Z" },
  { card_unique_id: "DPFPrrNbJmtDHjBLtk6zz", status_active: true, date_in_effect: "2025-12-15T00:00:00.000Z" },
  { card_unique_id: "rHt7wrBkFcGCKBNq8BckW", status_active: true, date_in_effect: "2025-12-15T00:00:00.000Z" },
  { card_unique_id: "kj7bRzhn8wTj7CMJTtdDn", status_active: true, date_in_effect: "2025-12-15T00:00:00.000Z" },
  { card_unique_id: "7pkFmgqjTzWQnPg7PLHDw", status_active: true, date_in_effect: "2025-12-15T00:00:00.000Z" },
];

// Silver Age banned list
// Source: json/english/banned-silver-age.json
const SAGE_BAN_LIST: BanEntry[] = [
  { card_unique_id: "jJchLwfJKhdhk8Hw7R6KP", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "zgkKwhBtRQf9zWz6kpPJR", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "bbGgprKNzmQPQP9P6CQkL", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "wd9TtjtPGfbWKQPprJfj9", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "t6MkmHjPRNghmMcMQbqch", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "TJdbQPDBpnLGpNmmN7fhg", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "w77m97tB9GPDzK6ccgkjr", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "QnKbrhtk7HFcckCBbFmkt", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "CtgLqKpjrGRtLnwbHjd9f", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "8b9Fj6hL8WbNF6zDgzJFp", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "dgBTMrWQ8F7gTCt6m7ngM", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "RMH9HdzcjCWdzLR7qwgbm", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "dPTR67DTztNrb8wdFHnGW", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "jrHMpbmnF6Hh97PffFzG8", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "Ld6twwNTNGTcWFw9rRWfh", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "cP6jRNBkfK9L8HzGjgpmw", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "gFm9BtgB7HbP6CkbjG8gC", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "7c9ChFNmpbPDdgD7DNKth", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "r7fBPzjnf99MPwFc6F8b6", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "N9QrfGfPbL9NHPcRT6Nd7", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "jMq8ttGz9DCqPMjQRRmdF", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "9bQFfTFGQWJFWrcJnfQgz", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "Nhmj8MBNCmWFC68JkhkNC", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "hJt6FwT8mhQbcWQLzgHMT", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "BM6cWKkWT7zRBLb7P77pg", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "dGtzm9PwqTkFGcJwFNzPM", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "TjdM8c7NpJjpjdLDbt7KG", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "rHQbwp8qrzCcfGm9GQFqp", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "w8QN7hhNck8pQJHcc9rFj", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "mbF7WMCnnpGHh9bwBwBKf", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "6dNCtnqWjTwr88JCckKDG", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "bR7C7tbtGczDWnbDHjTD7", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "7bLzzWQGtNWkHWzjkcdQn", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "WtGtPtHBQMNnjzBdcdLNd", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "NWTPMPpLT7TL7qzkBLTHF", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "tNwNjDkrznjwrPP6bHBtD", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "bPGmQFC976CBt9cTGc88t", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "666mgFjKrrLQhdkpGzNzf", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "zc8n8JQRfBTPHGfnBmw8L", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "pdCLkLqDkmFhBtp7MFMfP", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "TwN6BKbDJDrJBf7DPGcP8", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "7HzdfH8DD7cMhzKpCfDRG", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "6wDLWfBNH8rPfhKPNtT8L", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "KTh89nLtmJWQcQQJPwgDW", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "fwF67FGHHq7rCKdPRz77f", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "7MGt8wLQqdFk9F8LBQnD9", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "rpFFbrjQdDFGHgtwmjqKP", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "W6R6JDdMT8g77qmHJCDhG", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "ctP6TMfCKqwK6QpjG7wLH", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "pP7GCzgTjQPMNLBFfRbBw", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "bfbfWCWnHw6zP7bfrPGdC", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "T8JJgk7GLGpcDQWWN9RH7", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "DPFPrrNbJmtDHjBLtk6zz", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "rHt7wrBkFcGCKBNq8BckW", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "kj7bRzhn8wTj7CMJTtdDn", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "cbHrfwmLrMjWdhdBtzbff", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "bkwMDWGMmKTMd9dKQMt76", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "g9ckPjGmpNNkmbgChTQNR", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "BnQtggKJtBNmpqKR7NWBH", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "kzW8BKdWcm9LwtTCTdqRK", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "FDdnD9zhdgCkJFTQdLbbp", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "QgFnmwphgLtnNmrHF8B6w", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "LfddJTKKb9HwPzHMBH9w9", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "7RzTp9JnTprz6fjnhRJLM", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "bHRdHqLRCthfzcrffPNQH", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "gGmbgrQrzhKpFdtcRTF9h", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "wj7qpMrzMjDbn8tmtfPL7", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "dcMMQNzjpzQ76GQPpnQwz", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "C8KwDBgMJ9rrbpdgkFTNm", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "Rjg6tLjCGKhfGJkcnJFQD", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "NdwNmwRFRBQ8hFnrRTJcG", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "kzzwCj8LJwfMf9MTntgtt", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
  { card_unique_id: "DC8RfMDzMnthBkWJgmWpQ", status_active: true, date_in_effect: "2025-10-19T00:00:00.000Z" },
];

// Blitz has no banned cards.
// Format rule: max 1 copy of any non-token card (vs 3 for CC/Silver Age).

// Heroes that have achieved Living Legend status in CC — excluded from the CC hero selector.
// Source: json/english/living-legend-cc.json (all entries are status_active: true)
const CC_LIVING_LEGEND_HEROES: string[] = [
  "PFJnMWQNfr6jMMzJhjB9H",
  "MhBTRHCCft7RbrMmkwwGw",
  "r8Bq8zBCNdzGPkmMcr6QL",
  "F7rQpTDjHFWPgQhcGg7RT",
  "TQ7Twhtm6zfkTTHTKdpJK",
  "bh96L8jp69mNpjcGRCDbj",
  "pCdJMzmgBMD8Mt8qhM7nC",
  "cjDzkKdjNrGqL9tnDc7zd",
  "cbHrfwmLrMjWdhdBtzbff",
  "PFmgFK9dFr8q6PrpJFpPG",
  "Nzpgn9HrbNfkzM8CkwCQp",
  "8KRCDf6drqhFMKK7hJhbM",
  "Cd6PTGH6CqTHmt7LQmBMp",
  "PrJkWBKNgtNdzhqhWLGFw",
  "PQm7zFjBPCzc68JDd8D6z",
  "TKbRWjjBLJThMmLkTFb6q",
  "RWwk8hgBdnRdWfjkrfJHt",
  "tJhRRN9kkMCnGQdQJ8TWg",
  "zMC89pqnzTP7bkmfjmTzQ",
  "GDbCgdDrFKCWWthrgD6h6",
  "M7nPGBJMNj6tbtDgzMNqc",
  "mHBtPppktRTkWpnf69dHj",
  "m7NGBRdNftTh9ntBzppbB",
  "MghLPDjq8CfBJ8RzNc7Ft",
  "wcm8kJNcrzDtt6zJm9c9R",
  "6CcjWGnThrTmTQFQ9zHMN",
  "fNFqtdWLq6tCPnnwjLLWL",
  "PTFnJCdhWD9cFgMMNPqQj",
  "Nnmtz6GrR6MWMcptb6wD7",
  "kRPqHdCckKBKfRwjbfzNT",
  "nzDWrNMqGWgmJfgJhChNb",
];

// Heroes that have achieved Living Legend status in Blitz — excluded from the Blitz hero selector.
// Source: json/english/living-legend-blitz.json (computed: last entry per hero wins)
const BLITZ_LIVING_LEGEND_HEROES: string[] = [
  "RHnFkKb8FKdFzp9rdzGjF",
  "RWwk8hgBdnRdWfjkrfJHt",
  "TmKrpP8tDg8bmpnqMPtgj",
  "Cd6PTGH6CqTHmt7LQmBMp",
  "hw6qHfWdqQGfRPfKJMgR7",
  "pCdJMzmgBMD8Mt8qhM7nC",
  "mCCnJrJQkqJ7KfqKNHGnc",
  "r8Bq8zBCNdzGPkmMcr6QL",
  "Q9B8TDhTdfDLN8ccnBThK",
  "nzDWrNMqGWgmJfgJhChNb",
  "wWmP8RJRq7MWk7kBh9q7w",
  "GCRQMpBtqBHWrk68GqnGP",
  "FfRMHD8fbLP7FjLJdmbtM",
  "7TjkgnbJ8tghfrkMRnTfW",
  "cbHrfwmLrMjWdhdBtzbff",
  "kftPnNkrBLJ7rPmFGgQCm",
  "fNFqtdWLq6tCPnnwjLLWL",
  "wNRqrHCn6rrKLhrDkqPwp",
  "QT8JfjzmzqRR9MWgtgPLR",
  "kHmRR6Q7mJPjQgdQJcjpQ",
  "RRfwzgrbMbFGNqppnD8rB",
];

/**
 * Compute the currently-banned card_unique_ids from a ban list.
 * Groups entries by card_unique_id, takes the latest date_in_effect,
 * and returns cards where the latest entry has status_active: true.
 */
function computeActiveBans(banList: BanEntry[]): Set<string> {
  const latestByCard = new Map<string, BanEntry>();

  for (const entry of banList) {
    const existing = latestByCard.get(entry.card_unique_id);
    if (!existing || new Date(entry.date_in_effect) >= new Date(existing.date_in_effect)) {
      latestByCard.set(entry.card_unique_id, entry);
    }
  }

  const banned = new Set<string>();
  for (const [cardId, entry] of latestByCard) {
    if (entry.status_active) {
      banned.add(cardId);
    }
  }
  return banned;
}

// Pre-computed sets for fast lookup
const CC_BANNED_CARDS = computeActiveBans(CC_BAN_LIST);
const SAGE_BANNED_CARDS = computeActiveBans(SAGE_BAN_LIST);
const CC_LIVING_LEGEND_SET = new Set(CC_LIVING_LEGEND_HEROES);
const BLITZ_LIVING_LEGEND_SET = new Set(BLITZ_LIVING_LEGEND_HEROES);

/**
 * Get the set of currently-banned card_unique_ids for a format.
 */
export function getBannedCardIds(format: string): Set<string> {
  const f = format.toLowerCase();
  if (f === 'classic constructed' || f === 'cc') return CC_BANNED_CARDS;
  if (f === 'silver age' || f === 'sage') return SAGE_BANNED_CARDS;
  // Blitz has no banned cards
  return new Set();
}

/**
 * Check if a card_unique_id is banned in a given format.
 */
export function isCardBanned(cardUniqueId: string, format: string): boolean {
  return getBannedCardIds(format).has(cardUniqueId);
}

/**
 * Get the set of hero card_unique_ids that have achieved Living Legend status
 * and should be excluded from the hero selector for a given format.
 */
export function getLivingLegendHeroIds(format: string): Set<string> {
  const f = format.toLowerCase();
  if (f === 'classic constructed' || f === 'cc') return CC_LIVING_LEGEND_SET;
  if (f === 'blitz') return BLITZ_LIVING_LEGEND_SET;
  return new Set();
}

/**
 * Check if a hero card_unique_id has achieved Living Legend status in a format.
 */
export function isHeroLivingLegend(heroCardUniqueId: string, format: string): boolean {
  return getLivingLegendHeroIds(format).has(heroCardUniqueId);
}

/**
 * Maximum number of copies of any non-token card allowed in a deck for a format.
 * Blitz: 1, all others: 3.
 */
export function getMaxCopiesPerCard(format: string): number {
  if (format.toLowerCase() === 'blitz') return 1;
  return 3;
}
