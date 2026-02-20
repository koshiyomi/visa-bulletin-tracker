#!/usr/bin/env python3
"""
Backfill Table B (Dates for Filing) from Oct 2015 to Sep 2023.

The database currently has Dates_for_Filing data only from Oct 2023 onward,
but Table B has existed in visa bulletins since Oct 2015. This script fills
the ~96 missing months by re-scraping those bulletins.

Uses INSERT OR REPLACE, so it's safe to re-run -- existing records won't
be duplicated, and Final_Action records won't be lost.
"""

import sqlite3
import re
import time
from datetime import datetime
from pathlib import Path

# Import existing scraper functions
from build_visa_db import (
    DB_PATH,
    create_database,
    get_all_bulletin_urls,
    scrape_bulletin,
)

# Target range: Oct 2015 (FY2016 start) through Sep 2023 (FY2023 end)
START_DATE = "2015-10-01"
END_DATE = "2023-09-01"

# Politeness delay between requests (seconds)
REQUEST_DELAY = 1.5


def get_months_with_table_b(conn):
    """Return set of bulletin_date strings that already have Dates_for_Filing data."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT DISTINCT bulletin_date FROM visa_bulletin WHERE table_type = 'Dates_for_Filing'"
    )
    return {row[0] for row in cursor.fetchall()}


def generate_expected_months(start, end):
    """Generate all YYYY-MM-01 strings between start and end inclusive."""
    months = []
    dt = datetime.strptime(start, "%Y-%m-%d")
    end_dt = datetime.strptime(end, "%Y-%m-%d")
    while dt <= end_dt:
        months.append(dt.strftime("%Y-%m-01"))
        # Advance to next month
        if dt.month == 12:
            dt = dt.replace(year=dt.year + 1, month=1)
        else:
            dt = dt.replace(month=dt.month + 1)
    return months


def url_to_bulletin_date(url):
    """Extract bulletin date from URL like .../visa-bulletin-for-october-2019.html."""
    match = re.search(r"visa-bulletin-for-(\w+)-(\d{4})\.html", url)
    if not match:
        return None
    month_name = match.group(1).capitalize()
    year = int(match.group(2))
    try:
        dt = datetime.strptime(f"{month_name} {year}", "%B %Y")
        return dt.strftime("%Y-%m-01")
    except ValueError:
        return None


def generate_url_for_month(bulletin_date):
    """Generate the expected URL for a given bulletin_date (YYYY-MM-01).

    URL pattern:
      .../visa-bulletin/{fiscal_year}/visa-bulletin-for-{month}-{year}.html

    Fiscal year = calendar_year + 1 for Oct/Nov/Dec, otherwise calendar_year.
    """
    dt = datetime.strptime(bulletin_date, "%Y-%m-%d")
    month_name = dt.strftime("%B").lower()
    cal_year = dt.year

    # Fiscal year: Oct-Dec belong to next FY
    if dt.month >= 10:
        fiscal_year = cal_year + 1
    else:
        fiscal_year = cal_year

    return (
        f"https://travel.state.gov/content/travel/en/legal/visa-law0/"
        f"visa-bulletin/{fiscal_year}/visa-bulletin-for-{month_name}-{cal_year}.html"
    )


def main():
    print("=" * 60)
    print("Table B (Dates for Filing) Backfill")
    print(f"Target range: {START_DATE} to {END_DATE}")
    print("=" * 60)

    # Step 1: Open database
    conn = create_database()

    # Step 2: Find which months already have Table B data
    existing_table_b = get_months_with_table_b(conn)
    print(f"\nMonths with existing Dates_for_Filing data: {len(existing_table_b)}")

    # Step 3: Generate all expected months in our target range
    expected_months = generate_expected_months(START_DATE, END_DATE)
    print(f"Total months in target range: {len(expected_months)}")

    # Step 4: Filter to missing months
    missing_months = [m for m in expected_months if m not in existing_table_b]
    print(f"Months missing Table B data: {len(missing_months)}")

    if not missing_months:
        print("\nNo missing months -- nothing to backfill!")
        conn.close()
        return

    # Step 5: Get all bulletin URLs from the index page
    print("\nFetching bulletin URL index...")
    index_urls = get_all_bulletin_urls()
    print(f"  Found {len(index_urls)} URLs from index page")

    # Build a lookup: bulletin_date -> URL
    url_map = {}
    for url in index_urls:
        bd = url_to_bulletin_date(url)
        if bd:
            url_map[bd] = url

    # Step 6: For missing months, find or generate URLs
    urls_to_scrape = []
    missing_no_url = []

    for month in missing_months:
        if month in url_map:
            urls_to_scrape.append((month, url_map[month]))
        else:
            # Generate URL from pattern
            generated_url = generate_url_for_month(month)
            urls_to_scrape.append((month, generated_url))
            missing_no_url.append(month)

    if missing_no_url:
        print(f"\n  {len(missing_no_url)} months not found in index -- using generated URLs:")
        for m in missing_no_url[:5]:
            print(f"    {m}")
        if len(missing_no_url) > 5:
            print(f"    ... and {len(missing_no_url) - 5} more")

    # Step 7: Get record count before backfill
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM visa_bulletin WHERE table_type = 'Dates_for_Filing'")
    before_count = cursor.fetchone()[0]
    print(f"\nDates_for_Filing records before backfill: {before_count}")

    # Step 8: Scrape each missing month
    print(f"\nScraping {len(urls_to_scrape)} bulletins...")
    print("-" * 60)

    success_count = 0
    fail_count = 0
    zero_table_b = []
    total_new_records = 0

    for i, (month, url) in enumerate(urls_to_scrape, 1):
        print(f"[{i}/{len(urls_to_scrape)}] {month}")

        # Count Table B records before this scrape
        cursor.execute(
            "SELECT COUNT(*) FROM visa_bulletin WHERE table_type = 'Dates_for_Filing' AND bulletin_date = ?",
            (month,),
        )
        before = cursor.fetchone()[0]

        records = scrape_bulletin(url, conn)

        # Count Table B records after this scrape
        cursor.execute(
            "SELECT COUNT(*) FROM visa_bulletin WHERE table_type = 'Dates_for_Filing' AND bulletin_date = ?",
            (month,),
        )
        after = cursor.fetchone()[0]
        new_table_b = after - before

        if records > 0:
            success_count += 1
            total_new_records += new_table_b
            if new_table_b == 0:
                zero_table_b.append(month)
                print(f"    WARNING: {records} total records but 0 new Table B records")
        else:
            fail_count += 1
            print(f"    FAILED: 0 records from {url}")

        # Be polite
        if i < len(urls_to_scrape):
            time.sleep(REQUEST_DELAY)

    # Step 9: Final summary
    cursor.execute("SELECT COUNT(*) FROM visa_bulletin WHERE table_type = 'Dates_for_Filing'")
    after_count = cursor.fetchone()[0]

    cursor.execute(
        "SELECT COUNT(*) FROM visa_bulletin WHERE table_type = 'Dates_for_Filing' AND bulletin_date >= ? AND bulletin_date <= ?",
        (START_DATE, END_DATE),
    )
    backfilled_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM visa_bulletin")
    total_all = cursor.fetchone()[0]

    print("\n" + "=" * 60)
    print("BACKFILL SUMMARY")
    print("=" * 60)
    print(f"Bulletins attempted:     {len(urls_to_scrape)}")
    print(f"Bulletins succeeded:     {success_count}")
    print(f"Bulletins failed:        {fail_count}")
    print(f"New Table B records:     {total_new_records}")
    print(f"Table B total (before):  {before_count}")
    print(f"Table B total (after):   {after_count}")
    print(f"Table B in target range: {backfilled_count}")
    print(f"Database total records:  {total_all}")

    if zero_table_b:
        print(f"\nWARNING: {len(zero_table_b)} months had 0 new Table B records:")
        for m in zero_table_b:
            print(f"  {m}")

    # Final verification
    cursor.execute(
        "SELECT table_type, MIN(bulletin_date), MAX(bulletin_date), COUNT(*) "
        "FROM visa_bulletin GROUP BY table_type"
    )
    print("\nFinal database state:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[3]} records ({row[1]} to {row[2]})")

    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
