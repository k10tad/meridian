//========================
// Meridian Desk
// Commander Home v1.1
//========================

const deskGreeting = document.getElementById("deskGreeting");
const deskMessageBox = document.getElementById("message");

function getDeskTimeGreeting() {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 11) {
        return "おはよう、レイ。今日はどうだ。";
    }

    if (hour >= 11 && hour < 17) {
        return "昼だ。ペースを崩すな。";
    }

    if (hour >= 17 && hour < 22) {
        return "夕方だな。今日の残りを確認する。";
    }

    return "遅い時間だ。無理はするな、レイ。";
}

function applyDeskGreeting() {
    // Commander.js owns the hero greeting.
    // Desk keeps a safe fallback only when the hero is still empty.
    if (deskGreeting && !deskGreeting.textContent.trim()) {
        deskGreeting.textContent = getDeskTimeGreeting();
    }
}

applyDeskGreeting();

