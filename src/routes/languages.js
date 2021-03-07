const express = require('express');
const createError = require('http-errors');
const router = express.Router();
const config = require('../config.js');
const i18n = require('../i18n.js');

router.get('/:lang?', function (req, res, next) {
    if (req.params.lang) {
        req.session.lang = req.params.lang || config.lang;
        return res.redirect('back');
    }

    res.render('languages', {
        title: i18n('languages', 'page_titles', res.locals.lang, [config.site_name])
    });
});

module.exports = router;