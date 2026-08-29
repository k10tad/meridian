(function () {
    "use strict";

    const CACHE_KEY = "meridianHolidayCacheV1";
    const CACHE_TTL = 30 * 86400000;
    const pending = {};

    function readCache() {
        try {
            const parsed = JSON.parse(localStorage.getItem(CACHE_KEY));
            return parsed && typeof parsed === "object" ? parsed : { years: {} };
        } catch (_) {
            return { years: {} };
        }
    }

    function writeCache(cache) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    }

    function get(dateKey) {
        const year = String(dateKey || "").slice(0, 4);
        const cached = readCache().years[year];
        if (!cached || !Array.isArray(cached.items)) return null;
        return cached.items.find(function (item) { return item.date === dateKey; }) || null;
    }

    function normalize(items) {
        if (!Array.isArray(items)) return [];
        return items.filter(function (item) {
            return item && /^\d{4}-\d{2}-\d{2}$/.test(item.date || "");
        }).map(function (item) {
            return {
                date: item.date,
                localName: item.localName || item.name || "祝日",
                name: item.name || item.localName || "Public Holiday"
            };
        });
    }

    function ensureYear(year, force) {
        const yearKey = String(Number(year));
        if (!/^\d{4}$/.test(yearKey)) return Promise.resolve([]);

        const cache = readCache();
        const saved = cache.years[yearKey];
        if (!force && saved && Date.now() - Number(saved.fetchedAt || 0) < CACHE_TTL) {
            return Promise.resolve(saved.items || []);
        }
        if (pending[yearKey]) return pending[yearKey];

        const controller = new AbortController();
        const timeout = window.setTimeout(function () { controller.abort(); }, 12000);
        pending[yearKey] = fetch("https://date.nager.at/api/v3/PublicHolidays/" + yearKey + "/JP", {
            signal: controller.signal,
            cache: "no-store"
        }).then(function (response) {
            if (!response.ok) throw new Error("Holiday HTTP " + response.status);
            return response.json();
        }).then(function (data) {
            const items = normalize(data);
            if (!items.length) throw new Error("Holiday response empty");
            const latest = readCache();
            if (!latest.years) latest.years = {};
            latest.years[yearKey] = { fetchedAt: Date.now(), items: items };
            writeCache(latest);
            window.dispatchEvent(new CustomEvent("meridianHolidaysUpdated", { detail: { year: Number(yearKey) } }));
            return items;
        }).catch(function () {
            return saved && Array.isArray(saved.items) ? saved.items : [];
        }).finally(function () {
            window.clearTimeout(timeout);
            delete pending[yearKey];
        });

        return pending[yearKey];
    }

    window.MeridianHolidays = { get: get, ensureYear: ensureYear };
    const currentYear = new Date().getFullYear();
    ensureYear(currentYear);
    ensureYear(currentYear + 1);
})();
