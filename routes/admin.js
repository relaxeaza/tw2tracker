const express = require('express')
const router = express.Router()
const connectEnsureLogin = require('connect-ensure-login')

const db = require('../db.js')
const sql = require('../sql.js')
const utils = require('../utils.js')
const Sync = require('../sync.js')
const config = require('../config.js')
const syncStatus = require('../sync-status.js')

router.use(connectEnsureLogin.ensureLoggedIn())

const adminPanelRouter = utils.asyncRouter(async function (req, res) {
    const openWorlds = await db.any(sql.getOpenWorlds)
    const closedWorlds = await db.any(sql.getClosedWorlds)
    const markets = await db.any(sql.markets.all)

    res.render('admin', {
        title: `Admin Panel - ${config.site_name}`,
        openWorlds,
        closedWorlds,
        markets,
        ...utils.ejsHelpers
    })
})

const scrapeStatusRouter = utils.asyncRouter(async function (req, res) {
    const response = syncStatus.getCurrent()

    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(response))
})

const scrapeAllWorldsRouter = utils.asyncRouter(async function (req, res) {
    process.send({
        action: 'syncAllWorlds'
    })

    res.end()
})

const scrapeWorldRouter = utils.asyncRouter(async function (req, res) {
    const marketId = req.params.marketId
    const worldNumber = parseInt(req.params.worldNumber, 10)
    const enabledMarkets = await db.map(sql.markets.withAccount, [], market => market.id)
    const worlds = await db.map(sql.getWorlds, [], world => world.num)
    
    if (enabledMarkets.includes(marketId) && worlds.includes(worldNumber)) {
        process.send({
            action: 'syncWorld',
            marketId,
            worldNumber
        })
    }
    
    res.end()
})

const scrapeMarketsRouter = utils.asyncRouter(async function (req, res) {
    const addedMarkets = await Sync.markets()

    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(addedMarkets))
})

router.get('/', adminPanelRouter)
router.get('/scraper/status', scrapeStatusRouter)
router.get('/scraper/all-worlds', scrapeAllWorldsRouter)
router.get('/scraper/:marketId/:worldNumber', scrapeWorldRouter)
router.get('/scraper/markets', scrapeMarketsRouter)

module.exports = router
