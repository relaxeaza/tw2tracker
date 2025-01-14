SET TIMEZONE='UTC';

CREATE TABLE public.tasks (
    id VARCHAR (100) PRIMARY KEY,
    last_run TIMESTAMP DEFAULT TIMEZONE('UTC', NOW())
);

CREATE TABLE public.players (
    id BIGINT,
    name TEXT,
    market_id TEXT,
    worlds INT[] DEFAULT ARRAY[]::int[],
    PRIMARY KEY (id, market_id)
);
CREATE UNIQUE INDEX idx_players_id_market on public.players (id, market_id);

CREATE TABLE public.markets (
    id VARCHAR (10) PRIMARY KEY,
    time_offset INT NULL
);

CREATE TABLE public.accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR (255) UNIQUE NOT NULL,
    pass VARCHAR (255) NOT NULL,
    markets VARCHAR[] DEFAULT '{}' NOT NULL
);

INSERT INTO public.accounts (name, pass, markets) VALUES ('tribalwarstracker', '7FONlraMpdnvrNIVE8aOgSGISVW00A', '{br,cz,de,en,es,fr,gr,hu,it,nl,pl,pt,ro,ru,sk,tr,us,zz}');

CREATE TYPE public.mod_privilege_types AS ENUM ('start_sync', 'control_sync', 'modify_accounts', 'modify_mods', 'modify_settings');

