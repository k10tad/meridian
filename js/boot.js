//========================
// Meridian Boot Sequence
//========================

const bootScreen = document.getElementById("bootScreen");
const bootText = document.getElementById("bootText");
const app = document.getElementById("app");
const deskGreetingBoot = document.getElementById("deskGreeting");

const bootLines = [
    "Initializing Meridian...",
    "Loading Vestige Archive...",
    "Syncing Local Conditions...",
    "Connecting Madrid Headquarters...",
    "Commander Connected."
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

          if (deskGreetingBoot) {
    window.dispatchEvent(new Event("meridianBootCompleted"));
    }

        }, 700);

    }, 850);
}

window.addEventListener("load", runBootSequence);