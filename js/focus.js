//========================
// Meridian Focus Timer
// Phase 2: Focus / Break automatic switching
//========================

(function () {
    "use strict";

    const FOCUS_SECONDS = 25 * 60;
    const BREAK_SECONDS = 5 * 60;

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
        console.warn(
            "Meridian Focus Timer: required elements were not found."
        );
        return;
    }

    let mode = "focus";
    let round = 1;
    let remainingSeconds = FOCUS_SECONDS;
    let timerId = null;
    let endTimestamp = null;
    let isRunning = false;
    let isComplete = false;

    function getModeDuration() {
        return mode === "focus"
            ? FOCUS_SECONDS
            : BREAK_SECONDS;
    }

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

    function setMode(nextMode) {
        mode = nextMode;
        remainingSeconds = getModeDuration();
        endTimestamp = null;
        isRunning = false;
        isComplete = false;

        if (mode === "focus") {
            modeLabel.textContent = "Focus";
        } else {
            modeLabel.textContent = "Break";
        }
    }

    function render() {
        const duration = getModeDuration();
        const elapsed = duration - remainingSeconds;
        const progress = Math.min(
            100,
            Math.max(0, (elapsed / duration) * 100)
        );

        display.textContent = formatTime(remainingSeconds);
        progressFill.style.width = progress + "%";

        startButton.disabled = isRunning;
        pauseButton.disabled = !isRunning;

        if (isRunning) {
            startButton.textContent = "Running";
        } else if (
            remainingSeconds < duration &&
            remainingSeconds > 0
        ) {
            startButton.textContent = "Resume";
        } else {
            startButton.textContent =
                mode === "focus"
                    ? "Start"
                    : "Start Break";
        }
    }

    function stopInterval() {
        if (timerId !== null) {
            window.clearInterval(timerId);
            timerId = null;
        }
    }

    function startCurrentMode() {
        if (isRunning) {
            return;
        }

        if (remainingSeconds <= 0) {
            remainingSeconds = getModeDuration();
        }

        isRunning = true;
        isComplete = false;
        endTimestamp = Date.now() + remainingSeconds * 1000;

        setStatus("ACTIVE");

        if (mode === "focus") {
            message.textContent =
                "Round " +
                round +
                "。集中時間を開始した。今は一つだけ見ろ。";
        } else {
            message.textContent =
                "Round " +
                round +
                "の休憩だ。画面から目を離していい。";
        }

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

        if (mode === "focus") {
            message.textContent =
                "Round " +
                round +
                "を一時停止した。再開できる時に戻れ。";
        } else {
            message.textContent =
                "休憩を一時停止した。";
        }

        render();
    }

    function resetTimer() {
        stopInterval();

        round = 1;
        setMode("focus");

        setStatus("READY");
        message.textContent =
            "Round 1。25分の集中を開始できる。";

        render();
    }

    function completeFocus() {
        stopInterval();

        setMode("break");
        setStatus("BREAK");

        message.textContent =
            "Round " +
            round +
            "を完了した。5分休め。";

        render();

        // Focus終了後は休憩を自動開始する。
        window.setTimeout(function () {
            if (
                mode === "break" &&
                !isRunning &&
                remainingSeconds === BREAK_SECONDS
            ) {
                startCurrentMode();
            }
        }, 900);
    }

    function completeBreak() {
        stopInterval();

        round += 1;
        setMode("focus");
        setStatus("READY");

        message.textContent =
            "休憩終了。Round " +
            round +
            "を開始できる。";

        // 休憩終了後は次のFocusを自動開始せず、
        // READY状態で待機する。
        render();
    }

    function completeCurrentMode() {
        remainingSeconds = 0;
        isRunning = false;
        endTimestamp = null;
        isComplete = true;

        if (mode === "focus") {
            completeFocus();
        } else {
            completeBreak();
        }
    }

    function tick() {
        if (!isRunning || endTimestamp === null) {
            return;
        }

        const millisecondsLeft = endTimestamp - Date.now();
        remainingSeconds = Math.max(
            0,
            millisecondsLeft / 1000
        );

        if (remainingSeconds <= 0) {
            completeCurrentMode();
            return;
        }

        render();
    }

    startButton.addEventListener(
        "click",
        startCurrentMode
    );

    pauseButton.addEventListener(
        "click",
        pauseTimer
    );

    resetButton.addEventListener(
        "click",
        resetTimer
    );

    document.addEventListener(
        "visibilitychange",
        function () {
            if (!document.hidden && isRunning) {
                tick();
            }
        }
    );

    resetTimer();
})();

