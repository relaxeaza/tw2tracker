const {Router} = require('express');
const {ensureLoggedIn} = require('connect-ensure-login');

const db = require('../db.js');
const sql = require('../sql.js');
const utils = require('../utils.js');
const config = require('../config.js');
const enums = require('../enums.js');
const syncSocket = require('../sync-socket.js');
const debug = require('../debug.js');
const development = process.env.NODE_ENV === 'development';
const pgArray = require('pg').types.arrayParser;
const bcrypt = require('bcrypt');
const saltRounds = 10;
const createError = require('http-errors');

function createAdminMenu (user, selected) {
    const adminMenu = [
        ['sync', {
            label: 'Sync',
            enabled: user.privileges.start_sync || user.privileges.control_sync,
            selected: selected === 'sync'
        }],
        ['accounts', {
            label: 'Sync Accounts',
            enabled: user.privileges.modify_accounts,
            selected: selected === 'accounts'
        }],
        ['mods', {
            label: 'Mod Accounts',
            enabled: user.privileges.modify_mods,
            selected: selected === 'mods'
        }]
    ];

    return adminMenu.filter(function ([id, data]) {
        return data.enabled
    });
}

const adminPanelRouter = utils.asyncRouter(async function (req, res) {
    if (!req.user.privileges.control_sync && !req.user.privileges.start_sync) {
        throw createError(401, 'You do not have permission to access this page');
    }


    const openWorlds = await db.any(sql.getOpenWorlds);
    const closedWorlds = await db.any(sql.getClosedWorlds);
    const markets = await db.any(sql.getMarkets);
    const subPage = 'sync';
    const menu = createAdminMenu(req.user, subPage);

    res.render('admin', {
        title: `Admin Panel - ${config.site_name}`,
        menu,
        subPage,
        openWorlds,
        closedWorlds,
        markets,
        backendValues: {
            development,
            syncStates: enums.syncStates,
            subPage
        },
        ...utils.ejsHelpers
    });
});

const syncDataRouter = utils.asyncRouter(async function (req, res) {
    const marketId = req.params.marketId;
    const worldNumber = parseInt(req.params.worldNumber, 10);
    const worldId = marketId + worldNumber;
    const marketsWithAccounts = await db.map(sql.getMarketsWithAccounts, [], market => market.id);
    const worlds = await db.map(sql.getWorlds, [], world => world.num);

    if (marketsWithAccounts.includes(marketId) && worlds.includes(worldNumber)) {
        syncSocket.send(JSON.stringify({
            code: enums.SYNC_REQUEST_SYNC_DATA,
            marketId,
            worldNumber
        }));
    }

    res.redirect(`/admin/sync#world-${worldId}`);
});

const syncDataAllRouter = utils.asyncRouter(async function (req, res) {
    syncSocket.send(JSON.stringify({
        code: enums.SYNC_REQUEST_SYNC_DATA_ALL
    }));

    res.redirect('/admin/sync');
});

const syncAchievementsRouter = utils.asyncRouter(async function (req, res) {
    const marketId = req.params.marketId;
    const worldNumber = parseInt(req.params.worldNumber, 10);
    const worldId = marketId + worldNumber;
    const marketsWithAccounts = await db.map(sql.getMarketsWithAccounts, [], market => market.id);
    const worlds = await db.map(sql.getWorlds, [], world => world.num);

    if (marketsWithAccounts.includes(marketId) && worlds.includes(worldNumber)) {
        syncSocket.send(JSON.stringify({
            code: enums.SYNC_REQUEST_SYNC_ACHIEVEMENTS,
            marketId,
            worldNumber
        }));
    }
    
    res.redirect(`/admin/sync#world-${worldId}`);
});

const syncAchievementsAllRouter = utils.asyncRouter(async function (req, res) {
    syncSocket.send(JSON.stringify({
        code: enums.SYNC_REQUEST_SYNC_ACHIEVEMENTS_ALL
    }));

    res.redirect('/admin/sync');
});

const scrapeMarketsRouter = utils.asyncRouter(async function (req, res) {
    syncSocket.send(JSON.stringify({
        code: enums.SYNC_REQUEST_SYNC_MARKETS
    }));

    res.redirect('/admin/sync');
});

const scrapeWorldsRouter = utils.asyncRouter(async function (req, res) {
    syncSocket.send(JSON.stringify({
        code: enums.SYNC_REQUEST_SYNC_WORLDS
    }));

    res.redirect('/admin/sync');
});

