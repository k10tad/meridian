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
    palpitation: false
};

function getHealthStorageKey() {
    return "meridianHealthLog_" + todayKey;
}

function loadHealthLog() {
    const saved = localStorage.getItem(getHealthStorageKey());
    if (saved) {
        try {
            const parsedHealthLog = JSON.parse(saved);
            healthLog = Object.assign(healthLog, parsedHealthLog);
            localStorage.setItem(getHealthStorageKey(), JSON.stringify(healthLog));
        } catch (error) {
            // 壊れた旧データがあっても画面は止めない。
        }
    }
    renderHealthLog();
}

function saveHealthLog() {
    localStorage.setItem(getHealthStorageKey(), JSON.stringify(healthLog));
    renderHealthSummary();
    window.dispatchEvent(new CustomEvent("meridianHealthLogUpdated"));
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
    if (healthLog.palpitation) active.push("動悸");

    healthSummary.textContent = active.length
        ? "記録：" + active.join(" / ")
        : "今日の記録はまだない。";
}

healthButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const key = button.dataset.health;
        healthLog[key] = !healthLog[key];

        if (healthLog[key] && typeof addTrust === "function") addTrust(1, "health:" + key);
        if (typeof completeMission === "function") completeMission("health");

        saveHealthLog();
        renderHealthLog();
        window.MeridianSounds?.play("record");
    });
});

loadHealthLog();

(function () {
    const STORAGE_KEY = "meridianMedicationLogs";
    const HISTORY_DAYS = 90;
    let medicationButtons = document.querySelectorAll(".med-btn");
    const todayMedicationList = document.getElementById("todayMedicationList");
    const medicationHistoryList = document.getElementById("medicationHistoryList");
    const medicationHistoryModal = document.getElementById("medicationHistoryModal");
    const openMedicationHistory = document.getElementById("openMedicationHistory");
    const closeMedicationHistory = document.getElementById("closeMedicationHistory");
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

    function hasDailySlot(logs, slot, name) {
        return todayLogs(logs).some(function (log) {
            return log.name === (name || "ロメリジン") && log.slot === slot;
        });
    }

    function updateDailyButtons(logs) {
        medicationButtons.forEach(function (button) {
            if (button.classList.contains("prn")) return;
            button.classList.toggle("selected", hasDailySlot(logs, button.dataset.slot, button.dataset.medication));
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

    function shouldProceedAfterPreflight(medicine, logs) {
        const engine = window.MeridianMedicationKnowledge;
        const alert = engine && typeof engine.preflight === "function" ? engine.preflight(medicine, logs, new Date()) : null;
        if (!alert) return "clear";
        renderMedicationAlert(alert);
        if (commanderMessage) commanderMessage.textContent = alert.title + "。" + alert.message;
        if (alert.level === "high") window.MeridianSounds?.play("beep");
        return window.confirm(alert.title + "\n\n" + alert.message + "\n\n確認したうえで、服用記録だけを追加しますか？") ? "confirmed" : "cancel";
    }

    function renderCommanderMessage(logs) {
        if (!commanderMessage) return;
        const settings = window.MeridianMedicationSettings && window.MeridianMedicationSettings.read
            ? window.MeridianMedicationSettings.read()
            : [];
        const daily = settings.filter(function (item) { return item.type === "daily" && item.active !== false; });
        const missing = daily.filter(function (item) { return !hasDailySlot(logs, item.slot, item.name); });

        if (daily.length && missing.length === 0) {
            commanderMessage.textContent = "本日の定時薬は完了。よく管理できている。";
        } else if (daily.length && missing.length < daily.length) {
            commanderMessage.textContent = "定時薬は一部確認済み。未記録は " + missing.map(function (item) { return item.name + "（" + item.slot + "）"; }).join("、") + "。";
        } else if (daily.length) {
            commanderMessage.textContent = "本日の定時薬はまだ未記録だ。服用した時刻を、その場で残しておけ。";
        } else {
            commanderMessage.textContent = "定時薬は未設定だ。必要ならArchiveから登録しろ。";
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
        if (alert.level === "high") window.MeridianSounds?.play("beep");
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
        medicationButtons = document.querySelectorAll(".med-btn");
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

    function handleMedicationClick(button) {
            const medication = button.dataset.medication;
            const slot = button.dataset.slot;
            let logs = getLogs();

            const isDaily = !button.classList.contains("prn");
            if (isDaily && hasDailySlot(logs, slot, medication)) {
                logs = logs.filter(function (log) {
                    return !(log.date === dateKey(new Date()) && log.name === medication && log.slot === slot);
                });
                saveLogs(logs);
                renderAll();
                return;
            }

            const preflightState = shouldProceedAfterPreflight(medication, logs);
            if (preflightState === "cancel") return;

            if (!isDaily && preflightState === "clear" && !shouldProceedWithRestrictedMedicine(medication, logs)) {
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
            window.MeridianSounds?.play("record");

            if (typeof addTrust === "function") addTrust(1, "medication:" + currentLog.id);
            if (typeof completeMission === "function") completeMission("health");

            renderAll();
            updateMedicationKnowledge(getLogs(), currentLog);
    }

    [document.getElementById("dailyMedicationGrid"), document.getElementById("prnMedicationGrid")].forEach(function (grid) {
        if (!grid) return;
        grid.addEventListener("click", function (event) {
            const button = event.target.closest(".med-btn");
            if (button && grid.contains(button)) handleMedicationClick(button);
        });
    });
    window.addEventListener("meridianMedicationSettingsChanged", function () { renderAll(); });

    function setMedicationHistoryOpen(open) {
        if (!medicationHistoryModal) return;
        medicationHistoryModal.hidden = !open;
        document.body.classList.toggle("modal-open", open);
    }
    if (openMedicationHistory) openMedicationHistory.addEventListener("click", function () { setMedicationHistoryOpen(true); });
    if (closeMedicationHistory) closeMedicationHistory.addEventListener("click", function () { setMedicationHistoryOpen(false); });
    document.querySelectorAll('[data-close-record-modal="medication"]').forEach(function (button) {
        button.addEventListener("click", function () { setMedicationHistoryOpen(false); });
    });

    renderAll();
})();
