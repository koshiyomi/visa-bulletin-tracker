import csv
from datetime import datetime
import statistics

DAY_MS = 86400000

with open('data/visa_bulletin_all.csv', 'r') as f:
    reader = csv.DictReader(f)
    data = list(reader)

for r in data:
    if 'CHINA' in r['country'].upper() or r['country'].upper() == 'CH':
        r['normalized_country'] = 'China'
    else:
        r['normalized_country'] = r['country']

data.sort(key=lambda x: datetime.strptime(x['bulletin_date'], '%Y-%m-%d'))

segment = [d for d in data if d['table_type'] == 'Final_Action' and d['category'] == '2nd' and d['normalized_country'] == 'China']

movements = []
monthlyMovements = {i: [] for i in range(12)}

for i in range(1, len(segment)):
    prev = segment[i-1]
    curr = segment[i]
    if curr['is_unavailable'] == '1' or prev['is_unavailable'] == '1' or curr['is_current'] == '1' or prev['is_current'] == '1':
        continue
    
    try:
        prevPd = datetime.strptime(prev['priority_date'], '%Y-%m-%d').timestamp() * 1000
        currPd = datetime.strptime(curr['priority_date'], '%Y-%m-%d').timestamp() * 1000
        diffDays = (currPd - prevPd) / DAY_MS
        movements.append(diffDays)
        currMonth = datetime.strptime(curr['bulletin_date'], '%Y-%m-%d').month - 1
        monthlyMovements[currMonth].append(diffDays)
    except:
        pass

recentMoves = movements[-6:]
recentAvg = sum(recentMoves) / len(recentMoves) if recentMoves else 30

lastRecord = segment[-1]
lastBulletinDate = datetime.strptime(lastRecord['bulletin_date'], '%Y-%m-%d')
lastPdDate = datetime.strptime(lastRecord['priority_date'], '%Y-%m-%d').timestamp() * 1000

print(f"recentAvg: {recentAvg}")
print(f"lastPdDate Start: {lastPdDate}")

predictions = []
for i in range(1, 13):
    # advance month
    m = lastBulletinDate.month
    y = lastBulletinDate.year
    if m == 12:
        m = 1
        y += 1
    else:
        m += 1
    lastBulletinDate = lastBulletinDate.replace(year=y, month=m)
    
    targetMonth = lastBulletinDate.month - 1
    targetYear = lastBulletinDate.year
    
    histMoves = monthlyMovements[targetMonth]
    histAvg = sum(histMoves) / len(histMoves) if histMoves else recentAvg
    
    electionMultiplier = 1.0
    if targetYear % 4 == 0:
        electionMultiplier = 0.85
    elif targetYear % 4 == 1:
        electionMultiplier = 0.90
        
    blendedDays = ((recentAvg * 0.4) + (histAvg * 0.6)) * electionMultiplier
    
    lastPdDate += blendedDays * DAY_MS
    predictions.append({
        'bulletin_date': lastBulletinDate.strftime('%Y-%m-%d'),
        'priority_date': datetime.fromtimestamp(lastPdDate/1000).strftime('%Y-%m-%d'),
        'blendedDays': blendedDays,
        'histAvg': histAvg
    })

for p in predictions:
    print(p)
