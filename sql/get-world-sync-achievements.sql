SELECT
    last_achievements_sync_status AS last_sync_status,
    last_achievements_sync_date AS last_sync_date
FROM public.worlds
WHERE market = $1
AND num = $2
