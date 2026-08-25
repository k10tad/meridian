//========================
// Meridian Backup
// Step 2: Export + Import / Recovery
//========================

(function () {
    "use strict";

    const BACKUP_FORMAT = "meridian-backup";
    const BACKUP_SCHEMA_VERSION = 3;
    const AUTO_SNAPSHOT_KEY = "meridianRecoverySnapshot";
    const LAST_VERIFIED_KEY = "meridianLastVerifiedBackup";
    const DESK_ASSET_ID = "desk-commander";
    const DESK_RECOVERY_ASSET_ID = "desk-commander-recovery";

    const exportButton = document.getElementById("backupExportButton");
    const exportStatus = document.getElementById("backupExportStatus");
    const storageCount = document.getElementById("backupStorageCount");

    const importInput = document.getElementById("backupImportInput");
    const importButton = document.getElementById("backupImportButton");
    const importStatus = document.getElementById("backupImportStatus");
    const recoveryButton = document.getElementById("backupRecoveryButton");
    const recoveryStatus = document.getElementById("backupRecoveryStatus");
    const lastVerified = document.getElementById("backupLastVerified");

    if (
        !exportButton ||
        !exportStatus ||
        !storageCount ||
        !importInput ||
        !importButton ||
        !importStatus
    ) {
        console.warn("Meridian Backup: required elements were not found.");
        return;
    }

    let selectedBackup = null;

    function fingerprint(data) {
        const text = JSON.stringify(data);
        let hash = 2166136261;
        for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
        return (hash >>> 0).toString(16).padStart(8, "0");
    }

    function numberOr(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function getLocalDateStamp(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");

        return (
            year + "-" +
            month + "-" +
            day + "_" +
            hours + "-" +
            minutes
        );
    }

    function readAllLocalStorage() {
        const data = {};

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);

            if (key !== null && key !== AUTO_SNAPSHOT_KEY) {
                data[key] = localStorage.getItem(key);
            }
        }

        return data;
    }

    function blobToDataUrl(blob) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.addEventListener("load", function () {
                resolve(String(reader.result));
            });
            reader.addEventListener("error", function () {
                reject(new Error("Desk画像をバックアップへ追加できなかった。"));
            });
            reader.readAsDataURL(blob);
        });
    }

    function dataUrlToBlob(dataUrl) {
        const parts = String(dataUrl || "").split(",");
        const match = parts[0] && parts[0].match(/^data:([^;]+);base64$/);
        if (!match || !parts[1]) {
            throw new Error("バックアップ内のDesk画像を読み取れない。");
        }
        const binary = atob(parts[1]);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return new Blob([bytes], { type: match[1] });
    }

    async function readDeskAssetForBackup() {
        if (!window.MeridianPhotoDB || typeof window.MeridianPhotoDB.getAsset !== "function") {
            return null;
        }
        const asset = await window.MeridianPhotoDB.getAsset(DESK_ASSET_ID);
        if (!asset || !asset.blob) {
            return null;
        }
        return {
            id: DESK_ASSET_ID,
            updatedAt: asset.updatedAt || new Date().toISOString(),
            mimeType: asset.mimeType || asset.blob.type || "image/jpeg",
            width: Number(asset.width) || 0,
            height: Number(asset.height) || 0,
            size: Number(asset.size) || asset.blob.size,
            positionX: numberOr(asset.positionX, 50),
            positionY: numberOr(asset.positionY, 36),
            zoom: numberOr(asset.zoom, 100),
            dataUrl: await blobToDataUrl(asset.blob)
        };
    }

    function integritySource(localStorageData, assets) {
        return {
            localStorage: localStorageData,
            assets: assets || {}
        };
    }

    async function buildBackupPayload() {
        const now = new Date();
        const storageData = readAllLocalStorage();
        const deskImage = await readDeskAssetForBackup();
        const assets = deskImage ? { deskImage: deskImage } : {};

        const payload = {
            format: BACKUP_FORMAT,
            schemaVersion: BACKUP_SCHEMA_VERSION,
            app: "Meridian",
            exportedAt: now.toISOString(),
            origin: window.location.origin,
            pathname: window.location.pathname,
            itemCount: Object.keys(storageData).length + (deskImage ? 1 : 0),
            localStorage: storageData,
            assets: assets,
            integrity: { algorithm: "FNV1A-32", value: fingerprint(integritySource(storageData, assets)) }
        };
        return payload;
    }

    function validateBackupPayload(payload) {
        if (!payload || typeof payload !== "object") {
            return "JSONの内容を読み取れない。";
        }

        if (payload.format !== BACKUP_FORMAT) {
            return "Meridian形式のバックアップではない。";
        }

        if (![1, 2, BACKUP_SCHEMA_VERSION].includes(payload.schemaVersion)) {
            return "対応していないバックアップ形式だ。";
        }

        const expectedIntegrity = payload.schemaVersion >= 3
            ? fingerprint(integritySource(payload.localStorage, payload.assets))
            : fingerprint(payload.localStorage);

        if (payload.schemaVersion >= 2 && (!payload.integrity || payload.integrity.value !== expectedIntegrity)) {
            return "バックアップの整合性を確認できない。内容が欠損または変更されている。";
        }

        if (
            !payload.localStorage ||
            typeof payload.localStorage !== "object" ||
            Array.isArray(payload.localStorage)
        ) {
            return "localStorageデータが見つからない。";
        }

        return "";
    }

    function updateStorageCount() {
        const count = localStorage.length;

        storageCount.textContent =
            count + (count === 1 ? " item" : " items");
    }

    function downloadBackup(payload) {
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], {
            type: "application/json;charset=utf-8"
        });

        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = objectUrl;
        link.download =
            "meridian-backup_" +
            getLocalDateStamp(new Date()) +
            ".json";

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.setTimeout(function () {
            URL.revokeObjectURL(objectUrl);
        }, 1000);
    }

    async function exportBackup() {
        exportButton.disabled = true;
        exportButton.textContent = "Exporting...";
        exportStatus.textContent =
            "保存データを読み取っている。アプリ内のデータは変更しない。";

        try {
            const payload = await buildBackupPayload();

            if (payload.itemCount === 0) {
                exportStatus.textContent =
                    "保存対象がまだない。PlannerやHealthを記録してから再実行してくれ。";
                return;
            }

            downloadBackup(payload);
            localStorage.setItem(LAST_VERIFIED_KEY, payload.exportedAt);
            updateIntegrityStatus();

            exportStatus.textContent =
                payload.itemCount +
                "件の保存データを書き出した。ファイルアプリまたはダウンロードを確認してくれ。";
        } catch (error) {
            console.error("Meridian Backup: export failed.", error);

            exportStatus.textContent =
                "バックアップの作成に失敗した。もう一度試してくれ。";
        } finally {
            exportButton.disabled = false;
            exportButton.textContent = "Export Backup";
            updateStorageCount();
        }
    }

    async function saveAutomaticSnapshot() {
        const snapshot = {
            format: BACKUP_FORMAT,
            schemaVersion: BACKUP_SCHEMA_VERSION,
            createdAt: new Date().toISOString(),
            localStorage: readAllLocalStorage()
        };
        if (window.MeridianPhotoDB && typeof window.MeridianPhotoDB.getAsset === "function") {
            const currentAsset = await window.MeridianPhotoDB.getAsset(DESK_ASSET_ID);
            snapshot.deskAssetPresent = Boolean(currentAsset && currentAsset.blob);
            if (currentAsset && currentAsset.blob) {
                await window.MeridianPhotoDB.putAsset(Object.assign({}, currentAsset, {
                    id: DESK_RECOVERY_ASSET_ID
                }));
            } else {
                await window.MeridianPhotoDB.deleteAsset(DESK_RECOVERY_ASSET_ID);
            }
        }

        snapshot.integrity = { algorithm: "FNV1A-32", value: fingerprint(snapshot.localStorage) };
        localStorage.setItem(
            AUTO_SNAPSHOT_KEY,
            JSON.stringify(snapshot)
        );
    }

    function updateIntegrityStatus() {
        const stamp = localStorage.getItem(LAST_VERIFIED_KEY);
        if (lastVerified) lastVerified.textContent = stamp ? new Date(stamp).toLocaleString("ja-JP") : "未作成";
        if (recoveryButton) recoveryButton.disabled = !localStorage.getItem(AUTO_SNAPSHOT_KEY);
    }

    async function restoreRecoverySnapshot() {
        let snapshot=null; try { snapshot=JSON.parse(localStorage.getItem(AUTO_SNAPSHOT_KEY)); } catch (_) {}
        if (!snapshot || !snapshot.localStorage || snapshot.integrity?.value !== fingerprint(snapshot.localStorage)) {
            if (recoveryStatus) recoveryStatus.textContent="復元前退避を検証できない。現在データは変更しない。";
            return;
        }
        if (!window.confirm("直前の復元操作より前の状態へ戻します。現在の状態は上書きされます。続行しますか？")) return;
        const recoveryAsset = window.MeridianPhotoDB && typeof window.MeridianPhotoDB.getAsset === "function"
            ? await window.MeridianPhotoDB.getAsset(DESK_RECOVERY_ASSET_ID)
            : null;
        if (recoveryAsset && recoveryAsset.blob) {
            await window.MeridianPhotoDB.putAsset(Object.assign({}, recoveryAsset, { id: DESK_ASSET_ID }));
        } else if (snapshot.deskAssetPresent === false && window.MeridianPhotoDB) {
            await window.MeridianPhotoDB.deleteAsset(DESK_ASSET_ID);
        }
        restoreLocalStorage(snapshot.localStorage); sessionStorage.setItem("meridianRestoreCompleted","true"); window.location.reload();
    }

    async function restoreDeskAsset(payload) {
        const deskImage = payload && payload.assets && payload.assets.deskImage;
        if (!deskImage) {
            return false;
        }
        if (!window.MeridianPhotoDB || typeof window.MeridianPhotoDB.putAsset !== "function") {
            throw new Error("Desk画像の保管庫を開けない。");
        }
        const blob = dataUrlToBlob(deskImage.dataUrl);
        await window.MeridianPhotoDB.putAsset({
            id: DESK_ASSET_ID,
            updatedAt: deskImage.updatedAt || new Date().toISOString(),
            mimeType: deskImage.mimeType || blob.type || "image/jpeg",
            width: Number(deskImage.width) || 0,
            height: Number(deskImage.height) || 0,
            size: blob.size,
            positionX: numberOr(deskImage.positionX, 50),
            positionY: numberOr(deskImage.positionY, 36),
            zoom: numberOr(deskImage.zoom, 100),
            blob: blob
        });
        return true;
    }

    function restoreLocalStorage(storageData) {
        const preservedSnapshot = localStorage.getItem(AUTO_SNAPSHOT_KEY);

        localStorage.clear();

        if (preservedSnapshot !== null) {
            localStorage.setItem(
                AUTO_SNAPSHOT_KEY,
                preservedSnapshot
            );
        }

        Object.entries(storageData).forEach(function ([key, value]) {
            if (typeof value === "string") {
                localStorage.setItem(key, value);
            } else if (value !== null && value !== undefined) {
                localStorage.setItem(key, String(value));
            }
        });
    }

    function readBackupFile(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();

            reader.addEventListener("load", function () {
                try {
                    resolve(JSON.parse(String(reader.result)));
                } catch (error) {
                    reject(new Error("JSONの解析に失敗した。"));
                }
            });

            reader.addEventListener("error", function () {
                reject(new Error("ファイルを読み取れなかった。"));
            });

            reader.readAsText(file, "utf-8");
        });
    }

    async function handleBackupSelection() {
        const file = importInput.files && importInput.files[0];

        selectedBackup = null;
        importButton.disabled = true;

        if (!file) {
            importStatus.textContent =
                "Meridian形式のJSONだけ復元できる。";
            return;
        }

        importStatus.textContent =
            "バックアップ内容を確認している。";

        try {
            const payload = await readBackupFile(file);
            const validationError = validateBackupPayload(payload);

            if (validationError) {
                importStatus.textContent = validationError;
                return;
            }

            selectedBackup = payload;
            importButton.disabled = false;

            importStatus.textContent =
                payload.itemCount +
                "件の保存データを確認した。復元すると現在データは自動退避される。";
        } catch (error) {
            console.error(
                "Meridian Backup: file validation failed.",
                error
            );

            importStatus.textContent = error.message;
        }
    }

    function confirmRestore(payload) {
        const exportedAt = payload.exportedAt
            ? new Date(payload.exportedAt).toLocaleString("ja-JP")
            : "日時不明";

        return window.confirm(
            "このバックアップを復元します。\n\n" +
            "保存日時: " + exportedAt + "\n" +
            "データ件数: " + payload.itemCount + "\n\n" +
            "現在のデータは復元前スナップショットとして端末内に退避されます。続行しますか？"
        );
    }

    async function importBackup() {
        if (!selectedBackup) {
            importStatus.textContent =
                "先にバックアップJSONを選択してくれ。";
            return;
        }

        if (!confirmRestore(selectedBackup)) {
            importStatus.textContent = "復元を中止した。";
            return;
        }

        importButton.disabled = true;
        exportButton.disabled = true;
        importButton.textContent = "Restoring...";
        importStatus.textContent =
            "現在データを退避してから復元している。";

        try {
            await saveAutomaticSnapshot();
            restoreLocalStorage(selectedBackup.localStorage);
            await restoreDeskAsset(selectedBackup);

            sessionStorage.setItem(
                "meridianRestoreCompleted",
                "true"
            );

            importStatus.textContent =
                "復元が完了した。Meridianを再起動する。";

            window.setTimeout(function () {
                window.location.reload();
            }, 900);
        } catch (error) {
            console.error("Meridian Backup: restore failed.", error);

            importStatus.textContent =
                "復元に失敗した。現在データは変更されていないか、自動退避から戻せる。";

            importButton.disabled = false;
            exportButton.disabled = false;
            importButton.textContent = "Restore Backup";
        }
    }

    exportButton.addEventListener("click", exportBackup);
    importInput.addEventListener("change", handleBackupSelection);
    importButton.addEventListener("click", importBackup);
    if (recoveryButton) recoveryButton.addEventListener("click", restoreRecoverySnapshot);

    window.addEventListener("storage", updateStorageCount);

    if (
        sessionStorage.getItem("meridianRestoreCompleted") === "true"
    ) {
        sessionStorage.removeItem("meridianRestoreCompleted");

        importStatus.textContent =
            "バックアップから復元したデータを読み込んだ。";
    }

    updateStorageCount();
    updateIntegrityStatus();
})();
