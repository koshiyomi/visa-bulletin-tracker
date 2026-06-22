import pandas as pd
import yfinance as yf
import urllib.request
import json
import numpy as np

# 1. Load Visa Bulletin Data
df_vb = pd.read_csv('data/visa_bulletin_all.csv')
df_vb['bulletin_date'] = pd.to_datetime(df_vb['bulletin_date'])

def get_wait_time_series(cat, country):
    df_c = df_vb[(df_vb['category'] == cat) & (df_vb['country'].str.contains(country, case=False, na=False)) & (df_vb['table_type'] == 'Final_Action')].copy()
    def get_wait_time(row):
        if pd.isna(row['priority_date']) or row['priority_date'] in ['CURRENT', 'UNAVAILABLE']:
            return np.nan
        try:
            pd_date = pd.to_datetime(row['priority_date'])
            return (row['bulletin_date'] - pd_date).days / 365.25
        except:
            return np.nan

    df_c['wait_time_years'] = df_c.apply(get_wait_time, axis=1)
    df_c = df_c.dropna(subset=['wait_time_years'])
    df_c.set_index('bulletin_date', inplace=True)
    return df_c[['wait_time_years']].resample('ME').last()

df_eb2_cn = get_wait_time_series('2nd', 'CHINA')
df_eb3_cn = get_wait_time_series('3rd', 'CHINA')
df_eb2_in = get_wait_time_series('2nd', 'INDIA')

print("Fetching Macro Data from Yahoo Finance...")
# SPY: S&P 500 (Economy)
# QQQ: NASDAQ (Tech)
# ^IRX: 13-week Treasury Bill (Interest Rates / Fed Funds Proxy)
# ^VIX: Volatility Index (Market Fear)
tickers = ["SPY", "QQQ", "^IRX", "^VIX"]
data = yf.download(tickers, start="2005-01-01", end="2026-01-01", interval="1mo", progress=False)['Close']
if isinstance(data.columns, pd.MultiIndex):
    data.columns = [col[1] for col in data.columns] # Flatten MultiIndex

df_macro = data.resample('ME').last()
df_macro.index = df_macro.index.tz_localize(None)

print("Fetching BLS Unemployment Data...")
unemp_data = []
try:
    for start_year, end_year in [("2005", "2014"), ("2015", "2024")]:
        headers = {'Content-type': 'application/json'}
        req_data = json.dumps({"seriesid": ['LNS14000000'], "startyear": start_year, "endyear": end_year})
        req = urllib.request.Request('https://api.bls.gov/publicAPI/v2/timeseries/data/', data=req_data.encode('utf-8'), headers=headers)
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode())
            for item in res['Results']['series'][0]['data']:
                date_str = f"{item['year']}-{item['period'][1:]}-01"
                unemp_data.append({'date': pd.to_datetime(date_str), 'UNRATE': float(item['value'])})
except Exception as e:
    print("BLS Error:", e)

if unemp_data:
    df_unemp = pd.DataFrame(unemp_data)
    df_unemp.set_index('date', inplace=True)
    df_unemp = df_unemp.resample('ME').last()
    df_macro = df_macro.join(df_unemp, how='outer')

def run_correlation(df_target, target_name):
    df_merged = df_target.join(df_macro, how='inner')
    print(f"\n--- Correlation Analysis: {target_name} ---")
    header = f"{'Lag(Mo)':<7} | " + " | ".join([f"{col:<8}" for col in df_macro.columns])
    print(header)
    print("-" * len(header))
    
    for lag in [0, 6, 12, 18, 24, 30, 36, 48, 60]:
        df_shifted = df_merged.copy()
        df_shifted['wait_time_years'] = df_shifted['wait_time_years'].shift(-lag)
        df_shifted = df_shifted.dropna()
        
        row_str = f"{lag:<7} | "
        for col in df_macro.columns:
            corr = df_shifted[col].corr(df_shifted['wait_time_years'])
            row_str += f"{corr:>8.3f} | "
        print(row_str)

run_correlation(df_eb2_cn, "EB-2 China Wait Time")
run_correlation(df_eb3_cn, "EB-3 China Wait Time")
run_correlation(df_eb2_in, "EB-2 India Wait Time")
