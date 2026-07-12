//========================
// Meridian Focus Timer
// Phase 3 + Focus Statistics v1
//========================

(function () {
    "use strict";

    const FOCUS_SECONDS = 25 * 60;
    const BREAK_SECONDS = 5 * 60;
    const FOCUS_MINUTES_RECORDED = 25;

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

    const focusMessageEngine =
        window.MeridianFocusMessageEngine || {
            getStartMessage: function () {
                return "集中時間を開始した。今は一つだけ見ろ。";
            },

            getPauseMessage: function () {
                return "一時停止した。再開できる時に戻れ。";
            },

            getFocusCompleteMessage: function () {
                return "よく集中した。今は5分休め。";
            },

            getBreakStartMessage: function () {
                return "休憩を開始する。画面から目を離せ。";
            },

            getBreakCompleteMessage: function () {
                return "休憩終了。戻れるなら始めよう。";
            },

            getResetMessage: function () {
                return "25分の集中を開始できる。";
            }
        };

    let mode = "focus";
    let round = 1;
    let remainingSeconds = FOCUS_SECONDS;
    let timerId = null;
    let endTimestamp = null;
    let isRunning = false;
    let currentFocusRecorded = false;

    function getModeDuration() {
        return mode === "focus"
            ? FOCUS_SECONDS
            : BREAK_SECONDS;
    }

    function formatTime(totalSeconds) {
        const safeSeconds = Math.max(
            0,
            Math.ceil(totalSeconds)
        );

        const minutes = Math.floor(
            safeSeconds / 60
        );

        const seconds = safeSeconds % 60;

        return (
            String(minutes).padStart(2, "0") +
            ":" +
            String(seconds).padStart(2, "0")
        );
    }

    function setStatus(status) {
        statusLabel.textContent = status;
        statusLabel.dataset.status =
            status.toLowerCase();
    }

    function setMode(nextMode) {
        mode = nextMode;
        remainingSeconds = getModeDuration();
        endTimestamp = null;
        isRunning = false;

        if (mode === "focus") {
            currentFocusRecorded = false;
        }

        modeLabel.textContent =
            mode === "focus"
                ? "Focus"
                : "Break";
    }

    function render() {
        const duration = getModeDuration();
        const elapsed = duration - remainingSeconds;

        const progress = Math.min(
            100,
            Math.max(
                0,
                (elapsed / duration) * 100
            )
        );

        display.textContent =
            formatTime(remainingSeconds);

        progressFill.style.width =
            progress + "%";

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
            remainingSeconds =
                getModeDuration();
        }

        isRunning = true;
        endTimestamp =
            Date.now() +
            remainingSeconds * 1000;

        setStatus("ACTIVE");

        if (mode === "focus") {
            message.textContent =
                "Round " +
                round +
                "。 " +
                focusMessageEngine.getStartMessage();
        } else {
            message.textContent =
                "Round " +
                round +
                "。 " +
                focusMessageEngine.getBreakStartMessage();
        }

        stopInterval();

        timerId = window.setInterval(
            tick,
            250
        );

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

        message.textContent =
            focusMessageEngine.getPauseMessage();

        render();
    }

    function resetTimer() {
        stopInterval();

        round = 1;
        setMode("focus");
        setStatus("READY");

        message.textContent =
            "Round 1。 " +
            focusMessageEngine.getResetMessage();

        render();
    }

    function recordFocusStatistics() {
        if (currentFocusRecorded) {
            return null;
        }

        currentFocusRecorded = true;

        if (
            !window.MeridianFocusStats ||
            typeof window.MeridianFocusStats
                .recordCompletedRound !== "function"
        ) {
            console.warn(
                "Meridian Focus Timer: Focus Statistics is unavailable."
            );
            return null;
        }

        return window.MeridianFocusStats
            .recordCompletedRound(
                FOCUS_MINUTES_RECORDED
            );
    }

    function buildStatisticsText(summary) {
        if (!summary) {
            return "";
        }

        return (
            " 本日 " +
            summary.todayRounds +
            " Round / " +
            summary.todayFocusMinutes +
            "分。"
        );
    }

    function completeFocus() {
        stopInterval();

        const completedRound = round;
        const completionMessage =
            focusMessageEngine
                .getFocusCompleteMessage();

        const statisticsSummary =
            recordFocusStatistics();

        setMode("break");
        setStatus("BREAK");

        message.textContent =
            "Round " +
            completedRound +
            "完了。 " +
            completionMessage +
            buildStatisticsText(
                statisticsSummary
            );

        render();

        window.setTimeout(function () {
            if (
                mode === "break" &&
                !isRunning &&
                remainingSeconds ===
                    BREAK_SECONDS
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
            "Break完了。 " +
            focusMessageEngine
                .getBreakCompleteMessage() +
            " Round " +
            round +
            "を開始できる。";

        render();
    }

    function completeCurrentMode() {
        remainingSeconds = 0;
        isRunning = false;
        endTimestamp = null;

        if (mode === "focus") {
            completeFocus();
        } else {
            completeBreak();
        }
    }

    function tick() {
        if (
            !isRunning ||
            endTimestamp === null
        ) {
            return;
        }

        const millisecondsLeft =
            endTimestamp - Date.now();

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
            if (
                !document.hidden &&
                isRunning
            ) {
                tick();
            }
        }
    );

    resetTimer();
})();

