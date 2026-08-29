(function () {
    "use strict";

    const CACHE_KEY = "meridianAirQualityCacheV2";
    const HISTORY_KEY = "meridianAirQualityHistoryV1";
    const FRESH_MS = 60 * 60 * 1000;
    let request = null;

    const statusElement = document.getElementById("airQualityStatus");
    const metricsElement = document.getElementById("airQualityMetrics");
    const adviceElement = document.getElementById("airQualityAdvice");

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

    function pm25Category(value) {
        const pm = Number(value);
        if (!Number.isFinite(pm)) return { label: "判定待ち", level: 0 };
        if (pm <= 15) return { label: "少ない", level: 0 };
        if (pm <= 35) return { label: "やや多い", level: 1 };
        if (pm <= 70) return { label: "多い", level: 2 };
        return { label: "非常に多い", level: 3 };
    }

    function uvCategory(value) {
        const uv = Number(value);
        if (!Number.isFinite(uv)) return { label: "判定待ち", level: 0 };
        if (uv < 3) return { label: "弱い", level: 0 };
        if (uv < 6) return { label: "中程度", level: 1 };
        if (uv < 8) return { label: "強い", level: 2 };
        if (uv < 11) return { label: "非常に強い", level: 3 };
        return { label: "極端に強い", level: 4 };
    }

    function assessment(current) {
        if (!current) return null;
        const pm = pm25Category(current.pm2_5);
        const uv = uvCategory(current.uv_index);
        const notes = [];

        if (pm.level >= 3) notes.push("PM2.5が非常に多い。長時間の外出と換気は控えめにしろ。");
        else if (pm.level >= 2) notes.push("PM2.5が多い。外出時間と換気の長さに気をつけろ。");
        else if (pm.level >= 1) notes.push("PM2.5はやや多い。空気の変化には注意しておけ。");

        if (uv.level >= 4) notes.push("紫外線は極端に強い。日中の外出は対策を徹底しろ。");
        else if (uv.level >= 3) notes.push("紫外線が非常に強い。短時間でも対策して出ろ。");
        else if (uv.level >= 2) notes.push("今日は紫外線が強い。外へ出るなら対策してから行け。");
        else if (uv.level >= 1) notes.push("紫外線は中程度だ。長く外にいるなら対策しておけ。");

        if (!notes.length) notes.push("大気と紫外線は落ち着いている。通常の範囲で動ける。");

        return {
            aqi: category(Number(current.us_aqi)),
            pm25: pm,
            uv: uv,
            advice: notes.join(" "),
            commanderLine: notes[0]
        };
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
        const report = assessment(current);
        if (statusElement) {
            statusElement.textContent = state.label + (stale ? " · SAVED" : "");
            statusElement.dataset.status = state.key;
        }
        if (metricsElement) {
            metricsElement.innerHTML =
                "<div class='air-metric' data-level='" + report.pm25.level + "'><span>PM2.5</span><strong>" + number(current.pm2_5, 1) + " <em>μg/m³</em></strong><small>" + report.pm25.label + "</small></div>" +
                "<div class='air-metric' data-level='" + report.uv.level + "'><span>TODAY UV MAX</span><strong>" + number(current.uv_index, 1) + "</strong><small>" + report.uv.label + "</small></div>";
        }
        if (adviceElement) {
            const details = ["AQI " + number(aqi), "PM10 " + number(current.pm10, 1)];
            if (Number(current.dust) >= 10) details.push("黄砂 " + number(current.dust));
            adviceElement.textContent = report.advice + " " + details.join(" · ");
        }
        return true;
    }

    function renderStandby() {
        if (statusElement) {
            statusElement.textContent = "STANDBY";
            statusElement.dataset.status = "standby";
        }
        if (metricsElement) metricsElement.innerHTML = "<div class='air-metric'><span>PM2.5</span><strong>--</strong><small>判定待ち</small></div><div class='air-metric'><span>TODAY UV MAX</span><strong>--</strong><small>判定待ち</small></div>";
        if (adviceElement) adviceElement.textContent = "登録地点の大気情報を確認している。";
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
            window.dispatchEvent(new CustomEvent("meridianAirQualityUpdated", { detail: assessment(cache.current) }));
            return Promise.resolve(true);
        }

        const params = new URLSearchParams({
            latitude: String(place.latitude),
            longitude: String(place.longitude),
            current: "us_aqi,pm2_5,pm10,ozone,dust,uv_index",
            hourly: "uv_index",
            forecast_days: "1",
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
            const hourlyUv = data.hourly && Array.isArray(data.hourly.uv_index)
                ? data.hourly.uv_index.map(Number).filter(Number.isFinite)
                : [];
            const current = Object.assign({}, data.current, {
                uv_current: Number(data.current.uv_index),
                uv_index: hourlyUv.length ? Math.max.apply(null, hourlyUv) : Number(data.current.uv_index)
            });
            const saved = { savedAt: Date.now(), locationKey: key, current: current };
            localStorage.setItem(CACHE_KEY, JSON.stringify(saved));
            saveDailySnapshot(current);
            render(current, false);
            window.dispatchEvent(new CustomEvent("meridianAirQualityUpdated", { detail: assessment(current) }));
            return true;
        }).catch(function (error) {
            if (cache && cache.locationKey === key && cache.current) {
                render(cache.current, true);
                window.dispatchEvent(new CustomEvent("meridianAirQualityUpdated", { detail: assessment(cache.current) }));
            } else renderStandby();
            console.warn("Meridian air quality standby:", error);
            return false;
        }).finally(function () {
            window.clearTimeout(timeout);
            request = null;
        });
        return request;
    }

    window.MeridianAirQuality = {
        fetch: fetchAirQuality,
        getAssessment: function () {
            const place = location();
            const cache = read(CACHE_KEY, null);
            if (!place || !cache || cache.locationKey !== locationKey(place)) return null;
            return assessment(cache.current);
        }
    };
    window.addEventListener("meridianWeatherLocationChanged", function () { fetchAirQuality(true); });
    window.addEventListener("meridianBootCompleted", function () { fetchAirQuality(false); }, { once: true });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) fetchAirQuality(false); });
    window.setTimeout(function () { fetchAirQuality(false); }, 900);
})();
