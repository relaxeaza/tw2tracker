SELECT
    id,
    name,
    tag,
    points,
    victory_points,
    members,
    rank,
    villages
FROM ${worldId:name}.tribes
WHERE archived = false
ORDER BY tribes.${tribeRankingSortField:name} ${tribeRankingSortOrder:raw}
LIMIT ${limit}
