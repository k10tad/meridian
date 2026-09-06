// Meridian Private Atlas v1.0
// Local journey records with a registration-free OpenStreetMap tile view.
(function () {
    "use strict";

    const STORAGE_KEY = "meridianAtlasV1";
    const MODE_KEY = "meridianPlannerMode";
    const TILE_SIZE = 256;
    const MIN_ZOOM = 2;
    const MAX_ZOOM = 18;
    const DEFAULT_VIEW = { latitude: 34.6937, longitude: 135.5023, zoom: 10 };

    const elements = {
        modeTabs: Array.from(document.querySelectorAll("[data-planner-mode]")),
        plannerPanel: document.getElementById("plannerPanel"),
        atlasPanel: document.getElementById("atlasPanel"),
        subtitle: document.getElementById("plannerModeSubtitle"),
        overview: document.getElementById("atlasOverviewText"),
        newJourney: document.getElementById("atlasNewJourney"),
        list: document.getElementById("atlasJourneyList"),
        count: document.getElementById("atlasJourneyCount"),
        filter: document.getElementById("atlasJourneyFilter"),
        mapTitle: document.getElementById("atlasMapTitle"),
        map: document.getElementById("atlasMap"),
        tiles: document.getElementById("atlasMapTiles"),
        markers: document.getElementById("atlasMapMarkers"),
        mapStatus: document.getElementById("atlasMapStatus"),
        zoomIn: document.getElementById("atlasZoomIn"),
        zoomOut: document.getElementById("atlasZoomOut"),
        addCenterPin: document.getElementById("atlasAddCenterPin"),
        fitPins: document.getElementById("atlasFitPins"),
        journeyModal: document.getElementById("atlasJourneyModal"),
        journeyClose: document.getElementById("atlasJourneyClose"),
        journeyId: document.getElementById("atlasJourneyId"),
        journeyTitle: document.getElementById("atlasJourneyTitle"),
        journeyLocation: document.getElementById("atlasJourneyLocation"),
        journeyStart: document.getElementById("atlasJourneyStart"),
        journeyEnd: document.getElementById("atlasJourneyEnd"),
        journeyStatus: document.getElementById("atlasJourneyStatus"),
        journeyUrl: document.getElementById("atlasJourneyUrl"),
        journeyNotes: document.getElementById("atlasJourneyNotes"),
        journeyCoverInput: document.getElementById("atlasJourneyCoverInput"),
        journeyCoverPreview: document.getElementById("atlasJourneyCoverPreview"),
        journeyCoverRemove: document.getElementById("atlasJourneyCoverRemove"),
        journeyFormStatus: document.getElementById("atlasJourneyFormStatus"),
        journeySave: document.getElementById("atlasJourneySave"),
        journeyDelete: document.getElementById("atlasJourneyDelete"),
        pinModal: document.getElementById("atlasPinModal"),
        pinClose: document.getElementById("atlasPinClose"),
        pinId: document.getElementById("atlasPinId"),
        pinLatitude: document.getElementById("atlasPinLatitude"),
        pinLongitude: document.getElementById("atlasPinLongitude"),
        pinJourney: document.getElementById("atlasPinJourney"),
        pinTitle: document.getElementById("atlasPinTitle"),
        pinCategory: document.getElementById("atlasPinCategory"),
        pinStatus: document.getElementById("atlasPinStatus"),
        pinPriority: document.getElementById("atlasPinPriority"),
        pinUrl: document.getElementById("atlasPinUrl"),
        pinNotes: document.getElementById("atlasPinNotes"),
        pinCoordinates: document.getElementById("atlasPinCoordinates"),
        pinFormStatus: document.getElementById("atlasPinFormStatus"),
        pinSave: document.getElementById("atlasPinSave"),
        pinDelete: document.getElementById("atlasPinDelete")
    };

    if (!elements.atlasPanel || !elements.map) return;

    let atlas = readAtlas();
    let view = Object.assign({}, initialView(), atlas.view || {});
    view.latitude = Number.isFinite(Number(view.latitude)) ? Math.max(-85, Math.min(85, Number(view.latitude))) : DEFAULT_VIEW.latitude;
    view.longitude = Number.isFinite(Number(view.longitude)) ? normalizeLongitude(Number(view.longitude)) : DEFAULT_VIEW.longitude;
    view.zoom = Number.isFinite(Number(view.zoom)) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(Number(view.zoom)))) : DEFAULT_VIEW.zoom;
    let activeFilter = "all";
    let pendingCoverBlob = null;
    let pendingCoverRemoved = false;
    let coverPreviewUrl = "";
    let pointerState = null;
    let renderFrame = 0;

    function id(prefix) {
        return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function cleanUrl(value) {
        const raw = String(value || "").trim();
        if (!raw) return "";
        try {
            const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
            return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
        } catch (_) {
            return "";
        }
    }

    function normalizePin(pin) {
        const latitude = Number(pin && pin.latitude);
        const longitude = Number(pin && pin.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        pin = pin || {};
        return {
            id: String(pin.id || id("pin")),
            title: String(pin.title || "Pinned location"),
            latitude: Math.max(-85, Math.min(85, latitude)),
            longitude: normalizeLongitude(longitude),
            category: ["sight", "stay", "food", "shop", "transit", "note"].includes(pin.category) ? pin.category : "sight",
            status: pin.status === "visited" ? "visited" : "planned",
            priority: ["normal", "high", "optional"].includes(pin.priority) ? pin.priority : "normal",
            url: cleanUrl(pin.url),
            notes: String(pin.notes || ""),
            createdAt: pin.createdAt || new Date().toISOString(),
            updatedAt: pin.updatedAt || new Date().toISOString()
        };
    }

    function normalizeJourney(journey) {
        journey = journey || {};
        return {
            id: String(journey.id || id("journey")),
            title: String(journey.title || "Untitled Journey"),
            location: String(journey.location || ""),
            startDate: String(journey.startDate || ""),
            endDate: String(journey.endDate || ""),
            status: ["planned", "visited", "wishlist"].includes(journey.status) ? journey.status : "planned",
            url: cleanUrl(journey.url),
            notes: String(journey.notes || ""),
            coverAssetId: String(journey.coverAssetId || ""),
            pins: Array.isArray(journey.pins) ? journey.pins.map(normalizePin).filter(Boolean) : [],
            createdAt: journey.createdAt || new Date().toISOString(),
            updatedAt: journey.updatedAt || new Date().toISOString()
        };
    }

    function readAtlas() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) { saved = null; }
        return {
            version: 1,
            view: saved && saved.view ? saved.view : null,
            journeys: saved && Array.isArray(saved.journeys) ? saved.journeys.map(normalizeJourney) : []
        };
    }

    function writeAtlas() {
        atlas.version = 1;
        atlas.view = {
            latitude: view.latitude,
            longitude: view.longitude,
            zoom: view.zoom
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(atlas));
        window.dispatchEvent(new Event("meridianDataUpdated"));
    }

    function initialView() {
        let weather = window.MeridianWeather && typeof window.MeridianWeather.getLocation === "function"
            ? window.MeridianWeather.getLocation()
            : null;
        if (!weather) {
            try { weather = JSON.parse(localStorage.getItem("meridianWeatherLocation")); } catch (_) { weather = null; }
        }
        return weather && Number.isFinite(Number(weather.latitude)) && Number.isFinite(Number(weather.longitude))
            ? { latitude: Number(weather.latitude), longitude: Number(weather.longitude), zoom: 10 }
            : DEFAULT_VIEW;
    }

    function normalizeLongitude(longitude) {
        return ((Number(longitude) + 180) % 360 + 360) % 360 - 180;
    }

    function project(latitude, longitude, zoom) {
        const scale = TILE_SIZE * Math.pow(2, zoom);
        const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
        const sine = Math.sin(lat * Math.PI / 180);
        return {
            x: (normalizeLongitude(longitude) + 180) / 360 * scale,
            y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale
        };
    }

    function unproject(x, y, zoom) {
        const scale = TILE_SIZE * Math.pow(2, zoom);
        const longitude = x / scale * 360 - 180;
        const n = Math.PI - 2 * Math.PI * y / scale;
        const latitude = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
        return { latitude: Math.max(-85, Math.min(85, latitude)), longitude: normalizeLongitude(longitude) };
    }

    function currentTopLeft() {
        const center = project(view.latitude, view.longitude, view.zoom);
        return {
            x: center.x - elements.map.clientWidth / 2,
            y: center.y - elements.map.clientHeight / 2
        };
    }

    function pointToCoordinates(clientX, clientY) {
        const rect = elements.map.getBoundingClientRect();
        const topLeft = currentTopLeft();
        return unproject(topLeft.x + clientX - rect.left, topLeft.y + clientY - rect.top, view.zoom);
    }

    function visiblePins() {
        const journeys = activeFilter === "all"
            ? atlas.journeys
            : atlas.journeys.filter(function (journey) { return journey.id === activeFilter; });
        return journeys.flatMap(function (journey) {
            return journey.pins.map(function (pin) { return { journey: journey, pin: pin }; });
        });
    }

    function scheduleMapRender() {
        if (renderFrame) return;
        renderFrame = window.requestAnimationFrame(function () {
            renderFrame = 0;
            renderMap();
        });
    }

    function renderMap() {
        if (elements.atlasPanel.hidden || !elements.map.clientWidth || !elements.map.clientHeight) return;
        view.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(view.zoom)));
        const zoom = view.zoom;
        const worldTiles = Math.pow(2, zoom);
        const topLeft = currentTopLeft();
        const startX = Math.floor(topLeft.x / TILE_SIZE) - 1;
        const startY = Math.floor(topLeft.y / TILE_SIZE) - 1;
        const endX = Math.ceil((topLeft.x + elements.map.clientWidth) / TILE_SIZE) + 1;
        const endY = Math.ceil((topLeft.y + elements.map.clientHeight) / TILE_SIZE) + 1;
        const tileFragment = document.createDocumentFragment();
        const existingTiles = new Map(Array.from(elements.tiles.querySelectorAll("img")).map(function (image) {
            return [image.dataset.tileKey, image];
        }));
        const requiredTiles = new Set();

        for (let tileY = startY; tileY <= endY; tileY += 1) {
            if (tileY < 0 || tileY >= worldTiles) continue;
            for (let tileX = startX; tileX <= endX; tileX += 1) {
                const wrappedX = ((tileX % worldTiles) + worldTiles) % worldTiles;
                const tileKey = zoom + ":" + tileX + ":" + tileY;
                requiredTiles.add(tileKey);
                let image = existingTiles.get(tileKey);
                if (!image) {
                    image = document.createElement("img");
                    image.alt = "";
                    image.draggable = false;
                    image.dataset.tileKey = tileKey;
                    image.src = "https://tile.openstreetmap.org/" + zoom + "/" + wrappedX + "/" + tileY + ".png";
                    tileFragment.appendChild(image);
                }
                image.style.left = (tileX * TILE_SIZE - topLeft.x) + "px";
                image.style.top = (tileY * TILE_SIZE - topLeft.y) + "px";
            }
        }
        existingTiles.forEach(function (image, tileKey) {
            if (!requiredTiles.has(tileKey)) image.remove();
        });
        elements.tiles.appendChild(tileFragment);

        elements.markers.innerHTML = "";
        visiblePins().forEach(function (entry) {
            const position = project(entry.pin.latitude, entry.pin.longitude, zoom);
            const left = position.x - topLeft.x;
            const top = position.y - topLeft.y;
            if (left < -40 || top < -50 || left > elements.map.clientWidth + 40 || top > elements.map.clientHeight + 50) return;
            const marker = document.createElement("button");
            marker.type = "button";
            marker.className = "atlas-marker category-" + entry.pin.category + " status-" + entry.pin.status;
            marker.style.left = left + "px";
            marker.style.top = top + "px";
            marker.title = entry.pin.title + " · " + entry.journey.title;
            marker.setAttribute("aria-label", marker.title);
            marker.innerHTML = "<span></span>";
            marker.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
            marker.addEventListener("click", function (event) {
                event.stopPropagation();
                openPinEditor(entry.pin, entry.journey.id);
            });
            elements.markers.appendChild(marker);
        });
    }

    function setMapStatus(message) {
        elements.mapStatus.textContent = message;
    }

    function formatJourneyDates(journey) {
        if (!journey.startDate && !journey.endDate) return "DATE OPEN";
        const start = journey.startDate ? new Date(journey.startDate + "T12:00:00").toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" }) : "未定";
        const end = journey.endDate ? new Date(journey.endDate + "T12:00:00").toLocaleDateString("ja-JP", { month: "short", day: "numeric" }) : "";
        return end && journey.endDate !== journey.startDate ? start + " — " + end : start;
    }

    function renderJourneyFilters() {
        const selected = atlas.journeys.some(function (journey) { return journey.id === activeFilter; }) ? activeFilter : "all";
        activeFilter = selected;
        elements.filter.innerHTML = "<option value='all'>ALL</option>" + atlas.journeys.map(function (journey) {
            return "<option value='" + escapeHtml(journey.id) + "'>" + escapeHtml(journey.title) + "</option>";
        }).join("");
        elements.filter.value = activeFilter;
        const active = atlas.journeys.find(function (journey) { return journey.id === activeFilter; });
        elements.mapTitle.textContent = active ? active.title : "All Journeys";
    }

    function loadJourneyCovers() {
        if (!window.MeridianPhotoDB) return;
        elements.list.querySelectorAll("[data-atlas-cover]").forEach(async function (container) {
            try {
                const asset = await window.MeridianPhotoDB.getAsset(container.dataset.atlasCover);
                if (!asset || !asset.blob) return;
                const url = URL.createObjectURL(asset.blob);
                const image = new Image();
                image.alt = "";
                image.addEventListener("load", function () { URL.revokeObjectURL(url); }, { once: true });
                image.src = url;
                container.innerHTML = "";
                container.appendChild(image);
            } catch (error) {
                console.warn("Meridian Atlas: cover could not be loaded.", error);
            }
        });
    }

    function renderJourneys() {
        const pinCount = atlas.journeys.reduce(function (sum, journey) { return sum + journey.pins.length; }, 0);
        const visitedCount = atlas.journeys.filter(function (journey) { return journey.status === "visited"; }).length;
        elements.count.textContent = atlas.journeys.length + (atlas.journeys.length === 1 ? " record" : " records");
        elements.overview.textContent = atlas.journeys.length
            ? atlas.journeys.length + "件の旅程、" + pinCount + "本のピン、訪問済み" + visitedCount + "件を端末内に保管している。"
            : "旅程を作り、地図へ行きたい場所と訪れた場所を残す。";

        if (!atlas.journeys.length) {
            elements.list.innerHTML = "<div class='atlas-empty'><strong>NO JOURNEY FILES</strong><span>最初の旅程を作れば、地図へピンを置ける。</span></div>";
        } else {
            elements.list.innerHTML = atlas.journeys.slice().sort(function (a, b) {
                return String(b.updatedAt).localeCompare(String(a.updatedAt));
            }).map(function (journey) {
                const summary = journey.notes.trim().slice(0, 110);
                const link = journey.url ? "<a href='" + escapeHtml(journey.url) + "' target='_blank' rel='noopener noreferrer'>OPEN LINK ↗</a>" : "";
                return "<article class='atlas-journey-card status-" + journey.status + "'>" +
                    (journey.coverAssetId ? "<div class='atlas-journey-cover' data-atlas-cover='" + escapeHtml(journey.coverAssetId) + "'><span>IMAGE FILE</span></div>" : "") +
                    "<div class='atlas-journey-body'><div class='atlas-journey-top'><span>" + escapeHtml(journey.status.toUpperCase()) + "</span><strong>" + journey.pins.length + " PINS</strong></div>" +
                    "<h2>" + escapeHtml(journey.title) + "</h2>" +
                    "<div class='atlas-journey-meta'>" + escapeHtml(journey.location || "LOCATION OPEN") + " · " + escapeHtml(formatJourneyDates(journey)) + "</div>" +
                    (summary ? "<p>" + escapeHtml(summary) + (journey.notes.length > 110 ? "…" : "") + "</p>" : "") +
                    "<div class='atlas-journey-actions'>" + link + "<button type='button' data-atlas-map='" + escapeHtml(journey.id) + "'>MAP</button><button type='button' data-atlas-edit='" + escapeHtml(journey.id) + "'>EDIT</button></div></div></article>";
            }).join("");
        }

        elements.list.querySelectorAll("[data-atlas-edit]").forEach(function (button) {
            button.addEventListener("click", function () {
                const journey = atlas.journeys.find(function (item) { return item.id === button.dataset.atlasEdit; });
                if (journey) openJourneyEditor(journey);
            });
        });
        elements.list.querySelectorAll("[data-atlas-map]").forEach(function (button) {
            button.addEventListener("click", function () {
                activeFilter = button.dataset.atlasMap;
                renderJourneyFilters();
                fitVisiblePins();
                elements.map.scrollIntoView({ behavior: "smooth", block: "center" });
            });
        });
        loadJourneyCovers();
        renderJourneyFilters();
        scheduleMapRender();
    }

    function setModal(modal, open) {
        modal.hidden = !open;
        const anyOpen = !elements.journeyModal.hidden || !elements.pinModal.hidden;
        document.body.classList.toggle("modal-open", anyOpen);
    }

    function clearCoverPreview() {
        if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
        coverPreviewUrl = "";
        elements.journeyCoverPreview.innerHTML = "<span>NO IMAGE</span>";
    }

    function showCoverBlob(blob) {
        clearCoverPreview();
        coverPreviewUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.alt = "Journey cover preview";
        image.src = coverPreviewUrl;
        elements.journeyCoverPreview.innerHTML = "";
        elements.journeyCoverPreview.appendChild(image);
    }

    async function loadCoverPreview(assetId) {
        clearCoverPreview();
        if (!assetId || !window.MeridianPhotoDB) return;
        try {
            const asset = await window.MeridianPhotoDB.getAsset(assetId);
            if (asset && asset.blob) showCoverBlob(asset.blob);
        } catch (error) {
            elements.journeyFormStatus.textContent = "保存済み写真を読み込めなかった。旅程本文は編集できる。";
        }
    }

    function openJourneyEditor(journey) {
        const current = journey || null;
        pendingCoverBlob = null;
        pendingCoverRemoved = false;
        elements.journeyId.value = current ? current.id : "";
        elements.journeyTitle.value = current ? current.title : "";
        elements.journeyLocation.value = current ? current.location : "";
        elements.journeyStart.value = current ? current.startDate : "";
        elements.journeyEnd.value = current ? current.endDate : "";
        elements.journeyStatus.value = current ? current.status : "planned";
        elements.journeyUrl.value = current ? current.url : "";
        elements.journeyNotes.value = current ? current.notes : "";
        elements.journeyCoverInput.value = "";
        elements.journeyDelete.hidden = !current;
        elements.journeyFormStatus.textContent = current ? "旅程と記録を編集できる。" : "新しい旅程ファイルを作成する。";
        loadCoverPreview(current && current.coverAssetId);
        setModal(elements.journeyModal, true);
        window.setTimeout(function () { elements.journeyTitle.focus(); }, 60);
    }

    function closeJourneyEditor() {
        setModal(elements.journeyModal, false);
        clearCoverPreview();
        pendingCoverBlob = null;
        pendingCoverRemoved = false;
    }

    function imageBlob(file) {
        return new Promise(function (resolve, reject) {
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.addEventListener("load", function () {
                try {
                    const maxSide = 1400;
                    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(function (blob) {
                        URL.revokeObjectURL(url);
                        blob ? resolve(blob) : reject(new Error("写真を圧縮できなかった。"));
                    }, "image/jpeg", 0.82);
                } catch (error) {
                    URL.revokeObjectURL(url);
                    reject(error);
                }
            }, { once: true });
            image.addEventListener("error", function () {
                URL.revokeObjectURL(url);
                reject(new Error("この写真形式を読み込めなかった。"));
            }, { once: true });
            image.src = url;
        });
    }

    async function saveJourney() {
        const title = elements.journeyTitle.value.trim();
        if (!title) {
            elements.journeyFormStatus.textContent = "旅程名を入力しろ。";
            elements.journeyTitle.focus();
            return;
        }
        if (elements.journeyStart.value && elements.journeyEnd.value && elements.journeyEnd.value < elements.journeyStart.value) {
            elements.journeyFormStatus.textContent = "終了日は開始日より後に設定しろ。";
            return;
        }
        const url = cleanUrl(elements.journeyUrl.value);
        if (elements.journeyUrl.value.trim() && !url) {
            elements.journeyFormStatus.textContent = "URLを確認してくれ。httpまたはhttpsだけ保存できる。";
            return;
        }

        const existing = atlas.journeys.find(function (journey) { return journey.id === elements.journeyId.value; });
        const now = new Date().toISOString();
        const journey = existing || normalizeJourney({ id: id("journey"), pins: [], createdAt: now });
        journey.title = title;
        journey.location = elements.journeyLocation.value.trim();
        journey.startDate = elements.journeyStart.value;
        journey.endDate = elements.journeyEnd.value;
        journey.status = elements.journeyStatus.value;
        journey.url = url;
        journey.notes = elements.journeyNotes.value.trim();
        journey.updatedAt = now;

        try {
            if (pendingCoverRemoved && journey.coverAssetId && window.MeridianPhotoDB) {
                await window.MeridianPhotoDB.deleteAsset(journey.coverAssetId);
                journey.coverAssetId = "";
            }
            if (pendingCoverBlob) {
                if (!window.MeridianPhotoDB) throw new Error("画像保管庫を開けない。写真を外してもう一度保存してくれ。");
                const assetId = journey.coverAssetId || "atlas-cover-" + journey.id;
                await window.MeridianPhotoDB.putAsset({
                    id: assetId,
                    kind: "atlas-cover",
                    journeyId: journey.id,
                    mimeType: pendingCoverBlob.type || "image/jpeg",
                    size: pendingCoverBlob.size,
                    updatedAt: now,
                    blob: pendingCoverBlob
                });
                journey.coverAssetId = assetId;
            }
        } catch (error) {
            elements.journeyFormStatus.textContent = error.message || "写真を保存できなかった。";
            return;
        }

        if (!existing) atlas.journeys.push(journey);
        writeAtlas();
        activeFilter = journey.id;
        window.MeridianSounds?.play("record");
        renderJourneys();
        closeJourneyEditor();
        setMapStatus("旅程「" + journey.title + "」を保存した。地図を長押しして場所を追加できる。");
    }

    async function deleteJourney() {
        const journey = atlas.journeys.find(function (item) { return item.id === elements.journeyId.value; });
        if (!journey || !window.confirm("「" + journey.title + "」と含まれるピンを削除します。元には戻せません。続行しますか？")) return;
        if (journey.coverAssetId && window.MeridianPhotoDB) {
            try { await window.MeridianPhotoDB.deleteAsset(journey.coverAssetId); } catch (_) { /* orphan cleanup can wait */ }
        }
        atlas.journeys = atlas.journeys.filter(function (item) { return item.id !== journey.id; });
        if (activeFilter === journey.id) activeFilter = "all";
        writeAtlas();
        renderJourneys();
        closeJourneyEditor();
        setMapStatus("旅程を削除した。");
    }

    function fillPinJourneySelect(selectedId) {
        elements.pinJourney.innerHTML = atlas.journeys.map(function (journey) {
            return "<option value='" + escapeHtml(journey.id) + "'>" + escapeHtml(journey.title) + "</option>";
        }).join("");
        elements.pinJourney.value = atlas.journeys.some(function (journey) { return journey.id === selectedId; })
            ? selectedId
            : atlas.journeys[0].id;
    }

    function findPin(pinId) {
        for (const journey of atlas.journeys) {
            const pin = journey.pins.find(function (item) { return item.id === pinId; });
            if (pin) return { journey: journey, pin: pin };
        }
        return null;
    }

    function openPinEditor(pin, journeyId, coordinates) {
        if (!atlas.journeys.length) {
            setMapStatus("先に旅程を一つ作れ。ピンの所属先が必要だ。");
            openJourneyEditor(null);
            return;
        }
        const targetCoordinates = coordinates || pin || view;
        elements.pinId.value = pin ? pin.id : "";
        elements.pinLatitude.value = Number(targetCoordinates.latitude).toFixed(6);
        elements.pinLongitude.value = Number(targetCoordinates.longitude).toFixed(6);
        fillPinJourneySelect(journeyId || activeFilter);
        elements.pinTitle.value = pin ? pin.title : "";
        elements.pinCategory.value = pin ? pin.category : "sight";
        elements.pinStatus.value = pin ? pin.status : "planned";
        elements.pinPriority.value = pin ? pin.priority : "normal";
        elements.pinUrl.value = pin ? pin.url : "";
        elements.pinNotes.value = pin ? pin.notes : "";
        elements.pinCoordinates.textContent = "LAT " + Number(targetCoordinates.latitude).toFixed(5) + " · LON " + Number(targetCoordinates.longitude).toFixed(5);
        elements.pinFormStatus.textContent = pin ? "場所の記録を編集できる。" : "この座標へ新しいピンを置く。";
        elements.pinDelete.hidden = !pin;
        setModal(elements.pinModal, true);
        window.setTimeout(function () { elements.pinTitle.focus(); }, 60);
    }

    function closePinEditor() {
        setModal(elements.pinModal, false);
    }

    function savePin() {
        const title = elements.pinTitle.value.trim();
        const journey = atlas.journeys.find(function (item) { return item.id === elements.pinJourney.value; });
        if (!journey || !title) {
            elements.pinFormStatus.textContent = !journey ? "所属する旅程を選べ。" : "場所の名前を入力しろ。";
            return;
        }
        const url = cleanUrl(elements.pinUrl.value);
        if (elements.pinUrl.value.trim() && !url) {
            elements.pinFormStatus.textContent = "URLを確認してくれ。httpまたはhttpsだけ保存できる。";
            return;
        }
        const existing = elements.pinId.value ? findPin(elements.pinId.value) : null;
        if (existing) existing.journey.pins = existing.journey.pins.filter(function (item) { return item.id !== existing.pin.id; });
        const now = new Date().toISOString();
        const pin = normalizePin({
            id: existing ? existing.pin.id : id("pin"),
            title: title,
            latitude: Number(elements.pinLatitude.value),
            longitude: Number(elements.pinLongitude.value),
            category: elements.pinCategory.value,
            status: elements.pinStatus.value,
            priority: elements.pinPriority.value,
            url: url,
            notes: elements.pinNotes.value.trim(),
            createdAt: existing ? existing.pin.createdAt : now,
            updatedAt: now
        });
        journey.pins.push(pin);
        journey.updatedAt = now;
        activeFilter = journey.id;
        view.latitude = pin.latitude;
        view.longitude = pin.longitude;
        view.zoom = Math.max(view.zoom, 13);
        writeAtlas();
        window.MeridianSounds?.play("record");
        renderJourneys();
        closePinEditor();
        setMapStatus("「" + pin.title + "」を" + journey.title + "へ登録した。");
    }

    function deletePin() {
        const found = findPin(elements.pinId.value);
        if (!found || !window.confirm("「" + found.pin.title + "」のピンを削除しますか？")) return;
        found.journey.pins = found.journey.pins.filter(function (pin) { return pin.id !== found.pin.id; });
        found.journey.updatedAt = new Date().toISOString();
        writeAtlas();
        renderJourneys();
        closePinEditor();
        setMapStatus("ピンを削除した。");
    }

    function zoomBy(amount) {
        view.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom + amount));
        writeAtlas();
        renderMap();
    }

    function fitVisiblePins() {
        const pins = visiblePins().map(function (entry) { return entry.pin; });
        if (!pins.length) {
            setMapStatus("表示できるピンがまだない。地図を長押しして追加しろ。");
            renderMap();
            return;
        }
        if (pins.length === 1) {
            view.latitude = pins[0].latitude;
            view.longitude = pins[0].longitude;
            view.zoom = 13;
        } else {
            const minLat = Math.min.apply(null, pins.map(function (pin) { return pin.latitude; }));
            const maxLat = Math.max.apply(null, pins.map(function (pin) { return pin.latitude; }));
            const minLon = Math.min.apply(null, pins.map(function (pin) { return pin.longitude; }));
            const maxLon = Math.max.apply(null, pins.map(function (pin) { return pin.longitude; }));
            view.latitude = (minLat + maxLat) / 2;
            view.longitude = normalizeLongitude((minLon + maxLon) / 2);
            for (let zoom = 16; zoom >= MIN_ZOOM; zoom -= 1) {
                const northWest = project(maxLat, minLon, zoom);
                const southEast = project(minLat, maxLon, zoom);
                if (Math.abs(southEast.x - northWest.x) <= elements.map.clientWidth - 70 && Math.abs(southEast.y - northWest.y) <= elements.map.clientHeight - 70) {
                    view.zoom = zoom;
                    break;
                }
            }
        }
        writeAtlas();
        renderMap();
        setMapStatus(pins.length + "本のピンを表示している。");
    }

    function switchMode(mode, playSound) {
        const target = mode === "atlas" ? "atlas" : "planner";
        elements.modeTabs.forEach(function (tab) {
            const active = tab.dataset.plannerMode === target;
            tab.classList.toggle("active", active);
            tab.setAttribute("aria-selected", String(active));
        });
        elements.plannerPanel.classList.toggle("active", target === "planner");
        elements.atlasPanel.classList.toggle("active", target === "atlas");
        elements.plannerPanel.hidden = target !== "planner";
        elements.atlasPanel.hidden = target !== "atlas";
        elements.subtitle.textContent = target === "atlas" ? "Private travel atlas" : "Mission calendar";
        localStorage.setItem(MODE_KEY, target);
        if (playSound) window.MeridianSounds?.play("navigation");
        if (target === "atlas") window.requestAnimationFrame(function () { renderJourneys(); renderMap(); });
    }

    elements.modeTabs.forEach(function (tab) {
        tab.addEventListener("click", function () { switchMode(tab.dataset.plannerMode, true); });
    });
    document.querySelectorAll('.tab-btn[data-page="plannerPage"]').forEach(function (button) {
        button.addEventListener("click", function () {
            if (elements.atlasPanel.hidden) return;
            window.requestAnimationFrame(function () { renderJourneys(); renderMap(); });
        });
    });
    elements.newJourney.addEventListener("click", function () { openJourneyEditor(null); });
    elements.journeyClose.addEventListener("click", closeJourneyEditor);
    document.querySelectorAll("[data-close-atlas-journey]").forEach(function (button) { button.addEventListener("click", closeJourneyEditor); });
    elements.journeySave.addEventListener("click", saveJourney);
    elements.journeyDelete.addEventListener("click", deleteJourney);
    elements.journeyCoverRemove.addEventListener("click", function () {
        pendingCoverBlob = null;
        pendingCoverRemoved = true;
        clearCoverPreview();
        elements.journeyCoverInput.value = "";
    });
    elements.journeyCoverInput.addEventListener("change", async function () {
        const file = elements.journeyCoverInput.files && elements.journeyCoverInput.files[0];
        if (!file) return;
        elements.journeyFormStatus.textContent = "写真を端末向けに圧縮している。";
        try {
            pendingCoverBlob = await imageBlob(file);
            pendingCoverRemoved = false;
            showCoverBlob(pendingCoverBlob);
            elements.journeyFormStatus.textContent = "写真を準備した。Save Journeyで保存される。";
        } catch (error) {
            pendingCoverBlob = null;
            elements.journeyFormStatus.textContent = error.message || "写真を読み込めなかった。";
        }
    });

    elements.pinClose.addEventListener("click", closePinEditor);
    document.querySelectorAll("[data-close-atlas-pin]").forEach(function (button) { button.addEventListener("click", closePinEditor); });
    elements.pinSave.addEventListener("click", savePin);
    elements.pinDelete.addEventListener("click", deletePin);
    elements.filter.addEventListener("change", function () {
        activeFilter = elements.filter.value;
        renderJourneyFilters();
        fitVisiblePins();
    });
    elements.zoomIn.addEventListener("click", function () { zoomBy(1); });
    elements.zoomOut.addEventListener("click", function () { zoomBy(-1); });
    elements.addCenterPin.addEventListener("click", function () { openPinEditor(null, activeFilter, view); });
    elements.fitPins.addEventListener("click", fitVisiblePins);

    elements.map.addEventListener("pointerdown", function (event) {
        if (event.button !== undefined && event.button !== 0) return;
        pointerState = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
            center: project(view.latitude, view.longitude, view.zoom),
            startedAt: Date.now(),
            moved: false
        };
        if (typeof elements.map.setPointerCapture === "function") elements.map.setPointerCapture(event.pointerId);
    });
    elements.map.addEventListener("pointermove", function (event) {
        if (!pointerState || pointerState.id !== event.pointerId) return;
        const dx = event.clientX - pointerState.x;
        const dy = event.clientY - pointerState.y;
        if (Math.hypot(dx, dy) > 7) pointerState.moved = true;
        if (pointerState.moved) {
            const next = unproject(pointerState.center.x - dx, pointerState.center.y - dy, view.zoom);
            view.latitude = next.latitude;
            view.longitude = next.longitude;
            scheduleMapRender();
        }
        pointerState.lastX = event.clientX;
        pointerState.lastY = event.clientY;
    });
    function finishPointer(event) {
        if (!pointerState || pointerState.id !== event.pointerId) return;
        const held = Date.now() - pointerState.startedAt;
        const coordinates = pointToCoordinates(event.clientX, event.clientY);
        const longPress = !pointerState.moved && held >= 550;
        pointerState = null;
        try { elements.map.releasePointerCapture(event.pointerId); } catch (_) { /* already released */ }
        writeAtlas();
        if (longPress) openPinEditor(null, activeFilter, coordinates);
    }
    elements.map.addEventListener("pointerup", finishPointer);
    elements.map.addEventListener("pointercancel", function () {
        if (pointerState) writeAtlas();
        pointerState = null;
    });
    elements.map.addEventListener("contextmenu", function (event) { event.preventDefault(); });
    elements.map.addEventListener("dblclick", function (event) { event.preventDefault(); zoomBy(1); });
    elements.map.addEventListener("wheel", function (event) {
        event.preventDefault();
        zoomBy(event.deltaY < 0 ? 1 : -1);
    }, { passive: false });
    elements.map.addEventListener("keydown", function (event) {
        const movement = 80;
        const center = project(view.latitude, view.longitude, view.zoom);
        if (["+", "="].includes(event.key)) { zoomBy(1); event.preventDefault(); return; }
        if (event.key === "-") { zoomBy(-1); event.preventDefault(); return; }
        if (!event.key.startsWith("Arrow")) return;
        if (event.key === "ArrowLeft") center.x -= movement;
        if (event.key === "ArrowRight") center.x += movement;
        if (event.key === "ArrowUp") center.y -= movement;
        if (event.key === "ArrowDown") center.y += movement;
        const next = unproject(center.x, center.y, view.zoom);
        view.latitude = next.latitude;
        view.longitude = next.longitude;
        writeAtlas();
        renderMap();
        event.preventDefault();
    });
    document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") return;
        if (!elements.pinModal.hidden) closePinEditor();
        else if (!elements.journeyModal.hidden) closeJourneyEditor();
    });

    window.addEventListener("resize", scheduleMapRender);
    window.addEventListener("storage", function (event) {
        if (event.key !== STORAGE_KEY) return;
        atlas = readAtlas();
        view = Object.assign({}, initialView(), atlas.view || {});
        view.latitude = Number.isFinite(Number(view.latitude)) ? Math.max(-85, Math.min(85, Number(view.latitude))) : DEFAULT_VIEW.latitude;
        view.longitude = Number.isFinite(Number(view.longitude)) ? normalizeLongitude(Number(view.longitude)) : DEFAULT_VIEW.longitude;
        view.zoom = Number.isFinite(Number(view.zoom)) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(Number(view.zoom)))) : DEFAULT_VIEW.zoom;
        renderJourneys();
    });

    window.MeridianAtlas = {
        getData: function () { return JSON.parse(JSON.stringify(atlas)); },
        render: renderJourneys,
        activate: function () { switchMode("atlas", false); },
        openJourney: openJourneyEditor
    };

    renderJourneys();
    switchMode(localStorage.getItem(MODE_KEY) === "atlas" ? "atlas" : "planner", false);
})();
