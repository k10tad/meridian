//========================
// Meridian Photo Backup
// Phase 1: ZIP export
//========================

(function () {
    "use strict";

    const BACKUP_FORMAT = "meridian-photo-backup";
    const SCHEMA_VERSION = 1;

    const exportButton = document.getElementById(
        "photoBackupExportButton"
    );

    const statusText = document.getElementById(
        "photoBackupStatus"
    );

    const countText = document.getElementById(
        "photoBackupCount"
    );

    if (
        !exportButton ||
        !statusText ||
        !countText
    ) {
        console.warn(
            "Meridian Photo Backup: required elements were not found."
        );
        return;
    }

    if (
        !window.MeridianPhotoDB ||
        typeof window.MeridianPhotoDB.getAll !== "function"
    ) {
        console.error(
            "Meridian Photo Backup: Photo DB is unavailable."
        );

        statusText.textContent =
            "写真保管庫を読み込めなかった。";

        exportButton.disabled = true;
        return;
    }

    function getDateStamp(date) {
        const year = date.getFullYear();
        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");
        const day = String(
            date.getDate()
        ).padStart(2, "0");
        const hours = String(
            date.getHours()
        ).padStart(2, "0");
        const minutes = String(
            date.getMinutes()
        ).padStart(2, "0");

        return (
            year + "-" +
            month + "-" +
            day + "_" +
            hours + "-" +
            minutes
        );
    }

    function sanitizeFileName(name) {
        return String(name || "photo.jpg")
            .replace(/[\\/:*?"<>|]+/g, "_")
            .replace(/\s+/g, "_");
    }

    function getPhotoFileName(photo, index) {
        const dateKey =
            photo.dateKey || "undated";

        const extension =
            photo.mimeType === "image/png"
                ? ".png"
                : ".jpg";

        return (
            "photos/" +
            String(index + 1).padStart(3, "0") +
            "_" +
            dateKey +
            "_" +
            sanitizeFileName(photo.id) +
            extension
        );
    }

    function makeCrcTable() {
        const table = new Uint32Array(256);

        for (let value = 0; value < 256; value += 1) {
            let current = value;

            for (let bit = 0; bit < 8; bit += 1) {
                current =
                    current & 1
                        ? 0xedb88320 ^ (current >>> 1)
                        : current >>> 1;
            }

            table[value] = current >>> 0;
        }

        return table;
    }

    const CRC_TABLE = makeCrcTable();

    function crc32(bytes) {
        let crc = 0xffffffff;

        for (let index = 0; index < bytes.length; index += 1) {
            crc =
                CRC_TABLE[
                    (crc ^ bytes[index]) & 0xff
                ] ^
                (crc >>> 8);
        }

        return (crc ^ 0xffffffff) >>> 0;
    }

    function writeUint16(view, offset, value) {
        view.setUint16(
            offset,
            value & 0xffff,
            true
        );
    }

    function writeUint32(view, offset, value) {
        view.setUint32(
            offset,
            value >>> 0,
            true
        );
    }

    function encodeText(text) {
        return new TextEncoder().encode(
            String(text)
        );
    }

    function getDosDateTime(date) {
        const year = Math.max(
            1980,
            date.getFullYear()
        );

        const dosTime =
            (date.getHours() << 11) |
            (date.getMinutes() << 5) |
            Math.floor(date.getSeconds() / 2);

        const dosDate =
            ((year - 1980) << 9) |
            ((date.getMonth() + 1) << 5) |
            date.getDate();

        return {
            time: dosTime,
            date: dosDate
        };
    }

    async function blobToBytes(blob) {
        return new Uint8Array(
            await blob.arrayBuffer()
        );
    }

    async function buildZip(entries) {
        const localParts = [];
        const centralParts = [];
        let localOffset = 0;
        const now = new Date();
        const dos = getDosDateTime(now);

        for (const entry of entries) {
            const nameBytes = encodeText(entry.name);
            const dataBytes = entry.bytes;
            const checksum = crc32(dataBytes);

            const localHeader =
                new ArrayBuffer(
                    30 + nameBytes.length
                );

            const localView =
                new DataView(localHeader);

            writeUint32(
                localView,
                0,
                0x04034b50
            );

            writeUint16(localView, 4, 20);
            writeUint16(localView, 6, 0x0800);
            writeUint16(localView, 8, 0);
            writeUint16(localView, 10, dos.time);
            writeUint16(localView, 12, dos.date);
            writeUint32(localView, 14, checksum);
            writeUint32(
                localView,
                18,
                dataBytes.length
            );
            writeUint32(
                localView,
                22,
                dataBytes.length
            );
            writeUint16(
                localView,
                26,
                nameBytes.length
            );
            writeUint16(localView, 28, 0);

            new Uint8Array(
                localHeader,
                30
            ).set(nameBytes);

            localParts.push(
                new Uint8Array(localHeader),
                dataBytes
            );

            const centralHeader =
                new ArrayBuffer(
                    46 + nameBytes.length
                );

            const centralView =
                new DataView(centralHeader);

            writeUint32(
                centralView,
                0,
                0x02014b50
            );

            writeUint16(centralView, 4, 20);
            writeUint16(centralView, 6, 20);
            writeUint16(centralView, 8, 0x0800);
            writeUint16(centralView, 10, 0);
            writeUint16(centralView, 12, dos.time);
            writeUint16(centralView, 14, dos.date);
            writeUint32(
                centralView,
                16,
                checksum
            );
            writeUint32(
                centralView,
                20,
                dataBytes.length
            );
            writeUint32(
                centralView,
                24,
                dataBytes.length
            );
            writeUint16(
                centralView,
                28,
                nameBytes.length
            );
            writeUint16(centralView, 30, 0);
            writeUint16(centralView, 32, 0);
            writeUint16(centralView, 34, 0);
            writeUint16(centralView, 36, 0);
            writeUint32(centralView, 38, 0);
            writeUint32(
                centralView,
                42,
                localOffset
            );

            new Uint8Array(
                centralHeader,
                46
            ).set(nameBytes);

            centralParts.push(
                new Uint8Array(centralHeader)
            );

            localOffset +=
                localHeader.byteLength +
                dataBytes.length;
        }

        const centralSize =
            centralParts.reduce(
                function (total, part) {
                    return total + part.length;
                },
                0
            );

        const endRecord =
            new ArrayBuffer(22);

        const endView =
            new DataView(endRecord);

        writeUint32(
            endView,
            0,
            0x06054b50
        );

        writeUint16(endView, 4, 0);
        writeUint16(endView, 6, 0);
        writeUint16(
            endView,
            8,
            entries.length
        );
        writeUint16(
            endView,
            10,
            entries.length
        );
        writeUint32(
            endView,
            12,
            centralSize
        );
        writeUint32(
            endView,
            16,
            localOffset
        );
        writeUint16(endView, 20, 0);

        return new Blob(
            [
                ...localParts,
                ...centralParts,
                new Uint8Array(endRecord)
            ],
            {
                type: "application/zip"
            }
        );
    }

    function createDownload(blob, fileName) {
        const objectUrl =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = objectUrl;
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.setTimeout(
            function () {
                URL.revokeObjectURL(objectUrl);
            },
            1500
        );
    }

    function createMetadata(photo, filePath) {
        return {
            id: photo.id,
            createdAt: photo.createdAt,
            dateKey: photo.dateKey,
            vestigeRecordId:
                photo.vestigeRecordId || null,
            fileName: photo.fileName,
            originalMimeType:
                photo.originalMimeType,
            mimeType: photo.mimeType,
            width: photo.width,
            height: photo.height,
            size: photo.size,
            memo: photo.memo || "",
            backupFile: filePath
        };
    }

    async function refreshCount() {
        try {
            const photos =
                await window.MeridianPhotoDB.getAll();

            countText.textContent =
                photos.length +
                (photos.length === 1
                    ? " photo"
                    : " photos");
        } catch (error) {
            console.warn(
                "Meridian Photo Backup: count failed.",
                error
            );

            countText.textContent =
                "Unavailable";
        }
    }

    async function exportPhotoBackup(options) {
        const silent =
            options && options.silent === true;

        if (!silent) {
            exportButton.disabled = true;
            exportButton.textContent =
                "Creating ZIP...";

            statusText.textContent =
                "写真とメタデータを読み取っている。既存データは変更しない。";
        }

        try {
            const photos =
                await window.MeridianPhotoDB.getAll();

            if (photos.length === 0) {
                if (!silent) {
                    statusText.textContent =
                        "保存されている写真がない。";
                }

                return {
                    photoCount: 0,
                    downloaded: false
                };
            }

            const metadata = [];
            const entries = [];

            for (
                let index = 0;
                index < photos.length;
                index += 1
            ) {
                const photo = photos[index];
                const filePath =
                    getPhotoFileName(
                        photo,
                        index
                    );

                metadata.push(
                    createMetadata(
                        photo,
                        filePath
                    )
                );

                entries.push({
                    name: filePath,
                    bytes: await blobToBytes(
                        photo.blob
                    )
                });
            }

            const exportedAt =
                new Date().toISOString();

            const manifest = {
                format: BACKUP_FORMAT,
                schemaVersion:
                    SCHEMA_VERSION,
                app: "Meridian",
                exportedAt: exportedAt,
                photoCount: photos.length,
                database: {
                    name:
                        window.MeridianPhotoDB
                            .dbName,
                    version:
                        window.MeridianPhotoDB
                            .dbVersion,
                    store:
                        window.MeridianPhotoDB
                            .storeName
                }
            };

            entries.unshift(
                {
                    name: "photos.json",
                    bytes: encodeText(
                        JSON.stringify(
                            {
                                format:
                                    BACKUP_FORMAT,
                                schemaVersion:
                                    SCHEMA_VERSION,
                                exportedAt:
                                    exportedAt,
                                photos:
                                    metadata
                            },
                            null,
                            2
                        )
                    )
                },
                {
                    name: "manifest.json",
                    bytes: encodeText(
                        JSON.stringify(
                            manifest,
                            null,
                            2
                        )
                    )
                }
            );

            const zipBlob =
                await buildZip(entries);

            const prefix =
                options && options.filePrefix
                    ? options.filePrefix
                    : "MeridianPhotoBackup_";

            createDownload(
                zipBlob,
                prefix +
                getDateStamp(new Date()) +
                ".zip"
            );

            if (!silent) {
                statusText.textContent =
                    photos.length +
                    "枚の写真をZIPへ書き出した。ファイルアプリまたはダウンロードを確認してくれ。";
            }

            return {
                photoCount: photos.length,
                downloaded: true
            };
        } catch (error) {
            console.error(
                "Meridian Photo Backup: export failed.",
                error
            );

            if (!silent) {
                statusText.textContent =
                    "写真バックアップの作成に失敗した。もう一度試してくれ。";
            }

            throw error;
        } finally {
            if (!silent) {
                exportButton.disabled = false;
                exportButton.textContent =
                    "Export Photo Backup";
            }

            refreshCount();
        }
    }

    window.MeridianPhotoBackup = {
        exportNow: exportPhotoBackup,
        refreshCount: refreshCount
    };

    exportButton.addEventListener(
        "click",
        exportPhotoBackup
    );

    window.addEventListener(
        "meridianVestigePhotoUpdated",
        refreshCount
    );

    refreshCount();
})();
