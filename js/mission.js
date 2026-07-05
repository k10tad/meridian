//========================
// Meridian Mission Center v0.7
//========================

const missionItems = {
    condition: false,
    weather: false,
    planner: false,
    health: false,
    focus: false
};

const missionPercent = document.getElementById("missionPercent");
const missionFill = document.getElementById("missionFill");

function getMissionKey() {
    return "meridianMission_" + new Date().toDateString();
}

function loadMission() {
    const saved = localStorage.getItem(getMissionKey());

    if (saved) {
        Object.assign(missionItems, JSON.parse(saved));
    }

    renderMission();
}

function saveMission() {
    localStorage.setItem(getMissionKey(), JSON.stringify(missionItems));
}

function completeMission(type) {
    if (!missionItems.hasOwnProperty(type)) return;
    if (missionItems[type]) return;

    missionItems[type] = true;

    saveMission();
    renderMission();

    if (typeof addTrust === "function") {
        addTrust(1);
    }
}

function renderMission() {
    const completed =
        Object.values(missionItems).filter(Boolean).length;

    const total = Object.keys(missionItems).length;
    const percent = Math.round((completed / total) * 100);

    if (missionPercent) {
        missionPercent.textContent = percent + "%";
    }

    if (missionFill) {
        missionFill.style.width = percent + "%";
    }

    updateMissionLabel("missionCondition", missionItems.condition, "Condition Check");
    updateMissionLabel("missionWeather", missionItems.weather, "Weather Sync");
    updateMissionLabel("missionPlanner", missionItems.planner, "Planner");
    updateMissionLabel("missionHealth", missionItems.health, "Health Log");
    updateMissionLabel("missionFocus", missionItems.focus, "Focus Session");

    if (percent === 100) {
        const greeting = document.getElementById("deskGreeting");

        if (greeting) {
            greeting.textContent = "任務完了だ。今日はよくやった、レイ。";
        }
    }
}

function updateMissionLabel(id, done, label) {
    const el = document.getElementById(id);

    if (el) {
        el.textContent = (done ? "☑ " : "☐ ") + label;
        el.classList.toggle("mission-complete", done);
    }
}

loadMission();
