// Meridian Boot Sequence v3
(function () {
    const bootScreen = document.getElementById("bootScreen");
    const bootText = document.getElementById("bootText");
    const skipButton = document.getElementById("bootSkipButton");
    const app = document.getElementById("app");
    const bootLines = [
        "Initializing Meridian...",
        "Loading Archive...",
        "Syncing Local Conditions...",
        "Connecting Madrid Headquarters...",
        "Commander Connected."
    ];
    let intervalId = null;
    let finishId = null;
    let complete = false;

    function finishBoot(immediate) {
        if (complete) return;
        complete = true;
        window.clearInterval(intervalId);
        window.clearTimeout(finishId);
        app.classList.remove("hidden");
        bootScreen.classList.add("fade-out");
        if (immediate) bootScreen.classList.add("boot-skipped");
        window.dispatchEvent(new Event("meridianBootCompleted"));
    }

    function runBootSequence() {
        let index = 0;
        bootText.textContent = bootLines[index];
        intervalId = window.setInterval(function () {
            index += 1;
            if (index < bootLines.length) {
                bootText.textContent = bootLines[index];
                return;
            }
            window.clearInterval(intervalId);
            finishId = window.setTimeout(function () { finishBoot(false); }, 500);
        }, 700);
    }

    if (skipButton) skipButton.addEventListener("click", function () { finishBoot(true); });
    window.addEventListener("load", runBootSequence);
})();
