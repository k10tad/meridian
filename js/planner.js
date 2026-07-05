//========================
// Meridian Planner v1.2
// Schedule + Cycle Records
//========================

const plannerToday = document.getElementById("plannerToday");
const plannerMonth = document.getElementById("plannerMonth");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonthButton = document.getElementById("prevMonth");
const nextMonthButton = document.getElementById("nextMonth");
const plannerBrief = document.getElementById("plannerBrief");
const addPlanButton = document.getElementById("addPlanButton");

const periodStartButton = document.getElementById("periodStartButton");
const periodEndButton = document.getElementById("periodEndButton");
const lastPeriodDate = document.getElementById("lastPeriodDate");
const nextPeriodDate = document.getElementById("nextPeriodDate");
const averageCycleDays = document.getElementById("averageCycleDays");
const cycleHistory = document.getElementById("cycleHistory");

let plannerDate = new Date();
let selectedDate = new Date();

const DEFAULT_CYCLE_DAYS = 30;

function getDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
}

function parseDateKey(key) {
    const p = key.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
}

function formatSelectedDate(date) {
    return date.toLocaleDateString("ja-JP", {
        month: "long",
        day: "numeric",
        weekday: "short"
    });
}

function formatMonthLabel(date) {
    return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
    });
}

function formatShortDateFromKey(key) {
    if (!key) return "未設定";
    return parseDateKey(key).toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric"
    });
}

function getPlans() {
    return JSON.parse(localStorage.getItem("meridianPlans")) || {};
}

function savePlans(plans) {
    localStorage.setItem("meridianPlans", JSON.stringify(plans));
}

function getCycleData() {
    const saved = JSON.parse(localStorage.getItem("meridianCycle"));

    if (saved && Array.isArray(saved.records)) {
        return saved;
    }

    if (saved && saved.lastPeriodStart) {
        return {
            records: [
                {
                    start: saved.lastPeriodStart,
                    end: null,
                    note: ""
                }
            ]
        };
    }

    return {
        records: []
    };
}

function saveCycleData(data) {
    localStorage.setItem("meridianCycle", JSON.stringify(data));
}

function normalizeOldPlans(plans, key) {
    if (!plans[key]) return [];

    return plans[key].map(function (item) {
        if (typeof item === "string") {
            return {
                title: item,
                done: false,
                createdAt: Date.now()
            };
        }

        return item;
    });
}

function getSortedCycleRecords() {
    const cycle = getCycleData();

    return cycle.records
        .filter(function (record) {
            return record.start;
        })
        .sort(function (a, b) {
            return parseDateKey(a.start) - parseDateKey(b.start);
        });
}

function getLastCycleRecord() {
    const records = getSortedCycleRecords();

    if (records.length === 0) return null;

    return records[records.length - 1];
}

function calculateAverageCycleDays() {
    const records = getSortedCycleRecords();

    if (records.length < 2) {
        return DEFAULT_CYCLE_DAYS;
    }

    const intervals = [];

    for (let i = 1; i < records.length; i++) {
        const prev = parseDateKey(records[i - 1].start);
        const current = parseDateKey(records[i].start);

        const diff = Math.round((current - prev) / 86400000);

        if (diff > 15 && diff < 60) {
            intervals.push(diff);
        }
    }

    if (intervals.length === 0) {
        return DEFAULT_CYCLE_DAYS;
    }

    const sum = intervals.reduce(function (total, value) {
        return total + value;
    }, 0);

    return Math.round(sum / intervals.length);
}

function getNextPeriodKey() {
    const last = getLastCycleRecord();

    if (!last) return null;

    const average = calculateAverageCycleDays();
    const next = parseDateKey(last.start);

    next.setDate(next.getDate() + average);

    return getDateKey(next);
}

function isPeriodStart(key) {
    return getSortedCycleRecords().some(function (record) {
        return record.start === key;
    });
}

function isPeriodEnd(key) {
    return getSortedCycleRecords().some(function (record) {
        return record.end === key;
    });
}

function renderSelectedDate() {
    if (plannerToday) {
        plannerToday.textContent = formatSelectedDate(selectedDate);
    }
}

