//========================
// Meridian Updater
// Step 2: Version check and update prompt
//========================

(function () {
    "use strict";

    const VERSION_URL = "./data/version.json";
    const INSTALLED_VERSION_KEY = "meridianInstalledVersion";
    const DISMISSED_VERSION_KEY = "meridianDismissedVersion";

    const modal = document.getElementById("meridianUpdateModal");
    const versionText = document.getElementById("meridianUpdateVersion");
    const notesList = document.getElementById("meridianUpdateNotes");
    const statusText = document.getElementById("meridianUpdateStatus");
    const laterButton = document.getElementById("meridianUpdateLaterButton");
    const updateButton = document.getElementById("meridianUpdateNowButton");

    let registration = null;
    let availableVersion = null;
    let reloadRequested = false;

    function compareVersions(left, right) {
        const leftParts = String(left || "0")
            .split(".")
            .map(function (part) {
                return Number(part) || 0;
            });

        const rightParts = String(right || "0")
            .split(".")
            .map(function (part) {
                return Number(part) || 0;
            });

        const length = Math.max(leftParts.length, rightParts.length);

        for (let index = 0; index < length; index += 1) {
            const leftValue = leftParts[index] || 0;
            const rightValue = rightParts[index] || 0;

            if (leftValue > rightValue) return 1;
            if (leftValue < rightValue) return -1;
        }

        return 0;
    }

    function showModal(versionData) {
        if (!modal) return;

        availableVersion = versionData;
        versionText.textContent = "Version " + versionData.version;
        notesList.innerHTML = "";

        (versionData.notes || []).forEach(function (note) {
            const item = document.createElement("li");
            item.textContent = note;
            notesList.appendChild(item);
        });

        statusText.textContent =
            "更新しても、Planner・Health・Relationship・Vestigeなどの保存データは消えない。";

        updateButton.disabled = false;
        laterButton.disabled = false;
        updateButton.textContent = "更新";

        modal.classList.remove("hidden");
    }

    function hideModal() {
        if (modal) {
            modal.classList.add("hidden");
        }
    }

    async function fetchVersion() {
        const separator = VERSION_URL.includes("?") ? "&" : "?";
        const response = await fetch(
            VERSION_URL + separator + "t=" + Date.now(),
            {
                cache: "no-store",
                headers: {
                    "Cache-Control": "no-cache"
                }
            }
        );

        if (!response.ok) {
            throw new Error("Version file could not be loaded.");
        }

        return response.json();
    }

    async function checkForUpdate() {
        try {
            const versionData = await fetchVersion();
            const installedVersion =
                localStorage.getItem(INSTALLED_VERSION_KEY);
            const dismissedVersion =
                sessionStorage.getItem(DISMISSED_VERSION_KEY);

            if (!installedVersion) {
                localStorage.setItem(
                    INSTALLED_VERSION_KEY,
                    versionData.version
                );
                return;
            }

            if (
                compareVersions(versionData.version, installedVersion) > 0 &&
                dismissedVersion !== versionData.version
            ) {
                showModal(versionData);
            }
        } catch (error) {
            console.warn(
                "Meridian Updater: version check failed.",
                error
            );
        }
    }

    async function clearMeridianCaches() {
        if (!("caches" in window)) return;

        const cacheNames = await caches.keys();

        await Promise.all(
            cacheNames
                .filter(function (cacheName) {
                    return cacheName.startsWith("meridian-");
                })
                .map(function (cacheName) {
                    return caches.delete(cacheName);
                })
        );
    }

    function reloadToLatestVersion() {
        if (reloadRequested) return;
        reloadRequested = true;

        const version = availableVersion
            ? availableVersion.version
            : Date.now();

        if (availableVersion) {
            localStorage.setItem(INSTALLED_VERSION_KEY, version);
        }

        const url = new URL(window.location.href);
        url.searchParams.set("meridianUpdate", version);
        window.location.replace(url.toString());
    }

    async function applyUpdate() {
        if (!availableVersion) return;

        updateButton.disabled = true;
        laterButton.disabled = true;
        updateButton.textContent = "更新中...";
        statusText.textContent =
            "最新版を取得している。保存データには触れない。";

        try {
            await clearMeridianCaches();

            if (registration) {
                await registration.update();

                if (registration.waiting) {
                    registration.waiting.postMessage({
                        type: "SKIP_WAITING"
                    });
                    return;
                }
            }

            reloadToLatestVersion();
        } catch (error) {
            console.error(
                "Meridian Updater: update failed.",
                error
            );

            statusText.textContent =
                "更新に失敗した。通信を確認して、もう一度試してくれ。";

            updateButton.disabled = false;
            laterButton.disabled = false;
            updateButton.textContent = "再試行";
        }
    }

    function watchRegistration(swRegistration) {
        registration = swRegistration;

        if (registration.waiting) {
            checkForUpdate();
        }

        registration.addEventListener("updatefound", function () {
            const installingWorker = registration.installing;

            if (!installingWorker) return;

            installingWorker.addEventListener("statechange", function () {
                if (
                    installingWorker.state === "installed" &&
                    navigator.serviceWorker.controller
                ) {
                    checkForUpdate();
                }
            });
        });
    }

    if (laterButton) {
        laterButton.addEventListener("click", function () {
            if (availableVersion) {
                sessionStorage.setItem(
                    DISMISSED_VERSION_KEY,
                    availableVersion.version
                );
            }

            hideModal();
        });
    }

    if (updateButton) {
        updateButton.addEventListener("click", applyUpdate);
    }

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener(
            "controllerchange",
            reloadToLatestVersion
        );

        window.addEventListener("load", function () {
            navigator.serviceWorker
                .register("./service-worker.js", {
                    scope: "./",
                    updateViaCache: "none"
                })
                .then(function (swRegistration) {
                    console.info(
                        "Meridian Updater: Service Worker registered.",
                        swRegistration.scope
                    );

                    watchRegistration(swRegistration);
                    return swRegistration.update();
                })
                .then(function () {
                    return checkForUpdate();
                })
                .catch(function (error) {
                    console.error(
                        "Meridian Updater: initialization failed.",
                        error
                    );
                });
        });
    }
})();
