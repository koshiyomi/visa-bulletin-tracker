#!/usr/bin/env python3
"""
Clean data quality issues in visa_bulletin.db.

Fixes:
  1. Remove family-sponsored rows (2A*, 2B) that leaked into employment data
  2. Fix typo: '4rd' → '4th'
  3. Normalize EB5 whitespace duplicates (non-breaking space → regular space)
  4. Normalize historical EB5 names to current naming convention
  5. Remove ambiguous '5th' row (1 record)

Usage:
    python3 clean_data.py [path/to/visa_bulletin.db]
"""

import sqlite3
import sys


def clean(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    print(f"Database: {db_path}")
    cur.execute("SELECT COUNT(*) FROM visa_bulletin")
    total_before = cur.fetchone()[0]
    print(f"Records before cleanup: {total_before}\n")

    # ── Step 1: Remove family-sponsored rows ──────────────────────────
    print("Step 1: Remove family-sponsored rows (2A*, 2B)")
    cur.execute(
        "SELECT category, COUNT(*) FROM visa_bulletin "
        "WHERE category IN ('2A*', '2B') GROUP BY category"
    )
    for cat, cnt in cur.fetchall():
        print(f"  - '{cat}': {cnt} rows")
    cur.execute("DELETE FROM visa_bulletin WHERE category IN ('2A*', '2B')")
    print(f"  Deleted: {cur.rowcount} rows\n")

    # ── Step 2: Fix typo '4rd' → '4th' ───────────────────────────────
    print("Step 2: Fix typo '4rd' → '4th'")
    cur.execute("UPDATE visa_bulletin SET category = '4th' WHERE category = '4rd'")
    print(f"  Updated: {cur.rowcount} rows\n")

    # ── Step 3: Normalize EB5 whitespace (NBSP → regular space) ──────
    # Non-breaking space U+00A0 appears as \xc2\xa0 in UTF-8.
    # SQLite LIKE does not equate NBSP with space, so we identify rows
    # containing NBSP by checking hex(category) for 'C2A0'.
    #
    # Strategy: For each affected row, compute the cleaned category
    # (NBSP → space). Use UPDATE OR IGNORE to rename; rows that collide
    # with an existing UNIQUE key are left unchanged, then swept up by
    # a DELETE pass.
    NBSP = "\u00a0"

    print("Step 3: Normalize EB5 whitespace duplicates (NBSP → space)")

    # Count rows whose category contains NBSP
    cur.execute(
        "SELECT category, COUNT(*) FROM visa_bulletin "
        "WHERE INSTR(category, ?) > 0 GROUP BY category ORDER BY COUNT(*) DESC",
        (NBSP,),
    )
    nbsp_groups = cur.fetchall()
    for cat, cnt in nbsp_groups:
        cleaned = cat.replace(NBSP, " ")
        print(f"  '{cat}' ({cnt} rows) → '{cleaned}'")

    # UPDATE OR IGNORE: rename categories by replacing NBSP with space.
    # Rows that would violate the UNIQUE constraint are silently skipped.
    cur.execute(
        "UPDATE OR IGNORE visa_bulletin "
        "SET category = REPLACE(category, ?, ' ') "
        "WHERE INSTR(category, ?) > 0",
        (NBSP, NBSP),
    )
    updated = cur.rowcount
    # DELETE leftover rows that couldn't be updated (duplicate conflicts)
    cur.execute(
        "DELETE FROM visa_bulletin WHERE INSTR(category, ?) > 0",
        (NBSP,),
    )
    deleted = cur.rowcount
    print(f"  Updated: {updated}, duplicate conflicts deleted: {deleted}\n")

    # ── Step 4: Normalize historical EB5 names ───────────────────────
    canonical_regional = "5th Regional Center (I5 and R5)"
    print(f"Step 4: Normalize historical EB5 names → '{canonical_regional}'")

    historical_names = [
        "5th Targeted Employment Areas/ Regional Centers and Pilot Programs",
        "Targeted Employment Areas/Regional Centers",
    ]
    for name in historical_names:
        cur.execute(
            "SELECT COUNT(*) FROM visa_bulletin WHERE category = ?", (name,)
        )
        cnt = cur.fetchone()[0]
        print(f"  '{name}': {cnt} rows")

        cur.execute(
            "UPDATE OR IGNORE visa_bulletin SET category = ? WHERE category = ?",
            (canonical_regional, name),
        )
        up = cur.rowcount
        cur.execute("DELETE FROM visa_bulletin WHERE category = ?", (name,))
        dl = cur.rowcount
        print(f"    → {up} updated, {dl} duplicate conflicts deleted")

    print()

    # ── Step 5: Remove ambiguous '5th' row ────────────────────────────
    print("Step 5: Remove ambiguous '5th' row")
    cur.execute("DELETE FROM visa_bulletin WHERE category = '5th'")
    print(f"  Deleted: {cur.rowcount} rows\n")

    # ── Summary ───────────────────────────────────────────────────────
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM visa_bulletin")
    total_after = cur.fetchone()[0]

    cur.execute(
        "SELECT category, COUNT(*) as cnt FROM visa_bulletin "
        "GROUP BY category ORDER BY cnt DESC"
    )
    categories = cur.fetchall()

    print("=" * 60)
    print(f"Records before: {total_before}")
    print(f"Records after:  {total_after}")
    print(f"Removed:        {total_before - total_after}")
    print(f"Distinct categories: {len(categories)}")
    print()
    print("Category breakdown:")
    for cat, cnt in categories:
        print(f"  {cat:50s} {cnt:>5d}")

    conn.close()


if __name__ == "__main__":
    db = sys.argv[1] if len(sys.argv) > 1 else "visa_bulletin.db"
    clean(db)
