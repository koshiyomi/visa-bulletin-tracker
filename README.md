# Visa Bulletin Tracker

SQLite database of USCIS employment-based visa bulletin data with analysis views.
Covers **13,109 records** across **148 monthly bulletins** from May 2002 to March 2026.

## Data Coverage

| Metric | Value |
|--------|-------|
| Total records | 13,109 |
| Date range | 2002-05 to 2026-03 |
| Monthly bulletins | 148 |
| Table types | Final Action Dates, Dates for Filing |
| EB categories | 1st, 2nd, 3rd, 4th, 5th (multiple subcategories), Other Workers, Certain Religious Workers |
| Countries tracked | All Chargeability Areas, China, India, Mexico, Philippines |

## Quick Start

```bash
# Clone and set up
git clone <repo-url> && cd visa-bulletin-tracker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Apply analysis views (idempotent)
sqlite3 visa_bulletin.db < views.sql
```

## Usage

### Rebuild database from scratch

Re-scrapes all bulletins from travel.state.gov. Takes several minutes due to rate limiting.

```bash
python3 build_visa_db.py
python3 clean_data.py
python3 backfill_table_b.py
sqlite3 visa_bulletin.db < views.sql
```

### Run analysis queries

Latest bulletin snapshot:

```bash
sqlite3 -header -column visa_bulletin.db \
  "SELECT category, country, priority_date
   FROM v_latest
   WHERE table_type='Final_Action' AND category='2nd';"
```

Month-over-month movement (positive = advancement, negative = retrogression):

```bash
sqlite3 -header -column visa_bulletin.db \
  "SELECT current_month, country, days_moved
   FROM v_movement
   WHERE category='2nd' AND table_type='Final_Action'
   ORDER BY current_month DESC LIMIT 10;"
```

Yearly summary with retrogression count:

```bash
sqlite3 -header -column visa_bulletin.db \
  "SELECT year, avg_days_moved, retrogression_months
   FROM v_yearly_summary
   WHERE category='2nd' AND country='China' AND table_type='Final_Action'
   ORDER BY year DESC LIMIT 5;"
```

Saved queries are available in `queries/`.

### Track your priority date

```bash
# Add your case
sqlite3 visa_bulletin.db \
  "INSERT INTO user_tracking (label, category, country, priority_date)
   VALUES ('Example EB-2', '2nd', 'China', '2022-01-15');"

# Check your status against the latest bulletin
sqlite3 -header -column visa_bulletin.db \
  "SELECT label, my_priority_date, current_cutoff, table_type, status
   FROM v_my_wait;"
```

### Backfill historical data

Table B (Dates for Filing) exists from Oct 2015 onward. If your database is missing those months:

```bash
python3 backfill_table_b.py
```

Uses `INSERT OR REPLACE`, so it is safe to re-run without duplicating data.

## Schema

### visa_bulletin (main table)

| Column | Type | Description |
|--------|------|-------------|
| bulletin_date | TEXT | First of the month (YYYY-MM-DD) |
| table_type | TEXT | `Final_Action` or `Dates_for_Filing` |
| category | TEXT | EB category (1st, 2nd, 3rd, etc.) |
| country | TEXT | Chargeability area |
| priority_date | TEXT | Cutoff date (YYYY-MM-DD), `CURRENT`, or `UNAVAILABLE` |
| is_current | INTEGER | 1 if category is current |
| is_unavailable | INTEGER | 1 if category is unavailable |

Unique constraint on `(bulletin_date, table_type, category, country)`.

### Analysis Views

| View | Purpose |
|------|---------|
| `v_latest` | Most recent bulletin snapshot |
| `v_movement` | Month-over-month priority date changes (days moved) |
| `v_retrogression` | Months with backward movement only |
| `v_my_wait` | Personal wait-time dashboard (joins `user_tracking`) |
| `v_yearly_summary` | Average movement and retrogression counts per year |

### user_tracking (personal watchlist)

| Column | Type | Description |
|--------|------|-------------|
| label | TEXT | Friendly name for the case |
| category | TEXT | Must match a visa_bulletin category |
| country | TEXT | Must match a visa_bulletin country |
| priority_date | TEXT | Your priority date (YYYY-MM-DD) |

## Scripts

| File | Purpose |
|------|---------|
| `build_visa_db.py` | Scrape all bulletins and build the database |
| `clean_data.py` | Remove family-based rows, fix typos, normalize EB-5 categories |
| `backfill_table_b.py` | Backfill Table B for Oct 2015 -- Sep 2023 |
| `views.sql` | Create analysis views and user_tracking table |

## Data Source

All data is scraped from the [U.S. Department of State Visa Bulletin](https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html).
