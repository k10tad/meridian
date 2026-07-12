//========================
// Meridian Focus Statistics v1.0
// Records completed Focus rounds safely
//========================

(function () {
    "use strict";

    const STATS_KEY = "meridianFocusStats";
    const BACKUP_KEY = "meridianFocusStats_backup";
    const SCHEMA_VERSION = 1;

    function getDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return year + "-" + month + "-" + day;
    }

    function parseDateKey(key) {
        const parts = String(key).split("-").map(Number);

        return new Date(
            parts[0],
            parts[1] - 1,
            parts[2]
        );
    }

    function diffDays(leftKey, rightKey) {
        const left = parseDateKey(leftKey);
        const right = parseDateKey(rightKey);

        return Math.round(
            (left - right) / 86400000
        );
    }

    function createDefaultStats() {
        return {
            schemaVersion: SCHEMA_VERSION,
            totalRounds: 0,
            totalFocusMinutes: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastFocusDate: null,
            bestDayRounds: 0,
            bestDayMinutes: 0,
            days: {}
        };
    }

    function normalizeStats(rawStats) {
        const defaults = createDefaultStats();
        const stats =
            rawStats &&
            typeof rawStats === "object"
                ? rawStats
                : {};

        return {
            schemaVersion: SCHEMA_VERSION,
            totalRounds:
                Number(stats.totalRounds) || 0,
            totalFocusMinutes:
                Number(stats.totalFocusMinutes) || 0,
            currentStreak:
                Number(stats.currentStreak) || 0,
            longestStreak:
                Number(stats.longestStreak) || 0,
            lastFocusDate:
                typeof stats.lastFocusDate === "string"
                    ? stats.lastFocusDate
                    : null,
            bestDayRounds:
                Number(stats.bestDayRounds) || 0,
            bestDayMinutes:
                Number(stats.bestDayMinutes) || 0,
            days:
                stats.days &&
                typeof stats.days === "object" &&
                !Array.isArray(stats.days)
                    ? stats.days
                    : defaults.days
        };
    }

    function loadStats() {
        try {
            const saved =
                localStorage.getItem(STATS_KEY);

            if (!saved) {
                return createDefaultStats();
            }

            return normalizeStats(
                JSON.parse(saved)
            );
        } catch (error) {
            console.warn(
                "Meridian Focus Statistics: load failed.",
                error
            );

            return createDefaultStats();
        }
    }

    function saveStats(stats) {
        const current =
            localStorage.getItem(STATS_KEY);

        if (current !== null) {
            localStorage.setItem(
                BACKUP_KEY,
                current
            );
        }

        localStorage.setItem(
            STATS_KEY,
            JSON.stringify(stats)
        );

        window.dispatchEvent(
            new CustomEvent(
                "meridianFocusStatsUpdated",
                {
                    detail: getSummary(stats)
                }
            )
        );
    }

    function updateStreak(stats, todayKey) {
        if (!stats.lastFocusDate) {
            stats.currentStreak = 1;
        } else if (
            stats.lastFocusDate === todayKey
        ) {
            // Same day. Keep the current streak.
        } else {
            const difference = diffDays(
                todayKey,
                stats.lastFocusDate
            );

            stats.currentStreak =
                difference === 1
                    ? Math.max(
                        1,
                        stats.currentStreak + 1
                    )
                    : 1;
        }

        stats.longestStreak = Math.max(
            stats.longestStreak,
            stats.currentStreak
        );

        stats.lastFocusDate = todayKey;
    }

    function recordCompletedRound(minutes) {
        const safeMinutes = Math.max(
            1,
            Math.round(Number(minutes) || 25)
        );

        const stats = loadStats();
        const todayKey = getDateKey(
            new Date()
        );

        if (!stats.days[todayKey]) {
            stats.days[todayKey] = {
                rounds: 0,
                focusMinutes: 0
            };
        }

        updateStreak(stats, todayKey);

        stats.days[todayKey].rounds += 1;
        stats.days[todayKey].focusMinutes +=
            safeMinutes;

        stats.totalRounds += 1;
        stats.totalFocusMinutes +=
            safeMinutes;

        stats.bestDayRounds = Math.max(
            stats.bestDayRounds,
            stats.days[todayKey].rounds
        );

        stats.bestDayMinutes = Math.max(
            stats.bestDayMinutes,
            stats.days[todayKey].focusMinutes
        );

        saveStats(stats);

        return getSummary(stats);
    }

    function getSummary(sourceStats) {
        const stats = sourceStats
            ? normalizeStats(sourceStats)
            : loadStats();

        const todayKey = getDateKey(
            new Date()
        );

        const today =
            stats.days[todayKey] || {
                rounds: 0,
                focusMinutes: 0
            };

        return {
            todayRounds:
                Number(today.rounds) || 0,
            todayFocusMinutes:
                Number(today.focusMinutes) || 0,
            totalRounds:
                stats.totalRounds,
            totalFocusMinutes:
                stats.totalFocusMinutes,
            currentStreak:
                stats.currentStreak,
            longestStreak:
                stats.longestStreak,
            bestDayRounds:
                stats.bestDayRounds,
            bestDayMinutes:
                stats.bestDayMinutes,
            lastFocusDate:
                stats.lastFocusDate
        };
    }

    function restorePreviousStats() {
        const backup =
            localStorage.getItem(BACKUP_KEY);

        if (!backup) {
            return false;
        }

        try {
            const normalized =
                normalizeStats(
                    JSON.parse(backup)
                );

            localStorage.setItem(
                STATS_KEY,
                JSON.stringify(normalized)
            );

            window.dispatchEvent(
                new CustomEvent(
                    "meridianFocusStatsUpdated",
                    {
                        detail:
                            getSummary(normalized)
                    }
                )
            );

            return true;
        } catch (error) {
            console.error(
                "Meridian Focus Statistics: restore failed.",
                error
            );

            return false;
        }
    }

    window.MeridianFocusStats = {
        recordCompletedRound:
            recordCompletedRound,
        getSummary:
            getSummary,
        restorePreviousStats:
            restorePreviousStats
    };
})();

