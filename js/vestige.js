//========================
// Meridian Vestige v1.2
// Archive Detail Card
//========================

const saveVestigeButton = document.getElementById("saveVestigeButton");
const vestigeList = document.getElementById("vestigeList");
const vestigeDetailCard = document.getElementById("vestigeDetailCard");
const vestigeDetailNo = document.getElementById("vestigeDetailNo");
const vestigeDetailDate = document.getElementById("vestigeDetailDate");
const vestigeDetailBody = document.getElementById("vestigeDetailBody");
const closeVestigeDetail = document.getElementById("closeVestigeDetail");

const VESTIGE_KEY = "meridianVestigeRecords";

//========================
// Storage
//========================

function getVestigeRecords() {
    const records = JSON.parse(localStorage.getItem(VESTIGE_KEY)) || [];

    return records.map(function (record, index) {
        return normalizeVestigeRecord(record, index + 1);
    });
}

function saveVestigeRecords(records) {
    localStorage.setItem(VESTIGE_KEY, JSON.stringify(records));
}

//========================
// Date helpers
//========================

function formatVestigeDate(date) {
    return date.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short"
    });
}

function formatVestigeTime(date) {
    return date.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatArchiveNo(number) {
    return "No." + String(number).padStart(4, "0");
}

function getTodayStorageKey() {
    return new Date().toDateString();
}

function getDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return y + "-" + m + "-" + d;
}

