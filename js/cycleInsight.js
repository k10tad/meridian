// Meridian Cycle / Health Insight v2.0
(function () {
    "use strict";

    const cycleDayStatus = document.getElementById("cycleDayStatus");
    const cycleNextStatus = document.getElementById("cycleNextStatus");
    const cycleStatusMessage = document.getElementById("cycleStatusMessage");

    function formatShort(key) {
        if (!key || !window.MeridianCycle) return "未設定";
        const date = window.MeridianCycle.parseDate(key);
        return date ? date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) : "未設定";
    }

    function updateTodayHealth(status) {
        const todayKey = new Date().toDateString();
        const storageKey = "meridianHealthLog_" + todayKey;
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch (_) { saved = null; }
        saved = saved || {
            date: todayKey,
            headache: false,
            dizzy: false,
            period: false,
            pms: false,
            medicine: false,
            boxing: false,
            palpitation: false,
            sleepMemo: "",
            bodyNote: ""
        };

        if (status.isPeriod) saved.period = true;
        if (status.isPmsWindow) saved.pms = true;
        localStorage.setItem(storageKey, JSON.stringify(saved));

        document.querySelectorAll(".health-toggle").forEach(function (button) {
            if (saved[button.dataset.health]) button.classList.add("selected");
        });
    }

    function renderCycleInsight() {
        if (!window.MeridianCycle) return;
        const status = window.MeridianCycle.statusForToday();

        if (!status.last) {
            if (cycleDayStatus) cycleDayStatus.textContent = "未記録";
            if (cycleNextStatus) cycleNextStatus.textContent = "未設定";
            if (cycleStatusMessage) cycleStatusMessage.textContent = "Plannerで開始日を記録すると、中央値から周期の見通しを出せる。";
            return;
        }

        if (cycleDayStatus) cycleDayStatus.textContent = "Day " + status.cycleDay;
        if (cycleNextStatus) {
            if (status.daysUntilNext === 0) cycleNextStatus.textContent = "今日ごろ";
            else if (status.daysUntilNext > 0) cycleNextStatus.textContent = "あと約" + status.daysUntilNext + "日";
            else cycleNextStatus.textContent = formatShort(status.next) + "ごろ";
        }

        let message = "周期は記録済みだ。次は" + formatShort(status.next) + "ごろ。予測は一日ではなく、" +
            formatShort(status.forecastStart) + "〜" + formatShort(status.forecastEnd) + "の幅で見ろ。";
        if (status.isPeriod) {
            message = "生理中として記録されている。今日は身体の負担を優先しろ。予定は軽く見積もる。";
        } else if (status.isNearNext) {
            message = "次の時期が近い。" + formatShort(status.forecastStart) + "〜" + formatShort(status.forecastEnd) +
                "を目安にして、無理に予定を詰めるな。";
        } else if (status.isPmsWindow) {
            message = "PMSが出やすい時期の目安だ。睡眠、頭痛、気分の変化を先に見ておけ。";
        } else if (status.ovulation) {
            message = "今日は排卵日の暦上推定に当たる。確定日ではないから、体調の参考情報として扱え。";
        }

        if (cycleStatusMessage) cycleStatusMessage.textContent = message;
        updateTodayHealth(status);
        if (typeof window.loadHealthLog === "function") window.loadHealthLog();
    }

    window.addEventListener("meridianCycleUpdated", renderCycleInsight);
    window.addEventListener("storage", function (event) {
        if (!event.key || event.key === "meridianCycle") renderCycleInsight();
    });
    window.MeridianCycleInsight = { render: renderCycleInsight };
    renderCycleInsight();
})();
