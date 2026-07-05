//========================
// Meridian Commander Intelligence v1.4.2
// Readiness / Risk / Priority / Voice DB
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

function commanderTodayKey() {
    return new Date().toDateString();
}

function commanderGetDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
}

function commanderParseDate(key) {
    const p = key.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
}

function commanderDiffDays(a, b) {
    return Math.round((commanderParseDate(a) - commanderParseDate(b)) / 86400000);
}

function getWeatherData() {
    return JSON.parse(localStorage.getItem("meridianWeather")) || null;
}

function getHealthData() {
    return JSON.parse(localStorage.getItem("meridianHealthLog_" + commanderTodayKey())) || null;
}

function getRelationshipData() {
    return JSON.parse(localStorage.getItem("relationship")) || {
        affinity: 18,
        level: 1
    };
}

function getMissionData() {
    return JSON.parse(localStorage.getItem("meridianMission_" + commanderTodayKey())) || {
        condition: false,
        weather: false,
        planner: false,
        health: false,
        focus: false
    };
}

function getCycleData() {
    const saved = JSON.parse(localStorage.getItem("meridianCycle"));

    if (saved && Array.isArray(saved.records)) {
        return saved;
    }

    return { records: [] };
}

function getCycleStatus() {
    const cycle = getCycleData();

    const records = cycle.records
        .filter(function (record) {
            return record.start;
        })
        .sort(function (a, b) {
            return commanderParseDate(a.start) - commanderParseDate(b.start);
        });

    if (records.length === 0) {
        return {
            label: "未記録",
            cycleDay: null,
            isPeriod: false,
            isPmsWindow: false
        };
    }

    const last = records[records.length - 1];
    const todayKey = commanderGetDateKey(new Date());
    const cycleDay = commanderDiffDays(todayKey, last.start) + 1;

    let isPeriod = false;

    if (last.end) {
        isPeriod =
            commanderParseDate(last.start) <= commanderParseDate(todayKey) &&
            commanderParseDate(todayKey) <= commanderParseDate(last.end);
    } else {
        isPeriod = todayKey === last.start;
    }

    const isPmsWindow = cycleDay >= 24;

    return {
        label: "Day " + cycleDay,
        cycleDay: cycleDay,
        isPeriod: isPeriod,
        isPmsWindow: isPmsWindow
    };
}

function getMissionPercent() {
    const mission = getMissionData();
    const values = Object.values(mission);
    const total = values.length;
    const completed = values.filter(Boolean).length;

    if (total === 0) return 0;

    return Math.round((completed / total) * 100);
}

function calculateRisk(data) {
    let risk = 0;

    if (data.weather && data.weather.pressure <= 1008) risk += 2;
    if (data.weather && data.weather.pressure <= 1000) risk += 2;

    if (data.health && data.health.headache) risk += 3;
    if (data.health && data.health.dizzy) risk += 3;
    if (data.health && data.health.period) risk += 2;
    if (data.health && data.health.pms) risk += 2;

    if (data.cycle.isPeriod) risk += 2;
    if (data.cycle.isPmsWindow) risk += 1;

    if (data.health && data.health.sleepMemo) {
        if (
            data.health.sleepMemo.includes("4") ||
            data.health.sleepMemo.includes("5")
        ) {
            risk += 2;
        }
    }

    return Math.min(risk, 10);
}

function getReadiness(risk) {
    if (risk >= 8) return "RECOVERY";
    if (risk >= 5) return "LIMITED";
    if (risk >= 3) return "CAUTION";
    return "READY";
}

function getTimeGreeting() {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) return CommanderMessages.greetings.morning;
    if (hour >= 12 && hour < 18) return CommanderMessages.greetings.afternoon;
    if (hour >= 18 && hour < 23) return CommanderMessages.greetings.evening;

    return CommanderMessages.greetings.night;
}

function getRelationshipSuffix(affinity) {
    const tone = CommanderMessages.relationshipTone.find(function (item) {
        return affinity >= item.min;
    });

    return tone ? tone.suffix : "";
}

