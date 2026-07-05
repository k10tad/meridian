//========================
// Meridian Health v1.0
//========================

const healthButtons = document.querySelectorAll(".health-toggle");
const sleepMemoInput = document.getElementById("sleepMemoInput");
const bodyNoteInput = document.getElementById("bodyNoteInput");
const healthSummary = document.getElementById("healthSummary");

const todayKey = new Date().toDateString();

let healthLog = {
    date: todayKey,
    headache: false,
    dizzy: false,
    period: false,
    pms: false,
    medicine: false,
    boxing: false,
    sleepMemo: "",
    bodyNote: ""
};

function getHealthStorageKey() {
    return "meridianHealthLog_" + todayKey;
}

function loadHealthLog() {
    const saved = localStorage.getItem(getHealthStorageKey());

    if (saved) {
        healthLog = JSON.parse(saved);
    }

    renderHealthLog();
}

function saveHealthLog() {
    localStorage.setItem(
        getHealthStorageKey(),
        JSON.stringify(healthLog)
    );

    renderHealthSummary();
}

function renderHealthLog() {
    healthButtons.forEach(function (button) {
        const key = button.dataset.health;

        if (healthLog[key]) {
            button.classList.add("selected");
        } else {
            button.classList.remove("selected");
        }
    });

    if (sleepMemoInput) {
        sleepMemoInput.value = healthLog.sleepMemo || "";
    }

    if (bodyNoteInput) {
        bodyNoteInput.value = healthLog.bodyNote || "";
    }

    renderHealthSummary();
}

function renderHealthSummary() {
    if (!healthSummary) return;

    const active = [];

    if (healthLog.headache) active.push("頭痛");
    if (healthLog.dizzy) active.push("めまい");
    if (healthLog.period) active.push("生理");
    if (healthLog.pms) active.push("PMS");
    if (healthLog.medicine) active.push("服薬済み");
    if (healthLog.boxing) active.push("Boxing済み");

    if (active.length === 0 && !healthLog.sleepMemo && !healthLog.bodyNote) {
        healthSummary.textContent = "今日の記録はまだない。";
        return;
    }

    let summary = "記録：";

    if (active.length > 0) {
        summary += active.join(" / ");
    }

    if (healthLog.sleepMemo) {
        summary += "｜睡眠：" + healthLog.sleepMemo;
    }

    if (healthLog.bodyNote) {
        summary += "｜メモ：" + healthLog.bodyNote;
    }

    healthSummary.textContent = summary;
}

healthButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const key = button.dataset.health;

        healthLog[key] = !healthLog[key];

        if (typeof addTrust === "function") {
            addTrust(1);
        }

        if (typeof completeMission === "function") {
    completeMission("health");
}

        saveHealthLog();
        renderHealthLog();
    });
});

if (sleepMemoInput) {
    sleepMemoInput.addEventListener("input", function () {
        healthLog.sleepMemo = sleepMemoInput.value;
        saveHealthLog();
    });
}

if (bodyNoteInput) {
    bodyNoteInput.addEventListener("input", function () {
        healthLog.bodyNote = bodyNoteInput.value;
        saveHealthLog();
    });
}

loadHealthLog();