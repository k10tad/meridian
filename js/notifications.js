//========================
// Meridian Notifications
// Foundation: permission, test, settings
//========================

(function () {
    "use strict";

    const STORAGE_KEY = "meridian.notification.settings.v1";
    const DEFAULT_SETTINGS = {
        medication: true,
        planner: true,
        pressure: true
    };

    const permissionButton = document.getElementById("notificationPermissionButton");
    const testButton = document.getElementById("notificationTestButton");
    const status = document.getElementById("notificationStatus");
    const badge = document.getElementById("notificationPermissionBadge");
    const settingInputs = document.querySelectorAll("[data-notification-setting]");

    if (!permissionButton || !testButton || !status || !badge) return;

    function readSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            return Object.assign({}, DEFAULT_SETTINGS, saved);
        } catch (error) {
            return Object.assign({}, DEFAULT_SETTINGS);
        }
    }

    function saveSettings(settings) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        window.dispatchEvent(new CustomEvent("meridian:notification-settings", {
            detail: settings
        }));
    }

    function isStandalone() {
        return window.matchMedia("(display-mode: standalone)").matches ||
            window.navigator.standalone === true;
    }

    function supportsNotifications() {
        return "Notification" in window && "serviceWorker" in navigator;
    }

    function setStatus(message) {
        status.textContent = message;
    }

    function renderPermission() {
        if (!supportsNotifications()) {
            badge.textContent = "非対応";
            badge.dataset.state = "denied";
            permissionButton.disabled = true;
            testButton.disabled = true;
            setStatus("このブラウザでは通知機能を利用できない。iPhoneではホーム画面版Meridianから開いてくれ。");
            return;
        }

        const permission = Notification.permission;
        badge.dataset.state = permission;

        if (permission === "granted") {
            badge.textContent = "許可済み";
            permissionButton.textContent = "通知は許可済み";
            permissionButton.disabled = true;
            testButton.disabled = false;
            setStatus("通知の準備はできている。テスト通知でCommanderとの通信を確認できる。");
            return;
        }

        testButton.disabled = true;
        permissionButton.disabled = false;

        if (permission === "denied") {
            badge.textContent = "拒否";
            permissionButton.textContent = "通知設定を確認";
            setStatus("通知が拒否されている。iPhoneの設定からMeridianの通知を許可してくれ。");
            return;
        }

        badge.textContent = "未許可";
        permissionButton.textContent = "通知を許可";
        setStatus(isStandalone()
            ? "通知を許可すると、Commanderのテスト通知を受け取れる。"
            : "iPhoneではMeridianをホーム画面へ追加し、そのアイコンから開いて通知を許可してくれ。");
    }

    async function getRegistration() {
        const existing = await navigator.serviceWorker.getRegistration();
        if (existing) return existing;

        const registration = await navigator.serviceWorker.register("./service-worker.js", {
            updateViaCache: "none"
        });
        await navigator.serviceWorker.ready;
        return registration;
    }

    async function requestPermission() {
        if (!supportsNotifications()) {
            renderPermission();
            return;
        }

        if (!isStandalone() && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            setStatus("Safariの共有メニューから「ホーム画面に追加」し、追加したMeridianを開いて操作してくれ。");
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                await getRegistration();
            }
            renderPermission();
        } catch (error) {
            setStatus("通知の許可処理に失敗した。通信状態を確認して、もう一度試してくれ。");
        }
    }

    async function sendTestNotification() {
        if (Notification.permission !== "granted") {
            renderPermission();
            return;
        }

        testButton.disabled = true;
        setStatus("テスト通知を送信している。");

        try {
            const registration = await getRegistration();
            await registration.showNotification("MERIDIAN // Commander", {
                body: "通信確認。通知経路は正常だ、レイ。",
                icon: "./assets/icons/icon-192.png",
                badge: "./assets/icons/icon-192.png",
                tag: "meridian-notification-test",
                renotify: true,
                data: {
                    url: "./"
                }
            });
            setStatus("テスト通知を送信した。ロック画面または通知センターを確認してくれ。");
        } catch (error) {
            setStatus("テスト通知を送れなかった。Meridianを一度閉じて開き直してから再試行してくれ。");
        } finally {
            testButton.disabled = false;
        }
    }

    const settings = readSettings();
    settingInputs.forEach(function (input) {
        const key = input.dataset.notificationSetting;
        input.checked = settings[key] !== false;
        input.addEventListener("change", function () {
            settings[key] = input.checked;
            saveSettings(settings);
        });
    });

    permissionButton.addEventListener("click", requestPermission);
    testButton.addEventListener("click", sendTestNotification);

    window.MeridianNotifications = {
        getSettings: readSettings,
        requestPermission: requestPermission,
        sendTest: sendTestNotification
    };

    renderPermission();
})();
