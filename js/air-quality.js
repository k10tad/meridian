(function () {
    "use strict";

    const CACHE_KEY = "meridianAirQualityCacheV1";
    const HISTORY_KEY = "meridianAirQualityHistoryV1";
    const FRESH_MS = 60 * 60 * 1000;
    let request = null;

    const statusElement = document.getElementById("airQualityStatus");
    const metricsElement = document.getElementById("airQualityMetrics");

    function read(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
    }

    function location() {
        if (window.MeridianWeather && typeof window.MeridianWeather.getLocation === "function") {
            return window.MeridianWeather.getLocation();
        }
        return read("meridianWeatherLocation", null);
    }

    function locationKey(value) {
        return Number(value.latitude).toFixed(4) + "," + Number(value.longitude).toFixed(4);
    }

    function category(aqi) {
        if (!Number.isFinite(aqi)) return { label: "STANDBY", key: "standby" };
        if (aqi <= 50) return { label: "GOOD", key: "good" };
        if (aqi <= 100) return { label: "MODERATE", key: "moderate" };
        if (aqi <= 150) return { label: "SENSITIVE", key: "sensitive" };
        if (aqi <= 200) return { label: "POOR", key: "poor" };
        return { label: "VERY POOR", key: "very-poor" };
    }

    function number(value, digits) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return "--";
        return digits ? parsed.toFixed(digits) : String(Math.round(parsed));
    }

    function saveDailySnapshot(current) {
        const now = new Date();
        const dateKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
        const history = read(HISTORY_KEY, {});
        history[dateKey] = {
            aqi: Number(current.us_aqi),
            pm2_5: Number(current.pm2_5),
            pm10: Number(current.pm10),
            ozone: Number(current.ozone),
            dust: Number(current.dust),
            uv: Number(current.uv_index),
            savedAt: Date.now()
        };
        const trimmed = {};
        Object.keys(history).sort().slice(-30).forEach(function (key) { trimmed[key] = history[key]; });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    }

    function render(current, stale) {
        if (!current) return false;
        const aqi = Number(current.us_aqi);
        const state = category(aqi);
        if (statusElement) {
            statusElement.textContent = state.label + (stale ? " · SAVED" : "");
            statusElement.dataset.status = state.key;
        }
        if (metricsElement) {
            const parts = [
                "AQI " + number(aqi),
                "PM2.5 " + number(current.pm2_5, 1),
                "PM10 " + number(current.pm10, 1),
                "UV " + number(current.uv_index, 1)
            ];
            if (Number(current.dust) >= 10) parts.push("黄砂 " + number(current.dust));
            metricsElement.textContent = parts.join(" · ");
        }
        return true;
    }

    function renderStandby() {
        if (statusElement) {
            statusElement.textContent = "STANDBY";
            statusElement.dataset.status = "standby";
        }
        if (metricsElement) metricsElement.textContent = "PM2.5 -- · PM10 -- · UV --";
    }

    function fetchAirQuality(force) {
        if (request) return request;
        const place = location();
        if (!place || !Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) {
            renderStandby();
            return Promise.resolve(false);
        }
        const key = locationKey(place);
        const cache = read(CACHE_KEY, null);
        if (!force && cache && cache.locationKey === key && Date.now() - Number(cache.savedAt || 0) < FRESH_MS) {
            render(cache.current, false);
            return Promise.resolve(true);
        }

        const params = new URLSearchParams({
            latitude: String(place.latitude),
            longitude: String(place.longitude),
            current: "us_aqi,pm2_5,pm10,ozone,dust,uv_index",
            timezone: String(place.timezone || "auto")
        });
        const controller = new AbortController();
        const timeout = window.setTimeout(function () { controller.abort(); }, 18000);
        request = fetch("https://air-quality-api.open-meteo.com/v1/air-quality?" + params.toString(), {
            cache: "no-store",
            signal: controller.signal
        }).then(function (response) {
            if (!response.ok) throw new Error("Air quality HTTP " + response.status);
            return response.json();
        }).then(function (data) {
            if (!data.current) throw new Error("Air quality current data missing");
            const saved = { savedAt: Date.now(), locationKey: key, current: data.current };
            localStorage.setItem(CACHE_KEY, JSON.stringify(saved));
            saveDailySnapshot(data.current);
            render(data.current, false);
            return true;
        }).catch(function (error) {
            if (cache && cache.locationKey === key && cache.current) render(cache.current, true);
            else renderStandby();
            console.warn("Meridian air quality standby:", error);
            return false;
        }).finally(function () {
            window.clearTimeout(timeout);
            request = null;
        });
        return request;
    }

    window.MeridianAirQuality = { fetch: fetchAirQuality };
    window.addEventListener("meridianWeatherLocationChanged", function () { fetchAirQuality(true); });
    window.addEventListener("meridianBootCompleted", function () { fetchAirQuality(false); }, { once: true });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) fetchAirQuality(false); });
    window.setTimeout(function () { fetchAirQuality(false); }, 900);
})();
