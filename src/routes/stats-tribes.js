const express = require('express');
const router = express.Router();
const utils = require('../utils.js');
const timeUtils = require('../time-utils.js');
const conquestTypes = require('../types/conquest.js');
const memberChangeTypes = require('../types/member-change.js');
const historyOrderTypes = require('../types/history-order.js');
const createError = require('http-errors');
const {db, sql} = require('../db.js');
const config = require('../config.js');
const i18n = require('../i18n.js');
const {calcHistoryChanges} = require('../history-utils.js');
const {processTribeConquestTypes} = require('../conquest-utils.js');

const tribeFieldsOrder = [
    ['members', historyOrderTypes.ASC],
    ['points', historyOrderTypes.ASC],
    ['villages', historyOrderTypes.ASC],
    ['rank', historyOrderTypes.DESC],
    ['victory_points', historyOrderTypes.ASC],
    ['bash_points_off', historyOrderTypes.ASC],
    ['bash_points_def', historyOrderTypes.ASC],
    ['bash_points_total', historyOrderTypes.ASC]
];

const tribeShortFieldsOrder = [
    ['members', historyOrderTypes.ASC],
    ['points', historyOrderTypes.ASC],
    ['villages', historyOrderTypes.ASC],
    ['rank', historyOrderTypes.DESC],
    ['victory_points', historyOrderTypes.ASC]
];

const {
    paramWorld,
    paramWorldParse,
    paramTribeParse,
    createPagination,
    createNavigation,
    mergeBackendLocals,
    asyncRouter
} = require('../router-helpers.js');

const conquestCategories = ['gain', 'loss', 'all', 'self'];

const tribeRouter = asyncRouter(async function (req, res, next) {
    if (!paramWorld(req)) {
        return next();
    }

    const {
        marketId,
        worldId,
        worldNumber
    } = await paramWorldParse(req);

    const {
        tribeId,
        tribe
    } = await paramTribeParse(req, worldId);

    const market = await db.one(sql('get-market'), {marketId});
    const world = await db.one(sql('get-world'), {worldId});

    const conquestLimit = config('ui', 'profile_last_conquest_count');
    const conquestsRaw = await db.any(sql('get-tribe-conquests'), {worldId, tribeId, offset: 0, limit: conquestLimit});
    const conquests = processTribeConquestTypes(conquestsRaw, tribeId);

    const conquestCount = (await db.one(sql('get-tribe-conquests-count'), {worldId, tribeId})).count;
    const conquestGainCount = (await db.one(sql('get-tribe-conquests-gain-count'), {worldId, tribeId})).count;
    const conquestLossCount = (await db.one(sql('get-tribe-conquests-loss-count'), {worldId, tribeId})).count;
    const conquestSelfCount = (await db.one(sql('get-tribe-conquests-self-count'), {worldId, tribeId})).count;

    const achievements = await db.any(sql('get-tribe-achievements'), {worldId, id: tribeId});
    const achievementsLatest = achievements.slice(0, 5);
    const achievementsRepeatableCount = achievements.reduce((sum, {period}) => period ? sum + 1 : sum, 0);

    const historyLimit = config('ui', 'profile_last_history_count');
    const historyFullRaw = await db.any(sql('get-tribe-history'), {worldId, tribeId, limit: 30});
    const historyShortRaw = historyFullRaw.slice(0, historyLimit);
    const history = calcHistoryChanges(historyShortRaw, tribeShortFieldsOrder);
    const memberChangesCount = (await db.one(sql('get-tribe-member-changes-count'), {worldId, id: tribeId})).count;

    mergeBackendLocals(res, {
        marketId,
        worldNumber,
        tribe,
        historyFullRaw,
        mapHighlights: [tribe],
        mapHighlightsType: 'tribes'
    });

    res.render('stats', {
        page: 'stats/tribe',
        title: i18n('stats_tribe', 'page_titles', res.locals.lang, [tribe.tag, marketId.toUpperCase(), world.name, config('general', 'site_name')]),
        market,
        marketId,
        worldNumber,
        world,
        tribe,
        conquests,
        conquestCount,
        conquestGainCount,
        conquestLossCount,
        conquestSelfCount,
        conquestTypes,
        achievementsRepeatableCount,
        achievementsLatest,
        history,
        memberChangesCount,
        navigation: createNavigation([
            {label: i18n('stats', 'navigation', res.locals.lang), url: '/'},
            {label: i18n('server', 'navigation', res.locals.lang), url: `/stats/${marketId}/`, replaces: [marketId.toUpperCase()]},
            {label: i18n('world', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}`, replaces: [world.name]},
            {label: i18n('tribe', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}/tribes/${tribeId}`, replaces: [tribe.tag]}
        ])
    });
});

