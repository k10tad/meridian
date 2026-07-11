//========================
// Meridian Updater
// Step 1: Service Worker registration
//========================

(function () {
    "use strict";

    if (!("serviceWorker" in navigator)) {
        console.info("Meridian Updater: Service Worker is not supported.");
        return;
    }

    window.addEventListener("load", function () {
        navigator.serviceWorker
            .register("./service-worker.js", {
                scope: "./",
                updateViaCache: "none"
            })
            .then(function (registration) {
                console.info(
                    "Meridian Updater: Service Worker registered.",
                    registration.scope
                );

                // Ask the browser to check the worker script on each app launch.
                registration.update().catch(function (error) {
                    console.warn(
                        "Meridian Updater: update check failed.",
                        error
                    );
                });
            })
            .catch(function (error) {
                console.error(
                    "Meridian Updater: Service Worker registration failed.",
                    error
                );
            });
    });
})();

