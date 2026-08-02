// Meridian Training v4 — timestamp based fitness timer + wheel picker
(function () {
    "use strict";
    const STORAGE = "meridianTrainingLogs";
    const modeButtons = Array.from(document.querySelectorAll(".training-mode-btn"));
    const presetButtons = Array.from(document.querySelectorAll(".training-preset-btn"));
    const presetRow = document.getElementById("trainingPresetRow");
    const wheelPicker = document.getElementById("trainingWheelPicker");
    const wheelColumns = document.getElementById("trainingWheelColumns");
    const display = document.getElementById("trainingTimerDisplay");
    const phaseLabel = document.getElementById("trainingPhaseLabel");
    const roundLabel = document.getElementById("trainingRoundLabel");
    const startButton = document.getElementById("trainingStartButton");
    const pauseButton = document.getElementById("trainingPauseButton");
    const resetButton = document.getElementById("trainingResetButton");
    const setButton = document.getElementById("trainingSetButton");
    const finishButton = document.getElementById("trainingCompleteButton");
    const message = document.getElementById("trainingMessage");
    const history = document.getElementById("trainingHistory");
    if (!display || !startButton) return;

    let mode = "boxing", work = 120, rest = 60, rounds = 3;
    let phase = "work", round = 1, sets = 0, remaining = work;
    let running = false, endAt = 0, startedAt = 0, accumulated = 0, timer = null;
    let wheelValues = [2, 1, 3], wheelSettleTimers = [];

    function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || min)); }
    function format(seconds) {
        seconds = Math.max(0, Math.ceil(seconds));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const clock = String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
        return hours > 0 ? String(hours).padStart(2, "0") + ":" + clock : clock;
    }
    function isCountUp() { return false; }
    function loadLogs() { try { const v = JSON.parse(localStorage.getItem(STORAGE)); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
    function saveLogs(logs) { localStorage.setItem(STORAGE, JSON.stringify(logs.slice(-120))); }
    function durationNow() { return accumulated + (running && startedAt ? Math.max(0, (Date.now() - startedAt) / 1000) : 0); }

    function wheelDefinitions() {
        return mode === "custom" ? [
            { label: "HR", min: 0, max: 23 }, { label: "MIN", min: 0, max: 59 }, { label: "SEC", min: 0, max: 59 }
        ] : [
            { label: "WORK", min: 1, max: 90 }, { label: "REST", min: 0, max: 30 }, { label: "ROUNDS", min: 1, max: 30 }
        ];
    }
    function valuesFromSession() {
        return mode === "custom"
            ? [Math.floor(work / 3600), Math.floor((work % 3600) / 60), work % 60]
            : [Math.max(1, Math.round(work / 60)), Math.max(0, Math.round(rest / 60)), rounds];
    }
    function applyWheelValues(shouldReset) {
        if (mode === "custom") {
            work = wheelValues[0] * 3600 + wheelValues[1] * 60 + wheelValues[2];
            if (work < 1) { work = 1; wheelValues[2] = 1; renderWheels(false); }
            rest = 0; rounds = 1;
        } else {
            work = wheelValues[0] * 60; rest = wheelValues[1] * 60; rounds = wheelValues[2];
        }
        presetButtons.forEach(function (button) { button.classList.remove("active"); });
        if (shouldReset) reset();
    }
    function selectWheelItem(scroller, index, smooth) {
        const item = scroller.querySelector('[data-wheel-value="' + wheelValues[index] + '"]');
        if (!item) return;
        scroller.scrollTo({ top: item.offsetTop - 44, behavior: smooth ? "smooth" : "auto" });
        scroller.querySelectorAll(".training-wheel-item").forEach(function (node) { node.classList.toggle("selected", node === item); });
    }
    function settleWheel(scroller, index) {
        const definition = wheelDefinitions()[index];
        wheelValues[index] = Math.min(definition.max, Math.max(definition.min, Math.round(scroller.scrollTop / 44) + definition.min));
        selectWheelItem(scroller, index, true);
        applyWheelValues(true);
    }
    function renderWheels(resetValues) {
        if (!wheelColumns) return;
        if (resetValues) wheelValues = valuesFromSession();
        wheelColumns.innerHTML = wheelDefinitions().map(function (definition, index) {
            let items = '<div class="training-wheel-spacer"></div>';
            for (let value = definition.min; value <= definition.max; value += 1) items += '<div class="training-wheel-item" data-wheel-value="' + value + '">' + String(value).padStart(2, "0") + '</div>';
            return '<div class="training-wheel-column"><div class="training-wheel-scroll" data-wheel-index="' + index + '">' + items + '<div class="training-wheel-spacer"></div></div><span class="training-wheel-label">' + definition.label + '</span></div>';
        }).join("");
        Array.from(wheelColumns.querySelectorAll(".training-wheel-scroll")).forEach(function (scroller, index) {
            selectWheelItem(scroller, index, false);
            scroller.addEventListener("scroll", function () {
                window.clearTimeout(wheelSettleTimers[index]);
                wheelSettleTimers[index] = window.setTimeout(function () { settleWheel(scroller, index); }, 120);
            }, { passive: true });
        });
    }

    function configureMode(next) {
        stop(false); mode = next;
        presetRow.hidden = mode === "custom";
        setButton.hidden = true;
        if (mode === "boxing") {
            setPresets([
                ["Light", "2/1 × 3", 120, 60, 3],
                ["Standard", "3/1 × 5", 180, 60, 5],
                ["Long", "3/1 × 8", 180, 60, 8]
            ]);
        }
        if (mode === "treadmill") {
            setPresets([
                ["Quick", "10 min", 600, 0, 1],
                ["Standard", "20 min", 1200, 0, 1],
                ["Long", "30 min", 1800, 0, 1]
            ]);
        }
        if (mode === "custom") { work = 20 * 60; rest = 0; rounds = 1; }
        renderWheels(true);
        reset();
        modeButtons.forEach(function (button) { button.classList.toggle("active", button.dataset.trainingMode === mode); });
    }
    function setPresets(presets) {
        presetButtons.forEach(function (button, index) {
            const preset = presets[index];
            button.innerHTML = preset[0] + "<br><small>" + preset[1] + "</small>";
            button.dataset.work = preset[2];
            button.dataset.rest = preset[3];
            button.dataset.rounds = preset[4];
            button.classList.toggle("active", index === 0);
        });
        work = presets[0][2]; rest = presets[0][3]; rounds = presets[0][4];
    }
    function render() {
        display.textContent = isCountUp() ? format(durationNow()) : format(remaining);
        phaseLabel.textContent = running ? (isCountUp() ? "ACTIVE" : phase.toUpperCase()) : (remaining === 0 && !isCountUp() ? "COMPLETE" : "READY");
        roundLabel.textContent = mode === "custom" ? "CUSTOM" : "Round " + round + " / " + rounds;
        startButton.disabled = running;
        pauseButton.disabled = !running;
        startButton.textContent = running ? "Running" : ((accumulated > 0 || (!isCountUp() && remaining < (phase === "work" ? work : rest))) ? "Resume" : "Start");
        if (wheelPicker) wheelPicker.classList.toggle("locked", running || accumulated > 0 || remaining < (phase === "work" ? work : rest));
    }
    function tick() {
        if (!running) return render();
        if (isCountUp()) return render();
        remaining = Math.max(0, (endAt - Date.now()) / 1000);
        if (remaining > 0) return render();
        window.MeridianSounds?.play("alarm");
        if (phase === "work" && rest > 0 && round < rounds) { phase = "rest"; remaining = rest; endAt = Date.now() + rest * 1000; message.textContent = "Recover. Keep the next round controlled."; }
        else if (round < rounds) { round += 1; phase = "work"; remaining = work; endAt = Date.now() + work * 1000; message.textContent = "Round " + round + "."; }
        else { stop(false); remaining = 0; message.textContent = "Session complete. Record it when ready."; }
        render();
    }
    function start() {
        if (!isCountUp() && remaining <= 0) reset();
        running = true; startedAt = Date.now();
        if (!isCountUp()) endAt = Date.now() + remaining * 1000;
        timer = window.setInterval(tick, 250);
        message.textContent = "Session active."; render();
    }
    function stop(addElapsed) {
        if (addElapsed && running && startedAt) accumulated += Math.max(0, (Date.now() - startedAt) / 1000);
        running = false; startedAt = 0; window.clearInterval(timer); timer = null; render();
    }
    function pause() { if (!running) return; if (!isCountUp()) remaining = Math.max(0, (endAt - Date.now()) / 1000); stop(isCountUp()); message.textContent = "Paused."; }
    function reset() {
        stop(false); phase = "work"; round = 1; sets = 0; accumulated = 0; startedAt = 0;
        remaining = isCountUp() ? 0 : work; message.textContent = mode.charAt(0).toUpperCase() + mode.slice(1) + " is ready."; render();
    }
    function finish() {
        const elapsed = isCountUp() ? durationNow() : Math.max(0, ((round - 1) * work) + (phase === "rest" ? work : work - remaining));
        stop(isCountUp());
        if (elapsed < 3 && sets === 0) { message.textContent = "Start the session before recording."; return; }
        const logs = loadLogs();
        logs.push({ id: Date.now().toString(36), date: new Date().toISOString(), mode: mode, durationSeconds: Math.round(elapsed), rounds: mode === "boxing" ? round : null, sets: null });
        saveLogs(logs);
        if (mode === "boxing") {
            try { const key = "meridianHealthLog_" + new Date().toDateString(); const health = JSON.parse(localStorage.getItem(key)) || {}; health.boxing = true; health.date = new Date().toDateString(); localStorage.setItem(key, JSON.stringify(health)); } catch (_) {}
        }
        if (typeof completeMission === "function") completeMission("focus");
        window.MeridianSounds?.play("record");
        message.textContent = "Training recorded."; renderHistory(); reset();
    }
    function renderHistory() {
        const logs = loadLogs().slice().reverse().slice(0, 5);
        history.innerHTML = logs.length ? logs.map(function (log) {
            const detail = log.sets != null ? log.sets + " sets" : (log.rounds != null ? log.rounds + " rounds" : format(log.durationSeconds));
            return "<div class='training-history-row'><div><strong>" + log.mode.toUpperCase() + "</strong><small>" + new Date(log.date).toLocaleDateString("ja-JP") + "</small></div><span>" + detail + " · " + format(log.durationSeconds) + "</span></div>";
        }).join("") : "<div class='medication-empty'>No training records yet.</div>";
    }

    modeButtons.forEach(function (button) { button.addEventListener("click", function () { configureMode(button.dataset.trainingMode); }); });
    presetButtons.forEach(function (button) { button.addEventListener("click", function () { work = Number(button.dataset.work); rest = Number(button.dataset.rest); rounds = Number(button.dataset.rounds); presetButtons.forEach(function (b) { b.classList.toggle("active", b === button); }); renderWheels(true); reset(); }); });
    startButton.addEventListener("click", start); pauseButton.addEventListener("click", pause); resetButton.addEventListener("click", reset);
    setButton.addEventListener("click", function () { sets += 1; render(); }); finishButton.addEventListener("click", finish);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });
    renderWheels(true); renderHistory(); reset();
})();
