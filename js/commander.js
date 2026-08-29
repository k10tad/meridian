//========================
// Meridian Commander UI v2.1
// Data collection and rendering only.
// Message composition lives in engine.js and its supporting modules.
//========================

const intelWeather = document.getElementById("intelWeather");
const intelCycle = document.getElementById("intelCycle");
const intelHealth = document.getElementById("intelHealth");
const intelMission = document.getElementById("intelMission");
const commanderIntelMessage = document.getElementById("commanderIntelMessage");
const readinessStatus = document.getElementById("readinessStatus");
const riskScore = document.getElementById("riskScore");
const commanderPriority = document.getElementById("commanderPriority");
const deskGreetingCommander = document.getElementById("deskGreeting");

function commanderSafeJsonRead(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (error) {
        console.warn("Meridian storage parse failed:", key, error);
        return fallback;
    }
}

function commanderTodayStorageKey() {
    return new Date().toDateString();
}

function commanderDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
}

function commanderParseDateKey(key) {
    const parts = key.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function commanderDifferenceInDays(a, b) {
    return Math.round(
        (commanderParseDateKey(a) - commanderParseDateKey(b)) / 86400000
    );
}

function commanderReadWeather() {
    return commanderSafeJsonRead("meridianWeather", null);
}

function commanderReadHealth() {
    return commanderSafeJsonRead(
        "meridianHealthLog_" + commanderTodayStorageKey(),
        null
    );
}

function commanderReadMedicationAlert() {
    // Medication speech is session-only. Closing the app/tab clears it.
    try {
        localStorage.removeItem("meridianMedicationAlert");
        const value = sessionStorage.getItem("meridianMedicationAlert");
        const alert = value ? JSON.parse(value) : null;
        return alert && alert.medicine ? alert : null;
    } catch (error) {
        console.warn("Meridian session alert parse failed:", error);
        return null;
    }
}

function commanderReadRelationship() {
    return commanderSafeJsonRead("relationship", {
        level: 1,
        affinity: 18,
        trustToday: 0,
        totalTrust: 18
    });
}

function commanderReadMission() {
    return commanderSafeJsonRead(
        "meridianMission_" + commanderTodayStorageKey(),
        {
            condition: false,
            weather: false,
            planner: false,
            health: false,
            focus: false
        }
    );
}

function commanderReadPlannerCount() {
    const plans = commanderSafeJsonRead("meridianPlans", {});
    const todayPlans = plans[commanderDateKey(new Date())];
    return Array.isArray(todayPlans) ? todayPlans.length : 0;
}

function commanderReadAirQuality() {
    if (window.MeridianAirQuality && typeof window.MeridianAirQuality.getAssessment === "function") {
        return window.MeridianAirQuality.getAssessment();
    }
    return null;
}

function commanderReadTodayHoliday() {
    if (!window.MeridianHolidays || typeof window.MeridianHolidays.get !== "function") return null;
    return window.MeridianHolidays.get(commanderDateKey(new Date()));
}

function commanderEnvironmentMessage(data) {
    const lines = [];
    if (data.holiday) {
        lines.push("今日は" + (data.holiday.localName || data.holiday.name || "祝日") + "だ。休むことまで予定に入れておけ。");
    }
    if (data.airQuality && data.airQuality.advice) lines.push(data.airQuality.advice);
    return lines.join(" ");
}

function commanderReadCycleStatus() {
    const cycle = commanderSafeJsonRead("meridianCycle", { records: [] });
    const records = Array.isArray(cycle.records)
        ? cycle.records
            .filter(function (record) {
                return record && record.start;
            })
            .sort(function (a, b) {
                return commanderParseDateKey(a.start) - commanderParseDateKey(b.start);
            })
        : [];

    if (records.length === 0) {
        return {
            label: "未記録",
            cycleDay: null,
            isPeriod: false,
            isPmsWindow: false
        };
    }

    const last = records[records.length - 1];
    const todayKey = commanderDateKey(new Date());
    const cycleDay = commanderDifferenceInDays(todayKey, last.start) + 1;

    let isPeriod = false;

    if (last.end) {
        const today = commanderParseDateKey(todayKey);
        isPeriod =
            commanderParseDateKey(last.start) <= today &&
            today <= commanderParseDateKey(last.end);
    } else {
        isPeriod = todayKey === last.start;
    }

    return {
        label: "Day " + cycleDay,
        cycleDay: cycleDay,
        isPeriod: isPeriod,
        isPmsWindow: cycleDay >= 24 && !isPeriod
    };
}

function commanderMissionPercent(mission) {
    const values = Object.values(mission || {});

    if (values.length === 0) return 0;

    const completed = values.filter(Boolean).length;
    return Math.round((completed / values.length) * 100);
}

function collectCommanderData() {
    const mission = commanderReadMission();

    return {
        weather: commanderReadWeather(),
        health: commanderReadHealth(),
        relationship: commanderReadRelationship(),
        mission: mission,
        missionPercent: commanderMissionPercent(mission),
        plannerCount: commanderReadPlannerCount(),
        cycle: commanderReadCycleStatus(),
        medicationAlert: commanderReadMedicationAlert(),
        airQuality: commanderReadAirQuality(),
        holiday: commanderReadTodayHoliday()
    };
}

function renderCommanderPriorities(priorities) {
    if (!commanderPriority) return;

    commanderPriority.innerHTML = "";

    (priorities || []).forEach(function (priority) {
        const item = document.createElement("li");
        item.textContent = priority;
        commanderPriority.appendChild(item);
    });
}

function renderCommanderReadiness(readiness, risk) {
    if (readinessStatus) {
        readinessStatus.textContent = readiness;
        readinessStatus.className =
            "readiness-status status-" + readiness.toLowerCase();
    }

    if (riskScore) {
        riskScore.textContent = risk + " / 10";
    }
}

function renderCommanderIntel() {
    const engine = window.MeridianCommanderEngine;

    if (!engine || typeof engine.buildIntelligence !== "function") {
        console.error("Meridian Commander Engine is not ready.");
        return;
    }

    const data = collectCommanderData();
    const result = engine.buildIntelligence(data);
    const heroMessage = engine.buildHero(data);
    const environmentMessage = commanderEnvironmentMessage(data);
    const baseMessage = data.medicationAlert
        ? data.medicationAlert.title + "。" + data.medicationAlert.message
        : result.message;
    const fullMessage = baseMessage + (environmentMessage ? " " + environmentMessage : "");

    if (intelWeather) {
        intelWeather.textContent = data.weather
            ? data.weather.text + " / " + data.weather.pressure + "hPa"
            : "未同期";
    }

    if (intelCycle) {
        intelCycle.textContent = data.cycle.label;
    }

    if (intelHealth) {
        if (!data.health) {
            intelHealth.textContent = "未記録";
        } else {
            const flags = [];

            if (data.health.headache) flags.push("頭痛");
            if (data.health.dizzy) flags.push("めまい");
            if (data.health.period) flags.push("生理");
            if (data.health.pms) flags.push("PMS");
            if (data.health.medicine) flags.push("服薬");
            if (data.health.palpitation) flags.push("動悸");
            if (data.health.boxing) flags.push("Boxing");

            intelHealth.textContent = flags.length
                ? flags.join(" / ")
                : "記録あり";
        }
    }

    if (intelMission) {
        intelMission.textContent = data.missionPercent + "%";
    }

    renderCommanderReadiness(result.readiness, result.risk);
    const priorities = (result.priorities || []).slice();
    if (data.airQuality && data.airQuality.pm25 && data.airQuality.pm25.level >= 2) priorities.push("外気負荷を避ける");
    if (data.airQuality && data.airQuality.uv && data.airQuality.uv.level >= 2) priorities.push("紫外線対策");
    renderCommanderPriorities(priorities.slice(0, 4));

    if (commanderIntelMessage) {
        commanderIntelMessage.textContent = fullMessage;
    }

    if (deskGreetingCommander) {
        const firstConnectionSeen = localStorage.getItem(
            "meridianFirstConnectionSeen"
        );

        if (!firstConnectionSeen && typeof engine.getFirstConnection === "function") {
            deskGreetingCommander.textContent = engine.getFirstConnection();
            localStorage.setItem("meridianFirstConnectionSeen", "true");
        } else if (data.medicationAlert) {
            deskGreetingCommander.textContent = data.medicationAlert.title + "。" + data.medicationAlert.message;
        } else {
            deskGreetingCommander.textContent = heroMessage;
        }
    }

    localStorage.setItem(
        "meridianCommanderSnapshot",
        JSON.stringify({
            message: fullMessage,
            heroMessage: heroMessage,
            readiness: result.readiness,
            risk: result.risk + " / 10",
            priority: result.priorities,
            medicationAlert: data.medicationAlert,
            updatedAt: Date.now()
        })
    );
}

// Make a single refresh entry point available to other Meridian modules.
window.renderCommanderIntel = renderCommanderIntel;

renderCommanderIntel();

window.addEventListener("meridianWeatherUpdated", renderCommanderIntel);
window.addEventListener("meridianAirQualityUpdated", renderCommanderIntel);
window.addEventListener("meridianHolidaysUpdated", renderCommanderIntel);
window.addEventListener("meridianBootCompleted", renderCommanderIntel);
window.addEventListener("meridianDataUpdated", renderCommanderIntel);
window.addEventListener("storage", renderCommanderIntel);


window.addEventListener("meridian:medication-alert", renderCommanderIntel);
