//========================
// Meridian Cycle / Health Insight v1.3
//========================

const cycleDayStatus = document.getElementById("cycleDayStatus");
const cycleNextStatus = document.getElementById("cycleNextStatus");
const cycleStatusMessage = document.getElementById("cycleStatusMessage");
const briefMessageCycle = document.getElementById("briefMessage");
const deskGreetingCycle = document.getElementById("deskGreeting");

const DEFAULT_CYCLE = 30;

function cycleGetTodayKey() {
    const d = new Date();
    return cycleGetDateKey(d);
}

function cycleGetDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
}

function cycleParseDate(key) {
    const p = key.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
}

function cycleDiffDays(a, b) {
    return Math.round((cycleParseDate(a) - cycleParseDate(b)) / 86400000);
}

function cycleFormatShort(key) {
    if (!key) return "未設定";

    return cycleParseDate(key).toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric"
    });
}

function getCycleDataForInsight() {
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

function getSortedCycleRecordsForInsight() {
    const cycle = getCycleDataForInsight();

    return cycle.records
        .filter(function (record) {
            return record.start;
        })
        .sort(function (a, b) {
            return cycleParseDate(a.start) - cycleParseDate(b.start);
        });
}

function getAverageCycleDaysForInsight() {
    const records = getSortedCycleRecordsForInsight();

    if (records.length < 2) {
        return DEFAULT_CYCLE;
    }

    const intervals = [];

    for (let i = 1; i < records.length; i++) {
        const diff = cycleDiffDays(records[i].start, records[i - 1].start);

        if (diff > 15 && diff < 60) {
            intervals.push(diff);
        }
    }

    if (intervals.length === 0) {
        return DEFAULT_CYCLE;
    }

    const sum = intervals.reduce(function (a, b) {
        return a + b;
    }, 0);

    return Math.round(sum / intervals.length);
}

function getLastCycleRecordForInsight() {
    const records = getSortedCycleRecordsForInsight();

    if (records.length === 0) return null;

    return records[records.length - 1];
}

function getNextPeriodKeyForInsight() {
    const last = getLastCycleRecordForInsight();

    if (!last) return null;

    const avg = getAverageCycleDaysForInsight();
    const next = cycleParseDate(last.start);

    next.setDate(next.getDate() + avg);

    return cycleGetDateKey(next);
}

function isTodayInPeriod(last, todayKey) {
    if (!last || !last.start) return false;

    const start = last.start;
    const end = last.end || start;

    return cycleParseDate(start) <= cycleParseDate(todayKey) &&
           cycleParseDate(todayKey) <= cycleParseDate(end);
}

function updateTodayHealthFromCycle(status) {
    const todayKey = new Date().toDateString();
    const storageKey = "meridianHealthLog_" + todayKey;

    const saved = JSON.parse(localStorage.getItem(storageKey)) || {
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

    if (status.isPeriod) {
        saved.period = true;
    }

    if (status.isPmsWindow) {
        saved.pms = true;
    }

    localStorage.setItem(storageKey, JSON.stringify(saved));

    document.querySelectorAll(".health-toggle").forEach(function (button) {
        const key = button.dataset.health;

        if (saved[key]) {
            button.classList.add("selected");
        }
    });
}

function renderCycleInsight() {
    const records = getSortedCycleRecordsForInsight();
    const last = getLastCycleRecordForInsight();
    const nextKey = getNextPeriodKeyForInsight();
    const todayKey = cycleGetTodayKey();

    if (records.length === 0 || !last) {
        if (cycleDayStatus) cycleDayStatus.textContent = "未記録";
        if (cycleNextStatus) cycleNextStatus.textContent = "未設定";
        if (cycleStatusMessage) {
            cycleStatusMessage.textContent = "Plannerで開始日を記録すると、周期の見通しを出せる。";
        }
        return;
    }

    const cycleDay = cycleDiffDays(todayKey, last.start) + 1;
    const daysUntilNext = nextKey ? cycleDiffDays(nextKey, todayKey) : null;

    const isPeriod = isTodayInPeriod(last, todayKey);
    const isPmsWindow =
        daysUntilNext !== null &&
        daysUntilNext <= 7 &&
        daysUntilNext > 0;

    const isNearNext =
        daysUntilNext !== null &&
        daysUntilNext <= 3 &&
        daysUntilNext >= 0;

    if (cycleDayStatus) {
        cycleDayStatus.textContent = "Day " + cycleDay;
    }

    if (cycleNextStatus) {
        if (daysUntilNext === 0) {
            cycleNextStatus.textContent = "今日";
        } else if (daysUntilNext > 0) {
            cycleNextStatus.textContent =
                "あと" + daysUntilNext + "日";
        } else {
            cycleNextStatus.textContent =
                cycleFormatShort(nextKey);
        }
    }

    let message = "周期は記録済み。今日は通常モードで進められる。";

    if (isPeriod) {
        message = "生理中だ。今日は身体の負担を優先しろ。予定は軽く見積もる。";
    } else if (isNearNext) {
        message = "次回予測が近い。無理に予定を詰めるな。";
    } else if (isPmsWindow) {
        message = "PMSが出やすい時期に入っている。睡眠と頭痛に注意しろ。";
    }

    if (cycleStatusMessage) {
        cycleStatusMessage.textContent = message;
    }

    if (briefMessageCycle) {
        briefMessageCycle.textContent =
            briefMessageCycle.textContent + " " + message;
    }

    if (deskGreetingCycle && (isPeriod || isNearNext || isPmsWindow)) {
        deskGreetingCycle.textContent = message;
    }

updateTodayHealthFromCycle({
    isPeriod: isPeriod,
    isPmsWindow: isPmsWindow
});

if (typeof loadHealthLog === "function") {
    loadHealthLog();
}

}

renderCycleInsight();