function renderCalendar() {
    if (!calendarGrid || !plannerMonth) return;

    calendarGrid.innerHTML = "";

    const plans = getPlans();

    const year = plannerDate.getFullYear();
    const month = plannerDate.getMonth();

    plannerMonth.textContent = formatMonthLabel(plannerDate);

    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const todayKey = getDateKey(new Date());
    const selectedKey = getDateKey(selectedDate);
    const nextPeriodKey = getNextPeriodKey();

    for (let i = 0; i < firstWeekday; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "calendar-day empty";
        calendarGrid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const key = getDateKey(date);

        const dayCell = document.createElement("button");
        dayCell.type = "button";
        dayCell.className = "calendar-day";
        dayCell.textContent = day;

        const dayPlans = normalizeOldPlans(plans, key);

        if (key === todayKey) dayCell.classList.add("today");
        if (key === selectedKey) dayCell.classList.add("selected-day");
        if (dayPlans.length > 0) dayCell.classList.add("has-event");

        if (dayPlans.length > 0 && dayPlans.every(function (item) { return item.done; })) {
            dayCell.classList.add("all-done");
        }

        if (isPeriodStart(key)) dayCell.classList.add("period-start");
        if (isPeriodEnd(key)) dayCell.classList.add("period-end");
        if (nextPeriodKey === key) dayCell.classList.add("period-estimate");

        dayCell.addEventListener("click", function () {
            selectedDate = date;
            renderPlanner();
        });

        calendarGrid.appendChild(dayCell);
    }
}

function renderPlannerBrief() {
    if (!plannerBrief) return;

    const key = getDateKey(selectedDate);
    const plans = getPlans();
    const items = normalizeOldPlans(plans, key);

    if (items.length > 0) {
        plans[key] = items;
        savePlans(plans);
    }

    let html = "<div class='brief-date'>" + formatSelectedDate(selectedDate) + "</div>";

    const hasCycleMark =
        isPeriodStart(key) ||
        isPeriodEnd(key) ||
        getNextPeriodKey() === key;

    if (items.length === 0 && !hasCycleMark) {
        plannerBrief.textContent =
            formatSelectedDate(selectedDate) + "：予定はまだ登録されていない。";
        return;
    }

    items.forEach(function (item, index) {
        html +=
            "<div class='plan-item " + (item.done ? "done" : "") + "'>" +
                "<button type='button' class='plan-check' data-index='" + index + "'>" +
                    (item.done ? "☑" : "☐") +
                "</button>" +
                "<span class='plan-title'>" + item.title + "</span>" +
                "<button type='button' class='plan-delete' data-index='" + index + "'>×</button>" +
            "</div>";
    });

    if (isPeriodStart(key)) {
        html += "<div class='brief-item'>・生理開始日</div>";
    }

    if (isPeriodEnd(key)) {
        html += "<div class='brief-item'>・生理終了日</div>";
    }

    if (getNextPeriodKey() === key) {
        html += "<div class='brief-item'>・次回生理予測日</div>";
    }

    plannerBrief.innerHTML = html;

    document.querySelectorAll(".plan-check").forEach(function (button) {
        button.addEventListener("click", function () {
            togglePlanDone(Number(button.dataset.index));
        });
    });

    document.querySelectorAll(".plan-delete").forEach(function (button) {
        button.addEventListener("click", function () {
            deletePlan(Number(button.dataset.index));
        });
    });
}

function addPlan() {
    const title = prompt("予定を入力");

    if (!title || !title.trim()) return;

    const key = getDateKey(selectedDate);
    const plans = getPlans();

    if (!plans[key]) plans[key] = [];

    plans[key] = normalizeOldPlans(plans, key);

    plans[key].push({
        title: title.trim(),
        done: false,
        createdAt: Date.now()
    });

    savePlans(plans);

    if (typeof addTrust === "function") addTrust(1);

    renderPlanner();
}

function togglePlanDone(index) {
    const key = getDateKey(selectedDate);
    const plans = getPlans();

    plans[key] = normalizeOldPlans(plans, key);

    if (!plans[key][index]) return;

    plans[key][index].done = !plans[key][index].done;

    savePlans(plans);

    if (
        plans[key].length > 0 &&
        plans[key].every(function (item) { return item.done; })
    ) {
        if (typeof completeMission === "function") completeMission("planner");
        if (typeof addTrust === "function") addTrust(2);
    }

    renderPlanner();
}

