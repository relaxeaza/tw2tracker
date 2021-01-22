module.exports = {
    SYNC_SUCCESS: 'success',
    SYNC_FAIL: 'fail',
    SYNC_SUCCESS_ALL: 'sync_success_all',
    SYNC_ERROR_ALL: 'sync_error_all',
    SYNC_ERROR_SOME: 'sync_error_some',
    SYNC_ACHIEVEMENTS_SUCCESS_ALL: 'sync_achievements_success_all',
    SYNC_ACHIEVEMENTS_ERROR_ALL: 'sync_achievements_error_all',
    SYNC_ACHIEVEMENTS_ERROR_SOME: 'sync_achievements_error_some',
    SCRAPE_WORLD_START: 'scrape_world_start',
    SCRAPE_WORLD_END: 'scrape_world_end',
    SCRAPE_ALL_WORLD_START: 'scrape_all_world_start',
    SCRAPE_ALL_WORLD_END: 'scrape_all_world_end',
    IGNORE_LAST_SYNC: 'ignore_last_sync',
    SCRAPE_ACHIEVEMENT_WORLD_START: 'scrape_achievement_world_start',
    SCRAPE_ACHIEVEMENT_WORLD_END: 'scrape_achievement_world_end',
    SCRAPE_ACHIEVEMENT_ALL_WORLD_START: 'scrape_achievement_all_world_start',
    SCRAPE_ACHIEVEMENT_ALL_WORLD_END: 'scrape_achievement_all_world_end',
    SYNC_REQUEST_STATUS: 'request_sync_status',
    SYNC_REQUEST_SYNC_DATA: 'sync_request_sync_data',
    SYNC_REQUEST_SYNC_DATA_ALL: 'sync_request_sync_data_all',
    SYNC_REQUEST_SYNC_ACHIEVEMENTS: 'sync_request_sync_achievements',
    SYNC_REQUEST_SYNC_ACHIEVEMENTS_ALL: 'sync_request_sync_achievements_all',
    SYNC_REQUEST_SYNC_MARKETS: 'sync_request_sync_markets',
    EMPTY_CONTINENT: 'empty_continent',
    achievementCommitTypes: {
        ADD: 'add',
        UPDATE: 'update'
    },
    syncStates: {
        START: 'start',
        FINISH: 'finish',
        UPDATE: 'update',
        ACHIEVEMENT_START: 'achievement_start',
        ACHIEVEMENT_FINISH: 'achievement_finish'
    },
    mapShareTypes: {
        STATIC: 'static',
        DYNAMIC: 'dynamic'
    },
    conquestTypes: {
        GAIN: 'gain',
        LOSS: 'loss',
        SELF: 'self'
    },
    tribeMemberChangeTypes: {
        LEFT: 'left',
        JOIN: 'join'
    }
}
