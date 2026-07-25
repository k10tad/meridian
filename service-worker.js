//========================
// Meridian Service Worker
// Updater Step 2
//========================

const MERIDIAN_SW_VERSION = "meridian-runtime-2.4.0-notification-foundation";
const MERIDIAN_ROOT = new URL("./", self.location.href).pathname;

self.addEventListener("install", function () {
    // The new worker waits until the user accepts the update.
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
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

self.addEventListener("notificationclick", function (event) {
    event.notification.close();

    const targetUrl = new URL(
        (event.notification.data && event.notification.data.url) || "./",
        self.registration.scope
    ).href;

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true })
            .then(function (clientList) {
                for (const client of clientList) {
                    if ("focus" in client) {
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }

                if (self.clients.openWindow) {
                    return self.clients.openWindow(targetUrl);
                }

                return undefined;
            })
    );
});

self.addEventListener("fetch", function (event) {
    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    const requestUrl = new URL(request.url);

    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        fetch(request, { cache: "no-store" })
            .then(function (response) {
                if (!response || response.status !== 200) {
                    return response;
                }

                const responseCopy = response.clone();

                caches.open(MERIDIAN_SW_VERSION).then(function (cache) {
                    cache.put(request, responseCopy);
                });

                return response;
            })
            .catch(function () {
                return caches.match(request).then(function (cachedResponse) {
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    if (request.mode === "navigate") {
                        return caches.match(MERIDIAN_ROOT);
                    }

                    return Response.error();
                });
            })
    );
});

