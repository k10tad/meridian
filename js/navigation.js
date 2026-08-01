// Meridian Line Navigation v3
(function () {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const appPages = document.querySelectorAll(".app-page");
    const messageBox = document.getElementById("message");
    const migrations = { focusPage: "trainingPage", vestigePage: "archivePage" };
    const pageMessages = {
        deskPage: "司令室だ。今日の状態を確認する。",
        plannerPage: "予定を確認する。抜けがないようにしろ。",
        trainingPage: "身体を動かす。無理はせず、記録は正確に。",
        healthPage: "体調を見せろ。無理は許可しない。",
        archivePage: "必要な記録だけを開く。"
    };

    function switchPage(pageId) {
        pageId = migrations[pageId] || pageId;
        if (!document.getElementById(pageId)) pageId = "deskPage";
        appPages.forEach(function (page) { page.classList.toggle("active-page", page.id === pageId); });
        tabButtons.forEach(function (button) { button.classList.toggle("active", button.dataset.page === pageId); });
        if (messageBox && pageMessages[pageId]) messageBox.textContent = pageMessages[pageId];
        localStorage.setItem("meridianLastPage", pageId);
        window.scrollTo({ top: 0, behavior: "auto" });
    }

    tabButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            const target = migrations[button.dataset.page] || button.dataset.page;
            const current = document.querySelector(".app-page.active-page");
            if (!current || current.id !== target) window.MeridianSounds?.play("navigation");
            switchPage(button.dataset.page);
        });
    });
    window.MeridianNavigation = { switchPage: switchPage };
    switchPage(localStorage.getItem("meridianLastPage") || "deskPage");
})();