const toggleSyncRouter = utils.asyncRouter(async function (req, res) {
    const marketId = req.params.marketId;
    const worldNumber = req.params.worldNumber ? parseInt(req.params.worldNumber, 10) : false;
    const worldId = marketId + worldNumber;
    const code = worldNumber ? enums.SYNC_TOGGLE_WORLD : enums.SYNC_TOGGLE_MARKET;

    if (!worldNumber) {
        const msg = 'Sync toggle is available for worlds only not markets.';
        debug.sync(msg);
        res.end(msg);
        return false;
    }

    syncSocket.send(JSON.stringify({
        code,
        marketId,
        worldNumber
    }));

    res.redirect(`/admin/sync#world-${worldId}`);
});

const accountsRouter = utils.asyncRouter(async function (req, res) {
    if (!req.user.privileges.modify_accounts) {
        throw createError(401, 'You do not have permission to access this page');
    }

    const markets = await db.map(sql.getMarkets, [], market => market.id);
    const accounts = await db.map(sql.getAccounts, [], function (account) {
        account.missingMarkets = getMissingMarkets(account.markets, markets);
        return account;
    });

    function getMissingMarkets (accountMarkets, markets) {
        return markets.filter(function (marketId) {
            return !accountMarkets.includes(marketId);
        });
    }

    const subPage = 'accounts';
    const menu = createAdminMenu(req.user, subPage);

    res.render('admin', {
        title: `Admin Panel - Accounts - ${config.site_name}`,
        menu,
        subPage,
        accounts,
        markets,
        backendValues: {
            development,
            syncStates: enums.syncStates,
            subPage
        },
        ...utils.ejsHelpers
    });
});

const accountsAddMarketRouter = utils.asyncRouter(async function (req, res) {
    const accountId = req.params.accountId;
    const marketId = req.params.marketId;
    const account = await db.any(sql.getAccount, {accountId});
    const market = await db.any(sql.getMarket, {marketId});

    if (!account.length) {
        return res.end(`Account "${accountId}" does not exist.`);
    }

    if (!market.length) {
        return res.end(`Market "${marketId}" does not exist.`);
    }

    if (account[0].markets.includes(marketId)) {
        return res.end('Account already has market included.');
    }

    await db.query(sql.addAccountMarket, {
        accountId,
        marketId
    });

    res.redirect(`/admin/accounts#account-${accountId}`);
});

const accountsRemoveMarketRouter = utils.asyncRouter(async function (req, res) {
    const accountId = req.params.accountId;
    const marketId = req.params.marketId;
    const account = await db.any(sql.getAccount, {accountId});
    const market = await db.any(sql.getMarket, {marketId});

    if (!account.length) {
        return res.end(`Account "${accountId}" does not exist.`);
    }

    if (!market.length) {
        return res.end(`Market "${marketId}" does not exist.`);
    }

    if (!account[0].markets.includes(marketId)) {
        return res.end('Account already does not have market included.');
    }

    await db.query(sql.removeAccountMarket, {
        accountId,
        marketId
    });

    res.redirect(`/admin/accounts#account-${accountId}`);
});

const accountsDeleteRouter = utils.asyncRouter(async function (req, res) {
    const accountId = req.params.accountId;
    const account = await db.any(sql.getAccount, {accountId});

    if (!account.length) {
        return res.end(`Account "${accountId}" does not exist.`);
    }

    await db.query(sql.deleteAccount, {
        accountId,
    });

    res.redirect('/admin/accounts');
});

const accountsEditRouter = utils.asyncRouter(async function (req, res) {
    const {name, pass, id: accountId} = req.body;
    const account = await db.any(sql.getAccount, {accountId});

    if (!account.length) {
        return res.end(`Account "${id}" does not exist.`);
    }

    if (pass.length < 4) {
        return res.end(`Password minimum length is 4.`);
    }

    if (name.length < 4) {
        return res.end(`Account name minimum length is 4.`);
    }

    await db.query(sql.editAccount, {
        accountId,
        name,
        pass
    });

    res.redirect(`/admin/accounts#account-${accountId}`);
});

const accountsCreateRouter = utils.asyncRouter(async function (req, res) {
    const {name, pass, id: accountId} = req.body;

    if (pass.length < 4) {
        return res.end(`Password minimum length is 4.`);
    }

    if (name.length < 4) {
        return res.end(`Account name minimum length is 4.`);
    }

    const accountExists = await db.any(sql.getAccountByName, {name});

    if (accountExists.length) {
        return res.end(`Account with name "${name}" already exists.`);
    }

    await db.query(sql.addAccount, {
        name,
        pass
    });

    res.redirect(`/admin/accounts#account-${accountId}`);
});

