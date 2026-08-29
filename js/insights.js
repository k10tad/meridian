(function () {
    "use strict";

    function ymd(date) {
        return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
    }

    function read(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
    }

    function healthFor(date) {
        return read("meridianHealthLog_" + date.toDateString(), {});
    }

    function environmentBrief() {
        const parts = [];
        const todayKey = ymd(new Date());
        const holiday = window.MeridianHolidays && typeof window.MeridianHolidays.get === "function"
            ? window.MeridianHolidays.get(todayKey)
            : null;
        const air = window.MeridianAirQuality && typeof window.MeridianAirQuality.getAssessment === "function"
            ? window.MeridianAirQuality.getAssessment()
            : null;

        if (holiday) parts.push("今日は" + (holiday.localName || holiday.name || "祝日") + "だ。休息も予定として扱え。");
        if (air && air.advice) parts.push(air.advice);
        return parts.join("");
    }

    function lastThirtyDays() {
        const days = [];
        for (let i = 29; i >= 0; i -= 1) {
            const date = new Date();
            date.setHours(12, 0, 0, 0);
            date.setDate(date.getDate() - i);
            days.push(date);
        }
        return days;
    }

    function summary() {
        const weather = read("meridianWeatherHistory", {});
        const training = read("meridianTrainingLogs", []);
        const meds = read("meridianMedicationLogs", []);
        const headacheLogs = read("meridianHeadacheLogs", []);
        const cutoff = Date.now() - 30 * 86400000;
        const recentHeadaches = headacheLogs.filter(function (item) {
            return new Date(item.recordedAt).getTime() >= cutoff;
        });
        const quickHeadacheDates = new Set(recentHeadaches.map(function (item) {
            return ymd(new Date(item.recordedAt));
        }));
        const headacheDates = new Set(quickHeadacheDates);

        let recorded = 0;
        let dizzy = 0;
        let period = 0;
        let pms = 0;
        let weatherDays = 0;
        const weatherRiskDates = new Set();
        let previousPressure = null;

        lastThirtyDays().forEach(function (date) {
            const dateKey = ymd(date);
            const health = healthFor(date);
            const dayWeather = weather[dateKey];
            if (Object.keys(health).length || quickHeadacheDates.has(dateKey)) recorded += 1;
            if (health.headache) headacheDates.add(dateKey);
            if (health.dizzy) dizzy += 1;
            if (health.period) period += 1;
            if (health.pms) pms += 1;

            const pressure = Number(dayWeather && (dayWeather.pressureMean ?? dayWeather.pressure));
            if (Number.isFinite(pressure)) {
                weatherDays += 1;
                const fellSix = Number.isFinite(previousPressure) && previousPressure - pressure >= 6;
                if (pressure <= 1008 || fellSix) weatherRiskDates.add(dateKey);
                previousPressure = pressure;
            }
        });

        let overlap = 0;
        weatherRiskDates.forEach(function (dateKey) {
            if (headacheDates.has(dateKey)) overlap += 1;
        });

        let correlation;
        if (weatherDays < 7) {
            correlation = "過去気象を補完中だ。7日以上揃えば、気圧変化と頭痛記録の重なりを表示する。";
        } else if (overlap > 0) {
            correlation = "過去30日で、低気圧または前日比6hPa以上の低下と頭痛記録が" + overlap + "日重なった。原因とは断定せず、予定調整の参考にしろ。";
        } else {
            correlation = "過去30日では、低気圧または大きな気圧低下と頭痛記録の重なりは確認されていない。";
        }

        const averageIntensity = recentHeadaches.length
            ? (recentHeadaches.reduce(function (sum, item) { return sum + Number(item.intensity || 0); }, 0) / recentHeadaches.length).toFixed(1)
            : "--";

        return {
            recorded: recorded,
            headache: headacheDates.size,
            averageIntensity: averageIntensity,
            dizzy: dizzy,
            period: period,
            pms: pms,
            weatherDays: weatherDays,
            overlap: overlap,
            training: training.filter(function (item) { return new Date(item.date).getTime() >= cutoff; }).length,
            medications: meds.filter(function (item) { return new Date(item.takenAt).getTime() >= cutoff; }).length,
            correlation: correlation
        };
    }

    function renderAnalysis() {
        const target = document.getElementById("thirtyDayAnalysis");
        if (!target) return;
        const state = summary();
        target.innerHTML =
            "<div class='analysis-metrics'>" +
                "<div><strong>" + state.recorded + "</strong><span>記録日</span></div>" +
                "<div><strong>" + state.headache + "</strong><span>頭痛日</span></div>" +
                "<div><strong>" + state.averageIntensity + "</strong><span>平均強度</span></div>" +
                "<div><strong>" + state.training + "</strong><span>Training</span></div>" +
            "</div>" +
            "<p>" + state.correlation + "</p>" +
            "<small>気象 " + state.weatherDays + "日 · 服薬 " + state.medications + "件 · 生理 " + state.period + "日 · PMS " + state.pms + "日</small>";
    }

    function renderReport() {
        const title = document.getElementById("operationsReportTitle");
        const body = document.getElementById("operationsReportBody");
        if (!title || !body) return;
        const plans = read("meridianPlans", {})[ymd(new Date())] || [];
        const meds = read("meridianMedicationLogs", []).filter(function (item) { return item.date === ymd(new Date()); });
        const health = healthFor(new Date());
        const weather = read("meridianWeather", {});
        const night = new Date().getHours() >= 18 || new Date().getHours() < 5;
        const done = plans.filter(function (item) { return item.done; }).length;
        const environment = environmentBrief();
        title.textContent = night ? "Night Report" : "Morning Brief";
        const report = night
            ? "予定 " + done + "/" + plans.length + "件完了。服薬記録 " + meds.length + "件。" + (health.headache ? "頭痛あり。明日は負荷を下げろ。" : "重大な体調記録はない。今日はここで切り上げろ。")
            : "本日の予定は" + plans.length + "件。" + (Number(weather.pressure) <= 1008 ? "気圧は低めだ。無理に詰め込むな。" : "気象条件は通常範囲。") + (meds.length ? "服薬記録は既にある。" : "服薬したらその場で記録しろ。");
        body.textContent = report + (environment ? environment : "");
    }

    function render() {
        renderAnalysis();
        renderReport();
    }

    window.addEventListener("meridianWeatherUpdated", render);
    window.addEventListener("meridianHistoricalWeatherUpdated", render);
    window.addEventListener("meridianAirQualityUpdated", render);
    window.addEventListener("meridianHolidaysUpdated", render);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) render(); });
    document.addEventListener("click", function () { window.setTimeout(render, 0); });
    window.setInterval(render, 60000);
    window.MeridianInsights = { render: render, summary: summary };
    render();
})();
