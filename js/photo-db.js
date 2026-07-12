//========================
// Meridian Photo Database
// Vestige Photo Phase 1
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
            const request = indexedDB.open(
                DB_NAME,
                DB_VERSION
            );

            request.addEventListener(
                "upgradeneeded",
                function () {
                    const database = request.result;

                    if (!database.objectStoreNames.contains(STORE_NAME)) {
                        const store = database.createObjectStore(
                            STORE_NAME,
                            {
                                keyPath: "id"
                            }
                        );

                        store.createIndex(
                            "createdAt",
                            "createdAt",
                            {
                                unique: false
                            }
                        );

                        store.createIndex(
                            "dateKey",
                            "dateKey",
                            {
                                unique: false
                            }
                        );
                    }
                }
            );

            request.addEventListener(
                "success",
                function () {
                    const database = request.result;

                    database.addEventListener(
                        "versionchange",
                        function () {
                            database.close();
                            databasePromise = null;
                        }
                    );

                    resolve(database);
                }
            );

            request.addEventListener(
                "error",
                function () {
                    databasePromise = null;
                    reject(
                        request.error ||
                        new Error(
                            "Photo database could not be opened."
                        )
                    );
                }
            );

            request.addEventListener(
                "blocked",
                function () {
                    console.warn(
                        "Meridian Photo DB: upgrade is blocked by another open tab."
                    );
                }
            );
        });

        return databasePromise;
    }

    async function runTransaction(mode, operation) {
        const database = await openDatabase();

        return new Promise(function (resolve, reject) {
            const transaction = database.transaction(
                STORE_NAME,
                mode
            );

            const store =
                transaction.objectStore(STORE_NAME);

            let result;

            try {
                result = operation(store);
            } catch (error) {
                transaction.abort();
                reject(error);
                return;
            }

            transaction.addEventListener(
                "complete",
                function () {
                    resolve(result);
                }
            );

            transaction.addEventListener(
                "error",
                function () {
                    reject(
                        transaction.error ||
                        new Error(
                            "Photo database transaction failed."
                        )
                    );
                }
            );

            transaction.addEventListener(
                "abort",
                function () {
                    reject(
                        transaction.error ||
                        new Error(
                            "Photo database transaction was aborted."
                        )
                    );
                }
            );
        });
    }

    async function countPhotos() {
        const database = await openDatabase();

        return new Promise(function (resolve, reject) {
            const transaction = database.transaction(
                STORE_NAME,
                "readonly"
            );

            const store =
                transaction.objectStore(STORE_NAME);

            const request = store.count();

            request.addEventListener(
                "success",
                function () {
                    resolve(request.result);
                }
            );

            request.addEventListener(
                "error",
                function () {
                    reject(request.error);
                }
            );
        });
    }

    async function getAllPhotos() {
        const database = await openDatabase();

        return new Promise(function (resolve, reject) {
            const transaction = database.transaction(
                STORE_NAME,
                "readonly"
            );

            const store =
                transaction.objectStore(STORE_NAME);

            const request = store.getAll();

            request.addEventListener(
                "success",
                function () {
                    const photos = Array.isArray(request.result)
                        ? request.result
                        : [];

                    photos.sort(function (left, right) {
                        return String(right.createdAt)
                            .localeCompare(
                                String(left.createdAt)
                            );
                    });

                    resolve(photos);
                }
            );

            request.addEventListener(
                "error",
                function () {
                    reject(request.error);
                }
            );
        });
    }

    async function addPhoto(photoRecord) {
        return runTransaction(
            "readwrite",
            function (store) {
                store.add(photoRecord);
                return photoRecord;
            }
        );
    }

    async function deletePhoto(id) {
        return runTransaction(
            "readwrite",
            function (store) {
                store.delete(id);
                return id;
            }
        );
    }

    window.MeridianPhotoDB = {
        dbName: DB_NAME,
        dbVersion: DB_VERSION,
        storeName: STORE_NAME,
        open: openDatabase,
        count: countPhotos,
        getAll: getAllPhotos,
        add: addPhoto,
        delete: deletePhoto
    };
})();

