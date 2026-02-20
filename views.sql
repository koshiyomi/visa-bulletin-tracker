-- views.sql — Analysis views for visa_bulletin.db
-- Idempotent: safe to re-run (DROP VIEW IF EXISTS before each CREATE).

-- ============================================================
-- 1. user_tracking table — personal priority-date watchlist
-- ============================================================
CREATE TABLE IF NOT EXISTS user_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    country TEXT NOT NULL,
    priority_date TEXT NOT NULL
);

-- ============================================================
-- 2. v_latest — most recent bulletin snapshot
-- ============================================================
DROP VIEW IF EXISTS v_latest;
CREATE VIEW v_latest AS
SELECT *
FROM visa_bulletin
WHERE bulletin_date = (SELECT MAX(bulletin_date) FROM visa_bulletin);

-- ============================================================
-- 3. v_movement — month-over-month priority date changes
-- ============================================================
-- Self-join: curr row matched to prev row one month earlier.
-- days_moved semantics:
--   Both valid dates       → julianday(curr) - julianday(prev)
--   Was date, now current  → 9999   (became current)
--   Was current, now date  → -9999  (retrogressed from current)
--   Both current           → 0
--   Otherwise (UNAVAIL)    → NULL
-- Rows where either side is UNAVAILABLE are excluded entirely.
-- ============================================================
DROP VIEW IF EXISTS v_movement;
CREATE VIEW v_movement AS
SELECT
    curr.bulletin_date  AS current_month,
    prev.bulletin_date  AS previous_month,
    curr.table_type,
    curr.category,
    curr.country,
    prev.priority_date  AS prev_priority_date,
    curr.priority_date  AS curr_priority_date,
    prev.is_current     AS prev_is_current,
    curr.is_current     AS curr_is_current,
    CASE
        -- Both have real ISO dates (neither current nor unavailable)
        WHEN curr.is_current = 0 AND prev.is_current = 0
         AND curr.is_unavailable = 0 AND prev.is_unavailable = 0
            THEN CAST(julianday(curr.priority_date) - julianday(prev.priority_date) AS INTEGER)
        -- Was a date, now became current → big positive
        WHEN prev.is_current = 0 AND curr.is_current = 1
            THEN 9999
        -- Was current, now has a date → retrogressed from current
        WHEN prev.is_current = 1 AND curr.is_current = 0
            THEN -9999
        -- Both current → no change
        WHEN prev.is_current = 1 AND curr.is_current = 1
            THEN 0
        ELSE NULL
    END AS days_moved
FROM visa_bulletin AS curr
JOIN visa_bulletin AS prev
    ON  prev.bulletin_date = date(curr.bulletin_date, '-1 month')
    AND prev.table_type    = curr.table_type
    AND prev.category      = curr.category
    AND prev.country       = curr.country
WHERE curr.is_unavailable = 0
  AND prev.is_unavailable = 0;

-- ============================================================
-- 4. v_retrogression — months with backward movement
-- ============================================================
DROP VIEW IF EXISTS v_retrogression;
CREATE VIEW v_retrogression AS
SELECT * FROM v_movement WHERE days_moved < 0;

-- ============================================================
-- 5. v_my_wait — personal wait-time dashboard
-- ============================================================
-- Joins user_tracking with the latest bulletin data.
-- status logic:
--   Cutoff is CURRENT              → 'CURRENT - eligible now'
--   User date <= cutoff            → 'CURRENT - your date is before cutoff'
--   User date > cutoff             → 'N days behind cutoff'
--   Otherwise                      → 'Unknown'
-- ============================================================
DROP VIEW IF EXISTS v_my_wait;
CREATE VIEW v_my_wait AS
SELECT
    ut.label,
    ut.category,
    ut.country,
    ut.priority_date        AS my_priority_date,
    vl.priority_date        AS current_cutoff,
    vl.table_type,
    vl.bulletin_date,
    CASE
        WHEN vl.is_current = 1
            THEN 'CURRENT - eligible now'
        WHEN vl.is_current = 0 AND vl.is_unavailable = 0
         AND ut.priority_date <= vl.priority_date
            THEN 'CURRENT - your date is before cutoff'
        WHEN vl.is_current = 0 AND vl.is_unavailable = 0
         AND ut.priority_date > vl.priority_date
            THEN CAST(julianday(ut.priority_date) - julianday(vl.priority_date) AS INTEGER)
                 || ' days behind cutoff'
        ELSE 'Unknown'
    END AS status
FROM user_tracking AS ut
JOIN v_latest AS vl
    ON  vl.category = ut.category
    AND vl.country  = ut.country;

-- ============================================================
-- 6. v_yearly_summary — avg movement per category/country/year
-- ============================================================
-- Excludes ±9999 sentinel values from the average.
-- Counts retrogression months (< 0, excl -9999) and
-- advancement months (> 0, excl 9999) separately.
-- ============================================================
DROP VIEW IF EXISTS v_yearly_summary;
CREATE VIEW v_yearly_summary AS
SELECT
    SUBSTR(current_month, 1, 4)  AS year,
    table_type,
    category,
    country,
    ROUND(AVG(CASE WHEN days_moved NOT IN (9999, -9999) THEN days_moved END), 1)
        AS avg_days_moved,
    SUM(CASE WHEN days_moved < 0 AND days_moved != -9999 THEN 1 ELSE 0 END)
        AS retrogression_months,
    SUM(CASE WHEN days_moved > 0 AND days_moved != 9999  THEN 1 ELSE 0 END)
        AS advancement_months
FROM v_movement
GROUP BY SUBSTR(current_month, 1, 4), table_type, category, country;
