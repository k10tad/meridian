// Meridian Training v4.1 — timestamp based fitness timer + native platform pickers
(function () {
    "use strict";
    const STORAGE = "meridianTrainingLogs";
    const SETTINGS_STORAGE = "meridianTrainingSettings";
    const modeButtons = Array.from(document.querySelectorAll(".training-mode-btn"));
    const presetButtons = Array.from(document.querySelectorAll(".training-preset-btn"));
    const presetRow = document.getElementById("trainingPresetRow");
    const nativePicker = document.getElementById("trainingNativePicker");
    const workField = document.getElementById("trainingWorkField");
    const restField = document.getElementById("trainingRestField");
    const roundsField = document.getElementById("trainingRoundsField");
    const workTime = document.getElementById("trainingWorkTime");
    const restTime = document.getElementById("trainingRestTime");
    const roundsSelect = document.getElementById("trainingRoundsSelect");
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
    if (!display || !startButton || !workTime) return;

    let mode = "boxing", work = 120, rest = 60, rounds = 3;
    let phase = "work", round = 1, sets = 0, remaining = work;
    let running = false, endAt = 0, startedAt = 0, accumulated = 0, timer = null;
    let wakeLock = null;

    function readSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_STORAGE)) || {}; } catch (_) { return {}; } }
    function saveSettings() { localStorage.setItem(SETTINGS_STORAGE, JSON.stringify({ mode: mode, work: work, rest: rest, rounds: rounds })); }
    function vibrate(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }
    async function requestWakeLock() { try { if ("wakeLock" in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request("screen"); } catch (_) {} }
    async function releaseWakeLock() { try { if (wakeLock) await wakeLock.release(); } catch (_) {} wakeLock = null; }

    for (let value = 1; value <= 30; value += 1) {
        const option = document.createElement("option");
        option.value = String(value); option.textContent = String(value);
        roundsSelect.appendChild(option);
    }

    function format(seconds) {
        seconds = Math.max(0, Math.ceil(seconds));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const clock = String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
        return hours > 0 ? String(hours).padStart(2, "0") + ":" + clock : clock;
    }
    function secondsToInput(seconds) {
        seconds = Math.max(0, Math.min(86399, Math.round(Number(seconds) || 0)));
        return String(Math.floor(seconds / 3600)).padStart(2, "0") + ":" +
            String(Math.floor((seconds % 3600) / 60)).padStart(2, "0") + ":" +
            String(seconds % 60).padStart(2, "0");
    }
    function inputToSeconds(value) {
        const parts = String(value || "00:00:00").split(":").map(Number);
        if (parts.length < 2 || parts.some(Number.isNaN)) return 0;
        return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    }
    function isCountUp() { return false; }
    function loadLogs() { try { const value = JSON.parse(localStorage.getItem(STORAGE)); return Array.isArray(value) ? value : []; } catch (_) { return []; } }
    function saveLogs(logs) { localStorage.setItem(STORAGE, JSON.stringify(logs.slice(-120))); }
    function durationNow() { return accumulated + (running && startedAt ? Math.max(0, (Date.now() - startedAt) / 1000) : 0); }

    function syncInputs() {
        workTime.value = secondsToInput(work);
        restTime.value = secondsToInput(rest);
        roundsSelect.value = String(rounds);
    }
    function applyInputs() {
        work = inputToSeconds(workTime.value);
        if (work < 1) { work = 1; workTime.value = "00:00:01"; }
        if (mode === "custom" || mode === "treadmill") { rest = 0; rounds = 1; }
        else { rest = inputToSeconds(restTime.value); rounds = Math.max(1, Number(roundsSelect.value) || 1); }
        presetButtons.forEach(function (button) { button.classList.remove("active"); });
        saveSettings();
        reset();
    }
    function updatePickerLayout() {
        const single = mode === "custom" || mode === "treadmill";
        nativePicker.classList.toggle("single-duration", single);
        restField.hidden = single;
        roundsField.hidden = single;
        workField.querySelector("span").textContent = mode === "custom" ? "DURATION · HR / MIN / SEC" : (mode === "treadmill" ? "DURATION" : "WORK");
    }
    function configureMode(next) {
        stop(false); mode = next;
        presetRow.hidden = mode === "custom";
        setButton.hidden = true;
        if (mode === "boxing") setPresets([
            ["Light", "2/1 × 3", 120, 60, 3],
            ["Standard", "3/1 × 5", 180, 60, 5],
            ["Long", "3/1 × 8", 180, 60, 8]
        ]);
        if (mode === "treadmill") setPresets([
            ["Quick", "10 min", 600, 0, 1],
            ["Standard", "20 min", 1200, 0, 1],
            ["Long", "30 min", 1800, 0, 1]
        ]);
        if (mode === "custom") { work = 20 * 60; rest = 0; rounds = 1; }
        updatePickerLayout(); syncInputs(); reset();
        saveSettings();
        modeButtons.forEach(function (button) { button.classList.toggle("active", button.dataset.trainingMode === mode); });
    }
    function setPresets(presets) {
        presetButtons.forEach(function (button, index) {
            const preset = presets[index];
            button.innerHTML = preset[0] + "<br><small>" + preset[1] + "</small>";
            button.dataset.work = preset[2]; button.dataset.rest = preset[3]; button.dataset.rounds = preset[4];
            button.classList.toggle("active", index === 0);
        });
        work = presets[0][2]; rest = presets[0][3]; rounds = presets[0][4];
    }
    function render() {
        display.textContent = isCountUp() ? format(durationNow()) : format(remaining);
        phaseLabel.textContent = running ? (isCountUp() ? "ACTIVE" : phase.toUpperCase()) : (remaining === 0 && !isCountUp() ? "COMPLETE" : "READY");
        roundLabel.textContent = mode === "custom" ? "CUSTOM" : (mode === "treadmill" ? "TREADMILL" : "Round " + round + " / " + rounds);
        startButton.disabled = running; pauseButton.disabled = !running;
        startButton.textContent = running ? "Running" : ((accumulated > 0 || remaining < (phase === "work" ? work : rest)) ? "Resume" : "Start");
        nativePicker.classList.toggle("locked", running || accumulated > 0 || remaining < (phase === "work" ? work : rest));
        workTime.disabled = nativePicker.classList.contains("locked"); restTime.disabled = workTime.disabled; roundsSelect.disabled = workTime.disabled;
    }
    function tick() {
        if (!running) return render();
        remaining = Math.max(0, (endAt - Date.now()) / 1000);
        if (remaining > 0) return render();
        window.MeridianSounds?.play("alarm");
        vibrate([160, 80, 160]);
        if (phase === "work" && rest > 0 && round < rounds) { phase = "rest"; remaining = rest; endAt = Date.now() + rest * 1000; message.textContent = "Recover. Keep the next round controlled."; }
        else if (round < rounds) { round += 1; phase = "work"; remaining = work; endAt = Date.now() + work * 1000; message.textContent = "Round " + round + "."; }
        else { stop(false); releaseWakeLock(); remaining = 0; message.textContent = "Session complete. Record it when ready."; }
        render();
    }
    function start() { if (remaining <= 0) reset(); running = true; startedAt = Date.now(); endAt = Date.now() + remaining * 1000; timer = window.setInterval(tick, 250); requestWakeLock(); vibrate(60); message.textContent = "Session active."; render(); }
    function stop(addElapsed) { if (addElapsed && running && startedAt) accumulated += Math.max(0, (Date.now() - startedAt) / 1000); running = false; startedAt = 0; window.clearInterval(timer); timer = null; render(); }
    function pause() { if (!running) return; remaining = Math.max(0, (endAt - Date.now()) / 1000); stop(false); releaseWakeLock(); vibrate(40); message.textContent = "Paused."; }
    function reset() { stop(false); releaseWakeLock(); phase = "work"; round = 1; sets = 0; accumulated = 0; startedAt = 0; remaining = work; message.textContent = mode.charAt(0).toUpperCase() + mode.slice(1) + " is ready."; render(); }
    function finish() {
        const elapsed = Math.max(0, ((round - 1) * work) + (phase === "rest" ? work : work - remaining));
        stop(false);
        if (elapsed < 3 && sets === 0) { message.textContent = "Start the session before recording."; return; }
        const logs = loadLogs();
        logs.push({ id: Date.now().toString(36), date: new Date().toISOString(), mode: mode, durationSeconds: Math.round(elapsed), rounds: mode === "boxing" ? round : null, sets: null });
        saveLogs(logs);
        if (mode === "boxing") { try { const key = "meridianHealthLog_" + new Date().toDateString(); const health = JSON.parse(localStorage.getItem(key)) || {}; health.boxing = true; health.date = new Date().toDateString(); localStorage.setItem(key, JSON.stringify(health)); } catch (_) {} }
        if (typeof completeMission === "function") completeMission("focus");
        window.MeridianSounds?.play("record"); message.textContent = "Training recorded."; renderHistory(); reset();
    }
    function renderHistory() {
        const logs = loadLogs().slice().reverse().slice(0, 5);
        history.innerHTML = logs.length ? logs.map(function (log) {
            const detail = log.rounds != null ? log.rounds + " rounds" : format(log.durationSeconds);
            return "<div class='training-history-row'><div><strong>" + log.mode.toUpperCase() + "</strong><small>" + new Date(log.date).toLocaleDateString("ja-JP") + "</small></div><span>" + detail + " · " + format(log.durationSeconds) + "</span></div>";
        }).join("") : "<div class='medication-empty'>No training records yet.</div>";
    }

    modeButtons.forEach(function (button) { button.addEventListener("click", function () { configureMode(button.dataset.trainingMode); }); });
    presetButtons.forEach(function (button) { button.addEventListener("click", function () { work = Number(button.dataset.work); rest = Number(button.dataset.rest); rounds = Number(button.dataset.rounds); presetButtons.forEach(function (item) { item.classList.toggle("active", item === button); }); syncInputs(); saveSettings(); reset(); }); });
    [workTime, restTime, roundsSelect].forEach(function (control) { control.addEventListener("change", applyInputs); control.addEventListener("input", function () { if (control === roundsSelect) applyInputs(); }); });
    startButton.addEventListener("click", start); pauseButton.addEventListener("click", pause); resetButton.addEventListener("click", reset);
    setButton.addEventListener("click", function () { sets += 1; render(); }); finishButton.addEventListener("click", finish);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { tick(); if (running) requestWakeLock(); } });
    const savedSettings = readSettings();
    if (["boxing", "treadmill", "custom"].includes(savedSettings.mode)) mode = savedSettings.mode;
    if (Number(savedSettings.work) > 0) work = Number(savedSettings.work);
    if (Number(savedSettings.rest) >= 0) rest = Number(savedSettings.rest);
    if (Number(savedSettings.rounds) > 0) rounds = Math.min(30, Number(savedSettings.rounds));
    if (mode === "treadmill") {
        [["Quick","10 min",600,0,1],["Standard","20 min",1200,0,1],["Long","30 min",1800,0,1]].forEach(function (preset,index) { const button=presetButtons[index]; button.innerHTML=preset[0]+"<br><small>"+preset[1]+"</small>"; button.dataset.work=preset[2]; button.dataset.rest=preset[3]; button.dataset.rounds=preset[4]; button.classList.remove("active"); });
    }
    modeButtons.forEach(function (button) { button.classList.toggle("active", button.dataset.trainingMode === mode); });
    presetRow.hidden = mode === "custom";
    updatePickerLayout(); syncInputs(); renderHistory(); reset();
})();