function deletePlan(index) {
    const key = getDateKey(selectedDate);
    const plans = getPlans();

    plans[key] = normalizeOldPlans(plans, key);

    if (!plans[key][index]) return;

    plans[key].splice(index, 1);

    if (plans[key].length === 0) {
        delete plans[key];
    }

    savePlans(plans);
    renderPlanner();
}

function addCycleStart() {
    const key = getDateKey(selectedDate);
    const cycle = getCycleData();

    const exists = cycle.records.some(function (record) {
        return record.start === key;
    });

    if (!exists) {
        cycle.records.push({
            start: key,
            end: null,
            note: ""
        });
    }

    saveCycleData(cycle);

    if (typeof completeMission === "function") completeMission("health");
    if (typeof addTrust === "function") addTrust(1);

    renderPlanner();
}

function setCycleEnd() {
    const key = getDateKey(selectedDate);
    const cycle = getCycleData();

    if (cycle.records.length === 0) {
        alert("先に開始日を追加して。");
        return;
    }

    const records = cycle.records.sort(function (a, b) {
        return parseDateKey(a.start) - parseDateKey(b.start);
    });

    let target = null;

    for (let i = records.length - 1; i >= 0; i--) {
        const startDate = parseDateKey(records[i].start);
        const endDate = parseDateKey(key);

        if (startDate <= endDate) {
            target = records[i];
            break;
        }
    }

    if (!target) {
        alert("終了日は開始日より後の日付を選んで。");
        return;
    }

    target.end = key;

    cycle.records = records;
    saveCycleData(cycle);

    if (typeof addTrust === "function") addTrust(1);

    renderPlanner();
}

function deleteCycleRecord(index) {
    const cycle = getCycleData();
    const records = getSortedCycleRecords();

    records.splice(index, 1);

    cycle.records = records;
    saveCycleData(cycle);

    renderPlanner();
}

function renderCycleInfo() {
    const records = getSortedCycleRecords();
    const last = getLastCycleRecord();
    const nextKey = getNextPeriodKey();
    const average = calculateAverageCycleDays();

    if (!last) {
        if (lastPeriodDate) lastPeriodDate.textContent = "未記録";
        if (nextPeriodDate) nextPeriodDate.textContent = "未設定";
        if (averageCycleDays) averageCycleDays.textContent = "--日";
    } else {
        if (lastPeriodDate) lastPeriodDate.textContent = formatShortDateFromKey(last.start);
        if (nextPeriodDate) nextPeriodDate.textContent = formatShortDateFromKey(nextKey);
        if (averageCycleDays) averageCycleDays.textContent = average + "日";
    }

    if (!cycleHistory) return;

    if (records.length === 0) {
        cycleHistory.innerHTML = "<div class='cycle-empty'>履歴はまだない。</div>";
        return;
    }

    cycleHistory.innerHTML = records.map(function (record, index) {
        return (
            "<div class='cycle-record'>" +
                "<div>" +
                    "<div class='cycle-record-main'>" +
                        formatShortDateFromKey(record.start) +
                        " → " +
                        (record.end ? formatShortDateFromKey(record.end) : "終了未設定") +
                    "</div>" +
                    "<div class='cycle-record-sub'>Cycle Record</div>" +
                "</div>" +
                "<button type='button' class='cycle-delete' data-index='" + index + "'>×</button>" +
            "</div>"
        );
    }).join("");

    document.querySelectorAll(".cycle-delete").forEach(function (button) {
        button.addEventListener("click", function () {
            deleteCycleRecord(Number(button.dataset.index));
        });
    });
}

function renderPlanner() {
    renderSelectedDate();
    renderCalendar();
    renderPlannerBrief();
    renderCycleInfo();
}

if (prevMonthButton) {
    prevMonthButton.addEventListener("click", function () {
        plannerDate.setMonth(plannerDate.getMonth() - 1);
        renderPlanner();
    });
}

if (nextMonthButton) {
    nextMonthButton.addEventListener("click", function () {
        plannerDate.setMonth(plannerDate.getMonth() + 1);
        renderPlanner();
    });
}

if (addPlanButton) {
    addPlanButton.addEventListener("click", addPlan);
}

if (periodStartButton) {
    periodStartButton.addEventListener("click", addCycleStart);
}

if (periodEndButton) {
    periodEndButton.addEventListener("click", setCycleEnd);
}

renderPlanner();
