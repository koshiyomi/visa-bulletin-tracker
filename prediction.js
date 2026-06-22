// prediction.js

/**
 * Predicts the future priority dates using an advanced blended algorithm.
 * Incorporates short-term momentum, fiscal year seasonality (historical month trends),
 * and election year administrative slowdowns.
 * 
 * @param {Array<Object>} history - Array of historical data objects, sorted by bulletin_date ascending.
 * @param {string} tableType - The type of table (e.g., 'Final_Action' or 'Dates_for_Filing').
 * @param {string} category - The visa category (e.g., '2nd').
 * @param {string} country - The country of origin (e.g., 'China').
 * @param {number} [monthsAhead=12] - Number of months to project into the future.
 * @param {Object|null} [externalFactors=null] - Placeholder for external modifiers (e.g., { boost: 1.2 }).
 * @returns {Array<Object>} Array of projected data points.
 */
window.predictFutureCutoff = (history, tableType, category, country, monthsAhead = 12, externalFactors = null) => {
  // Filter history to isolate the specific trajectory we want to predict
  const segment = history.filter(({ table_type, category: cat, country: ctry }) => 
    table_type === tableType && cat === category && ctry === country
  );

  // Require at least two data points to establish a trend
  if (segment.length < 2) return [];

  const DAY_MS = 86400000;
  const movements = [];
  const monthlyMovements = Array.from({ length: 12 }, () => []); // Array of 12 arrays for each month
  
  // Calculate day-over-day differences between consecutive bulletins
  for (let i = 1; i < segment.length; i++) {
    const prev = segment[i - 1];
    const curr = segment[i];
    
    // Skip calculations if either data point is "Current" (1) or "Unavailable" (1)
    if (curr.is_unavailable === "1" || prev.is_unavailable === "1" || curr.is_current === "1" || prev.is_current === "1") {
      continue;
    }

    const prevPd = new Date(prev.priority_date).getTime();
    const currPd = new Date(curr.priority_date).getTime();
    
    if (!Number.isNaN(prevPd) && !Number.isNaN(currPd)) {
      const diffDays = (currPd - prevPd) / DAY_MS;
      movements.push(diffDays);
      
      // Track movement by bulletin month (0 = Jan, 11 = Dec) to capture fiscal year seasonality
      const currMonth = new Date(curr.bulletin_date).getUTCMonth();
      monthlyMovements[currMonth].push(diffDays);
    }
  }

  // Calculate the recent momentum (moving average of the last 6 valid movements)
  const recentMoves = movements.slice(-6);
  const recentAvg = recentMoves.length > 0 
    ? recentMoves.reduce((acc, val) => acc + val, 0) / recentMoves.length 
    : 30; // Default fallback to 1 month (30 days) of movement

  // Calculate the macro historical trend (average of ALL valid movements)
  const macroAvg = movements.length > 0
    ? movements.reduce((acc, val) => acc + val, 0) / movements.length
    : 30;

  const predictions = [];
  const lastRecord = segment.at(-1); // Modern array syntax to get last item
  
  // If the category is currently C or U, we cannot meaningfully project a date numerically
  if (lastRecord.is_current === "1" || lastRecord.is_unavailable === "1") {
      return []; 
  }

  // Calculate average wait time to determine projection length
  let totalWaitDays = 0;
  let validWaitCount = 0;
  segment.forEach(({ bulletin_date, priority_date, is_current, is_unavailable }) => {
      if (is_current !== "1" && is_unavailable !== "1") {
          const bd = new Date(bulletin_date).getTime();
          const pd = new Date(priority_date).getTime();
          if (!Number.isNaN(pd) && !Number.isNaN(bd)) {
              totalWaitDays += (bd - pd) / DAY_MS;
              validWaitCount++;
          }
      }
  });
  
  const avgWaitMonths = validWaitCount > 0 ? Math.round((totalWaitDays / validWaitCount) / 30.44) : 12;
  const targetMonthsAhead = Math.max(12, avgWaitMonths);

  const lastBulletinDate = new Date(lastRecord.bulletin_date);
  let lastPdDate = new Date(lastRecord.priority_date).getTime();

  // Generate future projections
  for (let i = 1; i <= targetMonthsAhead; i++) {
    // Advance the bulletin date by 1 month
    lastBulletinDate.setUTCMonth(lastBulletinDate.getUTCMonth() + 1);
    const newBulletinStr = lastBulletinDate.toISOString().split('T')[0];
    
    const targetMonth = lastBulletinDate.getUTCMonth();
    const targetYear = lastBulletinDate.getUTCFullYear();

    // 1. Seasonality Feature: Fiscal Quarters
    // Q1 (Oct-Dec) is fast, Q4 (Jul-Sep) is slow/flat.
    // Instead of raw historical averages (which cause erratic zigzag lines due to retrogressions),
    // we apply a smoothing multiplier to the recent momentum based on the USCIS fiscal calendar.
    let seasonMultiplier = 1.0;
    if (targetMonth >= 9 && targetMonth <= 11) {
        seasonMultiplier = 1.3; // Oct, Nov, Dec (Q1) - Quota reset, fastest movement
    } else if (targetMonth >= 0 && targetMonth <= 2) {
        seasonMultiplier = 1.0; // Jan, Feb, Mar (Q2) - Steady movement
    } else if (targetMonth >= 3 && targetMonth <= 5) {
        seasonMultiplier = 0.8; // Apr, May, Jun (Q3) - Slowing down
    } else if (targetMonth >= 6 && targetMonth <= 8) {
        seasonMultiplier = 0.3; // Jul, Aug, Sep (Q4) - Quotas exhausted, flattening out
    }

    // 2. Administrative Cycle Feature: Election Year Modifier
    // Presidential election years (e.g., 2024, 2028) and transitions often slow down processing
    let electionMultiplier = 1.0;
    if (targetYear % 4 === 0) {
        electionMultiplier = 0.85; // Election year slowdown (15% penalty)
    } else if (targetYear % 4 === 1) {
        electionMultiplier = 0.90; // Post-election transition slowdown (10% penalty)
    }

    // Calculate Economy Multiplier based on historical correlation findings
    // EB-2 India has strong correlation: High QQQ = Slower movement; High Unemployment = Faster movement
    let economyMultiplier = 1.0;
    if (externalFactors) {
        let qqqImpact = 1.0 - (externalFactors.qqq_yoy_pct / 100.0) * 0.4; // 40% scaling
        let unempImpact = 1.0 + (externalFactors.unemployment_yoy_diff * 0.1); // 10% scaling per 1% unemp diff
        
        qqqImpact = Math.max(0.6, Math.min(1.4, qqqImpact));
        unempImpact = Math.max(0.8, Math.min(1.2, unempImpact));
        
        if (country === 'India') {
            economyMultiplier = qqqImpact * unempImpact;
        } else {
            // For China/Others, dampen the effect significantly due to weak correlation
            economyMultiplier = 1.0 + ((qqqImpact * unempImpact - 1.0) * 0.25);
        }
    }

    // 3. Blending (Mean Reversion)
    // We smoothly transition from short-term momentum to the macro trend.
    // In Month 1, we rely heavily on recent momentum (e.g. 90% recent, 10% macro).
    // By Month 12, we transition to mostly macro trend (e.g. 10% recent, 90% macro).
    const blendFactor = Math.max(0.1, 1.0 - (i / 12) * 0.9);
    
    // Apply Economy Multiplier ONLY to the long-term Macro trend, as short-term is just administrative momentum
    const adjustedMacroAvg = Math.max(macroAvg, 0) * economyMultiplier;
    const blendedBase = (Math.max(recentAvg, 0) * blendFactor) + (adjustedMacroAvg * (1 - blendFactor));

    const blendedDays = blendedBase * seasonMultiplier * electionMultiplier;

    // Calculate new priority date timestamp
    lastPdDate += blendedDays * DAY_MS;
    
    predictions.push({
      bulletin_date: newBulletinStr,
      priority_date: lastPdDate,
      table_type: tableType,
      category,
      country,
      is_projected: true
    });
  }

  return predictions;
};
