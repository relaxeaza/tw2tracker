const createError = require('http-errors');
const config = require('../config.js');
const {db, sql} = require('../db.js');
const i18n = require('../i18n.js');

const {
    paramWorld,
    paramWorldParse,
    paramMarket,
    groupAchievements,
    createNavigation,
    mergeBackendLocals,
    parseRankingSort
} = require('../router-helpers.js');

const rankingsRouter = require('./stats-rankings.js');
const searchRouter = require('./stats-search.js');
const villagesRouter = require('./stats-villages.js');
const playersRouter = require('./stats-players.js');
const tribesRouter = require('./stats-tribes.js');
const conquestsRouter = require('./stats-conquests.js');

const marketsRouter = async function (request, reply) {
    const worlds = await db.any(sql('get-worlds'));
    const openWorlds = worlds.filter(world => world.open);
    const marketsIds = Array.from(new Set(worlds.map(world => world.market_id)));
    const worldsByMarket = {};

    for (const world of worlds) {
        worldsByMarket[world.market_id] = worldsByMarket[world.market_id] || {closed: [], open: []};

        if (world.open) {
            worldsByMarket[world.market_id].open.push([world.world_number, world]);
        } else {
            worldsByMarket[world.market_id].closed.push([world.world_number, world]);
        }
    }

    const marketStats = marketsIds.map(function (id) {
        return {
            id,
            players: openWorlds.reduce((base, next) => next.market_id === id ? base + next.player_count : base, 0),
            tribes: openWorlds.reduce((base, next) => next.market_id === id ? base + next.tribe_count : base, 0),
            villages: openWorlds.reduce((base, next) => next.market_id === id ? base + next.village_count : base, 0),
            openWorld: worlds.filter((world) => world.market_id === id && world.open).length,
            closedWorld: worlds.filter((world) => world.market_id === id && !world.open).length
        };
    });

    mergeBackendLocals(reply, {
        worldsByMarket,
        marketStats
    });

    reply.code(200).view('stats.ejs', {
        page: 'stats/market-list',
        title: i18n('stats_servers', 'page_titles', reply.locals.lang, [config('general', 'site_name')]),
        pageType: 'stats',
        marketStats,
        worldsByMarket,
        navigation: createNavigation([
            {label: i18n('stats', 'navigation', reply.locals.lang), url: '/'},
            {label: i18n('servers', 'navigation', reply.locals.lang)}
        ])
    });
};

