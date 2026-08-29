(function () {
    "use strict";

    const CACHE_KEY = "meridianSpaceWeatherCacheV1";
    const FRESH_MS = 30 * 60 * 1000;
    const OBSERVED_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
    const FORECAST_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";
    let request = null;

    const elements = {
        status: document.getElementById("spaceWeatherStatus"),
        kp: document.getElementById("spaceWeatherKp"),
        message: document.getElementById("spaceWeatherMessage")
    };

    function readCache() {
        try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (_) { return null; }
    }

    function rowsToObjects(payload) {
        if (!Array.isArray(payload) || !payload.length) return [];
        if (!Array.isArray(payload[0])) return payload.filter(function (item) { return item && typeof item === "object"; });
        const headers = payload[0].map(function (item) { return String(item); });
        return payload.slice(1).map(function (row) {
            const object = {};
            headers.forEach(function (header, index) { object[header] = row[index]; });
            return object;
        });
    }

    function kpValue(item) {
        const keys = ["kp", "Kp", "kp_index", "predicted_kp", "Kp_index"];
        for (let i = 0; i < keys.length; i += 1) {
            const value = Number(item && item[keys[i]]);
            if (Number.isFinite(value)) return value;
        }
        return null;
    }

    function timeValue(item) {
        const raw = item && (item.time_tag || item.time || item.timestamp || item.valid_time);
        const value = new Date(raw || 0).getTime();
        return Number.isFinite(value) ? value : 0;
    }

    function summarize(observedPayload, forecastPayload) {
        const now = Date.now();
        const horizon = now + 72 * 60 * 60 * 1000;
        const observedRows = rowsToObjects(observedPayload);
        const forecastRows = rowsToObjects(forecastPayload);
        const allRows = observedRows.concat(forecastRows).map(function (item) {
            return { kp: kpValue(item), time: timeValue(item), type: String(item.observed || item.type || "").toLowerCase() };
        }).filter(function (item) { return Number.isFinite(item.kp); });

        const currentRows = allRows.filter(function (item) {
            return (!item.time || item.time <= now + 60 * 60 * 1000) && item.type !== "predicted";
        }).sort(function (a, b) { return a.time - b.time; });
        const fallbackRows = allRows.filter(function (item) { return !item.time || item.time <= now + 60 * 60 * 1000; })
            .sort(function (a, b) { return a.time - b.time; });
        const currentRow = currentRows[currentRows.length - 1] || fallbackRows[fallbackRows.length - 1] || allRows[allRows.length - 1];
        if (!currentRow) throw new Error("No Kp data");

        const future = allRows.filter(function (item) { return item.time > now && item.time <= horizon; });
        const forecastMax = future.length ? Math.max.apply(null, future.map(function (item) { return item.kp; })) : currentRow.kp;
        return {
            current: Number(currentRow.kp.toFixed(1)),
            forecastMax: Number(forecastMax.toFixed(1)),
            savedAt: Date.now()
        };
    }

    function presentation(data) {
        if (data.current >= 5) return {
            status: "STORM",
            key: "storm",
            message: "地磁気活動が高い。観測条件とは別件だが、今夜の空は少し騒がしい。"
        };
        if (data.forecastMax >= 5) return {
            status: "WATCH",
            key: "watch",
            message: "今後72時間にKp " + data.forecastMax.toFixed(1) + "の予報がある。変化は俺が見ておく。"
        };
        if (data.current <= 2) return {
            status: "CALM",
            key: "calm",
            message: "地磁気は静穏だ。少なくとも宇宙天気は騒ぎを起こしていない。"
        };
        return {
            status: "ACTIVE",
            key: "active",
            message: "地磁気活動は通常範囲。最大予報Kp " + data.forecastMax.toFixed(1) + "だ。"
        };
    }

    function render(data, stale) {
        if (!data) return false;
        const view = presentation(data);
        if (elements.status) {
            elements.status.textContent = view.status + (stale ? " · SAVED" : "");
            elements.status.dataset.status = view.key;
        }
        if (elements.kp) elements.kp.textContent = "Kp " + Number(data.current).toFixed(1) + " · 72h max " + Number(data.forecastMax).toFixed(1);
        if (elements.message) elements.message.textContent = view.message;
        return true;
    }

    function renderStandby() {
        if (elements.status) { elements.status.textContent = "STANDBY"; elements.status.dataset.status = "standby"; }
        if (elements.kp) elements.kp.textContent = "Kp --";
        if (elements.message) elements.message.textContent = "地磁気情報は待機中だ。観測判定そのものは続行する。";
    }

    function fetchJson(url, signal) {
        return fetch(url, { cache: "no-store", signal: signal }).then(function (response) {
            if (!response.ok) throw new Error("NOAA HTTP " + response.status);
            return response.json();
        });
    }

    function fetchSpaceWeather(force) {
        if (request) return request;
        const cached = readCache();
        if (!force && cached && Date.now() - Number(cached.savedAt || 0) < FRESH_MS) {
            render(cached, false);
            return Promise.resolve(true);
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(function () { controller.abort(); }, 12000);
        request = Promise.allSettled([
            fetchJson(OBSERVED_URL, controller.signal),
            fetchJson(FORECAST_URL, controller.signal)
        ]).then(function (results) {
            const observed = results[0].status === "fulfilled" ? results[0].value : [];
            const forecast = results[1].status === "fulfilled" ? results[1].value : [];
            const summary = summarize(observed, forecast);
            localStorage.setItem(CACHE_KEY, JSON.stringify(summary));
            render(summary, false);
            return true;
        }).catch(function (error) {
            if (cached) render(cached, true);
            else renderStandby();
            console.warn("Meridian space weather standby:", error);
            return false;
        }).finally(function () {
            window.clearTimeout(timeout);
            request = null;
        });
        return request;
    }

    window.MeridianSpaceWeather = { fetch: fetchSpaceWeather };
    window.addEventListener("meridianBootCompleted", function () { fetchSpaceWeather(false); }, { once: true });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) fetchSpaceWeather(false); });
    window.setTimeout(function () { fetchSpaceWeather(false); }, 1500);
})();
