const fs = require('fs');
const path = require('path');
const express = require('express');
const createError = require('http-errors');
const router = express.Router();
const utils = require('../utils.js');
const config = require('../config.js');
const db = require('../db.js');
const sql = require('../sql.js');
const i18n = require('../i18n.js');

const mapsAPIRouter = require('./maps-api.js');

const marketsRouter = utils.asyncRouter(async function (req, res, next) {
    const worlds = await db.any(sql.getWorlds);
    const marketsIds = Array.from(new Set(worlds.map(world => world.market)));

    const marketStats = marketsIds.map(function (id) {
        return {
            id,
            players: worlds.reduce((base, next) => next.market === id ? base + next.player_count : base, 0),
            tribes: worlds.reduce((base, next) => next.market === id ? base + next.tribe_count : base, 0),
            villages: worlds.reduce((base, next) => next.market === id ? base + next.village_count : base, 0),
            openWorld: worlds.filter((world) => world.market === id && world.open).length,
            closedWorld: worlds.filter((world) => world.market === id && !world.open).length
        };
    });

    res.render('market-list', {
        title: i18n.page_titles.stats_maps_servers,
        pageType: 'stats',
        marketStats,
        navigation: [
            `<a href="/maps">Maps</a>`,
            `Server List`
        ],
        ...utils.ejsHelpers
    });
});

const worldsRouter = utils.asyncRouter(async function (req, res, next) {
    if (req.params.marketId.length !== 2) {
        return next();
    }

    const marketId = req.params.marketId;
    const syncedWorlds = await db.any(sql.getSyncedWorlds);
    const marketWorlds = syncedWorlds.filter((world) => world.market === marketId);
    const sortedWorlds = marketWorlds.sort((a, b) => a.num - b.num);

    if (!marketWorlds.length) {
        throw createError(404, i18n.errors.missing_world);
    }

    const worlds = [
        [i18n.world_list.open_worlds, sortedWorlds.filter(world => world.open)],
        [i18n.world_list.closed_worlds, sortedWorlds.filter(world => !world.open)]
    ];

    res.render('world-list', {
        title: i18n.page_titles.stats_maps_server_worlds,
        marketId,
        worlds,
        pageType: 'maps',
        navigation: [
            `<a href="/maps">Maps</a>`,
            `Server <a href="/maps/${marketId}/">${marketId.toUpperCase()}</a>`,
            'World List'
        ],
        backendValues: {
            marketId
        },
        ...utils.ejsHelpers
    });
});

const worldRouter = utils.asyncRouter(async function (req, res, next) {
    if (req.params.marketId.length !== 2 || isNaN(req.params.worldNumber)) {
        return next();
    }

    const marketId = req.params.marketId;
    const worldNumber = parseInt(req.params.worldNumber, 10);
    const worldId = marketId + worldNumber;

    try {
        await fs.promises.access(path.join('.', 'data', worldId, 'info'));
    } catch (error) {
        throw createError(404, i18n.errors.missing_world);
    }

    if (!await utils.schemaExists(worldId)) {
        throw createError(404, i18n.errors.missing_world);
    }

    const world = await db.one(sql.getWorld, [marketId, worldNumber]);
    const lastDataSyncDate = world.last_data_sync_date ? new Date(world.last_data_sync_date).getTime() : false;

    res.render('maps/map', {
        title: i18n.page_titles.maps_world_map,
        marketId,
        world,
        backendValues: {
            marketId,
            worldNumber,
            worldName: world.name,
            lastDataSyncDate,
            staticMapExpireTime: config.sync.static_share_expire_time
        }
    });
});

const mapShareRouter = utils.asyncRouter(async function (req, res, next) {
    if (req.params.marketId.length !== 2 || isNaN(req.params.worldNumber)) {
        return next();
    }

    const mapShareId = req.params.mapShareId;
    const marketId = req.params.marketId;
    const worldNumber = parseInt(req.params.worldNumber, 10);

    let mapShare;

    const worldExists = await utils.schemaExists(marketId + worldNumber);

    if (!worldExists) {
        throw createError(404, i18n.errors.missing_world);
    }

    const world = await db.one(sql.getWorld, [marketId, worldNumber]);
    const lastDataSyncDate = world.last_data_sync_date ? new Date(world.last_data_sync_date).getTime() : false;

    try {
        mapShare = await db.one(sql.maps.getShareInfo, [mapShareId, marketId, worldNumber]);
    } catch (error) {
        throw createError(404, i18n.errors.missing_map_share);
    }

    mapShare.creation_date = new Date(mapShare.creation_date).getTime();
    mapShare.settings = JSON.parse(mapShare.settings);

    db.query(sql.maps.updateShareAccess, [mapShareId]);

    res.render('maps/map', {
        title: i18n.page_titles.maps_world_map_shared,
        marketId,
        world,
        backendValues: {
            marketId,
            worldNumber,
            worldName: world.name,
            lastDataSyncDate,
            mapShare
        }
    });
});

router.get('/', marketsRouter);
router.get('/:marketId', worldsRouter);
router.get('/:marketId/:worldNumber', worldRouter);
router.get('/:marketId/:worldNumber/share/:mapShareId', mapShareRouter);
router.use(mapsAPIRouter);

module.exports = router;
