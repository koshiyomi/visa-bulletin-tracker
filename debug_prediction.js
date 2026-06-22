const fs = require('fs');

const data = fs.readFileSync('data/visa_bulletin_all.csv', 'utf8');
const lines = data.split('\n');
const headers = lines[0].split(',');
const fullData = [];
for(let i=1; i<lines.length; i++) {
    if(!lines[i].trim()) continue;
    const vals = lines[i].split(',');
    let obj = {};
    headers.forEach((h, idx) => obj[h.trim()] = vals[idx].trim());
    fullData.push(obj);
}

// Emulate normalizeCountry
function normalizeCountry(c) {
    if (!c) return "Unknown";
    const upperC = c.replace(/_/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
    if (upperC.includes("CHINA") || upperC === "CH") return "China";
    return c;
}

fullData.forEach(r => r.normalized_country = normalizeCountry(r.country));

// Sort
fullData.sort((a,b) => new Date(a.bulletin_date) - new Date(b.bulletin_date));

const DAY_MS = 86400000;

function predictFutureCutoff(history, tableType, category, country, monthsAhead = 12, externalFactors = null) {
  const segment = history.filter(({ table_type, category: cat, normalized_country: ctry }) => 
    table_type === tableType && cat === category && ctry === country
  );

  console.log("Segment length:", segment.length);

  const movements = [];
  const monthlyMovements = Array.from({ length: 12 }, () => []); 
  
  for (let i = 1; i < segment.length; i++) {
    const prev = segment[i - 1];
    const curr = segment[i];
    
    if (curr.is_unavailable === "1" || prev.is_unavailable === "1" || curr.is_current === "1" || prev.is_current === "1") {
      continue;
    }

    const prevPd = new Date(prev.priority_date).getTime();
    const currPd = new Date(curr.priority_date).getTime();
    
    if (!Number.isNaN(prevPd) && !Number.isNaN(currPd)) {
      const diffDays = (currPd - prevPd) / DAY_MS;
      movements.push(diffDays);
      
      const currMonth = new Date(curr.bulletin_date).getUTCMonth();
      monthlyMovements[currMonth].push(diffDays);
    }
  }

  const recentMoves = movements.slice(-6);
  const recentAvg = recentMoves.length > 0 
    ? recentMoves.reduce((acc, val) => acc + val, 0) / recentMoves.length 
    : 30; 

  console.log("recentAvg:", recentAvg);

  const predictions = [];
  const lastRecord = segment.at(-1); 
  
  const lastBulletinDate = new Date(lastRecord.bulletin_date);
  let lastPdDate = new Date(lastRecord.priority_date).getTime();

  for (let i = 1; i <= monthsAhead; i++) {
    lastBulletinDate.setUTCMonth(lastBulletinDate.getUTCMonth() + 1);
    const newBulletinStr = lastBulletinDate.toISOString().split('T')[0];
    
    const targetMonth = lastBulletinDate.getUTCMonth();
    const targetYear = lastBulletinDate.getUTCFullYear();

    const histMoves = monthlyMovements[targetMonth];
    const histAvg = histMoves.length > 0 
        ? histMoves.reduce((acc, val) => acc + val, 0) / histMoves.length 
        : recentAvg; 

    let electionMultiplier = 1.0;
    if (targetYear % 4 === 0) {
        electionMultiplier = 0.85; 
    } else if (targetYear % 4 === 1) {
        electionMultiplier = 0.90; 
    }

    const blendedDays = ((recentAvg * 0.4) + (histAvg * 0.6)) * electionMultiplier;
    const boostMultiplier = externalFactors?.boost ?? 1;
    
    lastPdDate += (blendedDays * boostMultiplier) * DAY_MS;
    
    predictions.push({
      bulletin_date: newBulletinStr,
      priority_date: lastPdDate,
      priority_date_str: new Date(lastPdDate).toISOString().split('T')[0],
      blendedDays,
      targetMonth,
      histAvg
    });
  }

  return predictions;
}

const preds = predictFutureCutoff(fullData, "Final_Action", "2nd", "China", 12);
console.log(preds);
