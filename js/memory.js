//========================
// Meridian Commander Engine v2.0
// memory.js - Vestige hooks for future use
//========================

function commanderReadVestigeRecords(limit) {
    try {
        const records = JSON.parse(localStorage.getItem("meridianVestigeRecords")) || [];
        return records.slice(0, limit || 7);
    } catch (error) {
        console.warn("Vestige read failed", error);
        return [];
    }
}

function commanderGetMemoryObservation() {
    const records = commanderReadVestigeRecords(2);

    if (records.length < 1) return "";

    const latest = records[0];

    if (latest.summary && latest.summary.health && latest.summary.health.headache) {
        return "直近の記録にも頭痛が残っている。今日は早めに抑えろ。";
    }

    if (latest.summary && latest.summary.mission) {
        return "前回の記録は残っている。今日も一つずつ積めばいい。";
    }

    return "";
}
