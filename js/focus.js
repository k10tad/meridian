//========================
// Meridian Focus Timer
// Phase 1: Start / Pause / Reset
//========================

(function () {
    "use strict";

    const FOCUS_DURATION_SECONDS = 25 * 60;

    const display = document.getElementById("focusTimerDisplay");
    const modeLabel = document.getElementById("focusModeLabel");
    const statusLabel = document.getElementById("focusTimerStatus");
    const message = document.getElementById("focusTimerMessage");
    const progressFill = document.getElementById("focusProgressFill");

    const startButton = document.getElementById("focusStartButton");
    const pauseButton = document.getElementById("focusPauseButton");
    const resetButton = document.getElementById("focusResetButton");

    if (
        !display ||
        !modeLabel ||
        !statusLabel ||
        !message ||
        !progressFill ||
        !startButton ||
        !pauseButton ||
        !resetButton
    ) {
        console.warn("Meridian Focus Timer: required elements were not found.");
        return;
    }

    let remainingSeconds = FOCUS_DURATION_SECONDS;
    let timerId = null;
    let endTimestamp = null;
    let isRunning = false;
    let isComplete = false;

    function formatTime(totalSeconds) {
        const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = safeSeconds % 60;

        return (
            String(minutes).padStart(2, "0") +
            ":" +
            String(seconds).padStart(2, "0")
        );
    }

    function setStatus(status) {
        statusLabel.textContent = status;
        statusLabel.dataset.status = status.toLowerCase();
    }

    function render() {
        display.textContent = formatTime(remainingSeconds);

        const elapsed = FOCUS_DURATION_SECONDS - remainingSeconds;
        const progress = Math.min(
            100,
            Math.max(0, (elapsed / FOCUS_DURATION_SECONDS) * 100)
        );

        progressFill.style.width = progress + "%";

        startButton.disabled = isRunning;
        pauseButton.disabled = !isRunning;

        if (isComplete) {
            startButton.textContent = "Start Again";
        } else if (remainingSeconds < FOCUS_DURATION_SECONDS) {
            startButton.textContent = "Resume";
        } else {
            startButton.textContent = "Start";
        }
    }

    function stopInterval() {
        if (timerId !== null) {
            window.clearInterval(timerId);
            timerId = null;
        }
    }

    function completeTimer() {
        stopInterval();

        remainingSeconds = 0;
        endTimestamp = null;
        isRunning = false;
        isComplete = true;

        setStatus("COMPLETE");
        message.textContent = "25分の集中を完了した。";
        render();
    }

    function tick() {
        if (!isRunning || endTimestamp === null) {
            return;
        }

        const millisecondsLeft = endTimestamp - Date.now();
        remainingSeconds = Math.max(0, millisecondsLeft / 1000);

        if (remainingSeconds <= 0) {
            completeTimer();
            return;
        }

        render();
    }

    function startTimer() {
        if (isRunning) {
            return;
        }

        if (isComplete || remainingSeconds <= 0) {
            remainingSeconds = FOCUS_DURATION_SECONDS;
            isComplete = false;
        }

        isRunning = true;
        endTimestamp = Date.now() + remainingSeconds * 1000;

        setStatus("ACTIVE");
        message.textContent = "集中時間を開始した。今は一つだけ見ろ。";

        stopInterval();
        timerId = window.setInterval(tick, 250);

        tick();
    }

    function pauseTimer() {
        if (!isRunning) {
            return;
        }

        tick();
        stopInterval();

        isRunning = false;
        endTimestamp = null;

        setStatus("PAUSED");
        message.textContent = "一時停止した。再開できる時に戻れ。";
        render();
    }

    function resetTimer() {
        stopInterval();

        remainingSeconds = FOCUS_DURATION_SECONDS;
        endTimestamp = null;
        isRunning = false;
        isComplete = false;

        setStatus("READY");
        message.textContent = "25分の集中を開始できる。";
        render();
    }

    startButton.addEventListener("click", startTimer);
    pauseButton.addEventListener("click", pauseTimer);
    resetButton.addEventListener("click", resetTimer);

    document.addEventListener("visibilitychange", function () {
        if (!document.hidden && isRunning) {
            tick();
        }
    });

    modeLabel.textContent = "Focus";
    resetTimer();
})();

