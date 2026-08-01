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
            const previousMuted = element.muted;
            element.muted = true;
            element.volume = 0;
            try {
                const promise = element.play();
                if (promise && typeof promise.catch === "function") promise.catch(function () {});
                element.pause();
                element.currentTime = 0;
            } catch (_) {}

            // iOS may resolve media playback after the pointer event has ended.
            // Keep the element muted briefly so no unlock sample can leak out.
            window.setTimeout(function () {
                element.pause();
                element.currentTime = 0;
                element.volume = previousVolume;
                element.muted = previousMuted;
            }, 180);
        });
    }

    document.addEventListener("pointerdown", unlock, { capture: true, once: true });

    window.MeridianSounds = { play: play, unlock: unlock };
})();
