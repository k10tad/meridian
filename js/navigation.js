//========================
// Meridian Mobile Navigation
//========================

const tabButtons = document.querySelectorAll(".tab-btn");
const appPages = document.querySelectorAll(".app-page");
const messageBox = document.getElementById("message");

const pageMessages = {
    deskPage: "司令室だ。今日の状態を確認する。",
    plannerPage: "予定を確認する。抜けがないようにしろ。",
    focusPage: "集中するぞ。まずは一つ終わらせる。",
    healthPage: "体調を見せろ。無理は許可しない。",
    vestigePage: "記録を確認する。Vestigeを開く。"
};

function switchPage(pageId) {
    appPages.forEach(function (page) {
        page.classList.remove("active-page");
    });

    tabButtons.forEach(function (button) {
        button.classList.remove("active");
    });

    const targetPage = document.getElementById(pageId);
    const targetButton = document.querySelector('[data-page="' + pageId + '"]');

    if (targetPage) {
        targetPage.classList.add("active-page");
    }

    if (targetButton) {
        targetButton.classList.add("active");
    }

    if (messageBox && pageMessages[pageId]) {
        messageBox.textContent = pageMessages[pageId];
    }

    localStorage.setItem("meridianLastPage", pageId);
}

tabButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        switchPage(button.dataset.page);
    });
});

const savedPage = localStorage.getItem("meridianLastPage") || "deskPage";
switchPage(savedPage);
