#!/usr/bin/env python3
"""
Build SQLite database for US Visa Bulletin historical data.
Scrapes both Table A (Final Action Dates) and Table B (Dates for Filing)
for Employment-based categories from travel.state.gov.
"""

import sqlite3
import re
import requests
import pandas as pd
from bs4 import BeautifulSoup
from datetime import datetime
from pathlib import Path
import time

DB_PATH = Path(__file__).parent / "visa_bulletin.db"

# Employment-based categories (standardized)
EB_CATEGORIES = [
    "1st",
    "2nd",
    "3rd",
    "Other Workers",
    "4th",
    "Certain Religious Workers",
    "5th Unreserved",
    "5th Rural",
    "5th High Unemployment",
    "5th Infrastructure",
]

COUNTRIES = [
    "All_Chargeability_Areas",
    "China",
    "India",
    "Mexico",
    "Philippines",
]


def create_database():
    """Create SQLite database with proper schema."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS visa_bulletin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bulletin_date TEXT NOT NULL,
            table_type TEXT NOT NULL,
            category TEXT NOT NULL,
            country TEXT NOT NULL,
            priority_date TEXT,
            is_current INTEGER DEFAULT 0,
            is_unavailable INTEGER DEFAULT 0,
            scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(bulletin_date, table_type, category, country)
        )
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_bulletin_date 
        ON visa_bulletin(bulletin_date)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_category_country 
        ON visa_bulletin(category, country)
    """)

    conn.commit()
    return conn


def parse_date_value(value):
    """Parse a date value from the visa bulletin.
    Returns (priority_date, is_current, is_unavailable)
    """
    if not value or value.strip() == "":
        return None, 0, 1

    value = value.strip().upper()

    if value == "C":
        return "CURRENT", 1, 0
    elif value == "U":
        return "UNAVAILABLE", 0, 1
    else:
        # Parse date like "15OCT24" -> "2024-10-15"
        match = re.match(r"(\d{1,2})([A-Z]{3})(\d{2,4})", value)
        if match:
            day = int(match.group(1))
            month_str = match.group(2)
            year = int(match.group(3))
            if year < 100:
                year += 2000 if year < 50 else 1900

            months = {
                "JAN": 1,
                "FEB": 2,
                "MAR": 3,
                "APR": 4,
                "MAY": 5,
                "JUN": 6,
                "JUL": 7,
                "AUG": 8,
                "SEP": 9,
                "OCT": 10,
                "NOV": 11,
                "DEC": 12,
            }
            month = months.get(month_str, 1)
            return f"{year:04d}-{month:02d}-{day:02d}", 0, 0

    return value, 0, 0


def normalize_category(cat):
    """Normalize category names."""
    cat = cat.strip()
    cat_lower = cat.lower()

    if cat_lower.startswith("1st") or cat_lower == "first":
        return "1st"
    elif cat_lower.startswith("2nd") or cat_lower == "second":
        return "2nd"
    elif cat_lower.startswith("3rd") or cat_lower == "third":
        return "3rd"
    elif "other worker" in cat_lower:
        return "Other Workers"
    elif cat_lower.startswith("4th") or cat_lower == "fourth":
        return "4th"
    elif "religious" in cat_lower:
        return "Certain Religious Workers"
    elif "unreserved" in cat_lower:
        return "5th Unreserved"
    elif "rural" in cat_lower and "20%" in cat:
        return "5th Rural"
    elif "high unemployment" in cat_lower or (
        "10%" in cat and "unemployment" in cat_lower
    ):
        return "5th High Unemployment"
    elif "infrastructure" in cat_lower:
        return "5th Infrastructure"

    return cat


def normalize_country(country):
    """Normalize country names."""
    country = country.strip()

    if "all chargeability" in country.lower():
        return "All_Chargeability_Areas"
    elif "china" in country.lower():
        return "China"
    elif "india" in country.lower():
        return "India"
    elif "mexico" in country.lower():
        return "Mexico"
    elif "philippines" in country.lower():
        return "Philippines"

    return country


def parse_employment_table(table, table_type, bulletin_date, conn):
    """Parse an employment-based visa table and insert into database."""
    cursor = conn.cursor()

    rows = table.find_all("tr")
    if len(rows) < 2:
        return 0

    header_row = rows[0]
    headers = [th.get_text(strip=True) for th in header_row.find_all(["th", "td"])]

    if not headers:
        return 0

    header_text = " ".join(headers).lower()
    if "employment" not in header_text:
        return 0

    countries = [normalize_country(h) for h in headers[1:]]

    records_inserted = 0

    for row in rows[1:]:
        cells = row.find_all(["td", "th"])
        if len(cells) < 2:
            continue

        category = normalize_category(cells[0].get_text(strip=True))

        for i, cell in enumerate(cells[1:], start=0):
            if i >= len(countries):
                break

            country = countries[i]
            value = cell.get_text(strip=True)
            priority_date, is_current, is_unavailable = parse_date_value(value)

            try:
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO visa_bulletin 
                    (bulletin_date, table_type, category, country, priority_date, is_current, is_unavailable)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        bulletin_date,
                        table_type,
                        category,
                        country,
                        priority_date,
                        is_current,
                        is_unavailable,
                    ),
                )
                records_inserted += 1
            except Exception as e:
                print(
                    f"  Error inserting {bulletin_date} {table_type} {category} {country}: {e}"
                )

    return records_inserted