const tribeConquestsRouter = asyncRouter(async function (req, res, next) {
    if (!paramWorld(req)) {
        return next();
    }

    const {
        marketId,
        worldId,
        worldNumber
    } = await paramWorldParse(req);

    const {
        tribeId,
        tribe
    } = await paramTribeParse(req, worldId);

    const market = await db.one(sql('get-market'), {marketId});
    const world = await db.one(sql('get-world'), {worldId});

    const page = req.params.page && !isNaN(req.params.page) ? Math.max(1, parseInt(req.params.page, 10)) : 1;
    const limit = config('ui', 'ranking_page_items_per_page');
    const offset = limit * (page - 1);

    const conquestsTypeMap = {
        all: {
            sqlConquests: sql('get-tribe-conquests'),
            sqlCount: sql('get-tribe-conquests-count'),
            navigationTitle: i18n('sub_title_all', 'tribe_profile_achievements', res.locals.lang)
        },
        gain: {
            sqlConquests: sql('get-tribe-conquests-gain'),
            sqlCount: sql('get-tribe-conquests-gain-count'),
            navigationTitle: i18n('sub_title_gain', 'tribe_profile_achievements', res.locals.lang)
        },
        loss: {
            sqlConquests: sql('get-tribe-conquests-loss'),
            sqlCount: sql('get-tribe-conquests-loss-count'),
            navigationTitle: i18n('sub_title_loss', 'tribe_profile_achievements', res.locals.lang)
        },
        self: {
            sqlConquests: sql('get-tribe-conquests-self'),
            sqlCount: sql('get-tribe-conquests-self-count'),
            navigationTitle: i18n('sub_title_self', 'tribe_profile_achievements', res.locals.lang)
        }
    };

    const category = req.params.category ?? 'all';

    if (!conquestCategories.includes(category)) {
        throw createError(404, i18n('router_missing_sub_page', 'errors', res.locals.lang));
    }

    const conquestsRaw = await db.any(conquestsTypeMap[category].sqlConquests, {worldId, tribeId, offset, limit});
    const conquests = processTribeConquestTypes(conquestsRaw, tribeId);

    const total = (await db.one(conquestsTypeMap[category].sqlCount, {worldId, tribeId})).count;
    const navigationTitle = conquestsTypeMap[category].navigationTitle;

    mergeBackendLocals(res, {
        marketId,
        worldNumber,
        tribe,
        mapHighlights: [tribe],
        mapHighlightsType: 'tribes'
    });

    res.render('stats', {
        page: 'stats/tribe-conquests',
        title: i18n('stats_tribe_conquests', 'page_titles', res.locals.lang, [tribe.tag, marketId.toUpperCase(), world.name, config('general', 'site_name')]),
        market,
        marketId,
        worldNumber,
        world,
        tribe,
        conquests,
        conquestTypes,
        category,
        navigationTitle,
        pagination: createPagination(page, total, limit, req.path),
        navigation: createNavigation([
            {label: i18n('stats', 'navigation', res.locals.lang), url: '/'},
            {label: i18n('server', 'navigation', res.locals.lang), url: `/stats/${marketId}/`, replaces: [marketId.toUpperCase()]},
            {label: i18n('world', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}`, replaces: [world.name]},
            {label: i18n('tribe', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}/tribes/${tribeId}`, replaces: [tribe.tag]},
            {label: navigationTitle}
        ])
    });
});

const tribeMembersRouter = asyncRouter(async function (req, res, next) {
    if (!paramWorld(req)) {
        return next();
    }

    const {
        marketId,
        worldId,
        worldNumber
    } = await paramWorldParse(req);

    const {
        tribeId,
        tribe
    } = await paramTribeParse(req, worldId);

    const world = await db.one(sql('get-world'), {worldId});
    const members = await db.any(sql('get-tribe-members'), {worldId, tribeId});

    mergeBackendLocals(res, {
        marketId,
        worldNumber,
        tribe,
        mapHighlights: [tribe],
        mapHighlightsType: 'tribes'
    });

    res.render('stats', {
        page: 'stats/tribe-members',
        title: i18n('stats_tribe_members', 'page_titles', res.locals.lang, [tribe.tag, marketId.toUpperCase(), world.name, config('general', 'site_name')]),
        marketId,
        worldNumber,
        tribe,
        members,
        navigation: createNavigation([
            {label: i18n('stats', 'navigation', res.locals.lang), url: '/'},
            {label: i18n('server', 'navigation', res.locals.lang), url: `/stats/${marketId}/`, replaces: [marketId.toUpperCase()]},
            {label: i18n('world', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}`, replaces: [world.name]},
            {label: i18n('tribe', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}/tribes/${tribeId}`, replaces: [tribe.tag]},
            {label: i18n('members', 'navigation', res.locals.lang)}
        ])
    });
});

