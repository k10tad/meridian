//========================
// Meridian Backup
// Step 2: Export + Import / Recovery
//========================

(function () {
    "use strict";

    const BACKUP_FORMAT = "meridian-backup";
    const BACKUP_SCHEMA_VERSION = 1;
    const AUTO_SNAPSHOT_KEY = "meridianRecoverySnapshot";

    const exportButton = document.getElementById("backupExportButton");
    const exportStatus = document.getElementById("backupExportStatus");
    const storageCount = document.getElementById("backupStorageCount");

    const importInput = document.getElementById("backupImportInput");
    const importButton = document.getElementById("backupImportButton");
    const importStatus = document.getElementById("backupImportStatus");

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

    function buildBackupPayload() {
        const now = new Date();
        const storageData = readAllLocalStorage();

        return {
            format: BACKUP_FORMAT,
            schemaVersion: BACKUP_SCHEMA_VERSION,
            app: "Meridian",
            exportedAt: now.toISOString(),
            origin: window.location.origin,
            pathname: window.location.pathname,
            itemCount: Object.keys(storageData).length,
            localStorage: storageData
        };
    }

    function validateBackupPayload(payload) {
        if (!payload || typeof payload !== "object") {
            return "JSONの内容を読み取れない。";
        }

        if (payload.format !== BACKUP_FORMAT) {
            return "Meridian形式のバックアップではない。";
        }

        if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
            return "対応していないバックアップ形式だ。";
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
            const payload = buildBackupPayload();

            if (payload.itemCount === 0) {
                exportStatus.textContent =
                    "保存対象がまだない。PlannerやHealthを記録してから再実行してくれ。";
                return;
            }

            downloadBackup(payload);

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

    function saveAutomaticSnapshot() {
        const snapshot = {
            format: BACKUP_FORMAT,
            schemaVersion: BACKUP_SCHEMA_VERSION,
            createdAt: new Date().toISOString(),
            localStorage: readAllLocalStorage()
        };

        localStorage.setItem(
            AUTO_SNAPSHOT_KEY,
            JSON.stringify(snapshot)
        );
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
            saveAutomaticSnapshot();
            restoreLocalStorage(selectedBackup.localStorage);

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

    window.addEventListener("storage", updateStorageCount);

    if (
        sessionStorage.getItem("meridianRestoreCompleted") === "true"
    ) {
        sessionStorage.removeItem("meridianRestoreCompleted");

        importStatus.textContent =
            "バックアップから復元したデータを読み込んだ。";
    }

    updateStorageCount();
})();