const modsRouter = utils.asyncRouter(async function (req, res) {
    if (!req.user.privileges.modify_mods) {
        throw createError(401, 'You do not have permission to access this page');
    }

    const modPrivilegeTypes = await db.map(sql.getModPrivilegeTypes, [], (privilege) => privilege.type);
    const mods = await db.map(sql.getMods, [], function (mod) {
        mod.privileges = pgArray.create(mod.privileges, String).parse();
        return mod;
    });

    const subPage = 'mods';
    const menu = createAdminMenu(req.user, subPage);

    res.render('admin', {
        title: `Admin Panel - Accounts - ${config.site_name}`,
        menu,
        subPage,
        mods,
        modPrivilegeTypes,
        backendValues: {
            development,
            subPage
        },
        ...utils.ejsHelpers
    });
});

const modsEditRouter = utils.asyncRouter(async function (req, res) {
    let {id, name, pass, email, privileges} = req.body;

    id = parseInt(id, 10);

    if (name.length < 3) {
        throw createError(400, 'Minimum username length is 3');
    }

    if (pass && pass.length < 4) {
        throw createError(400, 'Minimum password length is 4');
    }

    const [accountName] = await db.any(sql.getModAccountByName, {name});
    if (accountName && accountName.id !== id) {
        throw createError(400, 'A mod account with this name already exists');
    }

    const [accountEmail] = await db.any(sql.getModAccountByEmail, {email});
    if (accountEmail && accountEmail.id !== id) {
        throw createError(400, 'This email is already in use by another account');
    }

    if (!privileges) {
        privileges = [];
    } else if (typeof privileges === 'string') {
        privileges = [privileges];
    }

    const privilegeTypes = await db.map(sql.getModPrivilegeTypes, [], ({type}) => type);

    for (const type of privileges) {
        if (!privilegeTypes.includes(type)) {
            throw createError(400, 'Invalid privilege type');
        }
    }

    if (pass) {
        const hash = await bcrypt.hash(pass, saltRounds);
        await db.query(sql.updateModAccount, {id, name, pass: hash, privileges, email});
    } else {
        await db.query(sql.updateModAccountKeepPass, {id, name, privileges, email});
    }

    res.redirect(`/admin/mods#mod-${id}`);
});

const modsCreateRouter = utils.asyncRouter(async function (req, res) {
    let {name, pass, email, privileges} = req.body;

    if (name.length < 3) {
        throw createError(400, 'Minimum username length is 3');
    }

    if (pass.length < 4) {
        throw createError(400, 'Minimum password length is 4');
    }

    const [accountName] = await db.any(sql.getModAccountByName, {name});
    if (accountName) {
        throw createError(400, 'A mod account with this name already exists');
    }

    const [accountEmail] = await db.any(sql.getModAccountByEmail, {email});
    if (accountEmail) {
        throw createError(400, 'This email is already in use by another account');
    }

    if (!privileges) {
        privileges = [];
    } else if (typeof privileges === 'string') {
        privileges = [privileges];
    }

    const privilegeTypes = await db.map(sql.getModPrivilegeTypes, [], ({type}) => type);

    for (const type of privileges) {
        if (!privilegeTypes.includes(type)) {
            throw createError(400, 'Invalid privilege type');
        }
    }

    const hash = await bcrypt.hash(pass, saltRounds);
    const {id} = await db.one(sql.createModAccount, {name, pass: hash, privileges, email});

    res.redirect(`/admin/mods#mod-${id}`);
});

const modsDeleteRouter = utils.asyncRouter(async function (req, res) {
    let {id} = req.params;

    const [mod] = await db.any(sql.getMod, {id});

    if (!mod) {
        throw createError(404, 'This mod account does not exist');
    }

    await db.query(sql.deleteModAccount, {id});
    res.redirect('/admin/mods');
});

const router = Router();
router.use(ensureLoggedIn());
router.get('/', adminPanelRouter);
router.get('/sync', adminPanelRouter);
router.get('/sync/data/all', syncDataAllRouter);
router.get('/sync/data/:marketId/:worldNumber', syncDataRouter);
router.get('/sync/achievements/all', syncAchievementsAllRouter);
router.get('/sync/achievements/:marketId/:worldNumber', syncAchievementsRouter);
router.get('/sync/markets', scrapeMarketsRouter);
router.get('/sync/worlds', scrapeWorldsRouter);
router.get('/sync/toggle/:marketId/:worldNumber?', toggleSyncRouter);
router.get('/accounts', accountsRouter);
router.get('/accounts/markets/add/:accountId/:marketId', accountsAddMarketRouter);
router.get('/accounts/markets/remove/:accountId/:marketId', accountsRemoveMarketRouter);
router.get('/accounts/delete/:accountId', accountsDeleteRouter);
router.post('/accounts/edit/', accountsEditRouter);
router.post('/accounts/create/', accountsCreateRouter);
router.get('/mods', modsRouter);
router.post('/mods/edit', modsEditRouter);
router.post('/mods/create', modsCreateRouter);
router.get('/mods/delete/:id', modsDeleteRouter);

module.exports = router;
