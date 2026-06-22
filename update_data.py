#!/usr/bin/env python3
import re
import time
import requests
import pandas as pd
from bs4 import BeautifulSoup
from datetime import datetime
from pathlib import Path
import json

DATA_DIR = Path(__file__).parent / "data"
CSV_FILE = DATA_DIR / "visa_bulletin_all.csv"
DASHBOARD_JSON = DATA_DIR / "dashboard.json"

# Employment-based categories (standardized)
EB_CATEGORIES = [
    "1st", "2nd", "3rd", "Other Workers", "4th", "Certain Religious Workers",
    "5th Unreserved", "5th Rural", "5th High Unemployment", "5th Infrastructure",
]
COUNTRIES = ["All_Chargeability_Areas", "China", "India", "Mexico", "Philippines"]

def parse_date_value(value):
    if pd.isna(value) or str(value).strip() == "": return None, 0, 1
    value = str(value).strip().upper()
    if value == "C": return "CURRENT", 1, 0
    elif value == "U": return "UNAVAILABLE", 0, 1
    else:
        match = re.match(r"(\d{1,2})([A-Z]{3})(\d{2,4})", value)
        if match:
            day, month_str, year = int(match.group(1)), match.group(2), int(match.group(3))
            if year < 100: year += 2000 if year < 50 else 1900
            months = {"JAN":1,"FEB":2,"MAR":3,"APR":4,"MAY":5,"JUN":6,"JUL":7,"AUG":8,"SEP":9,"OCT":10,"NOV":11,"DEC":12}
            month = months.get(month_str, 1)
            return f"{year:04d}-{month:02d}-{day:02d}", 0, 0
    return value, 0, 0

def normalize_category(cat):
    cat = str(cat).strip()
    cat_lower = cat.lower()
    if cat_lower.startswith("1st") or cat_lower == "first": return "1st"
    elif cat_lower.startswith("2nd") or cat_lower == "second": return "2nd"
    elif cat_lower.startswith("3rd") or cat_lower == "third": return "3rd"
    elif "other worker" in cat_lower: return "Other Workers"
    elif cat_lower.startswith("4th") or cat_lower == "fourth": return "4th"
    elif "religious" in cat_lower: return "Certain Religious Workers"
    elif "unreserved" in cat_lower: return "5th Unreserved"
    elif "rural" in cat_lower and "20%" in cat: return "5th Rural"
    elif "high unemployment" in cat_lower or ("10%" in cat and "unemployment" in cat_lower): return "5th High Unemployment"
    elif "infrastructure" in cat_lower: return "5th Infrastructure"
    return cat

def normalize_country(country):
    country = str(country).strip()
    if "all chargeability" in country.lower(): return "All_Chargeability_Areas"
    elif "china" in country.lower(): return "China"
    elif "india" in country.lower(): return "India"
    elif "mexico" in country.lower(): return "Mexico"
    elif "philippines" in country.lower(): return "Philippines"
    return country

