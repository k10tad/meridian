//========================
// Meridian Vestige Photo
// Phase 1: select / save / display / delete
//========================

(function () {
    "use strict";

    const MAX_PHOTOS = 1;
    const MAX_INPUT_BYTES = 15 * 1024 * 1024;
    const MAX_IMAGE_EDGE = 1600;
    const JPEG_QUALITY = 0.82;

    const input = document.getElementById(
        "vestigePhotoInput"
    );

    const status = document.getElementById(
        "vestigePhotoStatus"
    );

    const gallery = document.getElementById(
        "vestigePhotoGallery"
    );

    const count = document.getElementById(
        "vestigePhotoCount"
    );

    if (
        !input ||
        !status ||
        !gallery ||
        !count
    ) {
        console.warn(
            "Meridian Vestige Photo: required elements were not found."
        );
        return;
    }

    if (!window.MeridianPhotoDB) {
        console.error(
            "Meridian Vestige Photo: Photo DB is unavailable."
        );
        status.textContent =
            "写真保管庫を起動できなかった。";
        return;
    }

    let activeObjectUrls = [];

    function getDateKey(date) {
        const year = date.getFullYear();
        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");
        const day = String(
            date.getDate()
        ).padStart(2, "0");

        return year + "-" + month + "-" + day;
    }

    function createId() {
        if (
            window.crypto &&
            typeof window.crypto.randomUUID === "function"
        ) {
            return "photo-" + window.crypto.randomUUID();
        }

        return (
            "photo-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(16)
                .slice(2)
        );
    }

    function revokeObjectUrls() {
        activeObjectUrls.forEach(function (url) {
            URL.revokeObjectURL(url);
        });

        activeObjectUrls = [];
    }

    function loadImage(file) {
        return new Promise(function (resolve, reject) {
            const image = new Image();
            const objectUrl =
                URL.createObjectURL(file);

            image.addEventListener(
                "load",
                function () {
                    URL.revokeObjectURL(objectUrl);
                    resolve(image);
                }
            );

            image.addEventListener(
                "error",
                function () {
                    URL.revokeObjectURL(objectUrl);
                    reject(
                        new Error(
                            "画像を読み込めなかった。"
                        )
                    );
                }
            );

            image.src = objectUrl;
        });
    }

    async function compressImage(file) {
        const image = await loadImage(file);

        const largestEdge = Math.max(
            image.naturalWidth,
            image.naturalHeight
        );

        const scale =
            largestEdge > MAX_IMAGE_EDGE
                ? MAX_IMAGE_EDGE / largestEdge
                : 1;

        const width = Math.max(
            1,
            Math.round(
                image.naturalWidth * scale
            )
        );

        const height = Math.max(
            1,
            Math.round(
                image.naturalHeight * scale
            )
        );

        const canvas =
            document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext(
            "2d",
            {
                alpha: false
            }
        );

        if (!context) {
            throw new Error(
                "画像処理を開始できなかった。"
            );
        }

        context.fillStyle = "#ffffff";
        context.fillRect(
            0,
            0,
            width,
            height
        );

        context.drawImage(
            image,
            0,
            0,
            width,
            height
        );

        return new Promise(function (resolve, reject) {
            canvas.toBlob(
                function (blob) {
                    if (!blob) {
                        reject(
                            new Error(
                                "画像の圧縮に失敗した。"
                            )
                        );
                        return;
                    }

                    resolve({
                        blob: blob,
                        width: width,
                        height: height
                    });
                },
                "image/jpeg",
                JPEG_QUALITY
            );
        });
    }

    function validateFile(file) {
        if (!file) {
            return "写真が選択されていない。";
        }

        if (
            !String(file.type).startsWith("image/")
        ) {
            return "画像ファイルを選択してくれ。";
        }

        if (file.size > MAX_INPUT_BYTES) {
            return "写真が大きすぎる。15MB以下の画像を選択してくれ。";
        }

        return "";
    }

    async function saveSelectedPhoto() {
        const file =
            input.files &&
            input.files[0];

        const validationError =
            validateFile(file);

        input.value = "";

        if (validationError) {
            status.textContent =
                validationError;
            return;
        }

        try {
            const existingCount =
                await window.MeridianPhotoDB.count();

            if (existingCount >= MAX_PHOTOS) {
                status.textContent =
                    "Phase 1では1枚だけ保存できる。現在の写真を削除してから追加してくれ。";
                return;
            }

            status.textContent =
                "写真を圧縮して保存している。";

            const processed =
                await compressImage(file);

            const now = new Date();

            const record = {
                id: createId(),
                createdAt: now.toISOString(),
                dateKey: getDateKey(now),
                vestigeRecordId: null,
                fileName:
                    file.name ||
                    "photo.jpg",
                originalMimeType:
                    file.type ||
                    "image/*",
                mimeType: "image/jpeg",
                width: processed.width,
                height: processed.height,
                size: processed.blob.size,
                blob: processed.blob,
                memo: ""
            };

            await window.MeridianPhotoDB.add(
                record
            );

            status.textContent =
                "写真を端末内へ保存した。";

            await renderPhotos();
        } catch (error) {
            console.error(
                "Meridian Vestige Photo: save failed.",
                error
            );

            status.textContent =
                "写真の保存に失敗した。別の画像で試してくれ。";
        }
    }

    async function removePhoto(photo) {
        const confirmed = window.confirm(
            "この写真を端末内のVestigeから削除します。\n\n" +
            "ファイル名: " +
            photo.fileName +
            "\n\n削除後は元に戻せません。"
        );

        if (!confirmed) {
            return;
        }

        try {
            await window.MeridianPhotoDB.delete(
                photo.id
            );

            status.textContent =
                "写真を削除した。";

            await renderPhotos();
        } catch (error) {
            console.error(
                "Meridian Vestige Photo: delete failed.",
                error
            );

            status.textContent =
                "写真を削除できなかった。";
        }
    }

    function createPhotoElement(photo) {
        const item =
            document.createElement("article");

        item.className =
            "vestige-photo-item";

        const image =
            document.createElement("img");

        const objectUrl =
            URL.createObjectURL(photo.blob);

        activeObjectUrls.push(objectUrl);

        image.className =
            "vestige-photo-image";

        image.src = objectUrl;
        image.alt =
            "Vestige photo";

        const meta =
            document.createElement("div");

        meta.className =
            "vestige-photo-meta";

        const text =
            document.createElement("div");

        text.className =
            "vestige-photo-name";

        const name =
            document.createElement("div");

        name.textContent =
            photo.fileName;

        const date =
            document.createElement("div");

        date.className =
            "vestige-photo-date";

        date.textContent =
            new Date(
                photo.createdAt
            ).toLocaleString(
                "ja-JP"
            );

        const deleteButton =
            document.createElement("button");

        deleteButton.className =
            "vestige-photo-delete-btn";

        deleteButton.type = "button";
        deleteButton.textContent =
            "Delete";

        deleteButton.addEventListener(
            "click",
            function () {
                removePhoto(photo);
            }
        );

        text.appendChild(name);
        text.appendChild(date);

        meta.appendChild(text);
        meta.appendChild(deleteButton);

        item.appendChild(image);
        item.appendChild(meta);

        return item;
    }

    async function renderPhotos() {
        revokeObjectUrls();
        gallery.innerHTML = "";

        try {
            const photos =
                await window.MeridianPhotoDB.getAll();

            count.textContent =
                photos.length +
                " / " +
                MAX_PHOTOS;

            photos.forEach(function (photo) {
                gallery.appendChild(
                    createPhotoElement(photo)
                );
            });

            if (photos.length === 0) {
                status.textContent =
                    "写真を選択すると、端末内へ圧縮保存する。";
            }
        } catch (error) {
            console.error(
                "Meridian Vestige Photo: render failed.",
                error
            );

            status.textContent =
                "保存済み写真を読み込めなかった。";
        }
    }

    input.addEventListener(
        "change",
        saveSelectedPhoto
    );

    window.addEventListener(
        "pagehide",
        revokeObjectUrls
    );

    renderPhotos();
})();

