-- category_timeline.sql
-- Full historical timeline for a single category/country combination.
--
-- Shows every bulletin date with the priority date, current status, and unavailable flag.
-- Default: EB2 China Final Action. Modify the WHERE clause for other combinations.
--
-- Available categories: 1st, 2nd, 3rd, Other Workers, 4th, Certain Religious Workers,
--   5th Unreserved, 5th Regional Center (I5 and R5), 5th Non-Regional Center (C5 and T5),
--   5th Rural/High Unemployment/Infrastructure
-- Available countries: All_Chargeability_Areas, China, India, Mexico, Philippines
-- Table types: Final_Action, Dates_for_Filing
--
-- Usage: sqlite3 visa_bulletin.db < queries/category_timeline.sql

.headers on
.mode column

SELECT
    bulletin_date,
    CASE
        WHEN is_current     = 1 THEN 'C (current)'
        WHEN is_unavailable = 1 THEN 'U (unavail)'
        ELSE priority_date
    END AS priority_date,
    is_current,
    is_unavailable
FROM visa_bulletin
WHERE table_type = 'Final_Action'   -- Change to 'Dates_for_Filing' for Table B
  AND category   = '2nd'            -- e.g. '1st', '3rd', 'Other Workers'
  AND country    = 'China'          -- e.g. 'India', 'All_Chargeability_Areas'
ORDER BY bulletin_date;
