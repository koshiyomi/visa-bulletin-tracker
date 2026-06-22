import pandas as pd
import yfinance as yf
import urllib.request
import json
import numpy as np

# 1. Load Visa Bulletin Data
df_vb = pd.read_csv('data/visa_bulletin_all.csv')
df_vb['bulletin_date'] = pd.to_datetime(df_vb['bulletin_date'])
df_c = df_vb[(df_vb['category'] == '2nd') & (df_vb['country'].str.contains('CHINA', case=False, na=False)) & (df_vb['table_type'] == 'Final_Action')].copy()

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
df_c = df_c.resample('ME').last() # Monthly

# 2. Get QQQ Historical Data
print("Fetching QQQ data...")
qqq = yf.download("QQQ", start="2005-01-01", end="2026-01-01", interval="1mo", progress=False)
if not qqq.empty:
    if isinstance(qqq.columns, pd.MultiIndex):
        qqq_close = qqq['Close']['QQQ']
    else:
        qqq_close = qqq['Close']
    df_qqq = pd.DataFrame({'qqq': qqq_close})
    df_qqq.index = df_qqq.index.tz_localize(None)
    df_qqq = df_qqq.resample('ME').last()
else:
    df_qqq = pd.DataFrame()

# 3. Get BLS Unemployment Data (Series LNS14000000)
print("Fetching BLS data...")
unemp_data = []
try:
    # BLS public API only allows 10 years at a time
    for start_year, end_year in [("2005", "2014"), ("2015", "2024")]:
        headers = {'Content-type': 'application/json'}
        data = json.dumps({"seriesid": ['LNS14000000'], "startyear": start_year, "endyear": end_year})
        req = urllib.request.Request('https://api.bls.gov/publicAPI/v2/timeseries/data/', data=data.encode('utf-8'), headers=headers)
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode())
            for item in res['Results']['series'][0]['data']:
                date_str = f"{item['year']}-{item['period'][1:]}-01"
                unemp_data.append({'date': pd.to_datetime(date_str), 'unemployment': float(item['value'])})
except Exception as e:
    print("BLS Error:", e)

if unemp_data:
    df_unemp = pd.DataFrame(unemp_data)
    df_unemp.set_index('date', inplace=True)
    df_unemp = df_unemp.resample('ME').last()
else:
    df_unemp = pd.DataFrame()

# 4. Merge and Correlate
df_merged = df_c[['wait_time_years']].join(df_qqq, how='inner').join(df_unemp, how='inner')

# Calculate correlation with lags (0 to 36 months)
# We test if Macro indicator at time T correlates with Wait Time at time T + Lag
print("\n--- Correlation Analysis (EB-2 China Wait Time vs Macro Indicators) ---")
print("Lag(Months) | Unemployment Corr | QQQ Corr")
print("-" * 50)

for lag in [0, 6, 12, 18, 24, 30, 36]:
    df_shifted = df_merged.copy()
    df_shifted['wait_time_years'] = df_shifted['wait_time_years'].shift(-lag)
    df_shifted = df_shifted.dropna()
    
    corr_unemp = df_shifted['unemployment'].corr(df_shifted['wait_time_years'])
    corr_qqq = df_shifted['qqq'].corr(df_shifted['wait_time_years'])
    
    print(f"{lag:>11} | {corr_unemp:>17.3f} | {corr_qqq:>8.3f}")

print("\nNote: Positive correlation with QQQ means higher tech stock prices -> longer wait times later.")
print("Negative correlation with Unemployment means lower unemployment (good economy) -> longer wait times later.")
