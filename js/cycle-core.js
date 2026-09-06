// Meridian Cycle Core v2.0
// Median-based estimates, uncertainty ranges, and calendar states.
(function () {
    "use strict";

    const STORAGE_KEY = "meridianCycle";
    const DEFAULT_CYCLE_DAYS = 28;
    const DEFAULT_PERIOD_DAYS = 5;
    const MAX_INTERVALS = 7;
    const DAY_MS = 86400000;

    function dateKey(date) {
        return date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0") + "-" +
            String(date.getDate()).padStart(2, "0");
    }

    function parseDate(key) {
        const parts = String(key || "").split("-").map(Number);
        if (parts.length !== 3 || parts.some(function (part) { return !Number.isFinite(part); })) return null;
        const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
        return dateKey(date) === String(key) ? date : null;
    }

    function addDays(key, days) {
        const date = parseDate(key);
        if (!date) return null;
        date.setDate(date.getDate() + Number(days || 0));
        return dateKey(date);
    }

    function diffDays(laterKey, earlierKey) {
        const later = parseDate(laterKey);
        const earlier = parseDate(earlierKey);
        if (!later || !earlier) return null;
        return Math.round((later - earlier) / DAY_MS);
    }

    function between(key, start, end) {
        return Boolean(key && start && end && key >= start && key <= end);
    }

    function median(values, fallback) {
        const sorted = values.filter(Number.isFinite).slice().sort(function (a, b) { return a - b; });
        if (!sorted.length) return fallback;
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2
            ? sorted[middle]
            : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
    }

    function safeRead() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) { saved = null; }

        if (saved && saved.lastPeriodStart && !Array.isArray(saved.records)) {
            saved = { records: [{ start: saved.lastPeriodStart, end: null, note: "" }] };
        }

        const records = saved && Array.isArray(saved.records)
            ? saved.records.filter(function (record) {
                return record && parseDate(record.start);
            }).map(function (record) {
                const end = parseDate(record.end) && record.end >= record.start ? record.end : null;
                return {
                    start: record.start,
                    end: end,
                    note: String(record.note || "")
                };
            })
            : [];

        return {
            version: 2,
            records: records,
            settings: {
                pmsDays: Math.min(10, Math.max(3, Number(saved && saved.settings && saved.settings.pmsDays) || 7))
            }
        };
    }

    function save(data) {
        const current = data && Array.isArray(data.records) ? data : safeRead();
        const normalized = {
            version: 2,
            records: current.records,
            settings: {
                pmsDays: Math.min(10, Math.max(3, Number(current.settings && current.settings.pmsDays) || 7))
            }
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        window.dispatchEvent(new CustomEvent("meridianCycleUpdated", { detail: getStats(normalized) }));
        window.dispatchEvent(new Event("meridianDataUpdated"));
        return normalized;
    }

    function getRecords(data) {
        const source = data || safeRead();
        return source.records.slice().sort(function (a, b) {
            return a.start.localeCompare(b.start);
        });
    }

    function confidenceFor(intervalCount, variability) {
        if (intervalCount === 0) return { key: "provisional", label: "仮予測" };
        if (intervalCount < 3 || variability >= 10) return { key: "low", label: "低め" };
        if (intervalCount < 5 || variability >= 5) return { key: "medium", label: "中" };
        return { key: "good", label: "良好" };
    }

    function getStats(data) {
        const source = data && Array.isArray(data.records) ? data : safeRead();
        const records = getRecords(source);
        const intervals = [];
        for (let index = 1; index < records.length; index += 1) {
            const interval = diffDays(records[index].start, records[index - 1].start);
            if (interval > 15 && interval < 60) intervals.push(interval);
        }
        const recentIntervals = intervals.slice(-MAX_INTERVALS);
        const durations = records.map(function (record) {
            if (!record.end) return null;
            const duration = diffDays(record.end, record.start);
            return duration !== null ? duration + 1 : null;
        }).filter(function (duration) { return duration >= 1 && duration <= 14; }).slice(-MAX_INTERVALS);

        const typicalDays = median(recentIntervals, DEFAULT_CYCLE_DAYS);
        const periodDays = median(durations, DEFAULT_PERIOD_DAYS);
        const variability = recentIntervals.length > 1
            ? Math.max.apply(null, recentIntervals) - Math.min.apply(null, recentIntervals)
            : 0;
        const uncertainty = recentIntervals.length === 0
            ? 3
            : recentIntervals.length === 1
                ? 2
                : Math.min(7, Math.max(1, Math.ceil(variability / 2)));
        const last = records.length ? records[records.length - 1] : null;
        const next = last ? addDays(last.start, typicalDays) : null;
        const forecastStart = next ? addDays(next, -uncertainty) : null;
        const forecastEnd = next ? addDays(next, uncertainty) : null;
        const pmsDays = Math.min(10, Math.max(3, Number(source.settings && source.settings.pmsDays) || 7));
        const confidence = confidenceFor(recentIntervals.length, variability);

        return {
            records: records,
            last: last,
            intervalCount: recentIntervals.length,
            intervals: recentIntervals,
            typicalDays: typicalDays,
            periodDays: periodDays,
            variability: variability,
            uncertainty: uncertainty,
            next: next,
            forecastStart: forecastStart,
            forecastEnd: forecastEnd,
            currentPeriodForecastEnd: last && !last.end ? addDays(last.start, periodDays - 1) : null,
            predictedPeriodEnd: next ? addDays(next, periodDays - 1) : null,
            pmsDays: pmsDays,
            pmsStart: next ? addDays(next, -pmsDays) : null,
            pmsEnd: next ? addDays(next, -1) : null,
            ovulation: next ? addDays(next, -14) : null,
            confidence: confidence
        };
    }

    function recordedPeriodFor(key, stats) {
        const today = dateKey(new Date());
        return stats.records.find(function (record) {
            if (record.end) return between(key, record.start, record.end);
            const elapsed = diffDays(key, record.start);
            return elapsed !== null && elapsed >= 0 && elapsed <= 13 && key <= today;
        }) || null;
    }

    function getDayStatus(key, suppliedStats) {
        const stats = suppliedStats || getStats();
        const record = recordedPeriodFor(key, stats);
        const today = dateKey(new Date());
        const currentPredictionStart = stats.last && !stats.last.end
            ? (stats.last.start > today ? stats.last.start : addDays(today, 1))
            : null;
        const currentPrediction = between(key, currentPredictionStart, stats.currentPeriodForecastEnd) && !record;
        const start = stats.records.some(function (item) { return item.start === key; });
        const end = stats.records.some(function (item) { return item.end === key; });
        return {
            recorded: Boolean(record),
            start: start,
            end: end,
            currentPrediction: currentPrediction,
            predicted: currentPrediction || (between(key, stats.next, stats.predictedPeriodEnd) && !record),
            forecastWindow: between(key, stats.forecastStart, stats.forecastEnd) && !record,
            pms: between(key, stats.pmsStart, stats.pmsEnd) && !record,
            ovulation: key === stats.ovulation && !record
        };
    }

    function statusForToday() {
        const stats = getStats();
        const today = dateKey(new Date());
        const day = getDayStatus(today, stats);
        const cycleDay = stats.last ? diffDays(today, stats.last.start) + 1 : null;
        const daysUntilNext = stats.next ? diffDays(stats.next, today) : null;
        return Object.assign({}, stats, day, {
            cycleDay: cycleDay,
            daysUntilNext: daysUntilNext,
            isPeriod: day.recorded,
            isPmsWindow: day.pms,
            isNearNext: daysUntilNext !== null && daysUntilNext >= 0 && daysUntilNext <= Math.max(3, stats.uncertainty)
        });
    }

    function setPmsDays(days) {
        const data = safeRead();
        data.settings.pmsDays = Math.min(10, Math.max(3, Number(days) || 7));
        return save(data);
    }

    window.MeridianCycle = {
        getData: safeRead,
        save: save,
        getRecords: getRecords,
        getStats: getStats,
        getDayStatus: getDayStatus,
        statusForToday: statusForToday,
        setPmsDays: setPmsDays,
        dateKey: dateKey,
        parseDate: parseDate,
        addDays: addDays,
        diffDays: diffDays
    };
})();
