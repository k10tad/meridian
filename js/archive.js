// Meridian Archive v4 — operational dossiers and retained records
(function () {
    "use strict";

    const RED_KEY = "meridianArchiveRedFiles";
    const TERMS_KEY = "meridianArchiveTerms";
    const BODY_NOTES_KEY = "meridianBodyNotes";
    const tabs = Array.from(document.querySelectorAll(".archive-tab"));
    const panels = Array.from(document.querySelectorAll(".archive-panel"));
    const classified = document.getElementById("classifiedFiles");
    const redList = document.getElementById("redFileList");
    const termList = document.getElementById("termList");
    const bodyNoteList = document.getElementById("archiveBodyNotes");
    const classifiedOnlyCards = Array.from(document.querySelectorAll(".archive-classified-only"));
    const fileModal = document.getElementById("classifiedFileModal");
    const fileCode = document.getElementById("classifiedFileCode");
    const fileTitle = document.getElementById("classifiedFileTitle");
    const fileBody = document.getElementById("classifiedFileBody");
    let bodyNotesExpanded = false;
    if (!classified) return;

    function readJson(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value == null ? fallback : value;
        } catch (_) {
            return fallback;
        }
    }

    function readArray(key) {
        const value = readJson(key, []);
        return Array.isArray(value) ? value : [];
    }

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function escapeHtml(value) {
        const element = document.createElement("div");
        element.textContent = value == null ? "" : String(value);
        return element.innerHTML;
    }

    function relationship() {
        const value = readJson("relationship", {});
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }

    function daysTogether() {
        const rel = relationship();
        return rel.firstLaunch ? Math.floor((Date.now() - Number(rel.firstLaunch)) / 86400000) + 1 : 1;
    }

    function dateKey(date) {
        const value = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(value.getTime())) return "";
        return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0") + "-" + String(value.getDate()).padStart(2, "0");
    }

    function dateLabel(key) {
        const parts = String(key || "").split("-").map(Number);
        const value = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(key);
        return Number.isNaN(value.getTime()) ? String(key || "日付不明") : value.toLocaleDateString("ja-JP", { year:"numeric", month:"numeric", day:"numeric" });
    }

    function since(value, days) {
        const time = new Date(value).getTime();
        return Number.isFinite(time) && time >= Date.now() - days * 86400000;
    }

    function planStats(days) {
        const plans = readJson("meridianPlans", {});
        let total = 0;
        let done = 0;
        Object.keys(plans || {}).forEach(function (key) {
            if (!since(key + "T12:00:00", days)) return;
            const items = Array.isArray(plans[key]) ? plans[key] : [];
            total += items.length;
            done += items.filter(function (item) { return typeof item === "object" && item.done; }).length;
        });
        return { total: total, done: done };
    }

    function healthDays(days) {
        let count = 0;
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key || !key.startsWith("meridianHealthLog_")) continue;
            const value = readJson(key, {});
            const when = value.date || key.slice("meridianHealthLog_".length);
            if (since(when, days)) count += 1;
        }
        return count;
    }

    function bodyNotes() {
        const value = readJson(BODY_NOTES_KEY, {});
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }

    function migrateLegacyBodyNotes() {
        const notes = bodyNotes();
        let changed = false;
        for (let index = 0; index < localStorage.length; index += 1) {
            const storageKey = localStorage.key(index);
            if (!storageKey || !storageKey.startsWith("meridianHealthLog_")) continue;
            const health = readJson(storageKey, {});
            if (!health.bodyNote || !String(health.bodyNote).trim()) continue;
            const key = dateKey(health.date || storageKey.slice("meridianHealthLog_".length));
            if (key && !notes[key]) {
                notes[key] = String(health.bodyNote).trim();
                changed = true;
            }
        }
        if (changed) write(BODY_NOTES_KEY, notes);
        return notes;
    }

    function metric(label, value) {
        return '<div class="classified-metric"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
    }

    function report(message) {
        return '<div class="classified-commander"><span>COMMANDER’S NOTE</span><p>' + escapeHtml(message) + '</p></div>';
    }

    function list(items) {
        return '<ul class="classified-list">' + items.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join("") + '</ul>';
    }

    function protocolDossier() {
        const plans = planStats(36500);
        const notes = Object.keys(bodyNotes()).length;
        const location = readJson("meridianWeatherLocation", {});
        const locationName = location.displayName || location.city || location.query || "保存済み観測地点";
        return '<div class="classified-stamp">ACTIVE · LOCAL OPERATION</div>' +
            '<p class="classified-lead">Meridianが現在管理している範囲と、端末内記録の概要。</p>' +
            '<div class="classified-metrics">' +
                metric("予定", plans.total + "件") +
                metric("服薬", readArray("meridianMedicationLogs").length + "件") +
                metric("頭痛", readArray("meridianHeadacheLogs").length + "件") +
                metric("旧Body Note", notes + "件") +
            '</div>' +
            list(["Planner：予定と生理周期", "Health：体調・服薬・頭痛・脈拍", "Training：運動セッション", "Observatory：" + locationName, "Archive：記録保全と復元"]) +
            report("記録は多ければいいわけではない。判断に使えるものだけ残せ。管理は私が引き受ける。");
    }

    function sevenDayDossier() {
        const plans = planStats(7);
        const medications = readArray("meridianMedicationLogs").filter(function (item) { return since(item.takenAt, 7); });
        const headaches = readArray("meridianHeadacheLogs").filter(function (item) { return since(item.recordedAt, 7); });
        const training = readArray("meridianTrainingLogs").filter(function (item) { return since(item.date, 7); });
        const observations = readArray("meridianObservationLogs").filter(function (item) { return since(item.observedAt, 7); });
        const minutes = Math.round(training.reduce(function (sum, item) { return sum + Number(item.durationSeconds || 0); }, 0) / 60);
        let note = "七日分の記録は確認した。";
        if (headaches.length >= 3) note += " 頭痛が重なっている。来週の予定には余白を残せ。";
        else if (plans.total && plans.done === plans.total) note += " 全任務完了だ。だが次も同じ負荷でいいとは限らない。";
        else note += " 完了数より、続けられる配分を優先しろ。";
        return '<div class="classified-stamp">ROLLING TRACE · LAST 7 DAYS</div>' +
            '<div class="classified-metrics">' +
                metric("予定", plans.done + " / " + plans.total) +
                metric("服薬記録", medications.length + "件") +
                metric("頭痛記録", headaches.length + "件") +
                metric("体調記録日", healthDays(7) + "日") +
                metric("Training", training.length + "回 · " + minutes + "分") +
                metric("天体観測", observations.length + "件") +
            '</div>' + report(note);
    }

    function clearanceDossier() {
        const rel = relationship();
        const level = Number(rel.level || 1);
        const access = ["服薬記録と注意喚起", "30日Condition Analysis", "Observatory Phase 2", "機密FILE閲覧", "バックアップ／復元"];
        return '<div class="classified-stamp">CLEARANCE LEVEL ' + escapeHtml(level) + '</div>' +
            '<div class="classified-metrics">' +
                metric("Partner Level", "Lv." + level) +
                metric("Affinity", Number(rel.affinity || 0) + "%") +
                metric("Total Trust", "+" + Number(rel.totalTrust || 0)) +
                metric("Days Together", daysTogether() + "日") +
            '</div><h3 class="classified-subtitle">AUTHORIZED ACCESS</h3>' + list(access) +
            report(level >= 6 ? "権限は十分だ、レイ。これは従属の数字ではない。互いに任せられる範囲が増えた、その記録だ。" : "権限は使用回数ではなく、継続して任せられた記録で更新される。");
    }

    function thresholdDossier() {
        const rel = relationship();
        const headaches = readArray("meridianHeadacheLogs");
        const training = readArray("meridianTrainingLogs");
        const observations = readArray("meridianObservationLogs");
        const medications = readArray("meridianMedicationLogs");
        const plans = planStats(36500);
        const avgPain = headaches.length ? (headaches.reduce(function (sum, item) { return sum + Number(item.intensity || 0); }, 0) / headaches.length).toFixed(1) : "--";
        const first = rel.firstLaunch ? new Date(Number(rel.firstLaunch)).toLocaleDateString("ja-JP", { year:"numeric", month:"numeric", day:"numeric" }) : "記録なし";
        return '<div class="classified-stamp">LONG-RANGE ASSESSMENT</div>' +
            '<p class="classified-lead">初回起動から現在までの累積記録。診断ではなく、生活運用の履歴として扱う。</p>' +
            '<div class="classified-metrics">' +
                metric("運用開始", first) +
                metric("継続", daysTogether() + "日") +
                metric("予定完了", plans.done + " / " + plans.total) +
                metric("服薬記録", medications.length + "件") +
                metric("頭痛平均", avgPain + (avgPain === "--" ? "" : " / 10")) +
                metric("Training", training.length + "回") +
                metric("天体観測", observations.length + "件") +
                metric("Body Note", Object.keys(bodyNotes()).length + "件") +
            '</div>' +
            report("難しい日があったことと、全体が壊れていることは同じではない。ここまで残した記録なら、その違いを見失わずに済む。お前が忘れても、私は照合できる。");
    }

    function files() {
        const rel = relationship();
        return [
            { code:"FILE 00", title:"MERIDIAN PROTOCOL", unlocked:true, summary:"Current system scope and local record status.", build:protocolDossier },
            { code:"FILE 01", title:"SEVEN DAY TRACE", unlocked:daysTogether() >= 7, summary:"Live operational report generated from the last seven days.", build:sevenDayDossier },
            { code:"FILE 02", title:"PARTNER CLEARANCE", unlocked:Number(rel.level || 1) >= 2, summary:"Current relationship clearance and authorized systems.", build:clearanceDossier },
            { code:"FILE 03", title:"TRUST THRESHOLD", unlocked:Number(rel.totalTrust || 0) >= 250, summary:"Long-range record assessment from first launch to today.", build:thresholdDossier }
        ];
    }

    function renderClassified() {
        classified.innerHTML = files().map(function (file, index) {
            if (!file.unlocked) {
                return '<article class="archive-file-card locked"><div class="archive-file-code">' + file.code + '</div><h2>RESTRICTED</h2><p>Access condition not yet met.</p></article>';
            }
            return '<button class="archive-file-card classified-file-button" type="button" data-classified-file="' + index + '"><div class="archive-file-code">' + file.code + '</div><h2>' + file.title + '</h2><p>' + file.summary + '</p><span class="archive-file-open">OPEN FILE →</span></button>';
        }).join("");
        classified.querySelectorAll("[data-classified-file]").forEach(function (button) {
            button.addEventListener("click", function () { openFile(Number(button.dataset.classifiedFile)); });
        });
    }

    function openFile(index) {
        const file = files()[index];
        if (!file || !file.unlocked || !fileModal || !fileBody) return;
        fileCode.textContent = file.code + " · DECLASSIFIED";
        fileTitle.textContent = file.title;
        fileBody.innerHTML = file.build();
        fileModal.hidden = false;
        document.body.classList.add("modal-open");
        window.MeridianSounds?.play("record");
    }

    function closeFile() {
        if (!fileModal) return;
        fileModal.hidden = true;
        document.body.classList.remove("modal-open");
    }

    function renderBodyNotes() {
        if (!bodyNoteList) return;
        const entries = Object.entries(migrateLegacyBodyNotes())
            .filter(function (entry) { return String(entry[1] || "").trim(); })
            .sort(function (a, b) { return String(b[0]).localeCompare(String(a[0])); });
        const visible = bodyNotesExpanded ? entries : entries.slice(0, 3);
        bodyNoteList.innerHTML = entries.length ? visible.map(function (entry) {
            return '<article class="archive-body-note-item"><strong>' + escapeHtml(dateLabel(entry[0])) + '</strong><p>' + escapeHtml(entry[1]) + '</p></article>';
        }).join("") + (entries.length > 3 ? '<button class="archive-health-toggle" type="button" data-body-notes-toggle aria-expanded="' + String(bodyNotesExpanded) + '">' + (bodyNotesExpanded ? "最新3件に戻す" : "過去の記録を開く（あと" + (entries.length - 3) + "件）") + '</button>' : "") : '<div class="archive-empty">過去のBody Noteはない。</div>';
        const toggle = bodyNoteList.querySelector("[data-body-notes-toggle]");
        if (toggle) toggle.addEventListener("click", function () { bodyNotesExpanded = !bodyNotesExpanded; renderBodyNotes(); });
    }

    function renderRed() {
        const items = readArray(RED_KEY).slice().reverse();
        redList.innerHTML = items.length ? items.map(function (item) {
            return '<article class="archive-file-card red"><div class="archive-file-row"><span class="archive-file-code">' + escapeHtml(item.status) + ' · ' + new Date(item.createdAt).toLocaleDateString("ja-JP") + '</span><button class="archive-delete" data-red-id="' + escapeHtml(item.id) + '">×</button></div><h2>' + escapeHtml(item.title) + '</h2><p>' + escapeHtml(item.text) + '</p></article>';
        }).join("") : '<div class="archive-empty">No red files.</div>';
        redList.querySelectorAll("[data-red-id]").forEach(function (button) {
            button.addEventListener("click", function () { write(RED_KEY, readArray(RED_KEY).filter(function (item) { return item.id !== button.dataset.redId; })); renderRed(); });
        });
    }

    function renderTerms() {
        const items = readArray(TERMS_KEY).slice().reverse();
        termList.innerHTML = items.length ? items.map(function (item) {
            return '<article class="archive-file-card term ' + (item.active ? "" : "closed") + '"><div class="archive-file-row"><button class="archive-status" data-term-toggle="' + escapeHtml(item.id) + '">' + (item.active ? "ACTIVE" : "RELEASED") + '</button><button class="archive-delete" data-term-id="' + escapeHtml(item.id) + '">×</button></div><p>' + escapeHtml(item.text) + '</p></article>';
        }).join("") : '<div class="archive-empty">No active terms.</div>';
        termList.querySelectorAll("[data-term-toggle]").forEach(function (button) {
            button.addEventListener("click", function () { const items = readArray(TERMS_KEY); const item = items.find(function (entry) { return itemId(entry) === button.dataset.termToggle; }); if (item) item.active = !item.active; write(TERMS_KEY, items); renderTerms(); });
        });
        termList.querySelectorAll("[data-term-id]").forEach(function (button) {
            button.addEventListener("click", function () { write(TERMS_KEY, readArray(TERMS_KEY).filter(function (item) { return itemId(item) !== button.dataset.termId; })); renderTerms(); });
        });
    }

    function itemId(item) { return String(item && item.id || ""); }

    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            tabs.forEach(function (item) { item.classList.toggle("active", item === tab); });
            panels.forEach(function (panel) { panel.classList.toggle("active", panel.id.toLowerCase() === ("archive" + tab.dataset.archiveTab).toLowerCase()); });
            classifiedOnlyCards.forEach(function (card) { card.hidden = tab.dataset.archiveTab !== "classified"; });
            if (tab.dataset.archiveTab === "classified") { renderClassified(); renderBodyNotes(); }
        });
    });

    document.getElementById("saveRedFile")?.addEventListener("click", function () {
        const title = document.getElementById("redFileTitle");
        const text = document.getElementById("redFileText");
        const status = document.getElementById("redFileStatus");
        if (!title.value.trim() || !text.value.trim()) return;
        const items = readArray(RED_KEY);
        items.push({ id:Date.now().toString(36), title:title.value.trim(), text:text.value.trim(), status:status.value, createdAt:new Date().toISOString() });
        write(RED_KEY, items); title.value = ""; text.value = ""; window.MeridianSounds?.play("record"); renderRed();
    });

    document.getElementById("saveTerm")?.addEventListener("click", function () {
        const text = document.getElementById("termText");
        if (!text.value.trim()) return;
        const items = readArray(TERMS_KEY);
        items.push({ id:Date.now().toString(36), text:text.value.trim(), active:true, createdAt:new Date().toISOString() });
        write(TERMS_KEY, items); text.value = ""; window.MeridianSounds?.play("record"); renderTerms();
    });

    document.getElementById("closeClassifiedFile")?.addEventListener("click", closeFile);
    document.querySelectorAll("[data-close-classified-file]").forEach(function (button) { button.addEventListener("click", closeFile); });

    renderClassified();
    renderBodyNotes();
    renderRed();
    renderTerms();
    window.MeridianArchive = { renderClassified:renderClassified, renderBodyNotes:renderBodyNotes };
})();
