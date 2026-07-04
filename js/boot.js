//========================
// Meridian Boot Sequence
//========================

const bootScreen = document.getElementById("bootScreen");
const bootText = document.getElementById("bootText");
const app = document.getElementById("app");
const message = document.getElementById("message");

const bootLines = [
    "Initializing...",
    "Loading Vestige...",
    "Commander Connected.",
    "Good Morning, Rei."
];

let bootIndex = 0;

function runBootSequence() {
    bootText.textContent = bootLines[bootIndex];

    const bootTimer = setInterval(function () {
        bootIndex++;

        if (bootIndex < bootLines.length) {
            bootText.textContent = bootLines[bootIndex];
            return;
        }

        clearInterval(bootTimer);

        setTimeout(function () {
            bootScreen.classList.add("fade-out");
            app.classList.remove("hidden");

            if (message) {
                message.textContent = "今日はどうだ、レイ。";
            }
        }, 700);

    }, 900);
}

window.addEventListener("load", runBootSequence);
