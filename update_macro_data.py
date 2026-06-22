import yfinance as yf
import urllib.request
import json
import datetime
import math
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
MACRO_FILE = DATA_DIR / "macro.json"

def fetch_macro_data():
    DATA_DIR.mkdir(exist_ok=True)
    
    macro_data = {
        "qqq_yoy_pct": 0.0,
        "unemployment_yoy_diff": 0.0,
        "last_updated": datetime.datetime.utcnow().strftime("%Y-%m-%d")
    }
    
    # 1. Fetch QQQ (Tech Stock Index)
    try:
        print("Fetching QQQ data...")
        # Get last 2 years of monthly data
        qqq = yf.download("QQQ", period="2y", interval="1mo", progress=False)
        if not qqq.empty:
            close_prices = qqq['Close']
            if hasattr(close_prices, "columns"):
                close_prices = close_prices['QQQ'] # Handle MultiIndex if present
            
            # Need at least 13 months to calculate YoY
            if len(close_prices) >= 13:
                current_price = close_prices.iloc[-1]
                last_year_price = close_prices.iloc[-13]
                if not math.isnan(current_price) and not math.isnan(last_year_price):
                    yoy_pct = ((current_price - last_year_price) / last_year_price) * 100.0
                    macro_data["qqq_yoy_pct"] = round(yoy_pct, 2)
                    print(f"QQQ YoY: {yoy_pct:.2f}% (Current: ${current_price:.2f}, Last Year: ${last_year_price:.2f})")
    except Exception as e:
        print(f"Error fetching QQQ: {e}")

    # 2. Fetch US Unemployment Rate (BLS)
    try:
        print("Fetching BLS Unemployment data...")
        current_year = datetime.datetime.now().year
        # BLS API v2 public endpoint
        headers = {'Content-type': 'application/json'}
        req_data = json.dumps({
            "seriesid": ['LNS14000000'],
            "startyear": str(current_year - 2),
            "endyear": str(current_year)
        })
        req = urllib.request.Request('https://api.bls.gov/publicAPI/v2/timeseries/data/', data=req_data.encode('utf-8'), headers=headers)
        
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode())
            if res.get('Results') and res['Results']['series'][0]['data']:
                data_points = res['Results']['series'][0]['data']
                # Data is returned from newest to oldest
                if len(data_points) >= 13:
                    current_unemp = float(data_points[0]['value'])
                    last_year_unemp = float(data_points[12]['value'])
                    yoy_diff = current_unemp - last_year_unemp
                    macro_data["unemployment_yoy_diff"] = round(yoy_diff, 2)
                    print(f"Unemployment YoY: {yoy_diff:+.2f}% (Current: {current_unemp}%, Last Year: {last_year_unemp}%)")
    except Exception as e:
        print(f"Error fetching BLS: {e}")

    # Save to JSON
    with open(MACRO_FILE, 'w') as f:
        json.dump(macro_data, f, indent=2)
    print(f"Saved macro data to {MACRO_FILE}")

if __name__ == "__main__":
    fetch_macro_data()
