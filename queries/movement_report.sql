-- movement_report.sql
-- Monthly movement report for EB2 China (Final Action) — last 24 months
--
-- Shows how much the priority date moved each month with a human-readable summary.
-- Sentinel values: 9999 = became current, -9999 = left current status.
--
-- Usage: sqlite3 visa_bulletin.db < queries/movement_report.sql

.headers on
.mode column

SELECT
    current_month                       AS month,
    COALESCE(prev_priority_date, '—')   AS prev_date,
    COALESCE(curr_priority_date, '—')   AS curr_date,
    CASE
        WHEN days_moved =  9999 THEN 'BECAME CURRENT'
        WHEN days_moved = -9999 THEN 'LEFT CURRENT'
        WHEN days_moved >  0    THEN '+' || days_moved || ' days'
        WHEN days_moved <  0    THEN days_moved || ' days'
        WHEN days_moved =  0    THEN 'No change'
        ELSE 'N/A'
    END                                 AS movement
FROM v_movement
WHERE table_type = 'Final_Action'
  AND category   = '2nd'
  AND country    = 'China'
ORDER BY current_month DESC
LIMIT 24;