function buildPriorityList(data, readiness) {
    const priorities = [];

    if (data.health && data.health.medicine === false) {
        priorities.push("服薬確認");
    }

    if (data.health && (data.health.headache || data.health.dizzy)) {
        priorities.push("Rest");
        priorities.push("Health");
    }

    if (data.cycle.isPeriod || (data.health && data.health.period)) {
        priorities.push("Warmth");
        priorities.push("Health");
    }

    if (readiness === "READY" || readiness === "CAUTION") {
        priorities.push("Planner");
        priorities.push("Focus");
    }

    priorities.push("Mission");

    return Array.from(new Set(priorities)).slice(0, 4);
}

function buildCommanderMessage(data) {
    const risk = calculateRisk(data);
    const readiness = getReadiness(risk);
    const relationship = getRelationshipData();
    const suffix = getRelationshipSuffix(relationship.affinity || 0);

    let message = "";

    if (
        data.health &&
        data.health.headache &&
        data.weather &&
        data.weather.pressure <= 1008
    ) {
        message = CommanderMessages.special.headachePressure;
    } else if (data.cycle.isPeriod || (data.health && data.health.period)) {
        message = CommanderMessages.special.period;
    } else if (data.cycle.isPmsWindow || (data.health && data.health.pms)) {
        message = CommanderMessages.special.pms;
    } else if (data.missionPercent >= 100) {
        message = CommanderMessages.special.missionComplete;
    } else if (data.missionPercent >= 80) {
        message = CommanderMessages.special.missionHigh;
    } else {
        message = pickCommanderMessage(CommanderMessages.readiness[readiness]);
    }

    if (suffix) {
        message += " " + suffix;
    }

    return {
        message: message,
        risk: risk,
        readiness: readiness,
        priorities: buildPriorityList(data, readiness)
    };
}

function renderPriority(priorities) {
    if (!commanderPriority) return;

    commanderPriority.innerHTML = "";

    priorities.forEach(function (priority) {
        const li = document.createElement("li");
        li.textContent = priority;
        commanderPriority.appendChild(li);
    });
}

function renderReadiness(readiness, risk) {
    if (readinessStatus) {
        readinessStatus.textContent = readiness;
        readinessStatus.className = "readiness-status status-" + readiness.toLowerCase();
    }

    if (riskScore) {
        riskScore.textContent = risk + " / 10";
    }
}

function renderCommanderIntel() {
    const weather = getWeatherData();
    const health = getHealthData();
    const cycle = getCycleStatus();
    const missionPercent = getMissionPercent();

    const data = {
        weather: weather,
        health: health,
        cycle: cycle,
        missionPercent: missionPercent
    };

    const result = buildCommanderMessage(data);

    if (intelWeather) {
        intelWeather.textContent = weather
            ? weather.text + " / " + weather.pressure + "hPa"
            : "未同期";
    }

    if (intelCycle) {
        intelCycle.textContent = cycle.label;
    }

    if (intelHealth) {
        if (!health) {
            intelHealth.textContent = "未記録";
        } else {
            const flags = [];

            if (health.headache) flags.push("頭痛");
            if (health.dizzy) flags.push("めまい");
            if (health.period) flags.push("生理");
            if (health.pms) flags.push("PMS");
            if (health.medicine) flags.push("服薬");
            if (health.boxing) flags.push("Boxing");

            intelHealth.textContent = flags.length ? flags.join(" / ") : "記録あり";
        }
    }

    if (intelMission) {
        intelMission.textContent = missionPercent + "%";
    }

    renderReadiness(result.readiness, result.risk);
    renderPriority(result.priorities);

    if (commanderIntelMessage) {
        commanderIntelMessage.textContent = result.message;
    }

    if (deskGreetingCommander) {
        deskGreetingCommander.textContent = getTimeGreeting();
    }
}

renderCommanderIntel();

window.addEventListener("meridianWeatherUpdated", renderCommanderIntel);
window.addEventListener("storage", renderCommanderIntel);
