//========================
// Meridian Vestige Timeline
// Phase 1: read-only monthly grid
//========================

(function () {
    "use strict";

    const VESTIGE_KEY = "meridianVestigeRecords";
    const FOCUS_STATS_KEY = "meridianFocusStats";

    const archiveButton = document.getElementById(
        "vestigeArchiveViewButton"
    );

    const timelineButton = document.getElementById(
        "vestigeTimelineViewButton"
    );

    const archivePanel = document.getElementById(
        "vestigeArchivePanel"
    );

    const timelinePanel = document.getElementById(
        "vestigeTimelinePanel"
    );

    const previousButton = document.getElementById(
        "timelinePrevMonth"
    );

    const nextButton = document.getElementById(
        "timelineNextMonth"
    );

    const monthLabel = document.getElementById(
        "timelineMonthLabel"
    );

    const grid = document.getElementById(
        "timelineGrid"
    );

    const statusText = document.getElementById(
        "timelineStatus"
    );

    const recordCount = document.getElementById(
        "timelineMonthRecordCount"
    );

    if (
        !archiveButton ||
        !timelineButton ||
        !archivePanel ||
        !timelinePanel ||
        !previousButton ||
        !nextButton ||
        !monthLabel ||
        !grid ||
        !statusText ||
        !recordCount
    ) {
        console.warn(
            "Meridian Timeline: required elements were not found."
        );
        return;
    }

    let currentMonth = new Date();
    currentMonth.setDate(1);

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

    function getRecordDateKey(record) {
        if (!record || !record.createdAt) {
            return "";
        }

        const date = new Date(record.createdAt);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return getDateKey(date);
    }

    function safeReadJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            console.warn(
                "Meridian Timeline: storage read failed.",
                key,
                error
            );

            return fallback;
        }
    }

    function getVestigeRecords() {
        if (
            typeof window.getMeridianVestigeRecords ===
            "function"
        ) {
            try {
                return window.getMeridianVestigeRecords();
            } catch (error) {
                console.warn(
                    "Meridian Timeline: Vestige API failed.",
                    error
                );
            }
        }

        const records = safeReadJson(
            VESTIGE_KEY,
            []
        );

        return Array.isArray(records)
            ? records
            : [];
    }

    async function getPhotos() {
        if (
            !window.MeridianPhotoDB ||
            typeof window.MeridianPhotoDB.getAll !==
            "function"
        ) {
            return [];
        }

        try {
            return await window.MeridianPhotoDB.getAll();
        } catch (error) {
            console.error(
                "Meridian Timeline: photo read failed.",
                error
            );

            return [];
        }
    }

    function getFocusDays() {
        const stats = safeReadJson(
            FOCUS_STATS_KEY,
            {}
        );

        return (
            stats &&
            stats.days &&
            typeof stats.days === "object"
                ? stats.days
                : {}
        );
    }

    function getMissionPercent(record) {
        const mission =
            record &&
            record.summary &&
            record.summary.mission;

        if (!mission || typeof mission !== "object") {
            return 0;
        }

        if (
            typeof mission.percent === "number"
        ) {
            return mission.percent;
        }

        const values = Object.values(mission);

        if (values.length === 0) {
            return 0;
        }

        const completed = values.filter(Boolean).length;

        return Math.round(
            (completed / values.length) * 100
        );
    }

    function isRainy(record) {
        const weather =
            record &&
            record.summary &&
            record.summary.weather;

        if (!weather) {
            return false;
        }

        const combined = JSON.stringify(
            weather
        ).toLowerCase();

        return (
            combined.includes("rain") ||
            combined.includes("雨") ||
            combined.includes("shower")
        );
    }

    function releaseObjectUrls() {
        activeObjectUrls.forEach(function (url) {
            URL.revokeObjectURL(url);
        });

        activeObjectUrls = [];
    }

    function buildDateMap(records, photos) {
        const map = new Map();

        records.forEach(function (record) {
            const dateKey =
                getRecordDateKey(record);

            if (!dateKey) {
                return;
            }

            const entry = map.get(dateKey) || {
                dateKey: dateKey,
                record: null,
                photo: null
            };

            entry.record = record;
            map.set(dateKey, entry);
        });

        photos.forEach(function (photo) {
            if (!photo || !photo.dateKey) {
                return;
            }

            const entry = map.get(photo.dateKey) || {
                dateKey: photo.dateKey,
                record: null,
                photo: null
            };

            entry.photo = photo;
            map.set(photo.dateKey, entry);
        });

        return map;
    }

    function setView(viewName) {
        const timelineActive =
            viewName === "timeline";

        archiveButton.classList.toggle(
            "active",
            !timelineActive
        );

        timelineButton.classList.toggle(
            "active",
            timelineActive
        );

        archiveButton.setAttribute(
            "aria-selected",
            String(!timelineActive)
        );

        timelineButton.setAttribute(
            "aria-selected",
            String(timelineActive)
        );

        archivePanel.classList.toggle(
            "is-hidden",
            timelineActive
        );

        timelinePanel.classList.toggle(
            "is-hidden",
            !timelineActive
        );

        timelinePanel.setAttribute(
            "aria-hidden",
            String(!timelineActive)
        );

        if (timelineActive) {
            renderTimeline();
        }
    }

    function createBadge(text, className) {
        const badge =
            document.createElement("span");

        badge.className =
            "timeline-cell-badge " +
            className;

        badge.textContent = text;

        return badge;
    }

    function openEntry(entry) {
        if (
            entry.record &&
            typeof window.openVestigeRecord ===
            "function"
        ) {
            window.openVestigeRecord(
                entry.record.id
            );
            return;
        }

        if (
            entry.photo &&
            typeof window.openVestigePhotoLightbox ===
            "function"
        ) {
            window.openVestigePhotoLightbox(
                entry.photo
            );
        }
    }

    function createCell(date, entry, focusDay) {
        const dateKey = getDateKey(date);
        const cell = document.createElement(
            entry ? "button" : "div"
        );

        cell.className = "timeline-cell";
        cell.dataset.date = dateKey;

        if (entry) {
            cell.type = "button";
            cell.classList.add("has-entry");
            cell.addEventListener(
                "click",
                function () {
                    openEntry(entry);
                }
            );
        } else {
            cell.classList.add("is-empty");
        }

        const dateNumber =
            document.createElement("span");

        dateNumber.className =
            "timeline-cell-date";

        dateNumber.textContent =
            String(date.getDate());

        cell.appendChild(dateNumber);

        if (entry && entry.photo && entry.photo.blob) {
            const image =
                document.createElement("img");

            const objectUrl =
                URL.createObjectURL(
                    entry.photo.blob
                );

            activeObjectUrls.push(objectUrl);

            image.src = objectUrl;
            image.alt =
                "Vestige photo " + dateKey;

            cell.appendChild(image);
        } else {
            const fallback =
                document.createElement("div");

            fallback.className =
                "timeline-cell-fallback";

            fallback.innerHTML =
                entry && entry.record
                    ? "<span>V</span><small>Record</small>"
                    : "<span>☾</span><small>No Photo</small>";

            cell.appendChild(fallback);
        }

        const badges =
            document.createElement("div");

        badges.className =
            "timeline-cell-badges";

        if (
            focusDay &&
            Number(focusDay.rounds) > 0
        ) {
            badges.appendChild(
                createBadge(
                    "●",
                    "focus"
                )
            );
        }

        if (
            entry &&
            entry.record &&
            getMissionPercent(entry.record) >= 80
        ) {
            badges.appendChild(
                createBadge(
                    "🎯",
                    "mission"
                )
            );
        }

        if (
            entry &&
            entry.record &&
            isRainy(entry.record)
        ) {
            badges.appendChild(
                createBadge(
                    "☂",
                    "rain"
                )
            );
        }

        if (badges.childNodes.length > 0) {
            cell.appendChild(badges);
        }

        return cell;
    }

    async function renderTimeline() {
        releaseObjectUrls();

        grid.innerHTML = "";
        statusText.textContent =
            "Vestigeと写真を読み込んでいる。";

        try {
            const records = getVestigeRecords();
            const photos = await getPhotos();
            const focusDays = getFocusDays();

            const dateMap =
                buildDateMap(records, photos);

            const year =
                currentMonth.getFullYear();

            const month =
                currentMonth.getMonth();

            monthLabel.textContent =
                year +
                "年" +
                (month + 1) +
                "月";

            const firstDay =
                new Date(year, month, 1);

            const finalDay =
                new Date(
                    year,
                    month + 1,
                    0
                );

            const leadingBlanks =
                firstDay.getDay();

            for (
                let blank = 0;
                blank < leadingBlanks;
                blank += 1
            ) {
                const spacer =
                    document.createElement("div");

                spacer.className =
                    "timeline-cell-spacer";

                grid.appendChild(spacer);
            }

            let daysWithMemory = 0;

            for (
                let day = 1;
                day <= finalDay.getDate();
                day += 1
            ) {
                const date =
                    new Date(
                        year,
                        month,
                        day
                    );

                const dateKey =
                    getDateKey(date);

                const entry =
                    dateMap.get(dateKey);

                const focusDay =
                    focusDays[dateKey];

                if (entry) {
                    daysWithMemory += 1;
                }

                grid.appendChild(
                    createCell(
                        date,
                        entry,
                        focusDay
                    )
                );
            }

            recordCount.textContent =
                daysWithMemory +
                (daysWithMemory === 1
                    ? " day"
                    : " days");

            statusText.textContent =
                daysWithMemory > 0
                    ? "日付をタップすると、その日のVestige詳細を開く。"
                    : "この月にはまだ記録がない。";
        } catch (error) {
            console.error(
                "Meridian Timeline: render failed.",
                error
            );

            statusText.textContent =
                "Timelineを読み込めなかった。";
        }
    }

    archiveButton.addEventListener(
        "click",
        function () {
            setView("archive");
        }
    );

    timelineButton.addEventListener(
        "click",
        function () {
            setView("timeline");
        }
    );

    previousButton.addEventListener(
        "click",
        function () {
            currentMonth.setMonth(
                currentMonth.getMonth() - 1
            );

            renderTimeline();
        }
    );

    nextButton.addEventListener(
        "click",
        function () {
            currentMonth.setMonth(
                currentMonth.getMonth() + 1
            );

            renderTimeline();
        }
    );

    window.addEventListener(
        "meridianVestigePhotoUpdated",
        function () {
            if (
                !timelinePanel.classList.contains(
                    "is-hidden"
                )
            ) {
                renderTimeline();
            }
        }
    );

    window.addEventListener(
        "pagehide",
        releaseObjectUrls
    );
})();
