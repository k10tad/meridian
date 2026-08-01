// Meridian Training v3 — timestamp based fitness timer
(function () {
    "use strict";
    const STORAGE = "meridianTrainingLogs";
    const modeButtons = Array.from(document.querySelectorAll(".training-mode-btn"));
    const presetButtons = Array.from(document.querySelectorAll(".training-preset-btn"));
    const presetRow = document.getElementById("trainingPresetRow");
    const customFields = document.getElementById("trainingCustomFields");
    const workInput = document.getElementById("trainingWorkInput");
    const restInput = document.getElementById("trainingRestInput");
    const roundsInput = document.getElementById("trainingRoundsInput");
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

    function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || min)); }
    function format(seconds) {
        seconds = Math.max(0, Math.ceil(seconds));
        return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
    }
    function isCountUp() { return false; }
    function loadLogs() { try { const v = JSON.parse(localStorage.getItem(STORAGE)); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
    function saveLogs(logs) { localStorage.setItem(STORAGE, JSON.stringify(logs.slice(-120))); }
    function durationNow() { return accumulated + (running && startedAt ? Math.max(0, (Date.now() - startedAt) / 1000) : 0); }

    function configureMode(next) {
        stop(false); mode = next;
        presetRow.hidden = mode === "custom";
        customFields.hidden = mode !== "custom";
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
        if (mode === "custom") readCustom();
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
    function readCustom() {
        work = clamp(workInput.value, 1, 90) * 60;
        rest = clamp(restInput.value, 0, 30) * 60;
        rounds = clamp(roundsInput.value, 1, 30);
    }
    function render() {
        display.textContent = isCountUp() ? format(durationNow()) : format(remaining);
        phaseLabel.textContent = running ? (isCountUp() ? "ACTIVE" : phase.toUpperCase()) : (remaining === 0 && !isCountUp() ? "COMPLETE" : "READY");
        roundLabel.textContent = mode === "strength" ? "Sets " + sets : (isCountUp() ? mode.toUpperCase() : "Round " + round + " / " + rounds);
        startButton.disabled = running;
        pauseButton.disabled = !running;
        startButton.textContent = running ? "Running" : ((accumulated > 0 || (!isCountUp() && remaining < (phase === "work" ? work : rest))) ? "Resume" : "Start");
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
        if (mode === "custom") readCustom();
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
        logs.push({ id: Date.now().toString(36), date: new Date().toISOString(), mode: mode, durationSeconds: Math.round(elapsed), rounds: mode === "boxing" || mode === "custom" ? round : null, sets: null });
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
    presetButtons.forEach(function (button) { button.addEventListener("click", function () { work = Number(button.dataset.work); rest = Number(button.dataset.rest); rounds = Number(button.dataset.rounds); presetButtons.forEach(function (b) { b.classList.toggle("active", b === button); }); reset(); }); });
    [workInput, restInput, roundsInput].forEach(function (input) { input.addEventListener("change", function () { if (mode === "custom") { readCustom(); reset(); } }); });
    startButton.addEventListener("click", start); pauseButton.addEventListener("click", pause); resetButton.addEventListener("click", reset);
    setButton.addEventListener("click", function () { sets += 1; render(); }); finishButton.addEventListener("click", finish);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });
    renderHistory(); reset();
})();
