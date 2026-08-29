(function () {
    "use strict";

    const HISTORY_KEY = "meridianWeatherHistory";
    const META_KEY = "meridianHistoricalWeatherMetaV1";
    const REFRESH_MS = 24 * 60 * 60 * 1000;
    let request = null;

    function ymd(date) {
        return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
    }

    function read(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
    }

    function average(values) {
        const valid = values.filter(Number.isFinite);
        if (!valid.length) return null;
        return valid.reduce(function (sum, value) { return sum + value; }, 0) / valid.length;
    }

    function locationKey(location) {
        return Number(location.latitude).toFixed(4) + "," + Number(location.longitude).toFixed(4);
    }

    function currentLocation() {
        if (window.MeridianWeather && typeof window.MeridianWeather.getLocation === "function") {
            return window.MeridianWeather.getLocation();
        }
        return read("meridianWeatherLocation", null);
    }

    function mergeHistory(data) {
        const hourly = data && data.hourly;
        if (!hourly || !Array.isArray(hourly.time)) throw new Error("Historical weather is missing hourly data.");
        const buckets = {};

        hourly.time.forEach(function (stamp, index) {
            const dateKey = String(stamp).slice(0, 10);
            if (!buckets[dateKey]) buckets[dateKey] = { pressure: [], humidity: [], temp: [] };
            buckets[dateKey].pressure.push(Number(hourly.pressure_msl && hourly.pressure_msl[index]));
            buckets[dateKey].humidity.push(Number(hourly.relative_humidity_2m && hourly.relative_humidity_2m[index]));
            buckets[dateKey].temp.push(Number(hourly.temperature_2m && hourly.temperature_2m[index]));
        });

        const history = read(HISTORY_KEY, {});
        Object.keys(buckets).forEach(function (dateKey) {
            const pressureValues = buckets[dateKey].pressure.filter(Number.isFinite);
            const pressureMean = average(pressureValues);
            if (!Number.isFinite(pressureMean)) return;
            const old = history[dateKey] || {};
            const humidity = average(buckets[dateKey].humidity);
            const temp = average(buckets[dateKey].temp);
            history[dateKey] = Object.assign({}, old, {
                pressure: Math.round(pressureMean),
                pressureMean: Number(pressureMean.toFixed(1)),
                pressureMin: Math.round(Math.min.apply(null, pressureValues)),
                pressureMax: Math.round(Math.max.apply(null, pressureValues)),
                humidity: Number.isFinite(humidity) ? Math.round(humidity) : old.humidity,
                temp: Number.isFinite(temp) ? Number(temp.toFixed(1)) : old.temp,
                historical: true,
                source: "Open-Meteo Historical",
                savedAt: Date.now()
            });
        });

        const keys = Object.keys(history).sort().slice(-30);
        const trimmed = {};
        keys.forEach(function (key) { trimmed[key] = history[key]; });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
        return trimmed;
    }

    function fetchHistory(force) {
        if (request) return request;
        const location = currentLocation();
        if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
            return Promise.resolve(false);
        }

        const key = locationKey(location);
        const meta = read(META_KEY, {});
        if (!force && meta.locationKey === key && Date.now() - Number(meta.fetchedAt || 0) < REFRESH_MS) {
            return Promise.resolve(true);
        }

        const end = new Date();
        end.setHours(12, 0, 0, 0);
        end.setDate(end.getDate() - 1);
        const start = new Date(end.getTime());
        start.setDate(start.getDate() - 28);

        const params = new URLSearchParams({
            latitude: String(location.latitude),
            longitude: String(location.longitude),
            start_date: ymd(start),
            end_date: ymd(end),
            hourly: "pressure_msl,relative_humidity_2m,temperature_2m",
            timezone: String(location.timezone || "auto")
        });
        const controller = new AbortController();
        const timeout = window.setTimeout(function () { controller.abort(); }, 15000);

        request = fetch("https://archive-api.open-meteo.com/v1/archive?" + params.toString(), {
            cache: "no-store",
            signal: controller.signal
        }).then(function (response) {
            if (!response.ok) throw new Error("Historical weather HTTP " + response.status);
            return response.json();
        }).then(function (data) {
            const history = mergeHistory(data);
            localStorage.setItem(META_KEY, JSON.stringify({
                locationKey: key,
                fetchedAt: Date.now(),
                startDate: ymd(start),
                endDate: ymd(end),
                days: Object.keys(history).length
            }));
            window.dispatchEvent(new CustomEvent("meridianHistoricalWeatherUpdated", { detail: { days: Object.keys(history).length } }));
            return true;
        }).catch(function (error) {
            console.warn("Meridian historical weather standby:", error);
            return false;
        }).finally(function () {
            window.clearTimeout(timeout);
            request = null;
        });
        return request;
    }

    window.MeridianWeatherHistory = { fetch: fetchHistory, get: function () { return read(HISTORY_KEY, {}); } };
    window.addEventListener("meridianWeatherLocationChanged", function () { fetchHistory(true); });
    window.addEventListener("meridianBootCompleted", function () { fetchHistory(false); }, { once: true });
    window.setTimeout(function () { fetchHistory(false); }, 1200);
})();
