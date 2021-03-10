const express = require('express');
const createError = require('http-errors');
const router = express.Router();
const {db} = require('../db.js');
const sql = require('../sql.js');
const utils = require('../utils.js');
const config = require('../config.js');
const i18n = require('../i18n.js');

const {
    paramWorld,
    paramWorldParse,
    createPagination,
    createNavigation,
    mergeBackendLocals,
    asyncRouter,
    parseRankingSort
} = require('../router-helpers.js');

const rankingCategories = ['players', 'tribes'];

const rankingRouterSqlMap = {
    players: {
        ranking: sql.getWorldRankingPlayers,
        count: sql.getWorldPlayerCount
    },
    tribes: {
        ranking: sql.getWorldRankingTribes,
        count: sql.getWorldTribeCount
    }
};

const rankingCategoryRouter = asyncRouter(async function (req, res, next) {
    if (!paramWorld(req)) {
        return next();
    }

    const {
        marketId,
        worldId,
        worldNumber
    } = await paramWorldParse(req);

    const category = req.params.category;

    if (!rankingCategories.includes(category)) {
        throw createError(404, i18n('router_missing_category', 'errors', res.locals.lang));
    }

    const page = req.params.page && !isNaN(req.params.page)
        ? Math.max(1, parseInt(req.params.page, 10))
        : 1;
    const limit = parseInt(config.ui.ranking_page_items_per_page, 10);
    const offset = limit * (page - 1);

    const world = await db.one(sql.getWorld, [marketId, worldNumber]);

    const {
        playerRankingSortField,
        playerRankingSortOrder,
        tribeRankingSortField,
        tribeRankingSortOrder
    } = parseRankingSort(req, world.config.victory_points);

    const sortField = category === 'players' ? playerRankingSortField : tribeRankingSortField;
    const sortOrder = category === 'players' ? playerRankingSortOrder : tribeRankingSortOrder;

    const ranking = await db.any(rankingRouterSqlMap[category].ranking, {worldId, offset, limit, sortField, sortOrder});
    const {count} = await db.one(rankingRouterSqlMap[category].count, {worldId});
    const total = parseInt(count, 10);
    const capitalizedCategory = utils.capitalize(category);

    let displayDominationColumn = false;

    if (!world.config.victory_points && offset < config.ui.ranking_page_items_per_page) {
        displayDominationColumn = true;
        const topTenVillages = ranking.slice(0, 10).reduce((villages, tribe) => villages + tribe.villages, 0);

        for (let i = 0; i < 10; i++) {
            ranking[i].domination = parseFloat((ranking[i].villages / topTenVillages * 100).toFixed(1));
        }
    }

    mergeBackendLocals(res, {
        marketId,
        worldNumber
    });

    res.render('stats', {
        page: 'stats/ranking',
        title: i18n('stats_ranking', 'page_titles', res.locals.lang, [capitalizedCategory, marketId.toUpperCase(), world.name, config.site_name]),
        marketId,
        worldNumber,
        worldName: world.name,
        world,
        ranking,
        category,
        displayDominationColumn,
        sortField,
        pagination: createPagination(page, total, limit, req.path),
        navigation: createNavigation([
            {label: i18n('stats', 'navigation', res.locals.lang), url: '/'},
            {label: i18n('server', 'navigation', res.locals.lang), url: `/stats/${marketId}/`, replaces: [marketId.toUpperCase()]},
            {label: i18n('world', 'navigation', res.locals.lang), url: `/stats/${marketId}/${world.num}`, replaces: [world.name]},
            {label: i18n('ranking', 'navigation', res.locals.lang), replaces: [capitalizedCategory]}
        ])
    });
});

router.get('/stats/:marketId/:worldNumber/ranking/:category?/', rankingCategoryRouter);
router.get('/stats/:marketId/:worldNumber/ranking/:category?/page/:page', rankingCategoryRouter);

module.exports = router;