const tribeVillagesRouter = asyncRouter(async function (req, res, next) {
    if (!paramWorld(req)) {
        return next();
    }

    const {
        marketId,
        worldId,
        worldNumber
    } = await paramWorldParse(req);

    const {
        tribeId,
        tribe
    } = await paramTribeParse(req, worldId);

    const world = await db.one(sql('get-world'), {worldId});

    const page = req.params.page && !isNaN(req.params.page) ? Math.max(1, parseInt(req.params.page, 10)) : 1;
    const limit = config('ui', 'ranking_page_items_per_page');
    const offset = limit * (page - 1);
    const allVillages = await db.any(sql('get-tribe-villages'), {worldId, tribeId});
    const villages = allVillages.slice(offset, offset + limit);
    const total = allVillages.length;

    mergeBackendLocals(res, {
        marketId,
        worldNumber,
        tribe,
        mapHighlights: [tribe],
        mapHighlightsType: 'tribes'
    });

    res.render('stats', {
        page: 'stats/tribe-villages',
        title: i18n('stats_tribe_villages', 'page_titles', res.locals.lang, [tribe.tag, marketId.toUpperCase(), world.name, config('general', 'site_name')]),
        marketId,
        worldNumber,
        tribe,
        villages,
        pagination: createPagination(page, total, limit, req.path),
        navigation: createNavigation([
            {label: i18n('stats', 'navigation', res.locals.lang), url: '/'},
            {label: i18n('server', 'navigation', res.locals.lang), url: `/stats/${marketId}/`, replaces: [marketId.toUpperCase()]},
            {label: i18n('world', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}`, replaces: [world.name]},
            {label: i18n('tribe', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}/tribes/${tribeId}`, replaces: [tribe.tag]},
            {label: i18n('villages', 'navigation', res.locals.lang)}
        ])
    });
});

const tribeMembersChangeRouter = asyncRouter(async function (req, res, next) {
    if (!paramWorld(req)) {
        return next();
    }

    const {
        marketId,
        worldId,
        worldNumber
    } = await paramWorldParse(req);

    const {
        tribeId,
        tribe
    } = await paramTribeParse(req, worldId);

    const market = await db.one(sql('get-market'), {marketId});
    const world = await db.one(sql('get-world'), {worldId});

    const playersName = {};
    const memberChangesRaw = await db.any(sql('get-tribe-member-changes'), {worldId, id: tribeId});
    const memberChanges = [];

    for (const change of memberChangesRaw) {
        if (!utils.hasOwn(playersName, change.character_id)) {
            playersName[change.character_id] = (await db.one(sql('get-player'), {worldId, playerId: change.character_id})).name;
        }

        memberChanges.push({
            player: {
                id: change.character_id,
                name: playersName[change.character_id]
            },
            type: change.old_tribe === tribeId ? memberChangeTypes.LEFT : memberChangeTypes.JOIN,
            date: change.date
        });
    }

    mergeBackendLocals(res, {
        marketId,
        worldNumber
    });

    res.render('stats', {
        page: 'stats/tribe-member-changes',
        title: i18n('stats_tribe_member_changes', 'page_titles', res.locals.lang, [tribe.tag, marketId.toUpperCase(), world.name, config('general', 'site_name')]),
        market,
        marketId,
        worldNumber,
        tribe,
        world,
        memberChanges,
        memberChangeTypes,
        navigation: createNavigation([
            {label: i18n('stats', 'navigation', res.locals.lang), url: '/'},
            {label: i18n('server', 'navigation', res.locals.lang), url: `/stats/${marketId}/`, replaces: [marketId.toUpperCase()]},
            {label: i18n('world', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}`, replaces: [world.name]},
            {label: i18n('tribe', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}/tribes/${tribeId}`, replaces: [tribe.tag]},
            {label: i18n('member_changes', 'navigation', res.locals.lang)}
        ])
    });
});