def parse_employment_table(table, table_type, bulletin_date):
    records = []
    rows = table.find_all("tr")
    if len(rows) < 2: return records
    header_row = rows[0]
    headers = [th.get_text(strip=True) for th in header_row.find_all(["th", "td"])]
    if not headers or "employment" not in " ".join(headers).lower(): return records
    countries = [normalize_country(h) for h in headers[1:]]

    for row in rows[1:]:
        cells = row.find_all(["td", "th"])
        if len(cells) < 2: continue
        category = normalize_category(cells[0].get_text(strip=True))
        if category in ('2A*', '2B', '5th'): continue # Skip invalid categories
        
        # Clean specific old names
        category = category.replace('\u00a0', ' ')
        if category in ["5th Targeted Employment Areas/ Regional Centers and Pilot Programs", "Targeted Employment Areas/Regional Centers"]:
            category = "5th Regional Center (I5 and R5)"

        for i, cell in enumerate(cells[1:], start=0):
            if i >= len(countries): break
            country = countries[i]
            value = cell.get_text(strip=True)
            priority_date, is_current, is_unavailable = parse_date_value(value)
            records.append({
                "bulletin_date": bulletin_date,
                "table_type": table_type,
                "category": category,
                "country": country,
                "priority_date": priority_date,
                "is_current": is_current,
                "is_unavailable": is_unavailable,
                "scraped_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            })
    return records

def scrape_bulletin(url):
    print(f"Fetching {url}")
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None, []

    soup = BeautifulSoup(resp.text, "lxml")
    bulletin_date = None
    for h1 in soup.find_all("h1"):
        text = h1.get_text(strip=True)
        if "Visa Bulletin" in text:
            match = re.search(r"([A-Za-z]+)\s+(\d{4})", text)
            if match:
                try:
                    dt = datetime.strptime(match.group(0), "%B %Y")
                    bulletin_date = dt.strftime("%Y-%m-01")
                except: pass
                break

    if not bulletin_date: return None, []

    tables = soup.find_all("table")
    all_records = []
    emp_count = 0
    for table in tables:
        text = table.get_text().lower()
        if "employment-based" in text or "employment" in text:
            emp_count += 1
            table_type = "Final_Action" if emp_count == 1 else "Dates_for_Filing"
            records = parse_employment_table(table, table_type, bulletin_date)
            all_records.extend(records)
            if emp_count >= 2: break
            
    return bulletin_date, all_records

def get_all_bulletin_urls():
    index_url = "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html"
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
            if href.startswith("/"): href = "https://travel.state.gov" + href
            if href.startswith("http") and href not in urls: urls.append(href)
    return urls

def update_data():
    DATA_DIR.mkdir(exist_ok=True)
    
    if CSV_FILE.exists():
        df = pd.read_csv(CSV_FILE)
        existing_dates = set(df['bulletin_date'].unique())
        print(f"Loaded {len(df)} records. Latest bulletin is {max(existing_dates) if existing_dates else 'None'}")
    else:
        df = pd.DataFrame()
        existing_dates = set()
        
    urls = get_all_bulletin_urls()
    new_records = []
    
    # Check URLs to find new bulletins
    for url in urls:
        # Extract month/year from URL to quickly skip if we already have it
        match = re.search(r'visa-bulletin-for-([a-z]+)-(\d{4})', url)
        if match:
            try:
                dt = datetime.strptime(f"{match.group(1)} {match.group(2)}", "%B %Y")
                b_date = dt.strftime("%Y-%m-01")
                if b_date in existing_dates:
                    continue # Skip scraping
            except: pass
            
        b_date, records = scrape_bulletin(url)
        if b_date and b_date not in existing_dates:
            new_records.extend(records)
            existing_dates.add(b_date)
            time.sleep(1) # Rate limit only if we actually scrape
            
    if new_records:
        print(f"Found {len(new_records)} new records.")
        df_new = pd.DataFrame(new_records)
        df = pd.concat([df, df_new], ignore_index=True)
        # Drop duplicates just in case
        df = df.drop_duplicates(subset=['bulletin_date', 'table_type', 'category', 'country'], keep='last')
        df = df.sort_values(['bulletin_date', 'table_type', 'category', 'country'], ascending=[False, True, True, True])
        df.to_csv(CSV_FILE, index=False)
    else:
        print("No new records found.")

    return df

def generate_dashboard_json(df):
    if df.empty: return
    
    # Filter for EB-2 China
    df_c = df[(df['category'] == '2nd') & (df['country'] == 'China')].copy()
    df_c['bulletin_date'] = pd.to_datetime(df_c['bulletin_date'])
    df_c = df_c.sort_values('bulletin_date')
    
    # Table A and B RAW
    table_a_df = df_c[df_c['table_type'] == 'Final_Action']
    table_b_df = df_c[df_c['table_type'] == 'Dates_for_Filing']
    
    def to_raw(tdf):
        res = []
        for _, row in tdf.iterrows():
            if pd.isna(row['priority_date']) or row['priority_date'] in ['CURRENT', 'UNAVAILABLE']: continue
            bd = row['bulletin_date'].strftime("%Y-%m")
            res.append([bd, row['priority_date']])
        return res
        
    table_a_raw = to_raw(table_a_df)
    table_b_raw = to_raw(table_b_df)
    
    # Calculate Movement A
    movement_a = []
    ta_dates = table_a_df.set_index('bulletin_date')
    for curr_date, curr_row in ta_dates.iterrows():
        prev_date = curr_date - pd.DateOffset(months=1)
        if prev_date in ta_dates.index:
            prev_row = ta_dates.loc[prev_date]
            if curr_row['is_unavailable'] or prev_row['is_unavailable']: continue
            
            days = 0
            if curr_row['is_current'] == 0 and prev_row['is_current'] == 0:
                try:
                    cd = pd.to_datetime(curr_row['priority_date'])
                    pd_dt = pd.to_datetime(prev_row['priority_date'])
                    days = (cd - pd_dt).days
                except: continue
            elif prev_row['is_current'] == 0 and curr_row['is_current'] == 1: days = 9999
            elif prev_row['is_current'] == 1 and curr_row['is_current'] == 0: days = -9999
            
            movement_a.append({
                "month": curr_date.strftime("%Y-%m"),
                "days": days
            })

    # Keep only last 24 for movement chart like the original HTML
    movement_a = movement_a[-24:] if len(movement_a) > 24 else movement_a
            
    # Calculate Yearly Summary
    yearly = []
    # Re-calculate movement for all tables and rows for yearly summary
    df_sorted = df_c.sort_values(['table_type', 'bulletin_date'])
    df_sorted['prev_date'] = df_sorted.groupby('table_type')['bulletin_date'].shift(1)
    
    for tt in ['Final_Action', 'Dates_for_Filing']:
        tt_df = df_sorted[df_sorted['table_type'] == tt].copy()
        
        tt_df['year'] = tt_df['bulletin_date'].dt.year.astype(str)
        
        movements = []
        for i in range(1, len(tt_df)):
            curr = tt_df.iloc[i]
            prev = tt_df.iloc[i-1]
            if curr['is_unavailable'] or prev['is_unavailable']: continue
            if curr['bulletin_date'] - prev['bulletin_date'] > pd.Timedelta(days=32): continue # Not consecutive
            
            days = 0
            if curr['is_current'] == 0 and prev['is_current'] == 0:
                try:
                    cd = pd.to_datetime(curr['priority_date'])
                    pdt = pd.to_datetime(prev['priority_date'])
                    days = (cd - pdt).days
                except: continue
            elif prev['is_current'] == 0 and curr['is_current'] == 1: days = 9999
            elif prev['is_current'] == 1 and curr['is_current'] == 0: days = -9999
            
            movements.append({
                "year": curr['year'],
                "days": days
            })
            
        if not movements: continue
        mdf = pd.DataFrame(movements)
        for year, group in mdf.groupby('year'):
            real_moves = group[~group['days'].isin([9999, -9999])]
            avg = round(real_moves['days'].mean(), 1) if not real_moves.empty else 0
            retro = len(group[(group['days'] < 0) & (group['days'] != -9999)])
            adv = len(group[(group['days'] > 0) & (group['days'] != 9999)])
            
            yearly.append({
                "year": str(year),
                "table": "A" if tt == "Final_Action" else "B",
                "avg": avg,
                "retro": retro,
                "adv": adv
            })
            
    yearly.sort(key=lambda x: (x['year'], x['table']), reverse=True)
    
    dashboard_data = {
        "TABLE_A_RAW": table_a_raw,
        "TABLE_B_RAW": table_b_raw,
        "MOVEMENT_A": movement_a,
        "YEARLY": yearly,
        "LAST_UPDATED": datetime.utcnow().strftime("%Y-%m-%d")
    }
    
    with open(DASHBOARD_JSON, 'w') as f:
        json.dump(dashboard_data, f, indent=2)
    print(f"Generated {DASHBOARD_JSON}")

if __name__ == "__main__":
    df = update_data()
    generate_dashboard_json(df)
