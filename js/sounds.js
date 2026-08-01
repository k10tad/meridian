// Meridian interface sounds — short, local-only cues with iOS-safe playback.
(function () {
    "use strict";

    const paths = {
        navigation: "assets/sounds/navigation.mp3",
        record: "assets/sounds/record.mp3",
        alarm: "assets/sounds/alarm.mp3",
        beep: "assets/sounds/beep.mp3"
    };
    const audio = {};
    const lastPlayedAt = {};
    let unlocked = false;

    Object.keys(paths).forEach(function (name) {
        const element = new Audio(paths[name]);
        element.preload = "auto";
        element.playsInline = true;
        audio[name] = element;
    });

    function play(name) {
        const element = audio[name];
        const now = Date.now();
        if (!element || now - (lastPlayedAt[name] || 0) < 180) return false;
        lastPlayedAt[name] = now;
        try {
            element.pause();
            element.currentTime = 0;
            const promise = element.play();
            if (promise && typeof promise.catch === "function") promise.catch(function () {});
            return true;
        } catch (_) {
            return false;
        }
    }

    function unlock() {
        if (unlocked) return;
        unlocked = true;
        Object.keys(audio).forEach(function (name) {
            const element = audio[name];
            const previousVolume = element.volume;
            element.volume = 0;
            const promise = element.play();
            if (promise && typeof promise.then === "function") {
                promise.then(function () {
                    element.pause();
                    element.currentTime = 0;
                    element.volume = previousVolume;
                }).catch(function () { element.volume = previousVolume; });
            } else {
                element.pause();
                element.currentTime = 0;
                element.volume = previousVolume;
            }
        });
    }

    document.addEventListener("pointerdown", unlock, { capture: true, once: true });

    window.MeridianSounds = { play: play, unlock: unlock };
})();