const tribeAchievementsRouter = asyncRouter(async function (req, res, next) {
    if (!paramWorld(req)) {
        return next();
    }

    const {
        marketId,
        worldId,
        worldNumber
    } = await paramWorldParse(req);

    const {
        tribeId,
        tribe
    } = await paramTribeParse(req, worldId);

    const market = await db.one(sql('get-market'), {marketId});
    const world = await db.one(sql('get-world'), {worldId});

    const subCategory = req.params.subCategory;

    if (subCategory && subCategory !== 'detailed') {
        throw createError(404, i18n('router_missing_sub_page', 'errors', res.locals.lang));
    }

    const achievements = await db.any(sql('get-tribe-achievements'), {worldId, id: tribeId});
    const achievementsRepeatable = {};
    const achievementsRepeatableCategoryCount = {};
    let achievementsRepeatableGeralCount = 0;
    const achievementsRepeatableLastEarned = {};
    const achievementsRepeatableDetailed = {};

    for (const {period, type, time_last_level} of achievements) {
        if (period) {
            if (!achievementsRepeatableLastEarned[type]) {
                achievementsRepeatableLastEarned[type] = timeUtils.formatDate(time_last_level, market.time_offset, 'day-only');
            }

            achievementsRepeatable[type] = achievementsRepeatable[type] || [];
            achievementsRepeatable[type].push(timeUtils.formatDate(time_last_level, market.time_offset, 'day-only'));

            achievementsRepeatableCategoryCount[type] = achievementsRepeatableCategoryCount[type] ?? 0;
            achievementsRepeatableCategoryCount[type]++;
            achievementsRepeatableGeralCount++;

            if (subCategory === 'detailed') {
                achievementsRepeatableDetailed[type] = achievementsRepeatableDetailed[type] || [];
                achievementsRepeatableDetailed[type].push(timeUtils.formatDate(time_last_level, market.time_offset, 'day-only'));
            }
        }
    }

    mergeBackendLocals(res, {
        marketId,
        worldNumber
    });

    res.render('stats', {
        page: 'stats/tribe-achievements',
        title: i18n('stats_tribe_achievements', 'page_titles', res.locals.lang, [tribe.tag, marketId.toUpperCase(), world.name, config('general', 'site_name')]),
        marketId,
        worldNumber,
        tribe,
        achievementsRepeatable,
        achievementsRepeatableCategoryCount,
        achievementsRepeatableGeralCount,
        achievementsRepeatableLastEarned,
        achievementsRepeatableDetailed,
        subCategory,
        navigation: createNavigation([
            {label: i18n('stats', 'navigation', res.locals.lang), url: '/'},
            {label: i18n('server', 'navigation', res.locals.lang), url: `/stats/${marketId}/`, replaces: [marketId.toUpperCase()]},
            {label: i18n('world', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}`, replaces: [world.name]},
            {label: i18n('tribe', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}/tribes/${tribeId}`, replaces: [tribe.tag]},
            {label: i18n('achievements', 'navigation', res.locals.lang)}
        ])
    });
});

const tribeHistoryRouter = asyncRouter(async function (req, res, next) {
    if (!paramWorld(req)) {
        return next();
    }

    const {
        marketId,
        worldId,
        worldNumber
    } = await paramWorldParse(req);

    const {
        tribeId,
        tribe
    } = await paramTribeParse(req, worldId);

    const market = await db.one(sql('get-market'), {marketId});
    const world = await db.one(sql('get-world'), {worldId});

    const historyLimit = config('sync', 'maximum_history_days');
    const rawHistory = await db.any(sql('get-tribe-history'), {worldId, tribeId, limit: historyLimit});
    const history = calcHistoryChanges(rawHistory, tribeFieldsOrder);

    mergeBackendLocals(res, {
        marketId,
        worldNumber
    });

    res.render('stats', {
        page: 'stats/tribe-history',
        title: i18n('stats_tribe_history', 'page_titles', res.locals.lang, [tribe.tag, marketId.toUpperCase(), world.name, config('general', 'site_name')]),
        market,
        marketId,
        worldNumber,
        world,
        tribe,
        history,
        navigation: createNavigation([
            {label: i18n('stats', 'navigation', res.locals.lang), url: '/'},
            {label: i18n('server', 'navigation', res.locals.lang), url: `/stats/${marketId}/`, replaces: [marketId.toUpperCase()]},
            {label: i18n('world', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}`, replaces: [world.name]},
            {label: i18n('tribe', 'navigation', res.locals.lang), url: `/stats/${marketId}/${worldNumber}/tribes/${tribeId}`, replaces: [tribe.tag]},
            {label: i18n('history', 'navigation', res.locals.lang)}
        ])
    });
});

router.get('/stats/:marketId/:worldNumber/tribes/:tribeId', tribeRouter);
router.get('/stats/:marketId/:worldNumber/tribes/:tribeId/conquests/:category?', tribeConquestsRouter);
router.get('/stats/:marketId/:worldNumber/tribes/:tribeId/conquests/:category?/page/:page', tribeConquestsRouter);
router.get('/stats/:marketId/:worldNumber/tribes/:tribeId/members', tribeMembersRouter);
router.get('/stats/:marketId/:worldNumber/tribes/:tribeId/villages', tribeVillagesRouter);
router.get('/stats/:marketId/:worldNumber/tribes/:tribeId/villages/page/:page', tribeVillagesRouter);
router.get('/stats/:marketId/:worldNumber/tribes/:tribeId/member-changes', tribeMembersChangeRouter);
router.get('/stats/:marketId/:worldNumber/tribes/:tribeId/achievements/:subCategory?', tribeAchievementsRouter);
router.get('/stats/:marketId/:worldNumber/tribes/:tribeId/history', tribeHistoryRouter);

module.exports = router;
