UPDATE ${worldId:name}.tribes
SET best_points = ${points},
    best_points_date = TIMEZONE('UTC', NOW())
WHERE id = ${tribe_id}
