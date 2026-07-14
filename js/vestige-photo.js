//========================
// Meridian Vestige Photo
// Phase 2: date / memo / one-per-day / lightbox
//========================

(function () {
    "use strict";

    const MAX_INPUT_BYTES = 15 * 1024 * 1024;
    const MAX_IMAGE_EDGE = 1600;
    const JPEG_QUALITY = 0.82;

    const input = document.getElementById("vestigePhotoInput");
    const dateInput = document.getElementById("vestigePhotoDate");
    const memoInput = document.getElementById("vestigePhotoMemo");
    const status = document.getElementById("vestigePhotoStatus");
    const gallery = document.getElementById("vestigePhotoGallery");
    const count = document.getElementById("vestigePhotoCount");

    const lightbox = document.getElementById("vestigePhotoLightbox");
    const lightboxClose = document.getElementById(
        "vestigePhotoLightboxClose"
    );
    const lightboxImage = document.getElementById(
        "vestigePhotoLightboxImage"
    );
    const lightboxTitle = document.getElementById(
        "vestigePhotoLightboxTitle"
    );
    const lightboxMemo = document.getElementById(
        "vestigePhotoLightboxMemo"
    );

    if (
        !input ||
        !dateInput ||
        !memoInput ||
        !status ||
        !gallery ||
        !count ||
        !lightbox ||
        !lightboxClose ||
        !lightboxImage ||
        !lightboxTitle ||
        !lightboxMemo
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
        status.textContent = "写真保管庫を起動できなかった。";
        return;
    }

    let activeObjectUrls = [];
    let editingPhotoId = null;

    function getDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return year + "-" + month + "-" + day;
    }

    function setDefaultDate() {
        if (!dateInput.value) {
            dateInput.value = getDateKey(new Date());
        }
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
            Math.random().toString(16).slice(2)
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
            const objectUrl = URL.createObjectURL(file);

            image.addEventListener("load", function () {
                URL.revokeObjectURL(objectUrl);
                resolve(image);
            });

            image.addEventListener("error", function () {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("画像を読み込めなかった。"));
            });

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
            Math.round(image.naturalWidth * scale)
        );

        const height = Math.max(
            1,
            Math.round(image.naturalHeight * scale)
        );

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d", {
            alpha: false
        });

        if (!context) {
            throw new Error("画像処理を開始できなかった。");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        return new Promise(function (resolve, reject) {
            canvas.toBlob(
                function (blob) {
                    if (!blob) {
                        reject(new Error("画像の圧縮に失敗した。"));
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

        if (!String(file.type).startsWith("image/")) {
            return "画像ファイルを選択してくれ。";
        }

        if (file.size > MAX_INPUT_BYTES) {
            return "写真が大きすぎる。15MB以下の画像を選択してくれ。";
        }

        return "";
    }

    function resetForm() {
        editingPhotoId = null;
        memoInput.value = "";
        dateInput.value = getDateKey(new Date());
        input.value = "";
    }

    async function saveSelectedPhoto() {
        const file = input.files && input.files[0];
        const validationError = validateFile(file);

        if (validationError) {
            input.value = "";
            status.textContent = validationError;
            return;
        }

        const selectedDate = dateInput.value || getDateKey(new Date());

        try {
            const existingForDate =
                await window.MeridianPhotoDB.getByDate(selectedDate);

            if (
                existingForDate &&
                existingForDate.id !== editingPhotoId
            ) {
                input.value = "";
                status.textContent =
                    selectedDate +
                    "にはすでに写真がある。編集または削除してから追加してくれ。";
                return;
            }

            status.textContent = "写真を圧縮して保存している。";

            const processed = await compressImage(file);
            const now = new Date();

            const wasEditing = Boolean(editingPhotoId);

            const record = {
                id: editingPhotoId || createId(),
                createdAt: now.toISOString(),
                dateKey: selectedDate,
                vestigeRecordId: null,
                fileName: file.name || "photo.jpg",
                originalMimeType: file.type || "image/*",
                mimeType: "image/jpeg",
                width: processed.width,
                height: processed.height,
                size: processed.blob.size,
                blob: processed.blob,
                memo: memoInput.value.trim()
            };

            if (editingPhotoId) {
                await window.MeridianPhotoDB.update(record);
                status.textContent = "写真を更新した。";
            } else {
                await window.MeridianPhotoDB.add(record);
                status.textContent = "写真を端末内へ保存した。";
            }

            resetForm();
            await renderPhotos();

            window.dispatchEvent(
                new CustomEvent("meridianVestigePhotoUpdated", {
                    detail: {
                        dateKey: record.dateKey,
                        photoId: record.id,
                        action: wasEditing ? "updated" : "saved"
                    }
                })
            );
        } catch (error) {
            console.error(
                "Meridian Vestige Photo: save failed.",
                error
            );

            status.textContent =
                "写真の保存に失敗した。別の画像で試してくれ。";
        } finally {
            input.value = "";
        }
    }

    async function removePhoto(photo) {
        const confirmed = window.confirm(
            "この写真を端末内のVestigeから削除します。\n\n" +
            "日付: " +
            photo.dateKey +
            "\nファイル名: " +
            photo.fileName +
            "\n\n削除後は元に戻せません。"
        );

        if (!confirmed) {
            return;
        }

        try {
            await window.MeridianPhotoDB.delete(photo.id);
            status.textContent = "写真を削除した。";
            await renderPhotos();

            window.dispatchEvent(
                new CustomEvent("meridianVestigePhotoUpdated", {
                    detail: {
                        dateKey: photo.dateKey,
                        photoId: photo.id,
                        action: "deleted"
                    }
                })
            );
        } catch (error) {
            console.error(
                "Meridian Vestige Photo: delete failed.",
                error
            );

            status.textContent = "写真を削除できなかった。";
        }
    }

    function beginEdit(photo) {
        editingPhotoId = photo.id;
        dateInput.value = photo.dateKey;
        memoInput.value = photo.memo || "";
        status.textContent =
            "編集モード。新しい写真を選ぶと、同じ記録を更新する。";
        dateInput.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    function openLightbox(photo, objectUrl) {
        lightboxImage.src = objectUrl;
        lightboxTitle.textContent =
            photo.dateKey + " / " + photo.fileName;
        lightboxMemo.textContent =
            photo.memo || "メモなし";
        lightbox.classList.remove("hidden");
    }

    function closeLightbox() {
        lightbox.classList.add("hidden");
        lightboxImage.removeAttribute("src");
    }

    function createPhotoElement(photo) {
        const item = document.createElement("article");
        item.className = "vestige-photo-item";
        item.dataset.photoId = photo.id;

        const imageButton = document.createElement("button");
        imageButton.className = "vestige-photo-image-button";
        imageButton.type = "button";
        imageButton.setAttribute("aria-label", "Enlarge photo");

        const image = document.createElement("img");
        const objectUrl = URL.createObjectURL(photo.blob);

        activeObjectUrls.push(objectUrl);

        image.className = "vestige-photo-image";
        image.src = objectUrl;
        image.alt = "Vestige photo";

        imageButton.appendChild(image);

        const meta = document.createElement("div");
        meta.className = "vestige-photo-meta";

        const text = document.createElement("div");
        text.className = "vestige-photo-name";

        const name = document.createElement("div");
        name.textContent = photo.dateKey + " / " + photo.fileName;

        const createdAt = document.createElement("div");
        createdAt.className = "vestige-photo-date";
        createdAt.textContent =
            "保存: " +
            new Date(photo.createdAt).toLocaleString("ja-JP");

        const memo = document.createElement("div");
        memo.className = "vestige-photo-memo";
        memo.textContent = photo.memo || "メモなし";

        const actions = document.createElement("div");
        actions.className = "vestige-photo-actions";

        const editButton = document.createElement("button");
        editButton.className = "vestige-photo-edit-btn";
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", function () {
            beginEdit(photo);
        });

        const deleteButton = document.createElement("button");
        deleteButton.className = "vestige-photo-delete-btn";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", function () {
            removePhoto(photo);
        });

        text.appendChild(name);
        text.appendChild(createdAt);
        text.appendChild(memo);

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);

        meta.appendChild(text);
        meta.appendChild(actions);

        item.appendChild(imageButton);
        item.appendChild(meta);

        return item;
    }

    async function renderPhotos() {
        revokeObjectUrls();
        gallery.innerHTML = "";

        try {
            const photos = await window.MeridianPhotoDB.getAll();

            count.textContent = photos.length + " photos";

            photos.forEach(function (photo) {
                gallery.appendChild(createPhotoElement(photo));
            });

            if (photos.length === 0) {
                status.textContent =
                    "1日につき1枚、端末内へ圧縮保存する。";
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

    window.openVestigePhotoCard = function (photo) {
        if (!photo || !photo.id) {
            return;
        }

        const selector =
            '.vestige-photo-item[data-photo-id="' +
            CSS.escape(String(photo.id)) +
            '"]';

        const item = document.querySelector(selector);

        if (!item) {
            return;
        }

        item.classList.add("is-photo-target");

        item.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        window.setTimeout(function () {
            item.classList.remove("is-photo-target");
        }, 1800);
    };


    input.addEventListener("change", saveSelectedPhoto);
    lightboxClose.addEventListener("click", closeLightbox);

    lightbox.addEventListener("click", function (event) {
        if (event.target === lightbox) {
            closeLightbox();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeLightbox();
        }
    });

    window.addEventListener("pagehide", revokeObjectUrls);

    setDefaultDate();
    renderPhotos();
})();

