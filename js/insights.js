(function () {
    "use strict";
    function ymd(date) { return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0"); }
    function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; } }
    function healthFor(date) { return read("meridianHealthLog_" + date.toDateString(), {}); }
    function summary() {
        const weather = read("meridianWeatherHistory", {}), training = read("meridianTrainingLogs", []), meds = read("meridianMedicationLogs", []), headacheLogs = read("meridianHeadacheLogs", []);
        let recorded = 0, headache = 0, dizzy = 0, period = 0, pms = 0, low = 0, lowHeadache = 0;
        for (let i = 29; i >= 0; i -= 1) {
            const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - i);
            const health = healthFor(date), dayWeather = weather[ymd(date)];
            if (Object.keys(health).length) recorded += 1;
            if (health.headache) headache += 1; if (health.dizzy) dizzy += 1; if (health.period) period += 1; if (health.pms) pms += 1;
            if (dayWeather && Number(dayWeather.pressure) <= 1008) { low += 1; if (health.headache) lowHeadache += 1; }
        }
        const cutoff = Date.now() - 30 * 86400000;
        const correlation = low < 3 ? "気象履歴は蓄積中だ。3日以上の低気圧記録から傾向を判定する。" : lowHeadache >= Math.ceil(low / 2) ? "低気圧日に頭痛が重なりやすい。気圧低下日は予定を一段軽くしろ。" : "低気圧と頭痛の明確な重なりは、現時点では強くない。";
        const recentHeadaches=headacheLogs.filter(function(x){return new Date(x.recordedAt).getTime()>=cutoff;}), averageIntensity=recentHeadaches.length?(recentHeadaches.reduce(function(sum,x){return sum+Number(x.intensity||0);},0)/recentHeadaches.length).toFixed(1):"--";
        return { recorded: recorded, headache: Math.max(headache, new Set(recentHeadaches.map(function(x){return ymd(new Date(x.recordedAt));})).size), averageIntensity:averageIntensity, dizzy: dizzy, period: period, pms: pms, training: training.filter(function (x) { return new Date(x.date).getTime() >= cutoff; }).length, medications: meds.filter(function (x) { return new Date(x.takenAt).getTime() >= cutoff; }).length, correlation: correlation };
    }
    function renderAnalysis() {
        const target = document.getElementById("thirtyDayAnalysis"); if (!target) return; const s = summary();
        target.innerHTML = "<div class='analysis-metrics'><div><strong>" + s.recorded + "</strong><span>記録日</span></div><div><strong>" + s.headache + "</strong><span>頭痛日</span></div><div><strong>" + s.averageIntensity + "</strong><span>平均強度</span></div><div><strong>" + s.training + "</strong><span>Training</span></div></div><p>" + s.correlation + "</p><small>服薬 " + s.medications + "件 · 生理 " + s.period + "日 · PMS " + s.pms + "日</small>";
    }
    function renderReport() {
        const title = document.getElementById("operationsReportTitle"), body = document.getElementById("operationsReportBody"); if (!title || !body) return;
        const plans = read("meridianPlans", {})[ymd(new Date())] || [], meds = read("meridianMedicationLogs", []).filter(function (x) { return x.date === ymd(new Date()); }), health = healthFor(new Date()), weather = read("meridianWeather", {}), night = new Date().getHours() >= 18 || new Date().getHours() < 5, done = plans.filter(function (x) { return x.done; }).length;
        title.textContent = night ? "Night Report" : "Morning Brief";
        body.textContent = night ? "予定 " + done + "/" + plans.length + "件完了。服薬記録 " + meds.length + "件。" + (health.headache ? "頭痛あり。明日は負荷を下げろ。" : "重大な体調記録はない。今日はここで切り上げろ。") : "本日の予定は" + plans.length + "件。" + (Number(weather.pressure) <= 1008 ? "気圧は低めだ。無理に詰め込むな。" : "気象条件は通常範囲。") + (meds.length ? "服薬記録は既にある。" : "服薬したらその場で記録しろ。");
    }
    function render() { renderAnalysis(); renderReport(); }
    window.addEventListener("meridianWeatherUpdated", render); document.addEventListener("visibilitychange", function () { if (!document.hidden) render(); }); document.addEventListener("click", function () { window.setTimeout(render, 0); }); window.setInterval(render, 60000);
    window.MeridianInsights = { render: render, summary: summary }; render();
})();
