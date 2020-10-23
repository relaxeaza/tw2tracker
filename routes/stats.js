const express = require('express')
const router = express.Router()
const db = require('../db')
const sql = require('../sql')
const utils = require('../utils')
const getSettings = require('../settings')

router.get('/:marketId/:worldNumber', async function (req, res, next) {
    if (req.params.marketId.length !== 2 || isNaN(req.params.worldNumber)) {
        return next()
    }

    const settings = await getSettings()
    const marketId = req.params.marketId
    const worldNumber = parseInt(req.params.worldNumber, 10)

    const worldExists = await utils.schemaExists(marketId, worldNumber)

    if (!worldExists) {
        res.status(404)
        res.render('error', {
            title: 'Tw2-Tracker Error',
            error_title: 'This world does not exist'
        })

        return false
    }

    const worldInfo = await db.one(sql.worlds.one, [marketId, worldNumber])
    const worldId = marketId + worldNumber

    const players = await db.any('SELECT * FROM ${schema:name}.players ORDER BY points DESC LIMIT 10', {
        schema: worldId
    })

    const tribes = await db.any('SELECT * FROM ${schema:name}.tribes ORDER BY points DESC LIMIT 10', {
        schema: worldId
    })

    res.render('stats', {
        title: 'Stats ' + marketId + worldNumber + ' - ' + settings.site_name,
        marketId,
        worldNumber,
        worldName: worldInfo.name,
        players,
        tribes,
        siteName: settings.site_name,
        development: process.env.NODE_ENV === 'development',
    })
})

module.exports = router
