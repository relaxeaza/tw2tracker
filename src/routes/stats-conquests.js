const express = require('express');
const router = express.Router();
const db = require('../db.js');
const sql = require('../sql.js');
const utils = require('../utils.js');
const config = require('../config.js');
const i18n = require('../i18n.js');

const {
    paramWorld,
    paramWorldParse,
    createPagination,
    createNavigation
} = require('../router-helpers.js');

const conquestsRouter = utils.asyncRouter(async function (req, res, next) {
    if (!paramWorld(req)) {
        return next();
    }

    const {
        marketId,
        worldId,
        worldNumber
    } = await paramWorldParse(req);

    const world = await db.one(sql.getWorld, [marketId, worldNumber]);

    const page = req.params.page && !isNaN(req.params.page)
        ? Math.max(1, parseInt(req.params.page, 10))
        : 1;
    const limit = config.ui.ranking_page_items_per_page;
    const offset = limit * (page - 1);

    const conquests = await db.any(sql.getWorldConquests, {worldId, offset, limit});
    const total = parseInt((await db.one(sql.getWorldConquestsCount, {worldId})).count, 10);

    res.render('stats', {
        page: 'stats/conquests',
        title: i18n('stats_world_conquests', 'page_titles', res.locals.lang, [marketId.toUpperCase(), world.name, config.site_name]),
        marketId,
        worldNumber,
        world,
        conquests,
        pagination: createPagination(page, total, limit, req.path),
        navigation: createNavigation([
            {label: i18n('stats', 'navigation', res.locals.lang), url: '/'},
            {label: i18n('server', 'navigation', res.locals.lang), url: `/stats/${marketId}/`, replaces: [marketId.toUpperCase()]},
            {label: i18n('world', 'navigation', res.locals.lang), url: `/stats/${marketId}/${world.num}`, replaces: [world.name]},
            {label: i18n('conquests', 'navigation', res.locals.lang)}
        ]),
        backendValues: {
            marketId,
            worldNumber
        }
    });
});

router.get('/stats/:marketId/:worldNumber/conquests', conquestsRouter);
router.get('/stats/:marketId/:worldNumber/conquests/page/:page', conquestsRouter);

module.exports = router;
