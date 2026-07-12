//========================
// Meridian Photo Restore
// Phase 1: validate + merge restore
//========================

(function () {
    "use strict";

    const BACKUP_FORMAT = "meridian-photo-backup";
    const SCHEMA_VERSION = 1;

    const input = document.getElementById("photoRestoreInput");
    const restoreButton = document.getElementById("photoRestoreButton");
    const statusText = document.getElementById("photoRestoreStatus");

    if (!input || !restoreButton || !statusText) {
        console.warn(
            "Meridian Photo Restore: required elements were not found."
        );
        return;
    }

    if (
        !window.MeridianPhotoDB ||
        typeof window.MeridianPhotoDB.getAll !== "function" ||
        typeof window.MeridianPhotoDB.add !== "function"
    ) {
        console.error(
            "Meridian Photo Restore: Photo DB is unavailable."
        );

        statusText.textContent =
            "写真保管庫を読み込めなかった。";

        return;
    }

    let selectedBackup = null;

    function readUint16(view, offset) {
        return view.getUint16(offset, true);
    }

    function readUint32(view, offset) {
        return view.getUint32(offset, true);
    }

    function decodeText(bytes) {
        return new TextDecoder("utf-8").decode(bytes);
    }

    function parseStoredZip(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(arrayBuffer);
        const entries = new Map();

        let offset = 0;

        while (offset + 4 <= bytes.length) {
            const signature = readUint32(view, offset);

            if (
                signature === 0x02014b50 ||
                signature === 0x06054b50
            ) {
                break;
            }

            if (signature !== 0x04034b50) {
                throw new Error(
                    "ZIP構造を読み取れない。Meridianが作成した写真バックアップを選択してくれ。"
                );
            }

            const flags = readUint16(view, offset + 6);
            const compressionMethod = readUint16(view, offset + 8);
            const compressedSize = readUint32(view, offset + 18);
            const fileNameLength = readUint16(view, offset + 26);
            const extraLength = readUint16(view, offset + 28);

            if (flags & 0x0008) {
                throw new Error(
                    "データ記述子付きZIPには対応していない。"
                );
            }

            if (compressionMethod !== 0) {
                throw new Error(
                    "圧縮形式が一致しない。Meridian Photo Backup ZIPを選択してくれ。"
                );
            }

            const nameStart = offset + 30;
            const nameEnd = nameStart + fileNameLength;
            const dataStart = nameEnd + extraLength;
            const dataEnd = dataStart + compressedSize;

            if (dataEnd > bytes.length) {
                throw new Error(
                    "ZIPが途中で破損している。"
                );
            }

            const name = decodeText(
                bytes.slice(nameStart, nameEnd)
            );

            entries.set(
                name,
                bytes.slice(dataStart, dataEnd)
            );

            offset = dataEnd;
        }

        return entries;
    }

    function parseJsonEntry(entries, name) {
        const bytes = entries.get(name);

        if (!bytes) {
            throw new Error(name + " がZIP内に見つからない。");
        }

        try {
            return JSON.parse(decodeText(bytes));
        } catch (error) {
            throw new Error(name + " のJSONを解析できない。");
        }
    }

    function validateBackup(entries) {
        const manifest = parseJsonEntry(entries, "manifest.json");
        const photosPayload = parseJsonEntry(entries, "photos.json");

        if (
            manifest.format !== BACKUP_FORMAT ||
            photosPayload.format !== BACKUP_FORMAT
        ) {
            throw new Error(
                "Meridian Photo Backup形式ではない。"
            );
        }

        if (
            manifest.schemaVersion !== SCHEMA_VERSION ||
            photosPayload.schemaVersion !== SCHEMA_VERSION
        ) {
            throw new Error(
                "対応していない写真バックアップ形式だ。"
            );
        }

        if (!Array.isArray(photosPayload.photos)) {
            throw new Error(
                "写真メタデータが見つからない。"
            );
        }

        if (
            Number(manifest.photoCount) !==
            photosPayload.photos.length
        ) {
            throw new Error(
                "manifestの写真件数とphotos.jsonが一致しない。"
            );
        }

        const ids = new Set();
        const dates = new Set();

        photosPayload.photos.forEach(function (photo) {
            if (
                !photo ||
                !photo.id ||
                !photo.dateKey ||
                !photo.backupFile
            ) {
                throw new Error(
                    "写真メタデータに必要な項目がない。"
                );
            }

            if (ids.has(photo.id)) {
                throw new Error(
                    "同じ写真IDが重複している。"
                );
            }

            if (dates.has(photo.dateKey)) {
                throw new Error(
                    "同じ日付の写真がバックアップ内で重複している。"
                );
            }

            if (!entries.has(photo.backupFile)) {
                throw new Error(
                    photo.backupFile +
                    " がZIP内に見つからない。"
                );
            }

            ids.add(photo.id);
            dates.add(photo.dateKey);
        });

        return {
            manifest: manifest,
            photos: photosPayload.photos,
            entries: entries
        };
    }

    function buildPhotoRecord(metadata, bytes) {
        const mimeType =
            metadata.mimeType || "image/jpeg";

        const blob = new Blob(
            [bytes],
            {
                type: mimeType
            }
        );

        return {
            id: metadata.id,
            createdAt:
                metadata.createdAt ||
                new Date().toISOString(),
            dateKey: metadata.dateKey,
            vestigeRecordId:
                metadata.vestigeRecordId || null,
            fileName:
                metadata.fileName || "photo.jpg",
            originalMimeType:
                metadata.originalMimeType ||
                mimeType,
            mimeType: mimeType,
            width:
                Number(metadata.width) || 0,
            height:
                Number(metadata.height) || 0,
            size: blob.size,
            blob: blob,
            memo: metadata.memo || ""
        };
    }

    async function selectBackup() {
        const file =
            input.files &&
            input.files[0];

        selectedBackup = null;
        restoreButton.disabled = true;

        if (!file) {
            statusText.textContent =
                "復元するMeridian Photo Backup ZIPを選択してくれ。";
            return;
        }

        statusText.textContent =
            "ZIPの内容と写真件数を検証している。";

        try {
            const entries = parseStoredZip(
                await file.arrayBuffer()
            );

            selectedBackup =
                validateBackup(entries);

            restoreButton.disabled = false;

            statusText.textContent =
                selectedBackup.photos.length +
                "枚を確認した。既存写真は削除せず、重複はスキップして復元する。";
        } catch (error) {
            console.error(
                "Meridian Photo Restore: validation failed.",
                error
            );

            statusText.textContent =
                error.message ||
                "写真バックアップを検証できなかった。";
        }
    }

    async function createEmergencyBackupIfNeeded() {
        const currentPhotos =
            await window.MeridianPhotoDB.getAll();

        if (currentPhotos.length === 0) {
            return;
        }

        if (
            !window.MeridianPhotoBackup ||
            typeof window.MeridianPhotoBackup.exportNow !== "function"
        ) {
            throw new Error(
                "現在写真の緊急バックアップ機能を起動できない。"
            );
        }

        await window.MeridianPhotoBackup.exportNow({
            filePrefix: "MeridianPhotoEmergency_",
            silent: true
        });
    }

    async function restorePhotos() {
        if (!selectedBackup) {
            statusText.textContent =
                "先に写真バックアップZIPを選択してくれ。";
            return;
        }

        const confirmed = window.confirm(
            selectedBackup.photos.length +
            "枚の写真を復元します。\n\n" +
            "既存写真は削除しません。\n" +
            "同じIDまたは同じ日付の写真はスキップします。\n" +
            "復元前に現在写真の緊急バックアップZIPを作成します。\n\n" +
            "続行しますか？"
        );

        if (!confirmed) {
            statusText.textContent =
                "写真の復元を中止した。";
            return;
        }

        restoreButton.disabled = true;
        restoreButton.textContent = "Restoring...";
        statusText.textContent =
            "現在写真を退避してから復元している。";

        try {
            await createEmergencyBackupIfNeeded();

            const existingPhotos =
                await window.MeridianPhotoDB.getAll();

            const existingIds = new Set(
                existingPhotos.map(function (photo) {
                    return String(photo.id);
                })
            );

            const existingDates = new Set(
                existingPhotos.map(function (photo) {
                    return String(photo.dateKey);
                })
            );

            let restored = 0;
            let skipped = 0;

            for (const metadata of selectedBackup.photos) {
                if (
                    existingIds.has(String(metadata.id)) ||
                    existingDates.has(String(metadata.dateKey))
                ) {
                    skipped += 1;
                    continue;
                }

                const bytes =
                    selectedBackup.entries.get(
                        metadata.backupFile
                    );

                const record =
                    buildPhotoRecord(
                        metadata,
                        bytes
                    );

                await window.MeridianPhotoDB.add(record);

                existingIds.add(String(record.id));
                existingDates.add(String(record.dateKey));
                restored += 1;
            }

            statusText.textContent =
                restored +
                "枚を復元し、" +
                skipped +
                "枚の重複をスキップした。";

            window.dispatchEvent(
                new CustomEvent(
                    "meridianVestigePhotoUpdated",
                    {
                        detail: {
                            action: "restored",
                            restored: restored,
                            skipped: skipped
                        }
                    }
                )
            );

            if (
                window.MeridianPhotoBackup &&
                typeof window.MeridianPhotoBackup.refreshCount === "function"
            ) {
                window.MeridianPhotoBackup.refreshCount();
            }

            input.value = "";
            selectedBackup = null;
        } catch (error) {
            console.error(
                "Meridian Photo Restore: restore failed.",
                error
            );

            statusText.textContent =
                error.message ||
                "写真の復元に失敗した。";
        } finally {
            restoreButton.disabled = true;
            restoreButton.textContent =
                "Restore Photos";
        }
    }

    input.addEventListener(
        "change",
        selectBackup
    );

    restoreButton.addEventListener(
        "click",
        restorePhotos
    );
})();
