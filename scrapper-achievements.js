/**
 * This function is evaluated inside the game's page context via puppeteer's page.evaluate()
 */
module.exports = async function () {
    const socketService = injector.get('socketService')
    const routeProvider = injector.get('routeProvider')
    const RANKING_QUERY_COUNT = 25
    
    const playerIds = new Set()
    const tribeIds = new Set()
    const playersAchievements = new Map()
    const tribesAchievements = new Map()

    const sleep = function (ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, typeof ms === 'number' ? ms : 1000)
        })
    }

    const loadTribes = function (offset) {
        return new Promise(function (resolve) {
            socketService.emit(routeProvider.RANKING_TRIBE, {
                area_type: 'world',
                offset: offset,
                count: RANKING_QUERY_COUNT,
                order_by: 'rank',
                order_dir: 0,
                query: ''
            }, function (data) {
                for (let tribe of data.ranking) {
                    tribeIds.add(tribe.tribe_id)
                }

                resolve(data.total)
            })
        })
    }

    const processTribes = async function () {
        let offset = 0

        const total = await loadTribes(offset)
        offset += RANKING_QUERY_COUNT

        if (total <= RANKING_QUERY_COUNT) {
            return
        }

        for (; offset < total; offset += RANKING_QUERY_COUNT * 4) {
            await Promise.all([
                loadTribes(offset),
                loadTribes(offset + RANKING_QUERY_COUNT),
                loadTribes(offset + (RANKING_QUERY_COUNT * 2)),
                loadTribes(offset + (RANKING_QUERY_COUNT * 3)),
            ])

            await sleep(150)
        }
    }

    const loadPlayers = function (offset) {
        return new Promise(function (resolve) {
            socketService.emit(routeProvider.RANKING_CHARACTER, {
                area_type: 'world',
                offset: offset,
                count: RANKING_QUERY_COUNT,
                order_by: 'rank',
                order_dir: 0,
                query: ''
            }, function (data) {
                for (let player of data.ranking) {
                    playerIds.add(player.character_id)
                }

                resolve(data.total)
            })
        })
    }

    const processPlayers = async function () {
        let offset = 0

        const total = await loadPlayers(offset)
        offset += RANKING_QUERY_COUNT

        if (total <= RANKING_QUERY_COUNT) {
            return
        }

        for (; offset < total; offset += RANKING_QUERY_COUNT * 4) {
            await Promise.all([
                loadPlayers(offset),
                loadPlayers(offset + RANKING_QUERY_COUNT),
                loadPlayers(offset + (RANKING_QUERY_COUNT * 2)),
                loadPlayers(offset + (RANKING_QUERY_COUNT * 3)),
            ])

            await sleep(150)
        }
    }

    const loadTribesAchievements = async function () {
        const tribeIdsArray = Array.from(tribeIds.values())

        for (let i = 0, l = tribeIdsArray.length; i < l; i += 4) {
            await Promise.all([
                loadTribeAchievements(tribeIdsArray[i]),
                loadTribeAchievements(tribeIdsArray[i + 1]),
                loadTribeAchievements(tribeIdsArray[i + 2]),
                loadTribeAchievements(tribeIdsArray[i + 3])
            ])
        }
    }

    const loadTribeAchievements = function (tribe_id) {
        return new Promise(function (resolve) {
            if (!tribe_id) {
                return resolve()
            }

            socketService.emit(routeProvider.ACHIEVEMENT_GET_TRIBE_ACHIEVEMENTS, {
                tribe_id
            }, function ({achievements}) {
                tribesAchievements.set(tribe_id, achievements)
                resolve()
            })
        })
    }

    const loadPlayersAchievements = async function () {
        const playerIdsArray = Array.from(playerIds.values())

        for (let i = 0, l = playerIdsArray.length; i < l; i += 4) {
            await Promise.all([
                loadPlayerAchievements(playerIdsArray[i]),
                loadPlayerAchievements(playerIdsArray[i + 1]),
                loadPlayerAchievements(playerIdsArray[i + 2]),
                loadPlayerAchievements(playerIdsArray[i + 3])
            ])
        }
    }

    const loadPlayerAchievements = function (character_id) {
        return new Promise(function (resolve) {
            if (!character_id) {
                return resolve()
            }

            socketService.emit(routeProvider.ACHIEVEMENT_GET_CHAR_ACHIEVEMENTS, {
                character_id
            }, function ({achievements}) {
                playersAchievements.set(character_id, achievements)
                resolve()
            })
        })
    }

    const time = async function (name, handler) {
        const start = Date.now()
        await handler()
        const end = Date.now()
        const seconds = Math.round(((end - start) / 1000) * 10) / 10
        console.log('Scrapper:', name, 'in', seconds + 's')
    }

    await time('loaded tribes', async function () {
        await processTribes()
    })

    await time('loaded players', async function () {
        await processPlayers()
    })

    await time('loaded tribe achievements', async function () {
        await loadTribesAchievements()
    })

    await time('loaded player achievements', async function () {
        await loadPlayersAchievements()
    })

    return {
        playersAchievements: Array.from(playersAchievements),
        tribesAchievements: Array.from(tribesAchievements)
    }
}