def scrape_bulletin(url, conn):
    """Scrape a single visa bulletin page."""
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
        return 0

    soup = BeautifulSoup(resp.text, "lxml")

    # Extract bulletin date from title
    h1_tags = soup.find_all("h1")
    bulletin_date = None
    for h1 in h1_tags:
        text = h1.get_text(strip=True)
        if "Visa Bulletin" in text:
            match = re.search(r"([A-Za-z]+)\s+(\d{4})", text)
            if match:
                month_year = match.group(0)
                try:
                    dt = datetime.strptime(month_year, "%B %Y")
                    bulletin_date = dt.strftime("%Y-%m-01")
                except:
                    pass
                break

    if not bulletin_date:
        print(f"  Could not extract bulletin date from {url}")
        return 0

    print(f"  Scraping {bulletin_date}...")

    tables = soup.find_all("table")
    total_records = 0

    employment_table_count = 0
    for table in tables:
        text = table.get_text().lower()

        if "employment-based" in text or "employment" in text:
            employment_table_count += 1

            # First employment table is typically Final Action, second is Dates for Filing
            table_type = (
                "Final_Action" if employment_table_count == 1 else "Dates_for_Filing"
            )

            records = parse_employment_table(table, table_type, bulletin_date, conn)
            total_records += records
            print(f"    {table_type}: {records} records")

            if employment_table_count >= 2:
                break

    conn.commit()
    return total_records


def get_all_bulletin_urls():
    """Get all visa bulletin URLs from the index page."""
    index_url = (
        "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html"
    )

    try:
        resp = requests.get(index_url, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        print(f"Error fetching index: {e}")
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    urls = []

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "visa-bulletin-for" in href and "visa-bulletin.html" not in href:
            if href.startswith("/"):
                href = "https://travel.state.gov" + href
            if href.startswith("http"):
                urls.append(href)

    seen = set()
    unique_urls = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)

    return unique_urls


def import_existing_csvs(conn):
    """Import existing CSV data from the cloned repo."""
    csv_dir = Path("/tmp/visaBulletin")

    if not csv_dir.exists():
        print("No existing CSV directory found")
        return 0

    cursor = conn.cursor()
    total_records = 0

    country_mapping = {
        "INDIA": "India",
        "CHINA": "China",
        "ROW": "All_Chargeability_Areas",
    }

    for csv_file in csv_dir.glob("employment_*.csv"):
        if "wait_times" in csv_file.name:
            continue

        country_code = csv_file.stem.replace("employment_", "")
        country = country_mapping.get(country_code, country_code)

        print(f"Importing {csv_file.name}...")

        try:
            df = pd.read_csv(csv_file, index_col=0)
        except Exception as e:
            print(f"  Error reading {csv_file}: {e}")
            continue

        for bulletin_mm_yy, row in df.iterrows():
            try:
                parts = str(bulletin_mm_yy).split("/")
                if len(parts) == 2:
                    month = int(parts[0])
                    year = int(parts[1])
                    if year < 100:
                        year += 2000 if year < 50 else 1900
                    bulletin_date = f"{year:04d}-{month:02d}-01"
                else:
                    continue
            except:
                continue

            for category, value in row.items():
                if pd.isna(value) or str(value) in ["", "b''", "b"]:
                    continue

                category = normalize_category(str(category))
                priority_date, is_current, is_unavailable = parse_date_value(str(value))

                try:
                    cursor.execute(
                        """
                        INSERT OR REPLACE INTO visa_bulletin 
                        (bulletin_date, table_type, category, country, priority_date, is_current, is_unavailable)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                        (
                            bulletin_date,
                            "Final_Action",
                            category,
                            country,
                            priority_date,
                            is_current,
                            is_unavailable,
                        ),
                    )
                    total_records += 1
                except Exception as e:
                    pass

        conn.commit()

    print(f"Imported {total_records} records from CSVs")
    return total_records


def main():
    print("=" * 60)
    print("US Visa Bulletin Database Builder")
    print("=" * 60)

    print("\n1. Creating database...")
    conn = create_database()
    print(f"   Database created at: {DB_PATH}")

    print("\n2. Importing existing CSV data...")
    csv_records = import_existing_csvs(conn)

    print("\n3. Scraping recent bulletins (2024-2026)...")
    urls = get_all_bulletin_urls()

    recent_urls = [
        u for u in urls if any(year in u for year in ["2024", "2025", "2026"])
    ]
    recent_urls = sorted(recent_urls, reverse=True)[:30]

    scraped_records = 0
    for url in recent_urls:
        records = scrape_bulletin(url, conn)
        scraped_records += records
        time.sleep(1)

    print(f"\n   Scraped {scraped_records} records from {len(recent_urls)} bulletins")

    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM visa_bulletin")
    total = cursor.fetchone()[0]

    cursor.execute("SELECT MIN(bulletin_date), MAX(bulletin_date) FROM visa_bulletin")
    min_date, max_date = cursor.fetchone()

    print("\n" + "=" * 60)
    print("DATABASE SUMMARY")
    print("=" * 60)
    print(f"Database: {DB_PATH}")
    print(f"Total records: {total}")
    print(f"Date range: {min_date} to {max_date}")

    cursor.execute("""
        SELECT table_type, COUNT(*) 
        FROM visa_bulletin 
        GROUP BY table_type
    """)
    print("\nRecords by table type:")
    for table_type, count in cursor.fetchall():
        print(f"  {table_type}: {count}")

    cursor.execute("""
        SELECT country, COUNT(*) 
        FROM visa_bulletin 
        GROUP BY country
        ORDER BY COUNT(*) DESC
    """)
    print("\nRecords by country:")
    for country, count in cursor.fetchall():
        print(f"  {country}: {count}")

    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
