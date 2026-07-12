//========================
// Meridian Photo Database
// Vestige Photo Phase 2
//========================

(function () {
    "use strict";

    const DB_NAME = "meridianPhotoDB";
    const DB_VERSION = 1;
    const STORE_NAME = "photos";

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

    async function runRequest(mode, callback) {
        const database = await openDatabase();

        return new Promise(function (resolve, reject) {
            const transaction = database.transaction(STORE_NAME, mode);
            const store = transaction.objectStore(STORE_NAME);
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

    window.MeridianPhotoDB = {
        dbName: DB_NAME,
        dbVersion: DB_VERSION,
        storeName: STORE_NAME,
        open: openDatabase,
        count: countPhotos,
        getAll: getAllPhotos,
        getByDate: getPhotoByDate,
        add: addPhoto,
        update: updatePhoto,
        delete: deletePhoto
    };
})();
