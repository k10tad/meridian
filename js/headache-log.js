(function () {
    "use strict";

    const KEY = "meridianHeadacheLogs";
    const intensity = document.getElementById("headacheIntensity");
    const value = document.getElementById("headacheIntensityValue");
    const pulse = document.getElementById("headachePulse");
    const medication = document.getElementById("headacheMedication");
    const memo = document.getElementById("headacheMemo");
    const save = document.getElementById("saveHeadacheLog");
    const archiveList = document.getElementById("archiveHealthRecords");
    const dailyList = document.getElementById("archiveDailyConditions");
    const commander = document.getElementById("headacheCommander");
    if (!intensity || !save || !archiveList) return;

    function read() {
        try {
            const records = JSON.parse(localStorage.getItem(KEY));
            return Array.isArray(records) ? records : [];
        } catch (_) {
            return [];
        }
    }

    function write(logs) {
        localStorage.setItem(KEY, JSON.stringify(logs.slice(-180)));
    }

    function esc(input) {
        return String(input == null ? "" : input).replace(/[&<>"']/g, function (character) {
            return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character];
        });
    }

    function format(iso) {
        return new Date(iso).toLocaleString("ja-JP", {
            year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
        });
    }

    function fillMedicines() {
        let settings = [];
        try { settings = window.MeridianMedicationSettings?.read?.() || []; } catch (_) {}
        const names = [...new Set(settings.filter(function (item) {
            return item.type === "prn" && item.active !== false;
        }).map(function (item) { return item.name; }))];
        medication.innerHTML = '<option value="">服薬なし／未記録</option>' + names.map(function (name) {
            return '<option value="' + esc(name) + '">' + esc(name) + 'を服用</option>';
        }).join("");
    }

    function readDailyConditions() {
        const entries = [];
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key || !key.startsWith("meridianHealthLog_")) continue;
            try {
                const item = JSON.parse(localStorage.getItem(key));
                if (!item || typeof item !== "object") continue;
                const flags = [];
                if (item.headache) flags.push("頭痛");
                if (item.dizzy) flags.push("めまい");
                if (item.period) flags.push("生理");
                if (item.pms) flags.push("PMS");
                if (item.medicine) flags.push("服薬");
                if (item.palpitation) flags.push("動悸");
                if (!flags.length) continue;
                const parsed = new Date(item.date || key.slice("meridianHealthLog_".length));
                entries.push({ date: Number.isNaN(parsed.getTime()) ? item.date : parsed, flags: flags });
            } catch (_) {}
        }
        return entries.sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 90);
    }

    function renderArchive() {
        const logs = read().sort(function (a, b) { return new Date(b.recordedAt) - new Date(a.recordedAt); });
        archiveList.innerHTML = logs.length ? logs.map(function (item) {
            const pulseText = Number(item.pulse) ? '<span>脈拍 ' + esc(item.pulse) + '/min</span>' : "";
            const medicineText = item.medication ? '<span>' + esc(item.medication) + '</span>' : '<span>頓服なし／未記録</span>';
            const memoText = item.memo ? '<p>' + esc(item.memo) + '</p>' : "";
            return '<article class="archive-health-item"><div class="archive-health-head"><strong>' + esc(format(item.recordedAt)) + '</strong><span class="archive-health-intensity">痛み ' + esc(item.intensity) + '/10</span></div><div class="archive-health-meta">' + pulseText + medicineText + '</div>' + memoText + '<button class="archive-health-delete" type="button" data-headache-delete="' + esc(item.id) + '">削除</button></article>';
        }).join("") : '<div class="archive-empty">頭痛・脈拍記録はまだない。</div>';

        archiveList.querySelectorAll("[data-headache-delete]").forEach(function (button) {
            button.addEventListener("click", function () {
                write(read().filter(function (item) { return item.id !== button.dataset.headacheDelete; }));
                renderArchive();
            });
        });

        const daily = readDailyConditions();
        if (dailyList) {
            dailyList.innerHTML = daily.length ? daily.map(function (item) {
                const dateText = item.date instanceof Date && !Number.isNaN(item.date.getTime())
                    ? item.date.toLocaleDateString("ja-JP", { year:"numeric", month:"numeric", day:"numeric" })
                    : String(item.date || "日付不明");
                return '<article class="archive-condition-item"><strong>' + esc(dateText) + '</strong><span>' + esc(item.flags.join(" / ")) + '</span></article>';
            }).join("") : '<div class="archive-empty">体調記録はまだない。</div>';
        }
    }

    function record() {
        const now = new Date();
        const pain = Number(intensity.value);
        const pulseValue = pulse && pulse.value !== "" ? Number(pulse.value) : null;
        if (pulseValue !== null && (!Number.isFinite(pulseValue) || pulseValue < 30 || pulseValue > 250)) {
            commander.textContent = "脈拍は30〜250の範囲で記録しろ。測っていないなら空欄で構わない。";
            pulse.focus();
            return;
        }

        const logs = read();
        logs.push({
            id: now.getTime().toString(36) + Math.random().toString(36).slice(2, 6),
            recordedAt: now.toISOString(), intensity: pain, pulse: pulseValue,
            medication: medication.value, memo: memo.value.trim()
        });
        write(logs);

        const dayKey = "meridianHealthLog_" + now.toDateString();
        let day = { date: now.toDateString() };
        try { day = Object.assign(day, JSON.parse(localStorage.getItem(dayKey)) || {}); } catch (_) {}
        day.headache = true;
        localStorage.setItem(dayKey, JSON.stringify(day));

        commander.textContent = pain >= 8
            ? "強い痛みを記録した。予定は止めろ。必要な対応は処方指示に従え。"
            : pain >= 5
                ? "記録した。光と音を減らせ。服薬したなら時刻も残しておけ。"
                : "記録した。悪化する前に一度休め。";
        if (pulse) pulse.value = "";
        memo.value = "";
        window.MeridianSounds?.play("record");
        renderArchive();
        window.dispatchEvent(new CustomEvent("meridianHeadacheLogged"));
    }

    intensity.addEventListener("input", function () { value.textContent = intensity.value; });
    save.addEventListener("click", record);
    window.addEventListener("meridianMedicationSettingsChanged", fillMedicines);
    window.addEventListener("meridianHealthLogUpdated", renderArchive);
    fillMedicines();
    renderArchive();
    window.MeridianHeadacheLog = { read: read };
})();
