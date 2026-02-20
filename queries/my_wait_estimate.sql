-- my_wait_estimate.sql
-- Personal wait time estimate based on your priority date.
--
-- STEP 1: Insert your info into user_tracking (run once, then comment out):
--
--   INSERT INTO user_tracking (label, category, country, priority_date)
--   VALUES ('Example EB-2', '2nd', 'China', '2022-01-15');
--
-- STEP 2: Run this file to see your status against the latest bulletin:
--
--   sqlite3 visa_bulletin.db < queries/my_wait_estimate.sql
--
-- You can track multiple cases by inserting additional rows with different labels.
-- To remove a case:  DELETE FROM user_tracking WHERE label = 'Example EB-2';
-- To update a date:  UPDATE user_tracking SET priority_date = '2022-06-01' WHERE label = 'Example EB-2';

.headers on
.mode column

SELECT
    label,
    category,
    country,
    my_priority_date,
    table_type,
    current_cutoff,
    bulletin_date,
    status
FROM v_my_wait
ORDER BY label, table_type;