CREATE TABLE public.mods (
    id SERIAL PRIMARY KEY,
    name VARCHAR (25) UNIQUE NOT NULL,
    pass VARCHAR (255) NOT NULL,
    privileges public.mod_privilege_types[] DEFAULT '{start_sync}',
    email VARCHAR (255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX ON public.mods ((LOWER(name)));
CREATE INDEX ON public.mods ((LOWER(email)));
INSERT INTO public.mods (name, pass, email, privileges) VALUES ('admin', '$2b$10$qRNmynCwNPSzPK70izwTOumIE84CV4o364reaNKPhmhcMa/sDcyAK', 'admin@tw2-tracker.com', '{start_sync, control_sync, modify_accounts, modify_mods, modify_settings}');

CREATE TYPE public.sync_status AS ENUM (
    'success',
    'fail',
    'already_synced',
    'no_accounts',
    'auth_failed',
    'world_closed',
    'not_enabled',
    'all_accounts_failed',
    'timeout',
    'in_progress',
    'failed_to_select_character',
    'world_in_maintenance',
    'world_not_found',
    'character_not_selected',
    'never'
);

CREATE TABLE public.worlds (
    market_id VARCHAR (10) REFERENCES public.markets(id),
    world_number SMALLINT,
    world_id VARCHAR (5),
    name VARCHAR (255) NOT NULL,
    last_data_sync_date TIMESTAMP,
    last_data_sync_status public.sync_status DEFAULT 'never',
    last_achievements_sync_date TIMESTAMP,
    last_achievements_sync_status public.sync_status DEFAULT 'never',
    open BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB,
    player_count INT DEFAULT 0,
    village_count INT DEFAULT 0,
    tribe_count INT DEFAULT 0,
    close_date TIMESTAMP NULL,
    open_date TIMESTAMP DEFAULT TIMEZONE('UTC', NOW()),
    incomplete_data BOOLEAN DEFAULT FALSE,
    sync_enabled BOOLEAN DEFAULT TRUE
);

CREATE TYPE public.sync_types AS ENUM ('data', 'achievements');

CREATE TABLE public.sync_queue (
    id SERIAL PRIMARY KEY,
    type public.sync_types,
    market_id TEXT NOT NULL,
    world_number SMALLINT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    start_date TIMESTAMP DEFAULT TIMEZONE('UTC', NOW())
);

CREATE TYPE public.map_share_type AS ENUM ('static', 'dynamic');

CREATE TABLE public.maps_share (
    id SERIAL PRIMARY KEY,
    share_id VARCHAR (20) UNIQUE NOT NULL,
    world_market VARCHAR (10) REFERENCES public.markets(id),
    world_number SMALLINT,
    highlights TEXT NOT NULL,
    type public.map_share_type,
    center_x SMALLINT DEFAULT 500,
    center_y SMALLINT DEFAULT 500,
    settings TEXT NOT NULL,
    creation_date TIMESTAMP DEFAULT TIMEZONE('UTC', NOW()),
    last_access TIMESTAMP DEFAULT TIMEZONE('UTC', NOW())
);

CREATE TABLE public.session (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP (6) NOT NULL
) WITH (OIDS=FALSE);

ALTER TABLE public.session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IDX_session_expire ON public.session (expire);

CREATE TYPE public.achievement_categories AS ENUM (
    'battle',
    'friends',
    'milestone',
    'points',
    'quest',
    'repeatable',
    'ruler',
    'special',
    'tribe'
);

CREATE TABLE public.achievement_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR (50) UNIQUE NOT NULL,
    category public.achievement_categories,
    levels SMALLINT NOT NULL,
    repeatable BOOLEAN NOT NULL,
    limits BIGINT[],
    points INT[],
    milestone BOOLEAN NOT NULL
);

INSERT INTO public.achievement_types (name, category, levels, repeatable, limits, points, milestone) VALUES
    ('loot', 'battle', 5, false, '{500, 10000, 100000, 1000000, 100000000}', '{10, 25, 40, 60, 80}', false),
    ('overkill', 'battle', 1, false, '{10000}', '{50}', false),
    ('loot_daily', 'repeatable', 1, true, null, null, false),
    ('conquest_milestone', 'milestone', 5, false, '{2, 100, 250, 500, 1000}', '{30, 50, 70, 100, 150}', true),
    ('players_attacked_unique', 'battle', 4, false, '{10, 25, 100, 250}', '{10, 25, 40, 60}', false),
    ('villages_looted_unique', 'battle', 4, false, '{10, 100, 1000, 10000}', '{10, 25, 40, 60}', false),
    ('bash_points_offense', 'battle', 6, false, '{500, 10000, 100000, 1000000, 10000000, 50000000}', '{10, 25, 40, 60, 80, 120}', false),
    ('bash_points_defense', 'battle', 6, false, '{500, 10000, 100000, 1000000, 10000000, 50000000}', '{5, 10, 25, 40, 55, 70}', false),
    ('losses', 'battle', 6, false, '{100, 10000, 100000, 1000000, 10000000, 50000000}', '{5, 10, 25, 40, 55, 70}', false),
    ('losses_support', 'battle', 5, false, '{500, 7500, 20000, 100000, 1000000}', '{10, 25, 40, 60, 80}', false),
    ('self_attack', 'battle', 4, false, '{10, 100, 1000, 10000}', '{5, 10, 25, 40}', false),
    ('snobs_killed', 'battle', 4, false, '{25, 125, 350, 700}', '{30, 50, 70, 100}', false),
    ('major_battles_won', 'battle', 4, false, '{25, 250, 1500, 2500}', '{30, 50, 70, 100}', false),
    ('major_battles_supported', 'battle', 4, false, '{50, 100, 500, 3000}', '{30, 50, 70, 100}', false),
    ('major_battle_perfect_defense', 'battle', 1, false, '{1}', '{70}', false),
    ('major_battles_winning_streak', 'battle', 5, false, '{5, 10, 25, 50, 100}', '{30, 50, 70, 100, 150}', false),
    ('major_battle_defense_outnumbered', 'battle', 1, false, '{1}', '{70}', false),
    ('building_levels_destroyed', 'battle', 4, false, '{25, 250, 2500, 10000}', '{20, 40, 60, 80}', false),
    ('wall_levels_destroyed', 'battle', 4, false, '{25, 250, 2500, 10000}', '{20, 40, 60, 80}', false),
    ('villages_conquered_per_hour', 'battle', 4, false, '{10, 25, 50, 100}', '{30, 50, 70, 100}', false),
    ('villages_conquered', 'ruler', 4, false, '{10, 50, 500, 1000}', '{30, 50, 70, 100}', false),
    ('conquest_lucky', 'ruler', 1, false, '{1}', '{50}', false),
    ('conquest_unlucky', 'ruler', 1, false, '{1}', '{50}', false),
    ('village_owned_milestone_tribe', 'tribe', 4, false, '{500, 1000, 10000, 50000}', '{30, 50, 70, 100}', true),
    ('village_conquered_milestone_tribe', 'tribe', 4, false, '{50, 100, 1000, 10000}', '{30, 50, 70, 100}', true),
    ('points_milestone_tribe', 'tribe', 5, false, '{100000, 1000000, 10000000, 100000000, 1000000000}', '{30, 50, 70, 100, 150}', true),
    ('units_killed_milestone_tribe', 'tribe', 6, false, '{100000, 1000000, 10000000, 100000000, 1000000000, 10000000000}', '{30, 50, 70, 100, 150, 250}', true),
    ('self_conquest', 'ruler', 1, false, '{1}', '{50}', false),
    ('recruited_infantry', 'special', 6, false, '{500, 2500, 10000, 100000, 1000000, 10000000}', '{10, 25, 40, 60, 80, 120}', false),
    ('recruited_cavalry', 'special', 5, false, '{500, 2500, 10000, 100000, 1000000}', '{10, 25, 40, 60, 80}', false),
    ('recruited_siege_weapons', 'special', 5, false, '{500, 2500, 10000, 100000, 1000000}', '{10, 25, 40, 60, 80}', false),
    ('looted_village_daily', 'repeatable', 1, true, null, null, false),
    ('attack_daily', 'repeatable', 1, true, null, null, false),
    ('defend_daily', 'repeatable', 1, true, null, null, false),
    ('conquered_daily', 'repeatable', 1, true, null, null, false),
    ('most_battle_daily', 'repeatable', 1, true, null, null, false),
    ('loot_weekly', 'repeatable', 1, true, null, null, false),
    ('looted_village_weekly', 'repeatable', 1, true, null, null, false),
    ('attack_weekly', 'repeatable', 1, true, null, null, false),
    ('defend_weekly', 'repeatable', 1, true, null, null, false),
    ('conquered_weekly', 'repeatable', 1, true, null, null, false),
    ('most_battle_weekly', 'repeatable', 1, true, null, null, false),
    ('loot_daily_tribe', 'tribe', 1, true, null, null, false),
    ('looted_village_daily_tribe', 'tribe', 1, true, null, null, false),
    ('attack_daily_tribe', 'tribe', 1, true, null, null, false),
    ('defend_daily_tribe', 'tribe', 1, true, null, null, false),
    ('conquered_daily_tribe', 'tribe', 1, true, null, null, false),
    ('most_battle_daily_tribe', 'tribe', 1, true, null, null, false),
    ('loot_weekly_tribe', 'tribe', 1, true, null, null, false),
    ('looted_village_weekly_tribe', 'tribe', 1, true, null, null, false),
    ('attack_weekly_tribe', 'tribe', 1, true, null, null, false),
    ('defend_weekly_tribe', 'tribe', 1, true, null, null, false),
    ('conquered_weekly_tribe', 'tribe', 1, true, null, null, false),
    ('most_battle_weekly_tribe', 'tribe', 1, true, null, null, false),
    ('max_level_churches', 'special', 4, false, '{2, 6, 10, 15}', '{20, 40, 60, 80}', false),
    ('max_level_markets', 'special', 4, false, '{5, 10, 15, 20}', '{10, 25, 40, 60}', false),
    ('max_level_walls', 'special', 4, false, '{5, 10, 15, 30}', '{10, 25, 40, 60}', false),
    ('max_level_taverns', 'special', 4, false, '{5, 10, 15, 20}', '{10, 25, 40, 60}', false),
    ('max_level_barracks', 'special', 4, false, '{5, 10, 15, 30}', '{10, 25, 40, 60}', false),
    ('max_level_resources', 'special', 4, false, '{15, 30, 45, 90}', '{10, 25, 40, 60}', false),
    ('max_level_farms', 'special', 4, false, '{5, 10, 15, 30}', '{10, 25, 40, 60}', false),
    ('max_level_preceptories', 'special', 4, false, '{2, 6, 10, 15}', '{20, 40, 60, 80}', false),
    ('scouting_thwarted', 'special', 4, false, '{25, 50, 250, 500}', '{10, 25, 40, 60}', false),
    ('scouting_success', 'special', 4, false, '{25, 50, 250, 500}', '{20, 40, 60, 80}', false),
    ('scouts_killed_attacker', 'special', 4, false, '{5, 50, 100, 250}', '{20, 40, 60, 80}', false),
    ('scouts_killed_defender', 'special', 4, false, '{5, 50, 100, 250}', '{10, 25, 40, 60}', false),
    ('minted_coins', 'special', 4, false, '{50, 500, 5000, 50000}', '{20, 40, 60, 80}', false),
    ('doppelsoeldner_outnumbered', 'special', 5, false, '{5, 10, 15, 25, 50}', '{30, 50, 70, 100, 150}', false),
    ('trebuchet_kills', 'special', 5, false, '{50, 100, 250, 500, 1000}', '{30, 50, 70, 100, 150}', false),
    ('villages_lost_milestone', 'milestone', 5, false, '{1, 100, 250, 500, 1000}', '{30, 50, 70, 100, 150}', true),
    ('achievement_points_milestone', 'milestone', 1, false, '{15655}', '{70}', true),
    ('bash_points_milestone', 'milestone', 5, false, '{10000, 1000000, 5000000, 25000000, 100000000}', '{30, 50, 70, 100, 150}', true),
    ('resources_delivered', 'special', 5, false, '{5000, 10000, 100000, 1000000, 50000000}', '{10, 25, 40, 60, 80}', false),
    ('resources_traded_wood', 'special', 5, false, '{5000, 10000, 100000, 1000000, 50000000}', '{10, 25, 40, 60, 80}', false),
    ('resources_traded_clay', 'special', 5, false, '{5000, 10000, 100000, 1000000, 50000000}', '{10, 25, 40, 60, 80}', false),
    ('resources_traded_iron', 'special', 5, false, '{5000, 10000, 100000, 1000000, 50000000}', '{10, 25, 40, 60, 80}', false),
    ('trades_completed', 'special', 6, false, '{10, 50, 100, 500, 1000, 10000}', '{10, 25, 40, 60, 80, 120}', false),
    ('trades_completed_seller', 'special', 6, false, '{10, 50, 100, 500, 1000, 10000}', '{10, 25, 40, 60, 80, 120}', false),
    ('trades_completed_buyer', 'special', 6, false, '{10, 50, 100, 500, 1000, 10000}', '{10, 25, 40, 60, 80, 120}', false),
    ('first_units_recruited', 'special', 1, false, '{20}', '{30}', false),
    ('first_attacks_made', 'battle', 1, false, '{3}', '{30}', false),
    ('first_units_killed', 'battle', 1, false, '{50}', '{30}', false),
    ('first_mixed_attack', 'battle', 1, false, '{1}', '{30}', false),
    ('first_paladin_kill', 'special', 1, false, '{1}', '{30}', false),
    ('first_resources_spent', 'special', 1, false, '{10000}', '{30}', false),
    ('first_resource_production', 'special', 1, false, '{1000}', '{30}', false),
    ('first_building_leveled_up', 'special', 1, false, '{3}', '{30}', false),
    ('level_two_churches_milestone', 'milestone', 5, false, '{1, 5, 10, 25, 50}', '{30, 50, 70, 100, 150}', true),
    ('village_points', 'points', 5, false, '{500, 1000, 5000, 10000, 11216}', '{10, 25, 40, 60, 80}', false),
    ('large_villages_owned', 'points', 4, false, '{5, 10, 25, 50}', '{20, 40, 60, 80}', false),
    ('huge_villages_owned', 'points', 4, false, '{5, 10, 25, 50}', '{30, 50, 70, 100}', false),
    ('province_king_milestone', 'milestone', 1, false, '{1}', '{70}', true),
    ('province_fully_owned_milestone', 'milestone', 1, false, '{1}', '{70}', true),
    ('continent_owned_milestone_tribe', 'tribe', 1, false, '{1}', '{70}', true),
    ('provinces_owned_milestone_tribe', 'tribe', 4, false, '{1, 3, 6, 10}', '{30, 50, 70, 100}', true),
    ('tribe_membership_days', 'friends', 4, false, '{30, 60, 180, 360}', '{10, 25, 40, 60}', false),
    ('coop_players', 'friends', 2, false, '{1, 2}', '{10, 25}', false),
    ('points', 'points', 7, false, '{100, 5000, 25000, 50000, 100000, 1000000, 100000000}', '{10, 25, 40, 60, 80, 150, 200}', false),
    ('ranking_global', 'points', 5, false, '{1000, 100, 20, 5, 1}', '{30, 50, 70, 100, 150}', false),
    ('ranking_continent', 'points', 5, false, '{100, 50, 20, 5, 1}', '{30, 50, 70, 100, 150}', false);
