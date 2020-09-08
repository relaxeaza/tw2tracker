const express = require('express')
const router = express.Router()
const passport = require('passport')

router.get('/', async function (req, res, next) {
    const settings = await db.one(sql.settings)

    res.render('login', {
        title: 'Admin login - ' + settings.site_name
    })
})

router.post('/', passport.authenticate('local', {
    failureRedirect: '/login'
}), function (req, res) {
    res.redirect('/admin')
})

module.exports = router
