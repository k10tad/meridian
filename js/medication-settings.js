(function () {
    "use strict";
    const KEY = "meridianMedicationSettings";
    const defaults = [
        { id: "lome-morning", name: "ロメリジン", slot: "午前", type: "daily", active: true },
        { id: "lome-night", name: "ロメリジン", slot: "夜", type: "daily", active: true },
        { id: "ibuprofen", name: "イブプロフェン", slot: "頓服", type: "prn", active: true },
        { id: "rayvow", name: "レイボー", slot: "頓服", type: "prn", active: true },
        { id: "travelmin", name: "トラベルミン", slot: "頓服", type: "prn", active: true },
        { id: "elpain", name: "エルペイン", slot: "頓服", type: "prn", active: true }
    ];
    function read() { try { const raw = localStorage.getItem(KEY); if (raw === null) return defaults.slice(); const value = JSON.parse(raw); return Array.isArray(value) ? value : defaults.slice(); } catch (_) { return defaults.slice(); } }
    function write(items) { localStorage.setItem(KEY, JSON.stringify(items)); }
    function notify() { window.dispatchEvent(new Event("meridianMedicationSettingsChanged")); }
    function escape(value) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
    function renderButtons() {
        const items = read().filter(function (item) { return item.active !== false; });
        const daily = document.getElementById("dailyMedicationGrid");
        const prn = document.getElementById("prnMedicationGrid");
        if (daily) daily.innerHTML = items.filter(function (item) { return item.type === "daily"; }).map(buttonHtml).join("") || "<div class='medication-empty'>定時薬は未設定</div>";
        if (prn) prn.innerHTML = items.filter(function (item) { return item.type === "prn"; }).map(buttonHtml).join("") || "<div class='medication-empty'>頓服は未設定</div>";
    }
    function buttonHtml(item) { return "<button class='med-btn " + (item.type === "prn" ? "prn" : "") + "' data-medication='" + escape(item.name) + "' data-slot='" + escape(item.slot) + "'>" + escape(item.name) + (item.type === "daily" ? "（" + escape(item.slot) + "）" : "") + "</button>"; }
    function renderEditor() {
        const list = document.getElementById("medicationSettingsList");
        if (!list) return;
        list.innerHTML = read().map(function (item) {
            return "<div class='medication-setting-row'><div><strong>" + escape(item.name) + "</strong><small>" + (item.type === "daily" ? "定時 · " + escape(item.slot) : "頓服") + "</small></div><button type='button' data-med-remove='" + escape(item.id) + "'>×</button></div>";
        }).join("");
        list.querySelectorAll("[data-med-remove]").forEach(function (button) { button.addEventListener("click", function () { write(read().filter(function (item) { return item.id !== button.dataset.medRemove; })); renderButtons(); renderEditor(); notify(); }); });
    }
    function add() {
        const name = document.getElementById("medicationSettingName");
        const type = document.getElementById("medicationSettingType");
        const slot = document.getElementById("medicationSettingSlot");
        if (!name || !name.value.trim()) return;
        const items = read();
        items.push({ id: Date.now().toString(36), name: name.value.trim(), type: type.value, slot: type.value === "daily" ? (slot.value.trim() || "定時") : "頓服", active: true });
        write(items); name.value = ""; renderButtons(); renderEditor(); notify();
    }
    renderButtons(); renderEditor();
    const addButton = document.getElementById("addMedicationSetting");
    if (addButton) addButton.addEventListener("click", add);
    window.MeridianMedicationSettings = { read: read, renderButtons: renderButtons };
})();
