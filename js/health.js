//========================
// Meridian Health v2.3
// Health toggles + persistent medication history
//========================

const healthButtons = document.querySelectorAll(".health-toggle");
const healthSummary = document.getElementById("healthSummary");
const todayKey = new Date().toDateString();

let healthLog = {
    date: todayKey,
    headache: false,
    dizzy: false,
    period: false,
    pms: false,
    medicine: false,
    boxing: false
};

function getHealthStorageKey() {
    return "meridianHealthLog_" + todayKey;
}

function loadHealthLog() {
    const saved = localStorage.getItem(getHealthStorageKey());
    if (saved) {
        try {
            healthLog = Object.assign(healthLog, JSON.parse(saved));
        } catch (error) {
            // 壊れた旧データがあっても画面は止めない。
        }
    }
    renderHealthLog();
}

function saveHealthLog() {
    localStorage.setItem(getHealthStorageKey(), JSON.stringify(healthLog));
    renderHealthSummary();
}

function renderHealthLog() {
    healthButtons.forEach(function (button) {
        const key = button.dataset.health;
        button.classList.toggle("selected", Boolean(healthLog[key]));
    });
    renderHealthSummary();
}

function renderHealthSummary() {
    if (!healthSummary) return;

    const active = [];
    if (healthLog.headache) active.push("頭痛");
    if (healthLog.dizzy) active.push("めまい");
    if (healthLog.period) active.push("生理");
    if (healthLog.pms) active.push("PMS");
    if (healthLog.medicine) active.push("服薬記録あり");
    if (healthLog.boxing) active.push("Boxing済み");

    healthSummary.textContent = active.length
        ? "記録：" + active.join(" / ")
        : "今日の記録はまだない。";
}

healthButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const key = button.dataset.health;
        healthLog[key] = !healthLog[key];

        if (typeof addTrust === "function") addTrust(1);
        if (typeof completeMission === "function") completeMission("health");

        saveHealthLog();
        renderHealthLog();
    });
});

loadHealthLog();

