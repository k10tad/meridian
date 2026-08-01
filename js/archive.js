// Meridian Archive v3 — quiet, local-only operational records
(function () {
    "use strict";
    const RED_KEY = "meridianArchiveRedFiles";
    const TERMS_KEY = "meridianArchiveTerms";
    const tabs = Array.from(document.querySelectorAll(".archive-tab"));
    const panels = Array.from(document.querySelectorAll(".archive-panel"));
    const classified = document.getElementById("classifiedFiles");
    const redList = document.getElementById("redFileList");
    const termList = document.getElementById("termList");
    const backupCard = document.getElementById("archiveBackupCard");
    if (!classified) return;

    function read(key) { try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; } catch (_) { return []; } }
    function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
    function escapeHtml(value) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
    function relationship() { try { return JSON.parse(localStorage.getItem("relationship")) || {}; } catch (_) { return {}; } }
    function daysTogether() { const rel = relationship(); return rel.firstLaunch ? Math.floor((Date.now() - rel.firstLaunch) / 86400000) + 1 : 1; }

    function renderClassified() {
        const rel = relationship();
        const files = [
            { code: "FILE 00", title: "MERIDIAN PROTOCOL", unlocked: true, text: "Local records remain on this device. Keep only what is useful." },
            { code: "FILE 01", title: "SEVEN DAY TRACE", unlocked: daysTogether() >= 7, text: "Seven days of continuity confirmed. Routine is now evidence." },
            { code: "FILE 02", title: "PARTNER CLEARANCE", unlocked: Number(rel.level || 1) >= 2, text: "Clearance advanced through consistent use, not performance." },
            { code: "FILE 03", title: "TRUST THRESHOLD", unlocked: Number(rel.totalTrust || 0) >= 250, text: "Enough data exists to distinguish a difficult day from a broken system." }
        ];
        classified.innerHTML = files.map(function (file) {
            return "<article class='archive-file-card " + (file.unlocked ? "" : "locked") + "'><div class='archive-file-code'>" + file.code + "</div><h2>" + (file.unlocked ? file.title : "RESTRICTED") + "</h2><p>" + (file.unlocked ? file.text : "Access condition not yet met.") + "</p></article>";
        }).join("");
    }
    function renderRed() {
        const items = read(RED_KEY).slice().reverse();
        redList.innerHTML = items.length ? items.map(function (item) {
            return "<article class='archive-file-card red'><div class='archive-file-row'><span class='archive-file-code'>" + escapeHtml(item.status) + " · " + new Date(item.createdAt).toLocaleDateString("ja-JP") + "</span><button class='archive-delete' data-red-id='" + item.id + "'>×</button></div><h2>" + escapeHtml(item.title) + "</h2><p>" + escapeHtml(item.text) + "</p></article>";
        }).join("") : "<div class='archive-empty'>No red files.</div>";
        redList.querySelectorAll("[data-red-id]").forEach(function (button) { button.addEventListener("click", function () { write(RED_KEY, read(RED_KEY).filter(function (item) { return item.id !== button.dataset.redId; })); renderRed(); }); });
    }
    function renderTerms() {
        const items = read(TERMS_KEY).slice().reverse();
        termList.innerHTML = items.length ? items.map(function (item) {
            return "<article class='archive-file-card term " + (item.active ? "" : "closed") + "'><div class='archive-file-row'><button class='archive-status' data-term-toggle='" + item.id + "'>" + (item.active ? "ACTIVE" : "RELEASED") + "</button><button class='archive-delete' data-term-id='" + item.id + "'>×</button></div><p>" + escapeHtml(item.text) + "</p></article>";
        }).join("") : "<div class='archive-empty'>No active terms.</div>";
        termList.querySelectorAll("[data-term-toggle]").forEach(function (button) { button.addEventListener("click", function () { const items = read(TERMS_KEY); const item = items.find(function (entry) { return entry.id === button.dataset.termToggle; }); if (item) item.active = !item.active; write(TERMS_KEY, items); renderTerms(); }); });
        termList.querySelectorAll("[data-term-id]").forEach(function (button) { button.addEventListener("click", function () { write(TERMS_KEY, read(TERMS_KEY).filter(function (item) { return item.id !== button.dataset.termId; })); renderTerms(); }); });
    }

    tabs.forEach(function (tab) { tab.addEventListener("click", function () { tabs.forEach(function (item) { item.classList.toggle("active", item === tab); }); panels.forEach(function (panel) { panel.classList.toggle("active", panel.id.toLowerCase() === ("archive" + tab.dataset.archiveTab).toLowerCase()); }); if (backupCard) backupCard.hidden = tab.dataset.archiveTab !== "classified"; }); });
    document.getElementById("saveRedFile").addEventListener("click", function () { const title = document.getElementById("redFileTitle"), text = document.getElementById("redFileText"), status = document.getElementById("redFileStatus"); if (!title.value.trim() || !text.value.trim()) return; const items = read(RED_KEY); items.push({ id: Date.now().toString(36), title: title.value.trim(), text: text.value.trim(), status: status.value, createdAt: new Date().toISOString() }); write(RED_KEY, items); title.value = ""; text.value = ""; window.MeridianSounds?.play("record"); renderRed(); });
    document.getElementById("saveTerm").addEventListener("click", function () { const text = document.getElementById("termText"); if (!text.value.trim()) return; const items = read(TERMS_KEY); items.push({ id: Date.now().toString(36), text: text.value.trim(), active: true, createdAt: new Date().toISOString() }); write(TERMS_KEY, items); text.value = ""; window.MeridianSounds?.play("record"); renderTerms(); });
    renderClassified(); renderRed(); renderTerms();
})();
