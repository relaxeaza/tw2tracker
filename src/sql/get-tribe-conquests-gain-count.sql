SELECT COUNT(*)::int
FROM ${worldId:name}.conquests
WHERE new_owner_tribe_id = ${tribeId}
AND old_owner_tribe_id != ${tribeId}