function parseDateKey(key) {
    const parts = key.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function diffDays(a, b) {
    return Math.round((parseDateKey(a) - parseDateKey(b)) / 86400000);
}

//========================
// Data readers
//========================

function readWeatherSnapshot() {
    return JSON.parse(localStorage.getItem("meridianWeather")) || null;
}

function readHealthSnapshot() {
    return JSON.parse(
        localStorage.getItem("meridianHealthLog_" + getTodayStorageKey())
    ) || null;
}

function readMissionSnapshot() {
    return JSON.parse(
        localStorage.getItem("meridianMission_" + getTodayStorageKey())
    ) || null;
}

function readRelationshipSnapshot() {
    return JSON.parse(localStorage.getItem("relationship")) || null;
}

function readCycleSnapshot() {
    const cycle = JSON.parse(localStorage.getItem("meridianCycle")) || {
        records: []
    };

    if (!Array.isArray(cycle.records)) {
        return {
            records: []
        };
    }

    return cycle;
}

function readCommanderSnapshot() {
    const messageBox = document.getElementById("commanderIntelMessage");
    const readinessBox = document.getElementById("readinessStatus");
    const riskBox = document.getElementById("riskScore");
    const priorityList = document.getElementById("commanderPriority");

    const priorities = [];

    if (priorityList) {
        priorityList.querySelectorAll("li").forEach(function (li) {
            priorities.push(li.textContent);
        });
    }

    return {
        message: messageBox ? messageBox.textContent : "",
        readiness: readinessBox ? readinessBox.textContent : "READY",
        risk: riskBox ? riskBox.textContent : "0 / 10",
        priority: priorities
    };
}

//========================
// New record structure
//========================

function createEmptyMedia() {
    return {
        photos: [],
        audio: null
    };
}

function createVestigeRecord(archiveNo) {
    const now = new Date();

    return {
        id: Date.now(),
        archiveNo: archiveNo,
        archiveLabel: formatArchiveNo(archiveNo),
        createdAt: now.toISOString(),
        label: formatVestigeDate(now),

        summary: {
            weather: readWeatherSnapshot(),
            health: readHealthSnapshot(),
            cycle: readCycleSnapshot(),
            mission: readMissionSnapshot(),
            relationship: readRelationshipSnapshot()
        },

        commander: readCommanderSnapshot(),

        media: createEmptyMedia(),

        memo: "",

        status: "Saved"
    };
}

//========================
// Migration / normalization
//========================

function normalizeVestigeRecord(record, fallbackNo) {
    return {
        id: record.id || Date.now(),

        archiveNo: record.archiveNo || fallbackNo,
        archiveLabel: record.archiveLabel || formatArchiveNo(record.archiveNo || fallbackNo),

        createdAt: record.createdAt || record.date || new Date().toISOString(),
        label: record.label || formatVestigeDate(new Date(record.date || Date.now())),

        summary: {
            weather: record.summary?.weather || null,
            health: record.summary?.health || null,
            cycle: record.summary?.cycle || null,
            mission: record.summary?.mission || null,
            relationship: record.summary?.relationship || null
        },

        commander: {
            message: record.commander?.message || record.note || "",
            readiness: record.commander?.readiness || "READY",
            risk: record.commander?.risk || "0 / 10",
            priority: record.commander?.priority || []
        },

        media: {
            photos: record.media?.photos || [],
            audio: record.media?.audio || null
        },

        memo: record.memo || "",

        status: record.status || "Saved"
    };
}

function migrateVestigeRecords() {
    const records = getVestigeRecords();
    saveVestigeRecords(records);
}

//========================
// Save today
//========================

function saveTodayVestige() {
    const records = getVestigeRecords();
    const todayKey = new Date().toDateString();

    const alreadySaved = records.some(function (record) {
        return new Date(record.createdAt).toDateString() === todayKey;
    });

    if (alreadySaved) {
        alert("今日の記録はすでに保存されている。");
        return;
    }

    const nextArchiveNo = records.length + 1;
    const newRecord = createVestigeRecord(nextArchiveNo);

    records.unshift(newRecord);
    saveVestigeRecords(records);

    renderVestigeList();
    openVestigeRecord(newRecord.id);
}

//========================
// Summary helpers
//========================

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getMissionPercent(mission) {
    if (!mission) return 0;

    const values = Object.values(mission);
    const total = values.length;

    if (total === 0) return 0;

    const completed = values.filter(Boolean).length;

    return Math.round((completed / total) * 100);
}

function getHealthFlags(health) {
    if (!health) return [];

    const flags = [];

    if (health.headache) flags.push("頭痛");
    if (health.dizzy) flags.push("めまい");
    if (health.period) flags.push("生理");
    if (health.pms) flags.push("PMS");
    if (health.medicine) flags.push("服薬");
    if (health.boxing) flags.push("Boxing");

    return flags;
}

function getCycleRecords(cycle) {
    if (!cycle || !Array.isArray(cycle.records)) return [];

    return cycle.records
        .filter(function (record) {
            return record.start;
        })
        .sort(function (a, b) {
            return parseDateKey(a.start) - parseDateKey(b.start);
        });
}

function getCycleStatus(cycle, createdAt) {
    const records = getCycleRecords(cycle);

    if (records.length === 0) {
        return "未記録";
    }

    const targetDate = new Date(createdAt);
    const targetKey = getDateKey(targetDate);

    const last = records
        .filter(function (record) {
            return parseDateKey(record.start) <= parseDateKey(targetKey);
        })
        .pop();

    if (!last) return "記録あり";

    const day = diffDays(targetKey, last.start) + 1;

    if (last.end) {
        const inPeriod =
            parseDateKey(last.start) <= parseDateKey(targetKey) &&
            parseDateKey(targetKey) <= parseDateKey(last.end);

        if (inPeriod) {
            return "Day " + day + " / 生理中";
        }
    }

    return "Day " + day;
}

function summarizeRecord(record) {
    const parts = [];

    if (record.summary.weather) {
        parts.push(
            record.summary.weather.text + " / " +
            record.summary.weather.pressure + "hPa"
        );
    }

    const healthFlags = getHealthFlags(record.summary.health);

    if (healthFlags.length > 0) {
        parts.push(healthFlags.join(" / "));
    }

    if (record.commander && record.commander.readiness) {
        parts.push(record.commander.readiness);
    }

    if (parts.length === 0) {
        return record.status;
    }

    return parts.join(" ・ ");
}

function renderTagList(items, emptyLabel) {
    if (!items || items.length === 0) {
        return "<span class='vestige-tag muted'>" + escapeHtml(emptyLabel || "なし") + "</span>";
    }

    return items.map(function (item) {
        return "<span class='vestige-tag'>" + escapeHtml(item) + "</span>";
    }).join("");
}

function getRecordMood(record) {
    const commander = record.commander || {};
    const readiness = commander.readiness || "READY";

    if (readiness.includes("RECOVERY")) return "Recovery";
    if (readiness.includes("LIMITED")) return "Limited";
    if (readiness.includes("CAUTION")) return "Caution";
    return "Ready";
}

//========================
// Detail render helpers
//========================

function detailSection(title, body) {
    return (
        "<div class='vestige-detail-section'>" +
            "<div class='vestige-section-title'>" + escapeHtml(title) + "</div>" +
            "<div class='vestige-section-body'>" + body + "</div>" +
        "</div>"
    );
}

function renderOverviewDetail(record) {
    const weather = record.summary.weather;
    const health = record.summary.health;
    const mission = record.summary.mission;
    const cycle = record.summary.cycle;

    const weatherLabel = weather
        ? (weather.text || "天気") + " / " + (weather.pressure || "----") + "hPa"
        : "未同期";

    const healthFlags = getHealthFlags(health);
    const healthLabel = healthFlags.length ? healthFlags.join(" / ") : "記録なし";

    const missionLabel = getMissionPercent(mission) + "%";
    const cycleLabel = getCycleStatus(cycle, record.createdAt);

    return (
        "<div class='vestige-overview-grid'>" +
            "<div class='vestige-overview-tile'>" +
                "<div class='meta-label'>Weather</div>" +
                "<div>" + escapeHtml(weatherLabel) + "</div>" +
            "</div>" +
            "<div class='vestige-overview-tile'>" +
                "<div class='meta-label'>Health</div>" +
                "<div>" + escapeHtml(healthLabel) + "</div>" +
            "</div>" +
            "<div class='vestige-overview-tile'>" +
                "<div class='meta-label'>Cycle</div>" +
                "<div>" + escapeHtml(cycleLabel) + "</div>" +
            "</div>" +
            "<div class='vestige-overview-tile'>" +
                "<div class='meta-label'>Mission</div>" +
                "<div>" + escapeHtml(missionLabel) + "</div>" +
            "</div>" +
        "</div>"
    );
}

function renderCommanderHero(record) {
    const commander = record.commander || {};
    const message = commander.message || "記録なし";
    const readiness = commander.readiness || "READY";
    const risk = commander.risk || "0 / 10";
    const priority = Array.isArray(commander.priority) ? commander.priority : [];

    let priorityHtml = "";

    if (priority.length > 0) {
        priorityHtml =
            "<div class='vestige-priority-row'>" +
                renderTagList(priority, "優先事項なし") +
            "</div>";
    }

    return (
        "<div class='vestige-commander-card'>" +
            "<div class='vestige-commander-label'>Commander</div>" +
            "<p class='vestige-commander-quote'>“" + escapeHtml(message) + "”</p>" +
            "<div class='vestige-commander-meta'>" +
                "<span>" + escapeHtml(readiness) + "</span>" +
                "<span>Risk " + escapeHtml(risk) + "</span>" +
            "</div>" +
            priorityHtml +
        "</div>"
    );
}

function renderWeatherDetail(weather) {
    if (!weather) {
        return detailSection("Weather", "<p>記録なし</p>");
    }

    const body =
        "<div class='vestige-metric-row'>" +
            "<span>Condition</span>" +
            "<strong>" + escapeHtml(weather.text || "天気不明") + "</strong>" +
        "</div>" +
        "<div class='vestige-metric-row'>" +
            "<span>Temperature</span>" +
            "<strong>" + escapeHtml(weather.temp ?? "--") + "℃</strong>" +
        "</div>" +
        "<div class='vestige-metric-row'>" +
            "<span>Pressure</span>" +
            "<strong>" + escapeHtml(weather.pressure ?? "----") + "hPa</strong>" +
        "</div>" +
        "<div class='vestige-metric-row'>" +
            "<span>Humidity</span>" +
            "<strong>" + escapeHtml(weather.humidity ?? "--") + "%</strong>" +
        "</div>" +
        "<p class='vestige-note-line'>" + escapeHtml(weather.note || "") + "</p>";

    return detailSection("Weather", body);
}

function renderHealthDetail(health) {
    if (!health) {
        return detailSection("Health", "<p>記録なし</p>");
    }

    const flags = getHealthFlags(health);

    let body = "<div class='vestige-tag-row'>" + renderTagList(flags, "症状記録なし") + "</div>";

    if (health.sleepMemo) {
        body +=
            "<div class='vestige-metric-row'>" +
                "<span>Sleep</span>" +
                "<strong>" + escapeHtml(health.sleepMemo) + "</strong>" +
            "</div>";
    }

    if (health.bodyNote) {
        body += "<p class='vestige-note-line'>" + escapeHtml(health.bodyNote) + "</p>";
    }

    return detailSection("Health", body);
}

function renderCycleDetail(cycle, record) {
    const records = getCycleRecords(cycle);
    const status = getCycleStatus(cycle, record.createdAt);

    if (records.length === 0) {
        return detailSection("Cycle", "<p>記録なし</p>");
    }

    const last = records[records.length - 1];

    let body =
        "<div class='vestige-metric-row'>" +
            "<span>Status</span>" +
            "<strong>" + escapeHtml(status) + "</strong>" +
        "</div>" +
        "<div class='vestige-metric-row'>" +
            "<span>Latest Start</span>" +
            "<strong>" + escapeHtml(last.start || "--") + "</strong>" +
        "</div>";

    if (last.end) {
        body +=
            "<div class='vestige-metric-row'>" +
                "<span>Latest End</span>" +
                "<strong>" + escapeHtml(last.end) + "</strong>" +
            "</div>";
    }

    return detailSection("Cycle", body);
}

function renderMissionDetail(mission) {
    if (!mission) {
        return detailSection("Mission", "<p>記録なし</p>");
    }

    const percent = getMissionPercent(mission);

    const labels = {
        condition: "Condition",
        weather: "Weather",
        planner: "Planner",
        health: "Health",
        focus: "Focus"
    };

    let body =
        "<div class='vestige-progress-row'>" +
            "<span>Mission Progress</span>" +
            "<strong>" + percent + "%</strong>" +
        "</div>" +
        "<div class='vestige-progress-bar'>" +
            "<div class='vestige-progress-fill' style='width:" + percent + "%'></div>" +
        "</div>" +
        "<ul class='vestige-mini-list'>";

    Object.keys(labels).forEach(function (key) {
        body += "<li>" + (mission[key] ? "☑ " : "☐ ") + labels[key] + "</li>";
    });

    body += "</ul>";

    return detailSection("Mission", body);
}

function renderRelationshipDetail(relationship) {
    if (!relationship) {
        return detailSection("Relationship", "<p>記録なし</p>");
    }

    const affinity = Number(relationship.affinity || 0);

    const body =
        "<div class='vestige-metric-row'>" +
            "<span>Level</span>" +
            "<strong>Partner Lv." + escapeHtml(relationship.level || 1) + "</strong>" +
        "</div>" +
        "<div class='vestige-progress-row'>" +
            "<span>Affinity</span>" +
            "<strong>" + escapeHtml(affinity) + "%</strong>" +
        "</div>" +
        "<div class='vestige-progress-bar'>" +
            "<div class='vestige-progress-fill' style='width:" + Math.min(affinity, 100) + "%'></div>" +
        "</div>" +
        "<div class='vestige-metric-row'>" +
            "<span>Today's Trust</span>" +
            "<strong>+" + escapeHtml(relationship.trustToday || 0) + "</strong>" +
        "</div>";

    return detailSection("Relationship", body);
}

//========================
// Render list / detail
//========================

function renderVestigeList() {
    if (!vestigeList) return;

    const records = getVestigeRecords();

    if (records.length === 0) {
        vestigeList.textContent = "まだ記録は保存されていない。";
        return;
    }

    vestigeList.innerHTML = "";

    records.forEach(function (record) {
        const item = document.createElement("div");
        item.className = "vestige-item";

        item.innerHTML =
            "<div>" +
                "<div class='vestige-date'>" +
                    escapeHtml(record.archiveLabel) + " / " + escapeHtml(record.label) +
                "</div>" +
                "<div class='vestige-status'>" +
                    escapeHtml(summarizeRecord(record)) +
                "</div>" +
            "</div>" +
            "<button class='vestige-open-btn' type='button' data-id='" + record.id + "'>Open</button>";

        vestigeList.appendChild(item);
    });

    document.querySelectorAll(".vestige-open-btn").forEach(function (button) {
        button.addEventListener("click", function () {
            openVestigeRecord(Number(button.dataset.id));
        });
    });
}

function openVestigeRecord(id) {
    const records = getVestigeRecords();
    const record = records.find(function (item) {
        return Number(item.id) === Number(id);
    });

    if (!record || !vestigeDetailCard || !vestigeDetailBody) return;

    const createdAt = new Date(record.createdAt);

    if (vestigeDetailNo) {
        vestigeDetailNo.textContent = "Archive " + record.archiveLabel + " / " + getRecordMood(record);
    }

    if (vestigeDetailDate) {
        vestigeDetailDate.textContent = record.label + " " + formatVestigeTime(createdAt);
    }

    vestigeDetailBody.innerHTML =
        renderOverviewDetail(record) +
        renderCommanderHero(record) +
        renderWeatherDetail(record.summary.weather) +
        renderHealthDetail(record.summary.health) +
        renderCycleDetail(record.summary.cycle, record) +
        renderMissionDetail(record.summary.mission) +
        renderRelationshipDetail(record.summary.relationship);

    vestigeDetailCard.classList.remove("is-hidden");
    vestigeDetailCard.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function closeDetail() {
    if (vestigeDetailCard) {
        vestigeDetailCard.classList.add("is-hidden");
    }
}

//========================
// Init
//========================

if (saveVestigeButton) {
    saveVestigeButton.addEventListener("click", saveTodayVestige);
}

if (closeVestigeDetail) {
    closeVestigeDetail.addEventListener("click", closeDetail);
}

migrateVestigeRecords();
renderVestigeList();

