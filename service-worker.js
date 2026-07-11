//========================
// Meridian Service Worker
// Updater Step 1
//========================

const MERIDIAN_SW_VERSION = "meridian-sw-1.8.0-step1";

self.addEventListener("install", function () {
    // Activate the new worker without waiting for every old tab to close.
    self.skipWaiting();
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),

            // Only remove old Meridian caches.
            // localStorage / IndexedDB data are NOT touched.
            caches.keys().then(function (cacheNames) {
                return Promise.all(
                    cacheNames
                        .filter(function (cacheName) {
                            return (
                                cacheName.startsWith("meridian-") &&
                                cacheName !== MERIDIAN_SW_VERSION
                            );
                        })
                        .map(function (cacheName) {
                            return caches.delete(cacheName);
                        })
                );
            })
        ])
    );
});

self.addEventListener("message", function (event) {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

// Step 1 intentionally has no fetch handler.
// Meridian continues to load files from the network/browser cache normally.
// A controlled update strategy will be added in Updater Step 2.

