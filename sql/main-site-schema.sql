CREATE SCHEMA main;
SET TIMEZONE='UTC';

CREATE TABLE main.settings (
    site_name VARCHAR (255) NOT NULL,
    admin_password VARCHAR (255) NOT NULL,
    scrapper_interval_minutes SMALLINT NOT NULL
);

CREATE TABLE main.markets (
    id VARCHAR (10) PRIMARY KEY,
    account_name VARCHAR (255) DEFAULT 'tribalwarstracker',
    account_password VARCHAR (255) DEFAULT 'tribalwarstracker'
);

CREATE TABLE main.worlds (
    market VARCHAR (10) REFERENCES main.markets(id),
    num SMALLINT,
    name VARCHAR (255) NOT NULL,
    last_sync TIMESTAMP,
    open BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE main.shared_maps (
    id SERIAL PRIMARY KEY,
    world_market VARCHAR (10) REFERENCES main.markets(id),
    world_number SMALLINT,
    highlights TEXT NOT NULL,
    type VARCHAR (7) NOT NULL,
    creation_date TIMESTAMP DEFAULT NOW(),
    last_access TIMESTAMP DEFAULT NOW()
);

INSERT INTO main.settings (site_name, admin_password, scrapper_interval_minutes) VALUES ('tw2tracker', '123', 30);