const worldRouter = async function (request, reply, done) {
    if (!paramWorld(request)) {
        return done();
    }

    const {
        marketId,
        worldId,
        worldNumber
    } = await paramWorldParse(request);

    const world = await db.one(sql('get-world'), {worldId});

    const {
        playerRankingSortField,
        playerRankingSortOrder,
        tribeRankingSortField,
        tribeRankingSortOrder
    } = parseRankingSort(request, world.config.victory_points);

    const [
        players,
        tribes,
        lastConquests,
        lastDailyPlayerAchievements,
        lastWeeklyPlayerAchievements,
        lastDailyTribeAchievements,
        lastWeeklyTribeAchievements
    ] = await Promise.all([
        db.any(sql('get-world-top-players'), {worldId, limit: config('ui', 'world_page_maximum_ranking_items'), playerRankingSortField, playerRankingSortOrder}),
        db.any(sql('get-world-top-tribes'), {worldId, limit: config('ui', 'world_page_maximum_ranking_items'), tribeRankingSortField, tribeRankingSortOrder}),
        db.any(sql('get-world-last-conquests'), {worldId, limit: config('ui', 'world_page_maximum_last_conquests')}),
        db.any(sql('get-world-last-player-repeatable-achievements'), {worldId, period: '%-%-%'}),
        db.any(sql('get-world-last-player-repeatable-achievements'), {worldId, period: '%-W%'}),
        db.any(sql('get-world-last-tribe-repeatable-achievements'), {worldId, period: '%-%-%'}),
        db.any(sql('get-world-last-tribe-repeatable-achievements'), {worldId, period: '%-W%'})
    ]);

    if (!world.config.victory_points) {
        const topTenVillages = tribes.reduce((villages, tribe) => villages + tribe.villages, 0);

        for (const tribe of tribes) {
            tribe.domination = parseFloat((tribe.villages / topTenVillages * 100).toFixed(1));
        }
    }

    const achievements = {
        counts: {
            players: {
                daily: lastDailyPlayerAchievements.length,
                weekly: lastWeeklyPlayerAchievements.length
            },
            tribes: {
                daily: lastDailyTribeAchievements.length,
                weekly: lastWeeklyTribeAchievements.length
            }
        },
        groups: {
            players: {
                daily: groupAchievements(lastDailyPlayerAchievements),
                weekly: groupAchievements(lastWeeklyPlayerAchievements)
            },
            tribes: {
                daily: groupAchievements(lastDailyTribeAchievements),
                weekly: groupAchievements(lastWeeklyTribeAchievements)
            }
        }
    };

    mergeBackendLocals(reply, {
        marketId,
        worldNumber,
        players,
        tribes,
        mapHighlights: tribes.slice(0, 3),
        mapHighlightsType: 'tribes'
    });

    reply.view('stats.ejs', {
        page: 'stats/world',
        title: i18n('stats_world', 'page_titles', reply.locals.lang, [marketId.toUpperCase(), world.name, config('general', 'site_name')]),
        marketId,
        worldNumber,
        players,
        tribes,
        world,
        lastConquests,
        achievements,
        playerRankingSortField,
        tribeRankingSortField,
        navigation: createNavigation([
            {label: i18n('stats', 'navigation', reply.locals.lang), url: '/'},
            {label: i18n('server', 'navigation', reply.locals.lang), url: `/stats/${marketId}`, replaces: [marketId.toUpperCase()]},
            {label: i18n(world.open ? 'world' : 'world_closed', 'navigation', reply.locals.lang), url: `/stats/${marketId}/${world.world_number}`, replaces: [world.name]}
        ])
    });
};

const worldsRouter = async function (request, reply, done) {
    if (!paramMarket(request)) {
        return done();
    }

    const marketId = request.params.marketId;
    const syncedWorlds = await db.any(sql('get-synced-worlds'));
    const marketWorlds = syncedWorlds.filter((world) => world.market_id === marketId);

    if (!marketWorlds.length) {
        throw createError(404, i18n('missing_world', 'errors', reply.locals.lang));
    }

    const worlds = {
        open: [],
        closed: []
    };

    for (const world of marketWorlds) {
        if (world.open) {
            worlds.open.push(world);
        } else {
            worlds.closed.push(world);
        }
    }

    const marketStats = {
        players: marketWorlds.reduce((sum, world) => sum + world.player_count, 0),
        tribes: marketWorlds.reduce((sum, world) => sum + world.tribe_count, 0),
        villages: marketWorlds.reduce((sum, world) => sum + world.village_count, 0),
        openWorlds: worlds.open.length,
        closedWorlds: worlds.closed.length
    };

    mergeBackendLocals(reply, {
        marketId
    });

    reply.view('stats.ejs', {
        page: 'stats/world-list',
        title: i18n('stats_worlds', 'page_titles', reply.locals.lang, [marketId.toUpperCase(), config('general', 'site_name')]),
        marketId,
        worlds,
        marketStats,
        pageType: 'stats',
        navigation: createNavigation([
            {label: i18n('stats', 'navigation', reply.locals.lang), url: '/'},
            {label: i18n('server', 'navigation', reply.locals.lang), url: `/stats/${marketId}`, replaces: [marketId.toUpperCase()]},
            {label: i18n('worlds', 'navigation', reply.locals.lang)}
        ])
    });
};

module.exports = function (fastify, opts, done) {
    fastify.get('/', marketsRouter);
    fastify.get('/stats/', async (request, reply) => reply.redirect('/'));
    fastify.get('/stats/:marketId', worldsRouter);
    fastify.get('/stats/:marketId/:worldNumber', worldRouter);
    fastify.register(rankingsRouter);
    fastify.register(searchRouter);
    fastify.register(villagesRouter);
    fastify.register(playersRouter);
    fastify.register(tribesRouter);
    fastify.register(conquestsRouter);
    done();
};
