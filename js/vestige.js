//========================
// Meridian Vestige v1.1B
// Archive with Meridian Data Snapshot
//========================

const saveVestigeButton = document.getElementById("saveVestigeButton");
const vestigeList = document.getElementById("vestigeList");

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

function createEmptySummary() {
    return {
        weather: null,
        health: null,
        cycle: null,
        mission: null,
        relationship: null
    };
}

function createEmptyCommander() {
    return {
        message: "",
        readiness: "READY",
        risk: "0 / 10",
        priority: []
    };
}

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
}

//========================
// Render helpers
//========================

function summarizeRecord(record) {
    const parts = [];

    if (record.summary.weather) {
        parts.push(
            record.summary.weather.text + " / " +
            record.summary.weather.pressure + "hPa"
        );
    }

    if (record.summary.health) {
        const health = record.summary.health;
        const flags = [];

        if (health.headache) flags.push("頭痛");
        if (health.dizzy) flags.push("めまい");
        if (health.period) flags.push("生理");
        if (health.pms) flags.push("PMS");
        if (health.medicine) flags.push("服薬");
        if (health.boxing) flags.push("Boxing");

        if (flags.length > 0) {
            parts.push(flags.join(" / "));
        }
    }

    if (record.commander && record.commander.readiness) {
        parts.push(record.commander.readiness);
    }

    if (parts.length === 0) {
        return record.status;
    }

    return parts.join(" ・ ");
}

//========================
// Render
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
                    record.archiveLabel + " / " + record.label +
                "</div>" +
                "<div class='vestige-status'>" +
                    summarizeRecord(record) +
                "</div>" +
            "</div>" +
            "<button class='vestige-open-btn' type='button'>Open</button>";

        vestigeList.appendChild(item);
    });
}

//========================
// Init
//========================

if (saveVestigeButton) {
    saveVestigeButton.addEventListener("click", saveTodayVestige);
}

migrateVestigeRecords();
renderVestigeList();
