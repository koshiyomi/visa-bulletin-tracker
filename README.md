# Visa Bulletin Tracker

A fully static Single Page Application (SPA) that tracks the USCIS employment-based visa bulletin, hosted on GitHub Pages.
The dataset covers **13,000+ records** across **148 monthly bulletins** from May 2002 to the present.

## Architecture

This project is a 100% static site that does not require a database server.

- **Frontend:** A simple `dashboard.html` that uses JavaScript (`fetch()`) and Chart.js to render data.
- **Backend/Data Pipeline:** A Python script (`update_data.py`) acts as a build step. It scrapes the latest bulletin from travel.state.gov, parses the tables, calculates metrics (like month-over-month movement), and exports static JSON/CSV files.
- **Automation:** A GitHub Actions workflow (`.github/workflows/update-bulletin.yml`) runs weekly to automatically run the Python script, scrape only the *newest* unseen bulletins (to avoid rate limits), and commit the updated data directly to the repository.

## Data Coverage

| Metric | Value |
|--------|-------|
| Date range | 2002-05 to Present |
| Table types | Final Action Dates, Dates for Filing |
| EB categories | 1st, 2nd, 3rd, 4th, 5th (multiple subcategories), Other Workers, Certain Religious Workers |
| Countries tracked | All Chargeability Areas, China, India, Mexico, Philippines |

## Quick Start (Local Development)

To run the dashboard locally or manually update the data:

```bash
# Clone and set up
git clone <repo-url> && cd visa-bulletin-tracker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Manually trigger a data update (fetches new bulletins)
python3 update_data.py

# Run a local web server to view the dashboard
python3 -m http.server
```
Then open `http://localhost:8000/dashboard.html` in your browser.

## Customizing the Dashboard

Currently, the dashboard visually defaults to tracking **EB-2 China**.
However, `update_data.py` scrapes *all* employment-based categories and countries into `data/visa_bulletin_all.csv`. 

If you wish to change the default tracked category, modify the `generate_dashboard_json()` function inside `update_data.py` to filter for your desired category/country before generating `data/dashboard.json`.

## Data Source

All data is scraped automatically from the [U.S. Department of State Visa Bulletin](https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html).
