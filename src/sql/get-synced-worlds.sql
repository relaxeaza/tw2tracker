SELECT * FROM public.worlds
WHERE last_data_sync_date IS NOT NULL
ORDER BY market_id, world_number
