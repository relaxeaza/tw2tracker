#!/usr/bin/env bash

ssh arch@tw2tracker 'pg_dump --dbname=tw2tracker --username=postgres --verbose --compress 9 > /any/tw2tracker.db.gz'
rsync arch@tw2tracker:/any/tw2tracker.db.gz /any/tw2tracker.db.gz
rsync --recursive --verbose arch@tw2tracker:/home/arch/tw2tracker/data/static-maps /any/