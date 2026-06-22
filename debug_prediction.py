import csv
from datetime import datetime
from dateutil.relativedelta import relativedelta
import json
import os

DAY_MS = 86400000

macro_factors = None
if os.path.exists('data/macro.json'):
    with open('data/macro.json', 'r') as f:
        macro_factors = json.load(f)

with open('data/visa_bulletin_all.csv', 'r') as f:
    reader = csv.DictReader(f)
    data = list(reader)

for r in data:
    if 'CHINA' in r['country'].upper() or r['country'].upper() == 'CH':
        r['normalized_country'] = 'China'
    else:
        r['normalized_country'] = r['country']

data.sort(key=lambda x: datetime.strptime(x['bulletin_date'], '%Y-%m-%d'))

def simulate(table, cat, country):
    segment = [d for d in data if d['table_type'] == table and d['category'] == cat and d['normalized_country'] == country]
    if not segment: return
    
    movements = []
    for i in range(1, len(segment)):
        prev = segment[i-1]
        curr = segment[i]
        if curr['is_unavailable'] == '1' or prev['is_unavailable'] == '1' or curr['is_current'] == '1' or prev['is_current'] == '1':
            continue
        try:
            prevPd = datetime.strptime(prev['priority_date'], '%Y-%m-%d').timestamp() * 1000
            currPd = datetime.strptime(curr['priority_date'], '%Y-%m-%d').timestamp() * 1000
            movements.append((currPd - prevPd) / DAY_MS)
        except:
            pass
            
    recentAvg = sum(movements[-6:]) / 6 if len(movements) >= 6 else 30
    macroAvg = sum(movements) / len(movements) if movements else 30
    
    print(f"\n{'='*60}")
    print(f"Prediction Debug: {table} | {cat} | {country}")
    print(f"Short-Term Momentum (recentAvg): {recentAvg:.1f} days/month")
    print(f"Long-Term Trend (macroAvg):     {macroAvg:.1f} days/month")
    print(f"{'='*60}")
    
    last_record = segment[-1]
    if last_record['is_current'] == '1' or last_record['is_unavailable'] == '1':
        print("Category is CURRENT or UNAVAILABLE. Cannot predict.")
        return
        
    last_bulletin = datetime.strptime(last_record['bulletin_date'], '%Y-%m-%d')
    last_pd = datetime.strptime(last_record['priority_date'], '%Y-%m-%d')
    
    print(f"Anchor: {last_bulletin.strftime('%Y-%m')} -> PD: {last_pd.strftime('%Y-%m-%d')}")
    print("-" * 60)
    print(f"{'Month':<10} | {'BlendWeight':<15} | {'Multiplier':<10} | {'DaysMoved':<10} | {'Projected PD'}")
    print("-" * 60)
    
    for i in range(1, 25): # Predict 24 months out
        last_bulletin += relativedelta(months=1)
        targetMonth = last_bulletin.month - 1 # 0-indexed
        targetYear = last_bulletin.year
        
        seasonMultiplier = 1.0
        if 9 <= targetMonth <= 11: seasonMultiplier = 1.3
        elif 0 <= targetMonth <= 2: seasonMultiplier = 1.0
        elif 3 <= targetMonth <= 5: seasonMultiplier = 0.8
        elif 6 <= targetMonth <= 8: seasonMultiplier = 0.3
        
        electionMultiplier = 1.0
        if targetYear % 4 == 0: electionMultiplier = 0.85
        elif targetYear % 4 == 1: electionMultiplier = 0.90
            
        economyMultiplier = 1.0
        if macro_factors:
            qqqImpact = 1.0 - (macro_factors.get("qqq_yoy_pct", 0) / 100.0) * 0.4
            unempImpact = 1.0 + (macro_factors.get("unemployment_yoy_diff", 0) * 0.1)
            
            qqqImpact = max(0.6, min(1.4, qqqImpact))
            unempImpact = max(0.8, min(1.2, unempImpact))
            
            if country == 'India':
                economyMultiplier = qqqImpact * unempImpact
            else:
                economyMultiplier = 1.0 + ((qqqImpact * unempImpact - 1.0) * 0.25)
                
        blendFactor = max(0.1, 1.0 - (i / 12) * 0.9)
        adjustedMacroAvg = max(macroAvg, 0) * economyMultiplier
        blendedBase = (max(recentAvg, 0) * blendFactor) + (adjustedMacroAvg * (1 - blendFactor))
        
        blendedDays = blendedBase * seasonMultiplier * electionMultiplier
        
        last_pd += relativedelta(days=int(blendedDays))
        
        print(f"{last_bulletin.strftime('%Y-%m'):<10} | "
              f"{blendFactor*100:3.0f}% R / {(1-blendFactor)*100:3.0f}% M | "
              f"{seasonMultiplier*electionMultiplier*economyMultiplier:<10.2f} | "
              f"{int(blendedDays):<10} | "
              f"{last_pd.strftime('%Y-%m-%d')}")

simulate('Final_Action', '2nd', 'China')
simulate('Final_Action', '2nd', 'India')
