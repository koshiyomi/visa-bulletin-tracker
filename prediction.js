// prediction.js

/**
 * Predicts the future priority dates based on a moving average of recent movements.
 * 
 * @param {Array} history - Array of objects from the CSV (must be sorted by bulletin_date ascending)
 * @param {String} tableType - e.g., 'Final_Action' or 'Dates_for_Filing'
 * @param {String} category - e.g., '2nd'
 * @param {String} country - e.g., 'China'
 * @param {Number} monthsAhead - How many months to predict into the future
 * @param {Object} externalFactors - TBD: placeholder for news or other external inputs
 * @returns {Array} Array of predicted { bulletin_date: 'YYYY-MM-DD', priority_date: timestamp }
 */
window.predictFutureCutoff = function(history, tableType, category, country, monthsAhead = 12, externalFactors = null) {
  // Filter for specific segment
  const segment = history.filter(d => 
    d.table_type === tableType && 
    d.category === category && 
    d.country === country
  );

  if (segment.length < 2) return [];

  // Parse dates and calculate movements
  const DAY_MS = 86400000;
  const movements = [];
  
  for (let i = 1; i < segment.length; i++) {
    const prev = segment[i - 1];
    const curr = segment[i];
    
    // Skip if unavailable or current
    if (curr.is_unavailable == "1" || prev.is_unavailable == "1" || curr.is_current == "1" || prev.is_current == "1") {
      continue;
    }

    const prevPd = new Date(prev.priority_date).getTime();
    const currPd = new Date(curr.priority_date).getTime();
    
    if (!isNaN(prevPd) && !isNaN(currPd)) {
      movements.push((currPd - prevPd) / DAY_MS);
    }
  }

  // Calculate moving average of the last 6 valid movements
  const recentMoves = movements.slice(-6);
  const avgMovementDays = recentMoves.length > 0 
    ? recentMoves.reduce((a, b) => a + b, 0) / recentMoves.length 
    : 30; // Default to 30 days per month if no data

  // Generate predictions
  const predictions = [];
  let lastRecord = segment[segment.length - 1];
  
  if (lastRecord.is_current == "1" || lastRecord.is_unavailable == "1") {
      return []; // Hard to predict if currently C or U
  }

  let lastBulletinDate = new Date(lastRecord.bulletin_date);
  let lastPdDate = new Date(lastRecord.priority_date).getTime();

  for (let i = 1; i <= monthsAhead; i++) {
    // Increment bulletin date by 1 month
    lastBulletinDate.setUTCMonth(lastBulletinDate.getUTCMonth() + 1);
    const newBulletinStr = lastBulletinDate.toISOString().split('T')[0];

    // Increment priority date by average movement
    // TBD: Use externalFactors here to adjust avgMovementDays based on news
    if (externalFactors && externalFactors.boost) {
        lastPdDate += (avgMovementDays * externalFactors.boost) * DAY_MS;
    } else {
        lastPdDate += avgMovementDays * DAY_MS;
    }
    
    predictions.push({
      bulletin_date: newBulletinStr,
      priority_date: lastPdDate,
      table_type: tableType,
      category: category,
      country: country,
      is_projected: true
    });
  }

  return predictions;
};
