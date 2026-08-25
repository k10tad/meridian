//========================
// Meridian Desk Image
// Commander portrait stored in IndexedDB
//========================

(function () {
    "use strict";

    const ASSET_ID = "desk-commander";
    const DEFAULT_SRC = "assets/images/sebas/commander-home.png?v=2.3.2";
    const DEFAULT_X = 50;
    const DEFAULT_Y = 36;
    const DEFAULT_ZOOM = 100;
    const MAX_SOURCE_SIZE = 24 * 1024 * 1024;
    const MAX_EDGE = 1800;

    const hero = document.getElementById("deskHeroImage");
    const portrait = document.getElementById("commanderPortrait");
    const modal = document.getElementById("deskImageModal");
    const backdrop = document.getElementById("deskImageBackdrop");
    const closeButton = document.getElementById("deskImageClose");
    const input = document.getElementById("deskImageInput");
    const preview = document.getElementById("deskImagePreview");
    const zoom = document.getElementById("deskImageZoom");
    const positionX = document.getElementById("deskImagePositionX");
    const positionY = document.getElementById("deskImagePositionY");
    const status = document.getElementById("deskImageStatus");
    const resetButton = document.getElementById("deskImageReset");
    const saveButton = document.getElementById("deskImageSave");

    if (
        !hero || !portrait || !modal || !input || !preview ||
        !zoom || !positionX || !positionY || !status || !resetButton || !saveButton
    ) {
        console.warn("Meridian Desk Image: required elements were not found.");
        return;
    }

    let currentAsset = null;
    let currentObjectUrl = "";
    let pendingBlob = null;
    let pendingWidth = 0;
    let pendingHeight = 0;
    let pendingObjectUrl = "";

    function clamp(value, minimum, maximum, fallback) {
        const number = Number(value);
        return Number.isFinite(number)
            ? Math.min(maximum, Math.max(minimum, number))
            : fallback;
    }

    function revokeUrl(url) {
        if (url && String(url).startsWith("blob:")) {
            URL.revokeObjectURL(url);
        }
    }

    function getSettings(asset) {
        return {
            x: clamp(asset && asset.positionX, 0, 100, DEFAULT_X),
            y: clamp(asset && asset.positionY, 0, 100, DEFAULT_Y),
            zoom: clamp(asset && asset.zoom, 100, 200, DEFAULT_ZOOM)
        };
    }

    function applyImage(src, settings) {
        portrait.src = src || DEFAULT_SRC;
        portrait.style.setProperty("--desk-image-x", settings.x + "%");
        portrait.style.setProperty("--desk-image-y", settings.y + "%");
        portrait.style.setProperty("--desk-image-scale", String(settings.zoom / 100));
        portrait.style.setProperty("--desk-image-breath-scale", String(settings.zoom / 100 + 0.018));
    }

    function updatePreview() {
        const settings = getSettings({
            positionX: positionX.value,
            positionY: positionY.value,
            zoom: zoom.value
        });

        preview.style.setProperty("--desk-preview-x", settings.x + "%");
        preview.style.setProperty("--desk-preview-y", settings.y + "%");
        preview.style.setProperty("--desk-preview-scale", String(settings.zoom / 100));
    }

    function loadImageFromFile(file) {
        return new Promise(function (resolve, reject) {
            const image = new Image();
            const objectUrl = URL.createObjectURL(file);

            image.addEventListener("load", function () {
                URL.revokeObjectURL(objectUrl);
                resolve(image);
            });

            image.addEventListener("error", function () {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("選択した画像を読み込めなかった。"));
            });

            image.src = objectUrl;
        });
    }

    function canvasToBlob(canvas) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("画像を圧縮できなかった。"));
                }
            }, "image/jpeg", 0.86);
        });
    }

    async function compressImage(file) {
        const image = await loadImageFromFile(file);
        const longest = Math.max(image.naturalWidth, image.naturalHeight);
        const ratio = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
        const width = Math.max(1, Math.round(image.naturalWidth * ratio));
        const height = Math.max(1, Math.round(image.naturalHeight * ratio));
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { alpha: false });

        canvas.width = width;
        canvas.height = height;
        context.fillStyle = "#050711";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        return {
            blob: await canvasToBlob(canvas),
            width: width,
            height: height
        };
    }

    function openModal(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const settings = getSettings(currentAsset);
        pendingBlob = currentAsset && currentAsset.blob ? currentAsset.blob : null;
        pendingWidth = currentAsset ? Number(currentAsset.width) || 0 : 0;
        pendingHeight = currentAsset ? Number(currentAsset.height) || 0 : 0;
        zoom.value = String(settings.zoom);
        positionX.value = String(settings.x);
        positionY.value = String(settings.y);
        preview.src = currentObjectUrl || DEFAULT_SRC;
        updatePreview();
        status.textContent = currentAsset
            ? "現在のDesk画像。選び直すか、位置だけ調整できる。"
            : "写真を選び、表示位置を調整できる。";
        input.value = "";
        modal.hidden = false;
        document.body.classList.add("modal-open");
    }

    function closeModal() {
        modal.hidden = true;
        document.body.classList.remove("modal-open");
        revokeUrl(pendingObjectUrl);
        pendingObjectUrl = "";
        input.value = "";
    }

    async function selectImage() {
        const file = input.files && input.files[0];

        if (!file) {
            return;
        }

        const looksLikeImage =
            String(file.type || "").startsWith("image/") ||
            /\.(jpe?g|png|webp|heic|heif)$/i.test(String(file.name || ""));

        if (!looksLikeImage) {
            status.textContent = "画像ファイルを選んでくれ。";
            return;
        }

        if (file.size > MAX_SOURCE_SIZE) {
            status.textContent = "元画像が大きすぎる。24MB以下の写真を選んでくれ。";
            return;
        }

        saveButton.disabled = true;
        status.textContent = "Desk用に画像を整えている。";

        try {
            const result = await compressImage(file);
            pendingBlob = result.blob;
            pendingWidth = result.width;
            pendingHeight = result.height;
            revokeUrl(pendingObjectUrl);
            pendingObjectUrl = URL.createObjectURL(pendingBlob);
            preview.src = pendingObjectUrl;
            zoom.value = String(DEFAULT_ZOOM);
            positionX.value = String(DEFAULT_X);
            positionY.value = String(DEFAULT_Y);
            updatePreview();
            status.textContent = "位置と拡大率を確認して、保存してくれ。";
        } catch (error) {
            console.error("Meridian Desk Image: compression failed.", error);
            status.textContent = error.message || "画像を処理できなかった。";
        } finally {
            saveButton.disabled = false;
        }
    }

    async function saveImage() {
        if (!pendingBlob) {
            status.textContent = "先に写真を選んでくれ。";
            return;
        }

        if (!window.MeridianPhotoDB || typeof window.MeridianPhotoDB.putAsset !== "function") {
            status.textContent = "画像保管庫を開けない。Meridianを再起動してくれ。";
            return;
        }

        saveButton.disabled = true;
        status.textContent = "Desk画像を端末内へ保存している。";

        try {
            const settings = getSettings({
                positionX: positionX.value,
                positionY: positionY.value,
                zoom: zoom.value
            });
            const asset = {
                id: ASSET_ID,
                updatedAt: new Date().toISOString(),
                mimeType: pendingBlob.type || "image/jpeg",
                width: pendingWidth,
                height: pendingHeight,
                size: pendingBlob.size,
                positionX: settings.x,
                positionY: settings.y,
                zoom: settings.zoom,
                blob: pendingBlob
            };

            await window.MeridianPhotoDB.putAsset(asset);
            currentAsset = asset;
            revokeUrl(currentObjectUrl);
            currentObjectUrl = URL.createObjectURL(asset.blob);
            applyImage(currentObjectUrl, settings);
            window.dispatchEvent(new CustomEvent("meridianDeskImageUpdated"));
            closeModal();
        } catch (error) {
            console.error("Meridian Desk Image: save failed.", error);
            status.textContent = "Desk画像を保存できなかった。空き容量を確認してくれ。";
        } finally {
            saveButton.disabled = false;
        }
    }

    async function resetImage() {
        if (!window.confirm("Desk画像を標準のCommanderへ戻しますか？")) {
            return;
        }

        try {
            if (window.MeridianPhotoDB && typeof window.MeridianPhotoDB.deleteAsset === "function") {
                await window.MeridianPhotoDB.deleteAsset(ASSET_ID);
            }
            currentAsset = null;
            pendingBlob = null;
            revokeUrl(currentObjectUrl);
            currentObjectUrl = "";
            applyImage(DEFAULT_SRC, getSettings(null));
            window.dispatchEvent(new CustomEvent("meridianDeskImageUpdated"));
            closeModal();
        } catch (error) {
            console.error("Meridian Desk Image: reset failed.", error);
            status.textContent = "標準画像へ戻せなかった。もう一度試してくれ。";
        }
    }

    async function loadSavedImage() {
        applyImage(DEFAULT_SRC, getSettings(null));

        if (!window.MeridianPhotoDB || typeof window.MeridianPhotoDB.getAsset !== "function") {
            return;
        }

        try {
            const asset = await window.MeridianPhotoDB.getAsset(ASSET_ID);
            if (!asset || !asset.blob) {
                return;
            }
            currentAsset = asset;
            revokeUrl(currentObjectUrl);
            currentObjectUrl = URL.createObjectURL(asset.blob);
            applyImage(currentObjectUrl, getSettings(asset));
        } catch (error) {
            console.warn("Meridian Desk Image: saved image could not be loaded.", error);
        }
    }

    hero.addEventListener("click", openModal);
    input.addEventListener("change", selectImage);
    zoom.addEventListener("input", updatePreview);
    positionX.addEventListener("input", updatePreview);
    positionY.addEventListener("input", updatePreview);
    saveButton.addEventListener("click", saveImage);
    resetButton.addEventListener("click", resetImage);
    closeButton.addEventListener("click", closeModal);
    backdrop.addEventListener("click", closeModal);
    window.addEventListener("meridianDeskImageRestore", loadSavedImage);
    window.addEventListener("beforeunload", function () {
        revokeUrl(currentObjectUrl);
        revokeUrl(pendingObjectUrl);
    });

    loadSavedImage();
})();
