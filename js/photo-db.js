//========================
// Meridian Photo Database
// Vestige Photo Phase 2
//========================

(function () {
    "use strict";

    const DB_NAME = "meridianPhotoDB";
    const DB_VERSION = 2;
    const STORE_NAME = "photos";
    const ASSET_STORE_NAME = "assets";

    let databasePromise = null;

    function openDatabase() {
        if (databasePromise) {
            return databasePromise;
        }

        databasePromise = new Promise(function (resolve, reject) {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.addEventListener("upgradeneeded", function () {
                const database = request.result;

                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    const store = database.createObjectStore(
                        STORE_NAME,
                        { keyPath: "id" }
                    );

                    store.createIndex("createdAt", "createdAt", {
                        unique: false
                    });

                    store.createIndex("dateKey", "dateKey", {
                        unique: false
                    });
                }

                if (!database.objectStoreNames.contains(ASSET_STORE_NAME)) {
                    database.createObjectStore(
                        ASSET_STORE_NAME,
                        { keyPath: "id" }
                    );
                }
            });

            request.addEventListener("success", function () {
                const database = request.result;

                database.addEventListener("versionchange", function () {
                    database.close();
                    databasePromise = null;
                });

                resolve(database);
            });

            request.addEventListener("error", function () {
                databasePromise = null;
                reject(
                    request.error ||
                    new Error("Photo database could not be opened.")
                );
            });

            request.addEventListener("blocked", function () {
                console.warn(
                    "Meridian Photo DB: upgrade is blocked by another open tab."
                );
            });
        });

        return databasePromise;
    }

    async function runStoreRequest(storeName, mode, callback) {
        const database = await openDatabase();

        return new Promise(function (resolve, reject) {
            const transaction = database.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            let request;

            try {
                request = callback(store);
            } catch (error) {
                reject(error);
                return;
            }

            request.addEventListener("success", function () {
                resolve(request.result);
            });

            request.addEventListener("error", function () {
                reject(request.error);
            });
        });
    }

    function runRequest(mode, callback) {
        return runStoreRequest(STORE_NAME, mode, callback);
    }

    function countPhotos() {
        return runRequest("readonly", function (store) {
            return store.count();
        });
    }

    async function getAllPhotos() {
        const photos = await runRequest("readonly", function (store) {
            return store.getAll();
        });

        const normalized = Array.isArray(photos) ? photos : [];

        normalized.sort(function (left, right) {
            return String(right.dateKey || right.createdAt)
                .localeCompare(String(left.dateKey || left.createdAt));
        });

        return normalized;
    }

    function getPhotoByDate(dateKey) {
        return runRequest("readonly", function (store) {
            return store.index("dateKey").get(dateKey);
        });
    }

    function addPhoto(photoRecord) {
        return runRequest("readwrite", function (store) {
            return store.add(photoRecord);
        });
    }

    function updatePhoto(photoRecord) {
        return runRequest("readwrite", function (store) {
            return store.put(photoRecord);
        });
    }

    function deletePhoto(id) {
        return runRequest("readwrite", function (store) {
            return store.delete(id);
        });
    }

    function getAsset(id) {
        return runStoreRequest(ASSET_STORE_NAME, "readonly", function (store) {
            return store.get(id);
        });
    }

    function putAsset(asset) {
        return runStoreRequest(ASSET_STORE_NAME, "readwrite", function (store) {
            return store.put(asset);
        });
    }

    function deleteAsset(id) {
        return runStoreRequest(ASSET_STORE_NAME, "readwrite", function (store) {
            return store.delete(id);
        });
    }

    window.MeridianPhotoDB = {
        dbName: DB_NAME,
        dbVersion: DB_VERSION,
        storeName: STORE_NAME,
        assetStoreName: ASSET_STORE_NAME,
        open: openDatabase,
        count: countPhotos,
        getAll: getAllPhotos,
        getByDate: getPhotoByDate,
        add: addPhoto,
        update: updatePhoto,
        delete: deletePhoto,
        getAsset: getAsset,
        putAsset: putAsset,
        deleteAsset: deleteAsset
    };
})();
