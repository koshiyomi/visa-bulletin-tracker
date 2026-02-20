-- retrogression.sql
-- All retrogression events across every category/country combination.
--
-- Excludes sentinel values (±9999) so only real date-to-date retrogressions appear.
-- Negative days_moved means the priority date moved backward (got worse).
--
-- Usage: sqlite3 visa_bulletin.db < queries/retrogression.sql

.headers on
.mode column

SELECT
    current_month,
    table_type,
    category,
    country,
    prev_priority_date  AS prev_date,
    curr_priority_date  AS curr_date,
    days_moved          AS retrogression_days
FROM v_retrogression
WHERE days_moved != -9999
ORDER BY current_month DESC, table_type, category, country;
