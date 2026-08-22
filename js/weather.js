//========================
// Meridian Weather v2.0
// Open-Meteo Geocoding + Forecast
//========================

(function () {
    "use strict";

    const LOCATION_KEY = "meridianWeatherLocation";
    const WEATHER_KEY = "meridianWeather";
    const CACHE_KEY = "meridianWeatherCacheV2";
    const REREGISTRATION_KEY = "meridianWeatherReregistrationPromptV1";
    const REFRESH_MS = 15 * 60 * 1000;
    const FRESH_CACHE_MS = 30 * 60 * 1000;
    const DEFAULT_LOCATION = {
        query: "大阪市",
        prefecture: "大阪府",
        city: "大阪市",
        displayName: "大阪市・大阪府（従来設定）",
        latitude: 34.6937,
        longitude: 135.5023,
        timezone: "Asia/Tokyo",
        legacy: true
    };

    const elements = {
        temp: document.getElementById("weatherTemp"),
        desc: document.getElementById("weatherDesc"),
        icon: document.getElementById("weatherIcon"),
        pressure: document.getElementById("weatherPressure"),
        humidity: document.getElementById("weatherHumidity"),
        pressureNote: document.getElementById("weatherPressureNote"),
        location: document.getElementById("weatherLocation"),
        regionInput: document.getElementById("weatherRegionInput"),
        resolvedLocation: document.getElementById("weatherResolvedLocation"),
        saveLocation: document.getElementById("saveWeatherLocation"),
        locationStatus: document.getElementById("weatherLocationStatus"),
        prompt: document.getElementById("weatherReregistrationPrompt"),
        promptLater: document.getElementById("weatherReregistrationLater"),
        promptOpen: document.getElementById("weatherReregistrationOpenSettings")
    };

    const weatherCodeMap = {
        0: { text: "快晴", icon: "☀" },
        1: { text: "晴れ", icon: "🌤" },
        2: { text: "一部くもり", icon: "⛅" },
        3: { text: "くもり", icon: "☁" },
        45: { text: "霧", icon: "🌫" },
        48: { text: "霧氷", icon: "🌫" },
        51: { text: "弱い霧雨", icon: "🌦" },
        53: { text: "霧雨", icon: "🌦" },
        55: { text: "強い霧雨", icon: "🌧" },
        56: { text: "着氷性の霧雨", icon: "🌧" },
        57: { text: "強い着氷性の霧雨", icon: "🌧" },
        61: { text: "小雨", icon: "🌧" },
        63: { text: "雨", icon: "🌧" },
        65: { text: "強い雨", icon: "🌧" },
        66: { text: "着氷性の雨", icon: "🌧" },
        67: { text: "強い着氷性の雨", icon: "🌧" },
        71: { text: "小雪", icon: "🌨" },
        73: { text: "雪", icon: "🌨" },
        75: { text: "強い雪", icon: "🌨" },
        77: { text: "霧雪", icon: "🌨" },
        80: { text: "にわか雨", icon: "🌦" },
        81: { text: "にわか雨", icon: "🌧" },
        82: { text: "強いにわか雨", icon: "🌧" },
        85: { text: "にわか雪", icon: "🌨" },
        86: { text: "強いにわか雪", icon: "🌨" },
        95: { text: "雷雨", icon: "⛈" },
        96: { text: "雷雨・雹", icon: "⛈" },
        99: { text: "強い雷雨・雹", icon: "⛈" }
    };

    let weatherRequest = null;
    let retryTimer = null;
    let currentLocation = readLocation();

    function normalizeStoredLocation(value) {
        if (!value || !Number.isFinite(Number(value.latitude)) || !Number.isFinite(Number(value.longitude))) {
            return null;
        }
        return {
            query: String(value.query || value.city || value.displayName || "").trim(),
            prefecture: String(value.prefecture || "").trim(),
            city: String(value.city || "").trim(),
            displayName: String(value.displayName || value.city || value.query || "観測地点").trim(),
            latitude: Number(value.latitude),
            longitude: Number(value.longitude),
            timezone: String(value.timezone || "auto"),
            legacy: Boolean(value.legacy || String(value.displayName || "").includes("従来設定"))
        };
    }

    function readLocation() {
        try {
            const stored = normalizeStoredLocation(JSON.parse(localStorage.getItem(LOCATION_KEY)));
            return stored || { ...DEFAULT_LOCATION };
        } catch (_) {
            return { ...DEFAULT_LOCATION };
        }
    }

    function saveLocation(location) {
        currentLocation = normalizeStoredLocation(location) || { ...DEFAULT_LOCATION };
        localStorage.setItem(LOCATION_KEY, JSON.stringify(currentLocation));
    }

    function normalizeQuery(value) {
        return String(value || "").trim().replace(/\s+/g, " ");
    }

    function normalizePlaceName(value) {
        return String(value || "").trim().replace(/[市区町村都道府県]$/, "").toLocaleLowerCase("ja");
    }

    async function resolveLocation(region) {
        const query = normalizeQuery(region);
        if (query.length < 2) throw new Error("市区町村名をもう少し詳しく入力してくれ。");

        const parameters = new URLSearchParams({ name: query, count: "10", language: "ja", format: "json" });
        if (/[ぁ-んァ-ヶ一-龠々]/.test(query)) parameters.set("countryCode", "JP");

        const controller = new AbortController();
        const timeout = window.setTimeout(function () { controller.abort(); }, 12000);
        try {
            const response = await fetch(
                "https://geocoding-api.open-meteo.com/v1/search?" + parameters.toString(),
                { cache: "no-store", signal: controller.signal }
            );
            if (!response.ok) throw new Error("観測地点を確認できなかった。通信を確認して、もう一度試してくれ。");

            const data = await response.json();
            const candidates = Array.isArray(data.results) ? data.results : [];
            const normalizedQuery = normalizePlaceName(query);
            const place = candidates.find(function (candidate) {
                return normalizePlaceName(candidate.name) === normalizedQuery;
            }) || candidates.find(function (candidate) {
                return normalizePlaceName(candidate.admin1) === normalizedQuery;
            }) || candidates[0];
            if (!place) throw new Error("地点が見つからない。市区町村名で入力し直してくれ。");

            const names = [place.name, place.admin1, place.country]
                .filter(Boolean)
                .filter(function (value, index, values) { return values.indexOf(value) === index; });
            return {
                query: query,
                prefecture: String(place.admin1 || ""),
                city: String(place.name || query),
                displayName: names.join("・") || query,
                latitude: Number(place.latitude),
                longitude: Number(place.longitude),
                timezone: String(place.timezone || "auto"),
                legacy: false
            };
        } catch (error) {
            if (error && error.name === "AbortError") throw new Error("地点確認がタイムアウトした。通信を確認してくれ。");
            throw error;
        } finally {
            window.clearTimeout(timeout);
        }
    }

    function getLocationKey(location) {
        return Number(location.latitude).toFixed(4) + "," + Number(location.longitude).toFixed(4);
    }

    function getLocationLabel(location) {
        const cleanName = String(location.displayName || location.query || "観測地点").replace("（従来設定）", "");
        return "Madrid Headquarters · " + cleanName;
    }

    function fillLocationForm() {
        if (elements.regionInput) elements.regionInput.value = currentLocation.query || currentLocation.city || "大阪市";
        if (elements.resolvedLocation) elements.resolvedLocation.textContent = "現在の観測地点：" + currentLocation.displayName;
        if (elements.location) elements.location.textContent = getLocationLabel(currentLocation);
    }

    function showLocationStatus(message, isError) {
        if (!elements.locationStatus) return;
        elements.locationStatus.textContent = message;
        elements.locationStatus.style.color = isError ? "#e8a5ad" : "";
    }

    function getPressureNote(pressure) {
        if (pressure <= 1000) return "低気圧注意";
        if (pressure <= 1008) return "やや低め";
        if (pressure >= 1020) return "高め";
        return "安定";
    }

    function getCommanderWeatherLine(pressure, weatherText) {
        if (pressure <= 1000) return "現地気圧が低い。今日は頭痛に注意しろ。予定は詰めすぎるな。";
        if (weatherText.includes("雨") || weatherText.includes("雷")) return "現地は天候が崩れている。移動と体調に気を付けろ。";
        if (pressure <= 1008) return "気圧がやや低い。無理に押し切るな。";
        return "Local conditions synced. 今日は通常通り進められる。";
    }

    function extractWeatherValues(current) {
        const values = {
            temp: Math.round(Number(current.temperature_2m)),
            humidity: Math.round(Number(current.relative_humidity_2m)),
            pressure: Math.round(Number(current.pressure_msl ?? current.surface_pressure)),
            code: Number(current.weather_code)
        };
        if (![values.temp, values.humidity, values.pressure, values.code].every(Number.isFinite)) {
            throw new Error("Weather data contains invalid values.");
        }
        return values;
    }

    function saveDailyWeatherSnapshot(values, weatherInfo, savedAt) {
        const key = "meridianWeatherHistory";
        let history = {};
        try { history = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) {}
        const date = new Date(savedAt || Date.now());
        const dateKey = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
        history[dateKey] = { pressure: values.pressure, humidity: values.humidity, temp: values.temp, code: values.code, text: weatherInfo.text, savedAt: Number(savedAt) || Date.now() };
        const keys = Object.keys(history).sort().slice(-30);
        const trimmed = {}; keys.forEach(function (item) { trimmed[item] = history[item]; });
        localStorage.setItem(key, JSON.stringify(trimmed));
    }

    function renderWeather(current, savedAt, forecast) {
        const values = extractWeatherValues(current);
        const weatherInfo = weatherCodeMap[values.code] || { text: "天気不明", icon: "—" };
        const note = getPressureNote(values.pressure);
        const commanderLine = getCommanderWeatherLine(values.pressure, weatherInfo.text);

        if (elements.location) elements.location.textContent = getLocationLabel(currentLocation);
        if (elements.temp) elements.temp.textContent = values.temp + "℃";
        if (elements.desc) elements.desc.textContent = weatherInfo.text;
        if (elements.icon) elements.icon.textContent = weatherInfo.icon;
        if (elements.pressure) elements.pressure.textContent = values.pressure + " hPa";
        if (elements.humidity) elements.humidity.textContent = "湿度 " + values.humidity + "%";
        if (elements.pressureNote) elements.pressureNote.textContent = note;

        localStorage.setItem(WEATHER_KEY, JSON.stringify({
            displayName: currentLocation.displayName,
            sourceName: currentLocation.displayName,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            locationKey: getLocationKey(currentLocation),
            temp: values.temp,
            humidity: values.humidity,
            pressure: values.pressure,
            code: values.code,
            text: weatherInfo.text,
            note: note,
            commanderLine: commanderLine,
            savedAt: Number(savedAt) || Date.now()
        }));
        if (forecast) localStorage.setItem("meridianWeatherForecast", JSON.stringify({ savedAt: Number(savedAt) || Date.now(), location: currentLocation, hourly: forecast.hourly || null, daily: forecast.daily || null }));
        saveDailyWeatherSnapshot(values, weatherInfo, savedAt);

        if (typeof window.completeMission === "function") window.completeMission("weather");
        window.dispatchEvent(new Event("meridianWeatherUpdated"));
        return true;
    }

    function readCache(allowExpired) {
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
            if (!cached || !cached.current || cached.locationKey !== getLocationKey(currentLocation)) return null;
            if (!allowExpired && Date.now() - Number(cached.savedAt || 0) >= FRESH_CACHE_MS) return null;
            return cached;
        } catch (_) {
            return null;
        }
    }

    function hasObservationForecast(cache) {
        return Boolean(
            cache && cache.forecast && cache.forecast.hourly &&
            Array.isArray(cache.forecast.hourly.time) &&
            cache.forecast.hourly.time.length > 0
        );
    }

    function clearWeatherCache() {
        localStorage.removeItem(CACHE_KEY);
    }

    function renderWeatherError() {
        if (elements.location) elements.location.textContent = getLocationLabel(currentLocation);
        if (elements.desc) elements.desc.textContent = "Local sync failed.";
        if (elements.icon) elements.icon.textContent = "—";
        if (elements.pressureNote) elements.pressureNote.textContent = "再取得が必要";
    }

    async function fetchWeather(force) {
        if (weatherRequest) return weatherRequest;
        if (!force) {
            const freshCache = readCache(false);
            if (freshCache && hasObservationForecast(freshCache)) {
                renderWeather(freshCache.current, freshCache.savedAt, freshCache.forecast);
                return true;
            }
        }

        const parameters = new URLSearchParams({
            latitude: String(currentLocation.latitude),
            longitude: String(currentLocation.longitude),
            current: "temperature_2m,relative_humidity_2m,weather_code,pressure_msl",
            hourly: "cloud_cover,visibility,precipitation_probability,wind_speed_10m",
            daily: "sunrise,sunset",
            timezone: String(currentLocation.timezone || "auto"),
            forecast_days: "2"
        });

        weatherRequest = (async function () {
            const controller = new AbortController();
            const timeout = window.setTimeout(function () { controller.abort(); }, 12000);
            try {
                const response = await fetch(
                    "https://api.open-meteo.com/v1/forecast?" + parameters.toString(),
                    { cache: "no-store", signal: controller.signal }
                );
                if (!response.ok) throw new Error("Weather API error: " + response.status);
                const data = await response.json();
                if (!data.current) throw new Error("Weather current data is missing.");

                const savedAt = Date.now();
                renderWeather(data.current, savedAt, data);
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    savedAt: savedAt,
                    locationKey: getLocationKey(currentLocation),
                    current: data.current,
                    forecast: { hourly: data.hourly || null, daily: data.daily || null }
                }));
                window.clearTimeout(retryTimer);
                return true;
            } catch (error) {
                const staleCache = readCache(true);
                if (staleCache) renderWeather(staleCache.current, staleCache.savedAt, staleCache.forecast);
                else renderWeatherError();
                window.clearTimeout(retryTimer);
                retryTimer = window.setTimeout(function () { fetchWeather(false); }, 20000);
                console.error("Meridian weather error:", error);
                return false;
            } finally {
                window.clearTimeout(timeout);
                weatherRequest = null;
            }
        })();
        return weatherRequest;
    }

    async function commitLocation() {
        const query = normalizeQuery(elements.regionInput ? elements.regionInput.value : "");
        const queryChanged = query !== currentLocation.query;
        if (query.length < 2) {
            showLocationStatus("市区町村名をもう少し詳しく入力してくれ。", true);
            if (elements.regionInput) elements.regionInput.focus();
            return;
        }
        if (!queryChanged && !currentLocation.legacy) {
            showLocationStatus("その地点はすでに登録済みだ。", false);
            return;
        }

        try {
            if (elements.saveLocation) elements.saveLocation.disabled = true;
            showLocationStatus("観測地点を照合している……", false);
            const resolved = await resolveLocation(query);
            saveLocation(resolved);
            clearWeatherCache();
            fillLocationForm();
            showLocationStatus("観測地点を保存した。気象データを再同期している。", false);
            await fetchWeather(true);
            window.dispatchEvent(new CustomEvent("meridianWeatherLocationChanged", { detail: currentLocation }));
        } catch (error) {
            showLocationStatus(error && error.message ? error.message : "地点を保存できなかった。", true);
        } finally {
            if (elements.saveLocation) elements.saveLocation.disabled = false;
        }
    }

    function closeReregistrationPrompt() {
        if (elements.prompt) elements.prompt.hidden = true;
        document.body.classList.remove("weather-reregistration-open");
    }

    function showReregistrationPromptOnce() {
        if (!elements.prompt || localStorage.getItem(REREGISTRATION_KEY) === "true") return;
        localStorage.setItem(REREGISTRATION_KEY, "true");
        elements.prompt.hidden = false;
        document.body.classList.add("weather-reregistration-open");
    }

    function openWeatherSettings() {
        closeReregistrationPrompt();
        if (window.MeridianNavigation && typeof window.MeridianNavigation.switchPage === "function") {
            window.MeridianNavigation.switchPage("archivePage");
        }
        const classifiedTab = document.querySelector('[data-archive-tab="classified"]');
        if (classifiedTab && !classifiedTab.classList.contains("active")) classifiedTab.click();
        window.setTimeout(function () {
            const card = document.getElementById("weatherStationCard");
            if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
            if (elements.regionInput) elements.regionInput.focus();
        }, 120);
    }

    if (!localStorage.getItem(LOCATION_KEY)) saveLocation(DEFAULT_LOCATION);
    fillLocationForm();

    if (elements.saveLocation) elements.saveLocation.addEventListener("click", commitLocation);
    if (elements.regionInput) {
        elements.regionInput.addEventListener("keydown", function (event) {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commitLocation();
        });
    }
    if (elements.promptLater) elements.promptLater.addEventListener("click", closeReregistrationPrompt);
    if (elements.promptOpen) elements.promptOpen.addEventListener("click", openWeatherSettings);

    window.addEventListener("meridianBootCompleted", function () {
        window.setTimeout(showReregistrationPromptOnce, 300);
    }, { once: true });
    window.addEventListener("load", function () {
        window.setTimeout(function () {
            const boot = document.getElementById("bootScreen");
            if (!boot || boot.classList.contains("fade-out")) showReregistrationPromptOnce();
        }, 4500);
    }, { once: true });

    window.setInterval(function () { fetchWeather(false); }, REFRESH_MS);
    window.MeridianWeather = {
        fetch: fetchWeather,
        getLocation: function () { return { ...currentLocation }; },
        resolveLocation: resolveLocation,
        clearCache: clearWeatherCache
    };

    fetchWeather(false);
})();
