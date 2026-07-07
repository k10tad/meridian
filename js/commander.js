//========================
// Meridian Commander Intelligence v1.6.1
// Message Engine / Hero Brief / Intelligence Panel
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

function safeJsonRead(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (error) {
        console.warn("Meridian storage parse failed:", key, error);
        return fallback;
    }
}

function getWeatherData() {
    return safeJsonRead("meridianWeather", null);
}

function getHealthData() {
    return safeJsonRead("meridianHealthLog_" + commanderTodayKey(), null);
}

function getRelationshipData() {
    return safeJsonRead("relationship", {
        affinity: 18,
        level: 1
    });
}

function getMissionData() {
    return safeJsonRead("meridianMission_" + commanderTodayKey(), {
        condition: false,
        weather: false,
        planner: false,
        health: false,
        focus: false
    });
}

function getCycleData() {
    const saved = safeJsonRead("meridianCycle", { records: [] });

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

    if (data.weather && Number(data.weather.pressure) <= 1008) risk += 2;
    if (data.weather && Number(data.weather.pressure) <= 1000) risk += 2;

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

function getCommanderRelationshipLine(affinity) {
    if (typeof commanderGetRelationshipLine === "function") {
        return commanderGetRelationshipLine(affinity);
    }

    if (affinity >= 50) return "一つずつでいい。";
    return "無理をする必要はない。";
}

function getCommanderGreetingLine() {
    if (typeof commanderGetGreetingLine === "function") {
        return commanderGetGreetingLine();
    }

    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Buenos días, Rei.";
    if (hour >= 12 && hour < 18) return "Buenas tardes, Rei.";
    if (hour >= 18 && hour < 23) return "Buenas noches, Rei.";
    return "遅い時間だ、レイ。";
}

function pickCommander(list, fallback) {
    if (typeof commanderPick === "function") {
        return commanderPick(list);
    }

    if (!Array.isArray(list) || list.length === 0) return fallback || "";
    return list[Math.floor(Math.random() * list.length)];
}

function getPlannerCountForCommander() {
    const plans = JSON.parse(localStorage.getItem("meridianPlans")) || {};
    const today = new Date();
    const key =
        today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");

    const todayPlans = plans[key] || [];
    return todayPlans.length;
}

function commanderGetWeekdayObservation() {
    const day = new Date().getDay();

    if (day === 1) {
        return commanderPick(CommanderMessages.observations.monday);
    }

    if (day === 5) {
        return commanderPick(CommanderMessages.observations.friday);
    }

    return "";
}

function commanderGetPlannerObservation() {
    const count = getPlannerCountForCommander();

    if (count === 0) {
        return commanderPick(CommanderMessages.observations.noPlans);
    }

    if (count >= 5) {
        return commanderPick(CommanderMessages.observations.manyPlans);
    }

    return "";
}

function commanderGetAnalysisLine(data) {
    const plannerCount = getPlannerCountForCommander();
    const hasHealthRisk =
        data.health &&
        (data.health.headache || data.health.dizzy || data.health.period || data.health.pms);

    const lowPressure =
        data.weather &&
        data.weather.pressure <= 1008;

    if ((hasHealthRisk || lowPressure) && plannerCount >= 3) {
        return commanderPick(CommanderMessages.analysis.heavyDay);
    }

    if (plannerCount === 0 && hasHealthRisk) {
        return commanderPick(CommanderMessages.analysis.recoveryDay);
    }

    return commanderPick(CommanderMessages.analysis.normalDay);
}

function commanderGetAdviceLine(data) {
    const plannerCount = getPlannerCountForCommander();

    if (data.health && (data.health.headache || data.health.period || data.health.pms)) {
        return commanderPick(CommanderMessages.advice.reduceLoad);
    }

    if (plannerCount === 0) {
        return commanderPick(CommanderMessages.advice.rest);
    }

    if (plannerCount >= 4) {
        return commanderPick(CommanderMessages.advice.focus);
    }

    return commanderPick(CommanderMessages.advice.startSmall);
}

function buildCommanderMessage(data) {
    const risk = calculateRisk(data);
    const readiness = getReadiness(risk);
    const relationship = getRelationshipData();
    const affinity = relationship.affinity || 0;

    const lines = [];

    lines.push(getCommanderGreetingLine());

    if (
        data.health &&
        data.health.headache &&
        data.weather &&
        Number(data.weather.pressure) <= 1008
    ) {
        lines.push(pickCommander(CommanderMessages.weather.lowPressure, "気圧が低い。頭痛に注意しろ。"));
        lines.push(pickCommander(CommanderMessages.health.headache, "頭痛があるなら、予定は少し削れ。"));
    } else {
        if (data.weather && Number(data.weather.pressure) <= 1008) {
            lines.push(pickCommander(CommanderMessages.weather.lowPressure, "気圧が低い。無理に押し切るな。"));
        } else if (
            data.weather &&
            data.weather.text &&
            (data.weather.text.includes("雨") || data.weather.text.includes("雷"))
        ) {
            lines.push(pickCommander(CommanderMessages.weather.rain, "天候が崩れている。移動は慎重に。"));
        } else {
            lines.push(pickCommander(CommanderMessages.weather.stable, "気象条件は安定している。"));
        }

        if (data.cycle.isPeriod || (data.health && data.health.period)) {
            lines.push(pickCommander(CommanderMessages.health.period, "生理中だ。身体を優先しろ。"));
        } else if (data.cycle.isPmsWindow || (data.health && data.health.pms)) {
            lines.push(pickCommander(CommanderMessages.health.pms, "PMSが出やすい時期だ。余白を残せ。"));
        } else if (data.health && data.health.headache) {
            lines.push(pickCommander(CommanderMessages.health.headache, "頭痛があるなら、今日は少し抑えろ。"));
        } else {
            lines.push(pickCommander(CommanderMessages.health.normal, "体調記録は安定している。"));
        }
    }

    if (data.missionPercent >= 100) {
        lines.push(pickCommander(CommanderMessages.mission.complete, "任務完了だ。今日はよくやった、レイ。"));
    } else if (data.missionPercent >= 80) {
        lines.push(pickCommander(CommanderMessages.mission.high, "かなり進んでいる。最後まで整えろ。"));
    } else if (data.missionPercent >= 40) {
        lines.push(pickCommander(CommanderMessages.mission.middle, "悪くない進み方だ。"));
    } else {
        lines.push(pickCommander(CommanderMessages.mission.low, "まず一つ終わらせるぞ。"));
    }

    const relationshipLine = getCommanderRelationshipLine(affinity);

    if (relationshipLine) {
        lines.push(relationshipLine);
    }

    const weekdayObservation = commanderGetWeekdayObservation();
if (weekdayObservation) {
    lines.push(weekdayObservation);
}

const plannerObservation = commanderGetPlannerObservation();
if (plannerObservation) {
    lines.push(plannerObservation);
}

lines.push(commanderGetAnalysisLine(data));
lines.push(commanderGetAdviceLine(data));

    lines.push(pickCommander(CommanderMessages.closings, "行ってこい。"));

    return {
        message: lines.filter(Boolean).join("\n\n"),
        risk: risk,
        readiness: readiness,
        priorities: buildPriorityList(data, readiness)
    };
}

function buildHeroCommanderMessage(data) {
    const relationship = getRelationshipData();
    const affinity = relationship.affinity || 0;
    const lines = [];

    lines.push(getCommanderGreetingLine());

    if (data.health && data.health.headache) {
        lines.push("頭痛があるなら、今日は少し抑えろ。");
    } else if (data.cycle.isPeriod || (data.health && data.health.period)) {
        lines.push("今日は身体を優先しろ。");
    } else if (data.weather && Number(data.weather.pressure) <= 1008) {
        lines.push("気圧が低い。無理に押し切るな。");
    } else {
        lines.push("今日の状況は確認済みだ。");
    }

    if (affinity >= 50) {
        lines.push("一つずつでいい。");
    }

    return lines.filter(Boolean).join(" ");
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

    localStorage.setItem(
        "meridianCommanderSnapshot",
        JSON.stringify({
            message: result.message,
            heroMessage: buildHeroCommanderMessage(data),
            readiness: result.readiness,
            risk: result.risk + " / 10",
            priority: result.priorities,
            updatedAt: Date.now()
        })
    );

    if (commanderIntelMessage) {
        commanderIntelMessage.textContent = result.message;
    }

    if (deskGreetingCommander) {
        const hasSeenFirstConnection =
            localStorage.getItem("meridianFirstConnectionSeen");

        if (!hasSeenFirstConnection && typeof commanderGetFirstConnectionMessage === "function") {
            deskGreetingCommander.textContent = commanderGetFirstConnectionMessage();
            localStorage.setItem("meridianFirstConnectionSeen", "true");
        } else {
            deskGreetingCommander.textContent = buildHeroCommanderMessage(data);
        }
    }
}

renderCommanderIntel();

window.addEventListener("meridianWeatherUpdated", renderCommanderIntel);
window.addEventListener("meridianBootCompleted", renderCommanderIntel);
window.addEventListener("storage", renderCommanderIntel);

