require([
    'TW2Map',
    'TW2DataLoader',
    'TW2Tooltip',
    'utils',
    'i18n',
    'backendValues'
], function (
    TW2Map,
    TW2DataLoader,
    TW2Tooltip,
    utils,
    i18n,
    {
        marketId,
        worldNumber,
        mapShare,
        lastDataSyncDate,
        staticMapExpireTime,
        mapShareTypes
    }
) {
    let colorPicker;
    let notif;
    const KEEP_COLORPICKER_OPEN = 'keep_colorpicker_open';
    const HIGHLIGHTS_STORE_KEY = 'tw2_tracker_map_highlights_' + marketId + worldNumber;
    const IGNORE_HIGHLIGHT_STORAGE = 'ignore_highlight_storage';

    const VILLAGES = 3;

    const setupQuickJump = () => {
        const $quickJumpX = document.querySelector('#quick-jump-x');
        const $quickJumpY = document.querySelector('#quick-jump-y');
        const $quickJumpGo = document.querySelector('#quick-jump-go');

        const onInput = function (event) {
            if (event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrag') {
                const coords = event.target.value.match(/(\d{1,3})[^\d](\d{1,3})/);

                if (coords !== null) {
                    $quickJumpX.value = coords[1];
                    $quickJumpY.value = coords[2];
                    $quickJumpY.focus();
                    return;
                }
            }

            event.target.value = event.target.value.replace(/[^\d]/g, '');

            if (event.target.value.length > 3) {
                event.target.value = $quickJumpX.value.slice(0, 3);
            }
        };

        function onAction (event) {
            if (event.code === 'Escape') {
                $quickJumpX.value = '';
                $quickJumpY.value = '';
            } else if (event.code === 'Enter') {
                move();
            }
        }

        function move () {
            map.moveTo($quickJumpX.value || 500, $quickJumpY.value || 500);
        }

        $quickJumpX.addEventListener('input', onInput);
        $quickJumpY.addEventListener('input', onInput);
        $quickJumpX.addEventListener('keydown', onAction);
        $quickJumpY.addEventListener('keydown', onAction);
        $quickJumpGo.addEventListener('click', move);
    };

    const setupCustomHighlights = async () => {
        const $input = document.getElementById('highlight-id');
        const $results = document.getElementById('search-results');
        const $noResults = document.getElementById('search-no-results');
        const $highlightItems = document.getElementById('highlight-items');
        const maxResults = 5;
        let selectedIndex = 0;
        let results = [];

        function onResults (newResults) {
            results = newResults;

            for (const item of results) {
                const $item = document.createElement('p');
                $item.classList.add('result');
                $item.innerText = item.id;
                $results.appendChild($item);
                $item.addEventListener('click', function (event) {
                    onSelect(item);
                });
            }

            $noResults.classList.add('hidden');
            $results.classList.remove('hidden');

            selectedIndex = 0;
            selectResult(selectedIndex);
        }

        function onNoResults () {
            results = [];
            $noResults.classList.remove('hidden');
            $results.classList.remove('hidden');
        }

        function onSelect (item) {
            resetSearch();
            const color = utils.arrayRandom(TW2Map.colorPalette.flat());
            map.addHighlight(item.highlightType, item.id, color);
        }

        function selectResult (index) {
            const $current = $results.querySelector('.selected');

            if ($current) {
                $current.classList.remove('selected');
            }

            const $item = $results.querySelectorAll('.result')[index];
            $item.classList.add('selected');
        }

        function onMove (dir) {
            if (results.length) {
                selectedIndex = Math.max(0, Math.min(maxResults - 1, selectedIndex + dir));
                selectResult(selectedIndex);
            }
        }

        function resetSearch () {
            $input.value = '';
            results = [];
            $noResults.classList.add('hidden');
            $results.classList.add('hidden');
        }

        map.on('add highlight', (highlightType, id, display, color, flag) => {
            const $item = document.createElement('li');
            const $name = document.createElement('div');
            const $color = document.createElement('div');
            const $villages = document.createElement('div');
            const $icon = document.createElement('span');

            $item.classList.add(`highlight-${utils.normalizeString(id)}`);
            $item.classList.add('item');
            $item.classList.add(highlightType);
            $item.dataset.highlightType = highlightType;
            $item.dataset.id = id;
            $item.dataset.color = color;

            $name.addEventListener('click', () => {
                map.removeHighlight(highlightType, id);
            });

            $name.classList.add('name');
            $name.innerHTML = display;
            
            $icon.classList.add(`icon-${highlightType}`);

            $color.classList.add('color');
            $color.classList.add('open-color-picker');
            $color.style.backgroundColor = color;
            $color.dataset.color = color;

            $color.addEventListener('click', () => {
                colorPicker($color, $color.dataset.color, (pickedColor) => {
                    $color.dataset.color = pickedColor;
                    map.addHighlight(highlightType, id, pickedColor);
                    return true;
                }, KEEP_COLORPICKER_OPEN);
            });

            let realId;
            let villages;

            if (highlightType === TW2Map.highlightTypes.PLAYERS) {
                realId = typeof id === 'number' ? id : loader.playersByName[id.toLowerCase()];
                villages = loader.players.get(realId)[VILLAGES];
            } else if (highlightType === TW2Map.highlightTypes.TRIBES) {
                realId = typeof id === 'number' ? id : loader.tribesByName[id.toLowerCase()] || loader.tribesByTag[id.toLowerCase()];
                villages = loader.tribes.get(realId)[VILLAGES];
            }

            $villages.classList.add('villages');
            $villages.innerHTML = villages > 1 ? `${villages} ${i18n('villages', 'maps')}` : `${villages} ${i18n('village', 'maps')}`;

            $item.appendChild($icon);
            $item.appendChild($name);
            $item.appendChild($color);
            $item.appendChild($villages);
            $highlightItems.appendChild($item);

            if (flag !== IGNORE_HIGHLIGHT_STORAGE) {
                updateStoredHighlights();
            }
        });

        map.on('update highlight', (highlightType, id, display, color) => {
            const $item = $highlightItems.querySelector(`.highlight-${utils.normalizeString(id)}`);

            if (!$item) {
                return false;
            }

            const $color = $item.querySelector('.color');

            $color.style.background = color;
            $item.dataset.color = color;

            updateStoredHighlights();
        });

        map.on('remove highlight', (highlightType, id) => {
            const $item = $highlightItems.querySelector(`.highlight-${utils.normalizeString(id)}`);

            if ($item) {
                $item.remove();
            }

            updateStoredHighlights();
        });

        const data = await (async () => {
            await loader.loadInfo;

            const matches = [];

            for (const [name] of Object.values(loader.players)) {
                matches.push({
                    search: name.toLowerCase(),
                    id: name,
                    highlightType: TW2Map.highlightTypes.PLAYERS
                });
            }

            for (const [name, tag] of Object.values(loader.tribes)) {
                matches.push({
                    search: (tag + name).toLowerCase(),
                    id: tag,
                    highlightType: TW2Map.highlightTypes.TRIBES
                });
            }

            return matches;
        })();

        $input.addEventListener('keydown', function (event) {
            if (event.code === 'ArrowDown' || event.code === 'ArrowUp') {
                event.preventDefault();
            }
        });

        $input.addEventListener('keyup', function (event) {
            if (event.code === 'ArrowDown') {
                return onMove(1);
            } else if (event.code === 'ArrowUp') {
                return onMove(-1);
            } else if (event.code === 'Escape') {
                return resetSearch();
            } else if (event.code === 'Enter') {
                if (results.length) {
                    return onSelect(results[selectedIndex]);
                }
            }

            const value = $input.value.toLowerCase();

            if (!value.length) {
                return resetSearch();
            }

            if (results.length) {
                for (const $oldResult of $results.querySelectorAll('.result')) {
                    $oldResult.remove();
                }
            }

            const newResults = [];

            for (const item of data) {
                if (item.search.includes(value)) {
                    newResults.push(item);

                    if (newResults.length >= maxResults) {
                        break;
                    }
                }
            }

            if (newResults.length) {
                onResults(newResults);
            } else {
                onNoResults();
            }
        });
    };

    const setupColorPicker = () => {
        let activeColorPicker = false;

        const $colorPicker = document.querySelector('#color-picker');
        const $colorPickerTable = $colorPicker.querySelector('table');

        for (const colorsRow of TW2Map.colorPalette) {
            const $row = document.createElement('tr');

            for (const color of colorsRow) {
                const $wrapper = document.createElement('td');
                const $color = document.createElement('div');
                $color.className = 'color';
                $color.style.background = color;
                $color.dataset.color = color;
                $wrapper.appendChild($color);
                $row.appendChild($wrapper);
            }

            $colorPickerTable.appendChild($row);
        }

        const $colors = $colorPicker.querySelectorAll('div');

        const clearActiveColor = () => {
            const $active = $colorPicker.querySelector('.active');

            if ($active) {
                $active.classList.remove('active');
            }
        };

        const updateActiveColor = (newColor) => {
            for (const $color of $colors) {
                if ($color.dataset.color === newColor) {
                    $color.classList.add('active');
                }
            }
        };

        colorPicker = ($reference, selectedColor, callback, flag) => {
            if (!$reference) {
                throw new Error('Color Picker: Invalid reference element');
            }

            if (activeColorPicker) {
                $colorPicker.removeEventListener('mouseup', activeColorPicker);
            }

            clearActiveColor();

            const {x, y} = utils.getElemPosition($reference);

            $colorPicker.style.visibility = 'visible';
            $colorPicker.style.opacity = 1;
            $colorPicker.style.transform = `translate3d(${x}px, ${y}px, 0px)`;

            const index = TW2Map.colorPalette.flat().indexOf(selectedColor);

            if (index !== -1) {
                $colors[index].classList.add('active');
            }

            $colorPicker.style.visibility = 'visible';
            $colorPicker.style.opacity = 1;

            activeColorPicker = (event) => {
                if (event.target.classList.contains('color')) {
                    const color = event.target.dataset.color;

                    callback(color);
                    clearActiveColor();
                    updateActiveColor(color);

                    if (flag !== KEEP_COLORPICKER_OPEN) {
                        closeColorPicker();
                    }
                }
            };

            $colorPicker.addEventListener('mouseup', activeColorPicker);
        };

        const closeColorPicker = () => {
            $colorPicker.removeEventListener('mouseup', activeColorPicker);
            $colorPicker.style.visibility = 'hidden';
            $colorPicker.style.opacity = 0;
            activeColorPicker = false;
        };

        addEventListener('mousedown', (event) => {
            if (activeColorPicker && !event.target.classList.contains('open-color-picker') && !event.target.closest('#color-picker')) {
                closeColorPicker();
            }
        });
    };

    const setupDisplayLastSync = () => {
        if (mapShare && mapShare.type === mapShareTypes.STATIC) {
            return;
        }

        const $lastSync = document.querySelector('#last-sync');
        const $lastSyncDate = document.querySelector('#last-sync-date');

        if (!lastDataSyncDate) {
            $lastSyncDate.innerHTML = 'never';

            return;
        }

        $lastSyncDate.innerHTML = utils.formatSince(lastDataSyncDate);
        $lastSync.classList.remove('hidden');
    };

    const setupDisplayShareDate = () => {
        if (!mapShare) {
            return;
        }

        const $shareDate = document.querySelector('#share-date');
        const $shareDateDate = document.querySelector('#share-date-date');

        $shareDateDate.innerHTML = utils.formatSince(mapShare.creation_date);
        $shareDate.classList.remove('hidden');
    };

    const setupDisplayPosition = () => {
        const $displayPositionX = document.querySelector('#display-position-x');
        const $displayPositionY = document.querySelector('#display-position-y');

        map.on('center coords update', (x, y) => {
            $displayPositionX.innerHTML = x;
            $displayPositionY.innerHTML = y;
        });
    };

    const setupCommonEvents = () => {
        addEventListener('resize', map.recalcSize);

        addEventListener('keydown', (event) => {
            if (event.target.nodeName === 'INPUT') {
                return;
            }

            switch (event.code) {
                case 'Space': {
                    map.moveTo(500, 500);
                    break;
                }
                case 'Equal': {
                    map.zoomIn();
                    break;
                }
                case 'Minus': {
                    map.zoomOut();
                    break;
                }
            }
        });
    };

    const setupSettings = () => {
        let visible = false;

        const $settings = document.querySelector('#settings');
        const $changeSettings = document.querySelector('#change-settings');
        const $colorOptions = document.querySelectorAll('#settings .color-option');

        const closeHandler = function (event) {
            const keep = ['#color-picker', '#settings', '#change-settings'].some((selector) => {
                return event.target.closest(selector);
            });

            if (!keep) {
                $settings.classList.add('hidden');
                removeEventListener('mousedown', closeHandler);
                visible = false;
            }
        };

        $changeSettings.addEventListener('mouseup', () => {
            if (visible) {
                $settings.classList.add('hidden');
                visible = false;
                return;
            }

            $settings.classList.toggle('hidden');
            visible = !visible;

            if (visible) {
                const {x, y} = utils.getElemPosition($changeSettings);
                $settings.style.left = `${x}px`;
                $settings.style.top = `${y}px`;

                addEventListener('mousedown', closeHandler);
            }
        });

        for (const $option of $colorOptions) {
            const id = $option.dataset.settingId;
            const color = map.getSetting(id);

            const $color = document.createElement('div');
            $color.classList.add('color');
            $color.classList.add('open-color-picker');
            $color.dataset.color = color;
            $color.style.backgroundColor = color;

            $option.appendChild($color);

            $color.addEventListener('click', () => {
                colorPicker($color, $color.dataset.color, (pickedColor) => {
                    $color.dataset.color = pickedColor;
                    $color.style.backgroundColor = pickedColor;
                    map.changeSetting(id, pickedColor);
                    return true;
                }, KEEP_COLORPICKER_OPEN);
            });
        }

        map.on('change setting', (id, value) => {
            const $color = $settings.querySelector(`div[data-setting-id="${id}"] .color`);

            if ($color) {
                $color.dataset.color = value;
                $color.style.backgroundColor = value;
            }
        });
    };

    const setupMapShare = async () => {
        let creatingShare = false;

        if (mapShare) {
            const response = await fetch('/maps/api/get-share', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mapShareId: mapShare.share_id,
                    marketId,
                    worldNumber,
                    highlightsOnly: true
                })
            });

            if (response.status === 200) {
                const content = await response.json();
                mapShare.highlights = JSON.parse(content.highlights);
            } else {
                const message = await response.text();
                notif({
                    title: i18n('failed_load_map_share', 'errors'),
                    content: message,
                    timeout: 0
                });
            }

            map.moveTo(mapShare.center_x, mapShare.center_y);

            if (mapShare.settings) {
                for (const [id, value] of Object.entries(mapShare.settings)) {
                    map.changeSetting(id, value, TW2Map.INITIAL_SETUP);
                }
            }

            await loader.loadInfo;

            for (const [highlightType, id, color] of mapShare.highlights) {
                map.addHighlight(highlightType, id, color);
            }
        }

        const $mapShare = document.querySelector('#map-share');
        const $mapSave = document.querySelector('#map-save');
        const $mapShareLoading = $mapShare.querySelector('.loading');
        const $mapSaveLoading = $mapSave.querySelector('.loading');
        const $mapShareLabel = $mapShare.querySelector('span');
        const $mapSaveLabel = $mapSave.querySelector('span');

        $mapShare.addEventListener('click', async () => {
            if (creatingShare) {
                return false;
            }

            creatingShare = true;
            $mapShareLabel.classList.add('hidden');
            $mapShareLoading.classList.remove('hidden');

            try {
                const result = await map.shareMap(mapShareTypes.DYNAMIC);

                notif({
                    title: i18n('dynamic_map', 'maps'),
                    link: location.origin + result,
                    timeout: 0
                });
            } catch (error) {
                notif({
                    title: i18n('failed_gen_share_map', 'errors'),
                    content: error.message
                });
            }

            creatingShare = false;
            $mapShareLabel.classList.remove('hidden');
            $mapShareLoading.classList.add('hidden');
        });

        $mapSave.addEventListener('click', async () => {
            if (creatingShare) {
                return false;
            }

            creatingShare = true;
            $mapSaveLabel.classList.add('hidden');
            $mapSaveLoading.classList.remove('hidden');

            try {
                const result = await map.shareMap(mapShareTypes.STATIC);

                notif({
                    title: i18n('static_map', 'maps'),
                    content: i18n('notif_static_share_expire', 'maps', [staticMapExpireTime]),
                    link: location.origin + result,
                    timeout: 0
                });
            } catch (error) {
                notif({
                    title: i18n('failed_gen_share_map', 'errors'),
                    content: error.message
                });
            }

            creatingShare = false;
            $mapSaveLabel.classList.remove('hidden');
            $mapSaveLoading.classList.add('hidden');
        });
    };

    const setupNotif = () => {
        const $notif = document.querySelector('#notif');
        const $notifTitle = $notif.querySelector('#notif-title');
        const $notifContent = $notif.querySelector('#notif-content');
        const $notifLink = $notif.querySelector('#notif-link');
        const $notifClose = $notif.querySelector('#notif-close');

        let activeTimeout;

        $notifClose.addEventListener('click', () => $notif.classList.add('hidden'));

        notif = ({title = '', content = '', timeout = 3000, link = false}) => {
            clearTimeout(activeTimeout);

            title = String(title);

            if (title.length) {
                $notifTitle.innerText = title;
                $notifTitle.classList.remove('hidden');
            } else {
                $notifTitle.classList.add('hidden');
            }

            if (link) {
                $notifLink.href = link;
                $notifLink.innerText = link;
                $notifLink.classList.remove('hidden');
            } else {
                $notifLink.classList.add('hidden');
            }

            if (content.length) {
                $notifContent.innerHTML = content;
                $notifContent.classList.remove('hidden');
            } else {
                $notifContent.classList.add('hidden');
            }

            $notifContent.innerHTML = content;
            $notif.classList.remove('hidden');

            if (typeof timeout === 'number' && timeout !== 0) {
                activeTimeout = setTimeout(() => {
                    $notif.classList.add('hidden');
                }, timeout);
            }
        };
    };

    const setupWorldList = () => {
        let visible = false;

        let loadWorldsPromise = null;
        let allWorlds = null;
        let allMarkets = null;

        const $allWorlds = document.querySelector('#all-worlds');
        const $allMarkets = document.querySelector('#all-markets');
        const $currentWorld = document.querySelector('#current-world');
        const $allMarketWorlds = document.querySelector('#all-market-worlds');
        const $loading = $allWorlds.querySelector('.loading');

        const loadWorlds = () => {
            if (loadWorldsPromise) {
                return loadWorldsPromise;
            }

            loadWorldsPromise = new Promise(async (resolve) => {
                const responseWorlds = await fetch('/maps/api/get-open-worlds');
                const worlds = await responseWorlds.json();

                allWorlds = worlds;
                allMarkets = new Set(worlds.map((world) => world.market));

                buildWorldList();
                changeWorldList(marketId);
                $loading.classList.add('hidden');
                resolve();
            });
        };

        const buildWorldList = () => {
            for (const market of allMarkets) {
                const $marketContainer = document.createElement('li');
                const $button = document.createElement('div');
                const $flag = document.createElement('span');

                $button.dataset.market = market;
                $button.appendChild($flag);

                if (market === marketId) {
                    $button.classList.add('selected');
                }

                $button.classList.add('market');
                $button.classList.add('text-container');
                $flag.innerText = market;
                $flag.classList.add(`flag-${market}`);

                $button.appendChild($flag);

                $button.addEventListener('mouseenter', function () {
                    const $selectedmarket = $allWorlds.querySelector('.market.selected');

                    if ($selectedmarket) {
                        $selectedmarket.classList.remove('selected');
                    }

                    this.classList.add('selected');

                    changeWorldList(this.dataset.market);
                });

                $marketContainer.appendChild($button);
                $allMarkets.appendChild($marketContainer);
            }
        };

        const changeWorldList = function (newMarket) {
            const marketWorlds = allWorlds.filter((world) => world.market === newMarket);

            while ($allMarketWorlds.firstChild) {
                $allMarketWorlds.removeChild($allMarketWorlds.lastChild);
            }

            for (const {market, num, name} of marketWorlds) {
                const $world = document.createElement('li');
                const $archor = document.createElement('a');
                const $button = document.createElement('button');

                $archor.href = location.origin + `/maps/${market}/${num}/`;

                $button.classList.add('world');

                if (worldNumber === num && marketId === market) {
                    $button.classList.add('selected');
                }

                $button.innerText = `${market}${num} ${name}`;

                $archor.appendChild($button);
                $world.appendChild($archor);
                $allMarketWorlds.appendChild($world);
            }
        };

        const closeHandler = function (event) {
            const keep = ['#all-worlds', '#current-world'].some((selector) => {
                return event.target.closest(selector);
            });

            if (!keep) {
                $allWorlds.classList.add('hidden');
                removeEventListener('mousedown', closeHandler);
                visible = false;
            }
        };

        $currentWorld.addEventListener('mouseup', async () => {
            await loadWorlds();

            if (visible) {
                $allWorlds.classList.add('hidden');
                visible = false;
                return;
            }

            $allWorlds.classList.toggle('hidden');
            visible = !visible;

            if (visible) {
                const {x, y} = utils.getElemPosition($currentWorld);
                $allWorlds.style.left = `${x}px`;
                $allWorlds.style.top = `${y}px`;

                addEventListener('mousedown', closeHandler);
            }
        });
    };

    const setupPanelToggle = () => {
        const $panelToggle = document.querySelector('#panel-toggle');
        const $sidePanel = document.querySelector('#side-panel');
        const $map = document.querySelector('#map');

        $panelToggle.addEventListener('click', function (event) {
            $sidePanel.classList.toggle('hidden');
            $map.classList.toggle('full');
            $panelToggle.classList.toggle('hide');
            map.recalcSize();
        });
    };

    const setupStoredHighlights = async () => {
        await loader.loadInfo;

        const stored = localStorage.getItem(HIGHLIGHTS_STORE_KEY);

        if (stored) {
            const parsed = Object.values(JSON.parse(stored).highlights);

            for (const items of parsed) {
                for (const item of Object.values(items)) {
                    const {highlightType, id, color} = item;
                    map.addHighlight(highlightType, id, color, IGNORE_HIGHLIGHT_STORAGE);
                }
            }
        }
    };

    function createFloatingModal (id, items, onClose) {
        const $template = document.querySelector('#floating-modal');
        const $modal = $template.content.cloneNode(true).children[0];
        const $header = $modal.querySelector('header');
        const $modalBody = $modal.querySelector('.floating-modal-body');
        const $close = $header.querySelector('.floating-modal-close');
        const $drag = $header.querySelector('.floating-modal-drag');
        const $menu = $header.querySelector('.floating-modal-menu');

        let $selectedBody;
        let $selectedButton;

        $modal.id = id;

        let firstItem = true;

        for (const {label, $body, click} of items) {
            const $button = document.createElement('button');
            const $bodyWrapper = document.createElement('div');

            $bodyWrapper.appendChild($body);

            if (firstItem) {
                $selectedBody = $bodyWrapper;
                $selectedButton = $button;
                $button.classList.add('selected');
                $bodyWrapper.classList.add('selected');
                firstItem = false;
            }

            $button.innerText = label;
            $button.addEventListener('click', function () {
                $selectedButton.classList.remove('selected');
                $selectedBody.classList.remove('selected');
                $selectedBody = $bodyWrapper;
                $selectedButton = $button;
                $selectedBody.classList.add('selected');
                $selectedButton.classList.add('selected');
                click();
            });

            $modalBody.appendChild($bodyWrapper);
            $menu.appendChild($button);
        }

        function close () {
            $modal.classList.add('hidden');

            if (onClose) {
                onClose();
            }
        }

        function open () {
            $modal.classList.remove('hidden');
        }

        function toggle () {
            if ($modal.classList.contains('hidden')) {
                open();
            } else {
                close();
            }
        }

        $close.addEventListener('click', close);

        let dragging = false;
        let startX;
        let startY;

        const dragEvent = function (event) {
            if (dragging) {
                $modal.style.left = startX + event.clientX + 'px';
                $modal.style.top = startY + event.clientY + 'px';
            }
        };

        $drag.addEventListener('mousedown', function (event) {
            document.body.addEventListener('mousemove', dragEvent);

            dragging = true;

            const rect = $modal.getBoundingClientRect();

            startX = rect.x - event.clientX;
            startY = rect.y - event.clientY;
        });

        document.body.addEventListener('mouseup', function () {
            dragging = false;
            document.body.removeEventListener('mousemove', dragEvent);
        });

        document.body.appendChild($modal);

        return {
            close,
            open,
            toggle,
            $modal
        };
    }

    const setupRanking = async () => {
        const $rankingToggle = document.querySelector('#ranking-toggle');
        const $rankingPlayers = document.querySelector('#ranking-players').content.cloneNode(true).children[0];
        const $rankingTribes = document.querySelector('#ranking-tribes').content.cloneNode(true).children[0];

        const modalItems = [{
            label: 'Players',
            $body: $rankingPlayers,
            click: function () {
                console.log('click players');
            }
        }, {
            label: 'Tribes',
            $body: $rankingTribes,
            click: function () {
                console.log('click tribes');
            }
        }];

        await loader.loadInfo;

        if (loader.config.victory_points) {
            $rankingPlayers.querySelector('.victory-points').classList.remove('hidden');
            $rankingTribes.querySelector('.victory-points').classList.remove('hidden');
        }

        const itemsLimit = 15;
        const modal = createFloatingModal('ranking', modalItems);

        for (const $ranking of [$rankingPlayers, $rankingTribes]) {
            const type = $ranking.dataset.type;
            const $body = $ranking.querySelector('tbody');
            const $pagination = $ranking.querySelector('.pagination');
            const $paginationPages = $pagination.querySelector('.pages');
            const $paginationFirst = $pagination.querySelector('.first');
            const $paginationPrev = $pagination.querySelector('.prev');
            const $paginationLast = $pagination.querySelector('.last');
            const $paginationNext = $pagination.querySelector('.next');

            const data = Array.from(loader[type].entries()).filter(([id, subject]) => subject[VILLAGES]);
            let page = 1;
            const lastPage = Math.max(1, Math.ceil(data.length / itemsLimit));
            const domination = [];

            if (type === 'tribes' && !loader.config.victory_points) {
                let topTenVillages = 0;

                for (let i = 0; i < 10; i++) {
                    topTenVillages += data[i][1][VILLAGES];
                }

                for (let i = 0; i < 10; i++) {
                    domination.push(Math.round((data[i][1][VILLAGES] / topTenVillages * 100)));
                }
            }

            const renderRankingPage = function () {
                while ($body.firstChild) {
                    $body.removeChild($body.lastChild);
                }

                const offset = (page - 1) * itemsLimit;

                for (const [id, subject] of data.slice(offset, offset + itemsLimit)) {
                    const $row = document.createElement('tr');
                    $row.classList.add('quick-highlight');
                    $row.dataset.id = id;
                    $row.dataset.type = type;

                    let name;
                    let tribeId;
                    let tag;
                    let points;
                    let villages;
                    let bashOff;
                    let bashDef;
                    let VP;
                    let rank;

                    if (type === 'players') {
                        ([name, tribeId, points, villages, , bashOff, bashDef, VP, rank] = subject);
                    } else {
                        ([name, tag, points, villages, , bashOff, bashDef, VP, rank] = subject);
                    }

                    const $rank = document.createElement('td');
                    const $name = document.createElement('td');
                    const $nameSpan = document.createElement('span');
                    const $points = document.createElement('td');
                    const $villages = document.createElement('td');
                    const $bashOff = document.createElement('td');
                    const $bashDef = document.createElement('td');
                    const $actions = document.createElement('td');

                    $rank.innerText = rank;

                    if (type === 'players') {
                        if (loader.tribes.has(tribeId)) {
                            const tribeTag = loader.tribes.get(tribeId)[1];
                            $nameSpan.innerText = `${name} [${tribeTag}]`;
                        } else {
                            $nameSpan.innerText = name;
                        }
                    } else {
                        $nameSpan.innerText = `${name} [${tag}]`;
                    }

                    $points.innerText = points.toLocaleString('pt-BR');
                    $villages.innerText = (type === 'tribes' && rank < 11 && !loader.config.victory_points) ? `${villages} (${domination[rank - 1]}%)` : villages;
                    $bashOff.innerText = bashOff.toLocaleString('pt-BR');
                    $bashDef.innerText = bashDef.toLocaleString('pt-BR');

                    $nameSpan.classList.add('highlight');
                    $nameSpan.addEventListener('click', function () {
                        const color = utils.arrayRandom(TW2Map.colorPalette.flat());
                        map.addHighlight(type, id, color);
                    });
                    $name.appendChild($nameSpan);

                    const $stats = document.createElement('a');
                    $stats.href = `/stats/${marketId}/${worldNumber}/${type}/${id}`;
                    $stats.innerText = i18n('button_open_stats', 'maps');
                    $actions.appendChild($stats);

                    $row.appendChild($rank);
                    $row.appendChild($name);
                    $row.appendChild($points);
                    $row.appendChild($villages);
                    $row.appendChild($bashOff);
                    $row.appendChild($bashDef);

                    if (loader.config.victory_points) {
                        const $VP = document.createElement('td');
                        $VP.innerText = VP;
                        $row.appendChild($VP);
                    }

                    $row.appendChild($actions);
                    $body.appendChild($row);
                }

                updatePagination();
                setTemporaryHighlights();
            };

            const updatePagination = function () {
                const start = Math.max(1, page - 3);
                const end = Math.min(lastPage, page + 3);

                while ($paginationPages.firstChild) {
                    $paginationPages.removeChild($paginationPages.lastChild);
                }

                for (let i = start; i <= end; i++) {
                    let $page;

                    if (i === page) {
                        $page = document.createElement('span');
                        $page.classList.add('current');
                    } else {
                        $page = document.createElement('a');
                        $page.addEventListener('click', function () {
                            page = i;
                            renderRankingPage();
                        });
                    }

                    $page.innerText = i;
                    $page.classList.add('page');
                    $paginationPages.appendChild($page);
                }
            };

            $paginationFirst.addEventListener('click', function () {
                page = 1;
                renderRankingPage();
            });

            $paginationLast.addEventListener('click', function () {
                page = lastPage;
                renderRankingPage();
            });

            $paginationNext.addEventListener('click', function () {
                page = Math.min(lastPage, page + 1);
                renderRankingPage();
            });

            $paginationPrev.addEventListener('click', function () {
                page = Math.max(1, page - 1);
                renderRankingPage();
            });

            renderRankingPage();
        }
        
        $rankingToggle.addEventListener('click', async function () {
            modal.toggle();
        });
    };

    function shortifyPoints (points) {
        if (points >= 1000000) {
            return parseFloat((points / 1000 / 1000).toFixed(1)) + 'kk';
        } else {
            return parseFloat((points / 1000).toFixed(1)) + 'k';
        }
    }

    function averagePositionFor (type, id) {
        let averageX;
        let averageY;

        switch (type) {
            case TW2Map.highlightTypes.TRIBES: {
                [averageX, averageY] = loader.tribes.get(id)[4];
                break;
            }
            case TW2Map.highlightTypes.PLAYERS: {
                [averageX, averageY] = loader.players.get(id)[4];
                break;
            }
            case TW2Map.highlightTypes.VILLAGES: {
                averageX = loader.villagesById[id].x;
                averageY = loader.villagesById[id].y;
                break;
            }
            default: {
                throw new Error('averagePositionFor: Invalid type.');
            }
        }

        return [averageX, averageY];
    }

    function setTemporaryHighlights () {
        const $elements = document.querySelectorAll('.quick-highlight');

        if (!$elements.length) {
            return false;
        }

        for (const $elem of $elements) {
            $elem.addEventListener('mouseenter', () => {
                const id = parseInt($elem.dataset.id, 10);

                if ($elem.dataset.type === 'conquest') {
                    const newOwner = parseInt($elem.dataset.newOwner, 10);
                    const oldOwner = parseInt($elem.dataset.oldOwner, 10);

                    if (oldOwner) {
                        map.quickHighlight('players', oldOwner, TW2Map.colorPaletteTopThree[2]);
                    }

                    map.quickHighlight('players', newOwner, TW2Map.colorPaletteTopThree[1]);
                    map.quickHighlight('villages', id);
                    map.moveTo(...averagePositionFor('villages', id));
                } else {
                    map.quickHighlight($elem.dataset.type, id);
                    map.moveTo(...averagePositionFor($elem.dataset.type, id));
                }
            });

            $elem.addEventListener('mouseleave', () => {
                map.quickHighlightOff();
            });
        }
    }

    function updateStoredHighlights () {
        localStorage.setItem(HIGHLIGHTS_STORE_KEY, JSON.stringify({highlights: map.getHighlights()}));
    }

    // const setupAbout = () => {
    //     const $contact = document.querySelector('#contact')
    //     const $about = document.querySelector('#about')

    //     $contact.addEventListener('click', () => {
    //         notif({
    //             title: 'Contact',
    //             content: 'contact@tw2-tracker.com',
    //             timeout: 0
    //         })
    //     })

    //     $about.addEventListener('click', () => {
    //         notif({
    //             title: 'About',
    //             content: 'This site is an interactive world map for Tribal Wars 2 created in 2020 by <i>anonymous</i>.',
    //             timeout: 0
    //         })
    //     })
    // }

    const loader = new TW2DataLoader(marketId, worldNumber);
    const tooltip = new TW2Tooltip('#map-tooltip');
    const map = new TW2Map('#map', loader, tooltip, {});

    setupQuickJump();
    setupCustomHighlights();
    setupColorPicker();
    setupDisplayShareDate();
    setupDisplayLastSync();
    setupDisplayPosition();
    setupCommonEvents();
    setupNotif();
    setupWorldList();
    setupSettings();
    setupMapShare();
    setupPanelToggle();
    setupStoredHighlights();
    setupRanking();
    // setupAbout()

    map.init();
});
