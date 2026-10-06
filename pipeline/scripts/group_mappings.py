"""
Set ↔ TCGplayer (tcgcsv) group mapping, shared by steps 001, 002 and 009.

Two sources, merged:
  - fab_set_with_db.csv — the historical list, baked into the pipeline image.
  - the `tcg_group_sets` table (migration 0124) — groups attached to a set from
    /admin/cardvault, so a newly registered set is priced without a deploy.

Rows are (set_name, group_id, set_code) with set_code in its SOURCE case — 001
keys set names by it and looks them up by the feed's uppercase set_id, so only
uppercase CSV rows match there; lowercasing would change that. Group maps are
built case-insensitively (set_to_groups). The mapping
is many-to-many: one group can hold several set codes (Silver Age chapters),
one set can draw on several groups (IAR's Marvels live in the OMN group).
The CSV is the floor: if the DB is unreachable or the table is missing, the
CSV rows are returned and the run continues (a warning, never a failure).
"""
import csv

Row = tuple  # (set_name: str, group_id: int, set_code: str)


def read_csv_rows(csv_path):
    with open(csv_path) as f:
        return [
            (r['set_name'].strip(), int(r['group_id']), r['printings.set'].strip())
            for r in csv.DictReader(f)
        ]


def read_db_rows(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT set_name, group_id, set_code FROM tcg_group_sets ORDER BY group_id, set_code")
        return [(name, int(gid), code.strip()) for name, gid, code in cur.fetchall()]


def merge_rows(csv_rows, db_rows):
    """CSV first, then DB rows for (group, set) pairs the CSV doesn't have."""
    seen = {(gid, code.lower()) for _, gid, code in csv_rows}
    merged = list(csv_rows)
    for name, gid, code in db_rows:
        if (gid, code.lower()) not in seen:
            seen.add((gid, code.lower()))
            merged.append((name, gid, code))
    return merged


def set_to_groups(rows):
    """{set_code(lower): [group_ids in row order, deduped]}"""
    mapping = {}
    for _, gid, code in rows:
        groups = mapping.setdefault(code.lower(), [])
        if gid not in groups:
            groups.append(gid)
    return mapping


def load_group_rows(csv_path, connect=None):
    """CSV rows merged with the DB's. `connect` returns a DB-API connection
    (None = CSV only). Any DB error falls back to the CSV alone."""
    csv_rows = read_csv_rows(csv_path)
    if connect is None:
        return csv_rows
    conn = None
    try:
        conn = connect()
        db_rows = read_db_rows(conn)
    except Exception as e:  # noqa: BLE001 — the CSV is the floor
        print(f"⚠️  tcg_group_sets unavailable ({e}); using fab_set_with_db.csv only")
        return csv_rows
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:  # noqa: BLE001
                pass
    merged = merge_rows(csv_rows, db_rows)
    added = len(merged) - len(csv_rows)
    if added:
        print(f"📋 {added} set↔group mapping(s) from the database (tcg_group_sets)")
    return merged


def resolve_db_url(use_production):
    """Same env selection as 002/005 (POSTGRES_URL_PROD / POSTGRES_URL_STAGING,
    POSTGRES_URL fallback for ad-hoc local runs)."""
    import os
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    if use_production:
        return os.getenv('POSTGRES_URL_PROD')
    return os.getenv('POSTGRES_URL_STAGING') or os.getenv('POSTGRES_URL')


def psycopg2_connector(db_url):
    """A `connect` callable for load_group_rows, or None without a URL."""
    if not db_url:
        return None

    def connect():
        import psycopg2
        return psycopg2.connect(db_url, connect_timeout=10)
    return connect
