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
  
  // Find the last valid record (not U or C) to serve as our anchor
  let lastRecord = null;
  for (let i = segment.length - 1; i >= 0; i--) {
      if (segment[i].is_current !== "1" && segment[i].is_unavailable !== "1") {
          lastRecord = segment[i];
          break;
      }
  }
  
  if (!lastRecord) return []; // If there are literally no valid records in history
  
  // Calculate Arbitrage Multiplier for China (EB-1, EB-2, EB-3)
  let arbitrageMultiplier = 1.0;
  if (country === 'China' && (category === '1st' || category === '2nd' || category === '3rd')) {
      const anchorDate = lastRecord.bulletin_date;
      const eb1Seg = history.find(d => d.table_type === tableType && d.category === '1st' && d.normalized_country === country && d.bulletin_date === anchorDate);
      const eb2Seg = history.find(d => d.table_type === tableType && d.category === '2nd' && d.normalized_country === country && d.bulletin_date === anchorDate);
      const eb3Seg = history.find(d => d.table_type === tableType && d.category === '3rd' && d.normalized_country === country && d.bulletin_date === anchorDate);
      
      const bullDate = new Date(anchorDate).getTime();
      
      const getWaitDays = (seg) => {
          if (!seg || seg.is_unavailable === "1" || seg.is_current === "1") return 0;
          const pdTime = new Date(seg.priority_date).getTime();
          if (Number.isNaN(pdTime)) return 0;
          return (bullDate - pdTime) / DAY_MS;
      };

      const eb1WaitDays = getWaitDays(eb1Seg);
      const eb2WaitDays = getWaitDays(eb2Seg);
      const eb3WaitDays = getWaitDays(eb3Seg);
      
      const eb1_eb2_spread = (eb1WaitDays - eb2WaitDays) / 365.25;
      const eb2_eb3_spread = (eb2WaitDays - eb3WaitDays) / 365.25;
      
      // Upgrades to EB-1 are low volume, so weight is small.
      // Downgrades to EB-3 are high volume, so weight is larger.
      if (category === '1st') {
          arbitrageMultiplier = 1.0 + (eb1_eb2_spread * 0.10);
      } else if (category === '2nd') {
          arbitrageMultiplier = 1.0 + (eb2_eb3_spread * 0.40) - (eb1_eb2_spread * 0.10);
      } else if (category === '3rd') {
          arbitrageMultiplier = 1.0 - (eb2_eb3_spread * 0.40);
      }
      
      if (Number.isNaN(arbitrageMultiplier)) arbitrageMultiplier = 1.0;
      arbitrageMultiplier = Math.max(0.3, Math.min(2.5, arbitrageMultiplier));
      
      // Calculate target catch-up days to prevent infinite crossover
      // If we are artificially boosting speed, we should only boost until the backlog is cleared.
      window.initialSpreadDays = {
          '1st': Math.max(0, eb1WaitDays - eb2WaitDays),
          '2nd': Math.max(0, eb2WaitDays - eb3WaitDays), // Assume EB-2 is catching up to EB-3
          '3rd': 0 // EB-3 doesn't usually catch up to EB-2, it gets dragged down
      }[category] || 0;
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
  let accumulatedExtraDays = 0;

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
    
    // 3. Economy / Macro factors (especially for India)
    let economyMultiplier = 1.0;
    if (externalFactors && typeof externalFactors.qqq_yoy_pct === 'number' && !Number.isNaN(externalFactors.qqq_yoy_pct)) {
        // High QQQ = tech hiring boom = more PERM/H1B = slower movement.
        // Low QQQ = tech layoffs = fewer applicants = faster movement.
        let qqqImpact = 1.0 - (externalFactors.qqq_yoy_pct / 100.0) * 0.4;
        let unempImpact = 1.0 + ((externalFactors.unemployment_yoy_diff || 0) * 0.1);
        
        qqqImpact = Math.max(0.6, Math.min(1.4, qqqImpact));
        unempImpact = Math.max(0.8, Math.min(1.2, unempImpact));
        
        if (country === 'India') {
            economyMultiplier = qqqImpact * unempImpact;
        } else {
            economyMultiplier = 1.0 + ((qqqImpact * unempImpact - 1.0) * 0.25); // Minor effect on ROW/China
            economyMultiplier = 1.0 + ((qqqImpact * unempImpact - 1.0) * 0.25);
        }
    }

    // 4. Blending (Mean Reversion)
    const blendFactor = Math.max(0.1, 1.0 - (i / 12) * 0.9);
    
    // Use the adjusted arbitrage multiplier directly (no hard clamping)
    // The adjusted weights prevent it from exploding to 1.8+
    let currentArbitrage = arbitrageMultiplier;

    // Apply Arbitrage multiplier
    const adjustedMacroAvg = macroAvg * currentArbitrage;
    
    // If arbitrage is strongly positive (>1.05 for China/ROW), prevent recentAvg from trapping us at 0
    let baseRecent = recentAvg;
    if (currentArbitrage > 1.05 && recentAvg < macroAvg * 0.5) {
        baseRecent = macroAvg * 0.5; // Pent-up demand breaks the zero-momentum trap
    }
    const adjustedRecentAvg = baseRecent * currentArbitrage;
    
    const blendedBase = (adjustedRecentAvg * blendFactor) + (adjustedMacroAvg * (1 - blendFactor));

    const blendedDays = blendedBase * seasonMultiplier * electionMultiplier * economyMultiplier;

    // Apply external factor boost if provided (for future API expansion)
    const boostMultiplier = externalFactors?.boost ?? 1;
    
    lastPdDate += (blendedDays * boostMultiplier) * DAY_MS;
    
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