(function () {
    const STORAGE_KEY = "meridianMedicationLogs";
    const HISTORY_DAYS = 90;
    const medicationButtons = document.querySelectorAll(".med-btn");
    const todayMedicationList = document.getElementById("todayMedicationList");
    const medicationHistoryList = document.getElementById("medicationHistoryList");
    const commanderMessage = document.getElementById("medicationCommanderMessage");
    const medicationAlertCard = document.getElementById("medicationAlertCard");
    const medicationAlertTitle = document.getElementById("medicationAlertTitle");
    const medicationAlertText = document.getElementById("medicationAlertText");
    const medicationAlertMeta = document.getElementById("medicationAlertMeta");

    if (!medicationButtons.length || !todayMedicationList) return;

    function dateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + d;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getLogs() {
        try {
            const logs = JSON.parse(localStorage.getItem(STORAGE_KEY));
            return Array.isArray(logs) ? logs : [];
        } catch (error) {
            return [];
        }
    }

    function saveLogs(logs) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    }

    function pruneOldLogs(logs) {
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() - (HISTORY_DAYS - 1));
        return logs.filter(function (log) {
            return new Date(log.takenAt).getTime() >= cutoff.getTime();
        });
    }

    function formatTime(iso) {
        return new Date(iso).toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function formatDate(iso) {
        return new Date(iso).toLocaleDateString("ja-JP", {
            month: "numeric",
            day: "numeric",
            weekday: "short"
        });
    }

    function todayLogs(logs) {
        const today = dateKey(new Date());
        return logs.filter(function (log) { return log.date === today; });
    }

    function hasDailySlot(logs, slot) {
        return todayLogs(logs).some(function (log) {
            return log.name === "ロメリジン" && log.slot === slot;
        });
    }

    function updateDailyButtons(logs) {
        medicationButtons.forEach(function (button) {
            if (button.dataset.medication !== "ロメリジン") return;
            button.classList.toggle("selected", hasDailySlot(logs, button.dataset.slot));
        });
    }

    function updateMedicationRestrictions(logs) {
        const engine = window.MeridianMedicationKnowledge;
        if (!engine || typeof engine.getTodayRestrictions !== "function") return;
        const restrictions = engine.getTodayRestrictions(logs, new Date());
        medicationButtons.forEach(function (button) {
            const medicine = button.dataset.medication;
            const isAvoid = restrictions.avoid.indexOf(medicine) !== -1;
            const isConfirm = !isAvoid && restrictions.confirm.indexOf(medicine) !== -1;
            button.classList.toggle("med-avoid-today", isAvoid);
            button.classList.toggle("med-confirm-today", isConfirm);
            if (isAvoid) {
                button.setAttribute("aria-label", medicine + "。本日は併用回避の警告あり");
                button.title = "本日は避ける薬として警告されています";
            } else if (isConfirm) {
                button.setAttribute("aria-label", medicine + "。服用前に確認が必要");
                button.title = "服用前に処方指示を確認してください";
            } else {
                button.removeAttribute("aria-label");
                button.removeAttribute("title");
            }
        });
    }

    function shouldProceedWithRestrictedMedicine(medicine, logs) {
        const engine = window.MeridianMedicationKnowledge;
        if (!engine || typeof engine.getTodayRestrictions !== "function") return true;
        const restrictions = engine.getTodayRestrictions(logs, new Date());
        if (restrictions.avoid.indexOf(medicine) !== -1) {
            return window.confirm(
                medicine + "は、本日の服薬記録との組み合わせから『今日は避ける薬』として警告されています。\n\n" +
                (restrictions.reasons[medicine] || "自己判断で追加せず、処方・添付文書または医療者の指示を確認してください。") +
                "\n\nそれでも記録しますか？"
            );
        }
        if (restrictions.confirm.indexOf(medicine) !== -1) {
            return window.confirm(
                medicine + "は、本日の服薬記録との組み合わせで注意が必要です。\n\n" +
                (restrictions.reasons[medicine] || "処方指示を確認してください。") +
                "\n\n確認済みとして記録しますか？"
            );
        }
        return true;
    }

    function renderCommanderMessage(logs) {
        if (!commanderMessage) return;
        const hour = new Date().getHours();
        const morning = hasDailySlot(logs, "午前");
        const night = hasDailySlot(logs, "夜");

        if (morning && night) {
            commanderMessage.textContent = "本日の定時薬は完了。よく管理できている。";
        } else if (!morning && hour >= 15) {
            commanderMessage.textContent = "午前のロメリジンが未記録だ。飲んだなら記録、まだなら確認しろ。";
        } else if (!night && hour >= 23) {
            commanderMessage.textContent = "夜のロメリジンが未記録だ。忘れたふりは通用しないぞ、レイ。";
        } else if (morning && !night) {
            commanderMessage.textContent = "午前分は確認済み。夜分も忘れずに。";
        } else {
            commanderMessage.textContent = "服薬した時刻を、その場で記録しておけ。記憶より記録だ。";
        }
    }


    function renderMedicationAlert(alert) {
        if (!medicationAlertCard || !alert) return;
        medicationAlertCard.hidden = false;
        medicationAlertCard.dataset.level = alert.level || "info";
        if (medicationAlertTitle) medicationAlertTitle.textContent = alert.title;
        if (medicationAlertText) medicationAlertText.textContent = alert.message + " " + alert.detail;
        if (medicationAlertMeta) {
            medicationAlertMeta.textContent = alert.category + " / " + alert.ingredient;
        }
    }

    function updateMedicationKnowledge(logs, currentLog) {
        const engine = window.MeridianMedicationKnowledge;
        if (!engine || typeof engine.evaluate !== "function" || !currentLog) return;
        const alert = engine.evaluate(currentLog.name, logs, currentLog);
        if (!alert) return;
        engine.saveLatest(alert);
        renderMedicationAlert(alert);
        if (commanderMessage) commanderMessage.textContent = alert.title + "。" + alert.message;
        if (typeof window.renderCommanderIntel === "function") window.renderCommanderIntel();
    }

    function itemHtml(log, includeDate) {
        return (
            "<div class='medication-item'>" +
                "<div class='medication-item-main'>" +
                    "<div class='medication-item-name'>" + escapeHtml(log.name) + "</div>" +
                    "<div class='medication-item-sub'>" +
                        (includeDate ? escapeHtml(formatDate(log.takenAt)) + " / " : "") +
                        escapeHtml(log.slot) +
                    "</div>" +
                "</div>" +
                "<div class='medication-item-actions'>" +
                    "<div class='medication-item-time'>" + escapeHtml(formatTime(log.takenAt)) + "</div>" +
                    "<button type='button' class='medication-delete' data-id='" + escapeHtml(log.id) + "' aria-label='記録を削除'>×</button>" +
                "</div>" +
            "</div>"
        );
    }

    function bindDeleteButtons() {
        document.querySelectorAll(".medication-delete").forEach(function (button) {
            button.addEventListener("click", function () {
                const next = getLogs().filter(function (log) {
                    return log.id !== button.dataset.id;
                });
                saveLogs(next);
                renderAll();
            });
        });
    }

    function renderAll() {
        let logs = pruneOldLogs(getLogs());
        logs.sort(function (a, b) {
            return new Date(b.takenAt) - new Date(a.takenAt);
        });
        saveLogs(logs);

        const today = todayLogs(logs);
        todayMedicationList.innerHTML = today.length
            ? today.map(function (log) { return itemHtml(log, false); }).join("")
            : "<div class='medication-empty'>まだ記録なし</div>";

        if (medicationHistoryList) {
            medicationHistoryList.innerHTML = logs.length
                ? logs.map(function (log) { return itemHtml(log, true); }).join("")
                : "<div class='medication-empty'>履歴はまだない</div>";
        }

        healthLog.medicine = today.length > 0;
        saveHealthLog();
        renderHealthLog();
        updateDailyButtons(logs);
        updateMedicationRestrictions(logs);
        renderCommanderMessage(logs);
        bindDeleteButtons();

        const knowledge = window.MeridianMedicationKnowledge;
        if (knowledge && typeof knowledge.readLatest === "function") {
            const latestAlert = knowledge.readLatest();
            if (latestAlert) renderMedicationAlert(latestAlert);
        }
    }

    medicationButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            const medication = button.dataset.medication;
            const slot = button.dataset.slot;
            let logs = getLogs();

            if (medication === "ロメリジン" && hasDailySlot(logs, slot)) {
                logs = logs.filter(function (log) {
                    return !(log.date === dateKey(new Date()) && log.name === medication && log.slot === slot);
                });
                saveLogs(logs);
                renderAll();
                return;
            }

            if (medication !== "ロメリジン" && !shouldProceedWithRestrictedMedicine(medication, logs)) {
                return;
            }

            const now = new Date();
            logs.push({
                id: now.getTime().toString(36) + Math.random().toString(36).slice(2, 7),
                name: medication,
                slot: slot,
                date: dateKey(now),
                takenAt: now.toISOString()
            });
            saveLogs(logs);
            const currentLog = logs[logs.length - 1];

            if (typeof addTrust === "function") addTrust(1);
            if (typeof completeMission === "function") completeMission("health");

            renderAll();
            updateMedicationKnowledge(getLogs(), currentLog);
        });
    });

    renderAll();
})();
