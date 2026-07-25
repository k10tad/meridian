//========================
// Meridian Notifications
// Stage 2: permission, settings and Push subscription
//========================

(function () {
    "use strict";

    const STORAGE_KEY = "meridian.notification.settings.v1";
    const DEVICE_KEY = "meridian.notification.device.v1";
    const DEFAULT_SETTINGS = {
        medication: true,
        planner: true,
        pressure: true
    };

    // The delivery service added in the next stage supplies these values.
    // Keeping them outside the application logic makes endpoint changes safe.
    const pushConfig = Object.assign({
        publicKey: "",
        registerUrl: "",
        unregisterUrl: ""
    }, window.MERIDIAN_PUSH_CONFIG || {});

    const permissionButton = document.getElementById("notificationPermissionButton");
    const testButton = document.getElementById("notificationTestButton");
    const status = document.getElementById("notificationStatus");
    const badge = document.getElementById("notificationPermissionBadge");
    const subscribeButton = document.getElementById("notificationSubscribeButton");
    const unsubscribeButton = document.getElementById("notificationUnsubscribeButton");
    const subscriptionBadge = document.getElementById("notificationSubscriptionBadge");
    const subscriptionStatus = document.getElementById("notificationSubscriptionStatus");
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

    function supportsPush() {
        return supportsNotifications() && "PushManager" in window;
    }

    function hasDeliveryConfig() {
        return Boolean(pushConfig.publicKey && pushConfig.registerUrl);
    }

    function setStatus(message) {
        status.textContent = message;
    }

    function setSubscriptionStatus(message) {
        if (subscriptionStatus) subscriptionStatus.textContent = message;
    }

    function urlBase64ToUint8Array(value) {
        const padding = "=".repeat((4 - value.length % 4) % 4);
        const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        return Uint8Array.from(rawData, function (character) {
            return character.charCodeAt(0);
        });
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

    async function postJson(url, payload) {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error("Push registration failed: " + response.status);
        }

        return response;
    }

    function buildDevicePayload(subscription) {
        return {
            subscription: subscription.toJSON(),
            settings: readSettings(),
            locale: navigator.language || "ja-JP",
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            userAgent: navigator.userAgent
        };
    }

    async function getSubscription() {
        if (!supportsPush()) return null;
        const registration = await getRegistration();
        return registration.pushManager.getSubscription();
    }

    async function renderSubscription() {
        if (!subscribeButton || !unsubscribeButton || !subscriptionBadge) return;

        if (!supportsPush()) {
            subscriptionBadge.textContent = "非対応";
            subscriptionBadge.dataset.state = "error";
            subscribeButton.disabled = true;
            setSubscriptionStatus("この環境ではPush通知の端末登録を利用できない。");
            return;
        }

        try {
            const subscription = await getSubscription();
            if (subscription) {
                subscriptionBadge.textContent = "登録済み";
                subscriptionBadge.dataset.state = "registered";
                subscribeButton.hidden = true;
                unsubscribeButton.hidden = false;
                unsubscribeButton.disabled = false;
                setSubscriptionStatus("この端末はPush通知の受信先として登録されている。");
                return;
            }

            subscriptionBadge.textContent = "未登録";
            subscriptionBadge.dataset.state = "idle";
            subscribeButton.hidden = false;
            unsubscribeButton.hidden = true;
            subscribeButton.disabled = Notification.permission !== "granted";

            if (Notification.permission !== "granted") {
                setSubscriptionStatus("先に通知を許可してくれ。");
            } else if (!hasDeliveryConfig()) {
                subscribeButton.disabled = true;
                setSubscriptionStatus("端末登録の準備は完了。次段階で送信先を接続すると登録できる。");
            } else {
                setSubscriptionStatus("この端末をPush通知の受信先として登録できる。");
            }
        } catch (error) {
            subscriptionBadge.textContent = "確認失敗";
            subscriptionBadge.dataset.state = "error";
            subscribeButton.disabled = true;
            setSubscriptionStatus("端末登録の状態を確認できなかった。再起動後にもう一度確認してくれ。");
        }
    }

    function renderPermission() {
        if (!supportsNotifications()) {
            badge.textContent = "非対応";
            badge.dataset.state = "denied";
            permissionButton.disabled = true;
            testButton.disabled = true;
            setStatus("このブラウザでは通知機能を利用できない。iPhoneではホーム画面版Meridianから開いてくれ。");
            renderSubscription();
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
            renderSubscription();
            return;
        }

        testButton.disabled = true;
        permissionButton.disabled = false;

        if (permission === "denied") {
            badge.textContent = "拒否";
            permissionButton.textContent = "通知設定を確認";
            setStatus("通知が拒否されている。iPhoneの設定からMeridianの通知を許可してくれ。");
        } else {
            badge.textContent = "未許可";
            permissionButton.textContent = "通知を許可";
            setStatus(isStandalone()
                ? "通知を許可すると、Commanderのテスト通知を受け取れる。"
                : "iPhoneではMeridianをホーム画面へ追加し、そのアイコンから開いて通知を許可してくれ。");
        }

        renderSubscription();
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
            if (permission === "granted") await getRegistration();
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
                data: { url: "./" }
            });
            setStatus("テスト通知を送信した。ロック画面または通知センターを確認してくれ。");
        } catch (error) {
            setStatus("テスト通知を送れなかった。Meridianを一度閉じて開き直してから再試行してくれ。");
        } finally {
            testButton.disabled = false;
        }
    }

    async function subscribeDevice() {
        if (!hasDeliveryConfig()) {
            setSubscriptionStatus("送信先がまだ未接続だ。次段階で接続してから登録できる。");
            return;
        }

        subscribeButton.disabled = true;
        setSubscriptionStatus("この端末を登録している。");

        try {
            const registration = await getRegistration();
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(pushConfig.publicKey)
                });
            }

            await postJson(pushConfig.registerUrl, buildDevicePayload(subscription));
            localStorage.setItem(DEVICE_KEY, JSON.stringify({
                endpoint: subscription.endpoint,
                registeredAt: new Date().toISOString()
            }));
            await renderSubscription();
        } catch (error) {
            subscriptionBadge.textContent = "登録失敗";
            subscriptionBadge.dataset.state = "error";
            subscribeButton.disabled = false;
            setSubscriptionStatus("端末を登録できなかった。通信状態を確認して、もう一度試してくれ。");
        }
    }

    async function unsubscribeDevice() {
        unsubscribeButton.disabled = true;
        setSubscriptionStatus("この端末の登録を解除している。");

        try {
            const subscription = await getSubscription();
            if (subscription && pushConfig.unregisterUrl) {
                await postJson(pushConfig.unregisterUrl, {
                    endpoint: subscription.endpoint
                });
            }
            if (subscription) await subscription.unsubscribe();
            localStorage.removeItem(DEVICE_KEY);
            await renderSubscription();
        } catch (error) {
            unsubscribeButton.disabled = false;
            setSubscriptionStatus("登録を解除できなかった。通信状態を確認して、もう一度試してくれ。");
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
    if (subscribeButton) subscribeButton.addEventListener("click", subscribeDevice);
    if (unsubscribeButton) unsubscribeButton.addEventListener("click", unsubscribeDevice);

    window.MeridianNotifications = {
        getSettings: readSettings,
        requestPermission: requestPermission,
        sendTest: sendTestNotification,
        getSubscription: getSubscription,
        subscribeDevice: subscribeDevice,
        unsubscribeDevice: unsubscribeDevice
    };

    renderPermission();
})();
