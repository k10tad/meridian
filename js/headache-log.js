(function () {
    "use strict";
    const KEY = "meridianHeadacheLogs";
    const intensity = document.getElementById("headacheIntensity");
    const value = document.getElementById("headacheIntensityValue");
    const medication = document.getElementById("headacheMedication");
    const memo = document.getElementById("headacheMemo");
    const save = document.getElementById("saveHeadacheLog");
    const list = document.getElementById("headacheLogList");
    const commander = document.getElementById("headacheCommander");
    if (!intensity || !save || !list) return;

    function read() { try { const x = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(x) ? x : []; } catch (_) { return []; } }
    function write(logs) { localStorage.setItem(KEY, JSON.stringify(logs.slice(-180))); }
    function esc(x) { return String(x || "").replace(/[&<>"']/g, function(c){ return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]; }); }
    function format(iso) { return new Date(iso).toLocaleString("ja-JP", {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}); }
    function fillMedicines() {
        let settings=[]; try { settings=window.MeridianMedicationSettings?.read?.() || []; } catch (_) {}
        const names=[...new Set(settings.filter(function(x){return x.active!==false;}).map(function(x){return x.name;}))];
        medication.innerHTML='<option value="">服薬なし／未記録</option>'+names.map(function(n){return '<option value="'+esc(n)+'">'+esc(n)+'を服用</option>';}).join("");
    }
    function render() {
        const logs=read().sort(function(a,b){return new Date(b.recordedAt)-new Date(a.recordedAt);});
        list.innerHTML=logs.length ? logs.slice(0,10).map(function(x){return '<div class="headache-log-item"><div><strong>'+esc(format(x.recordedAt))+' · '+esc(x.intensity)+'/10</strong><small>'+esc(x.medication||"服薬なし／未記録")+(x.memo?' · '+esc(x.memo):'')+'</small></div><button type="button" data-headache-delete="'+esc(x.id)+'">×</button></div>';}).join("") : '<div class="medication-empty">頭痛記録はまだない。</div>';
        list.querySelectorAll("[data-headache-delete]").forEach(function(button){button.addEventListener("click",function(){write(read().filter(function(x){return x.id!==button.dataset.headacheDelete;}));render();});});
    }
    function record() {
        const now=new Date(); const n=Number(intensity.value);
        const logs=read(); logs.push({id:now.getTime().toString(36)+Math.random().toString(36).slice(2,6),recordedAt:now.toISOString(),intensity:n,medication:medication.value,memo:memo.value.trim()}); write(logs);
        const dayKey="meridianHealthLog_"+now.toDateString(); let day={date:now.toDateString()}; try{day=Object.assign(day,JSON.parse(localStorage.getItem(dayKey))||{});}catch(_){} day.headache=true; localStorage.setItem(dayKey,JSON.stringify(day));
        commander.textContent=n>=8?"強い痛みを記録した。予定は止めろ。必要な対応は処方指示に従え。":n>=5?"記録した。光と音を減らせ。服薬したなら時刻も残しておけ。":"記録した。悪化する前に一度休め。";
        memo.value=""; window.MeridianSounds?.play("record"); render(); window.dispatchEvent(new CustomEvent("meridianHeadacheLogged"));
    }
    intensity.addEventListener("input",function(){value.textContent=intensity.value;});
    save.addEventListener("click",record); window.addEventListener("meridianMedicationSettingsChanged",fillMedicines); fillMedicines(); render();
    window.MeridianHeadacheLog={read:read};
})();
