//========================
// Meridian Today's Condition
//========================

const conditionButtons = document.querySelectorAll(".condition-btn");
const deskGreetingBox = document.getElementById("deskGreeting");
const todayOrdersList = document.getElementById("todayOrders");

const conditionData = {
    good: {
        line: "顔色は悪くない。今日は少し攻められそうだ。",
        orders: [
            "25分集中を2回",
            "ボクシングを軽く1セット",
            "水分を忘れるな"
        ],
        trust: 2
    },

    normal: {
        line: "いつも通りでいい。崩さず進めるぞ。",
        orders: [
            "25分集中を1回",
            "今日の予定を確認する",
            "水を一杯飲む"
        ],
        trust: 1
    },

    tired: {
        line: "了解した。今日は量より質だ。",
        orders: [
            "作業は20分だけ",
            "予定を一つ減らす",
            "休憩を長めに取る"
        ],
        trust: 1
    },

    headache: {
        line: "頭痛か。画面を見すぎるな。照明も落とせ。",
        orders: [
            "水を飲む",
            "強い運動はしない",
            "画面を見る時間を短くする"
        ],
        trust: 1
    },

    period: {
        line: "記録した。今日は身体の負担を優先して考える。",
        orders: [
            "運動は軽めにする",
            "温かくして過ごす",
            "無理なら予定を減らす"
        ],
        trust: 1
    },

    low: {
        line: "分かった。今日はノルマを半分にする。",
        orders: [
            "一つだけ終わらせれば十分",
            "1分だけ身体を動かす",
            "ここに戻ってくればいい"
        ],
        trust: 1
    }
};

function renderOrders(orders) {
    if (!todayOrdersList) return;

    todayOrdersList.innerHTML = "";

    orders.forEach(function (order) {
        const li = document.createElement("li");
        li.textContent = order;
        todayOrdersList.appendChild(li);
    });
}

function saveCondition(condition) {
    const today = new Date().toDateString();

    localStorage.setItem("meridianConditionDate", today);
    localStorage.setItem("meridianTodayCondition", condition);
}

function applyCondition(condition, shouldAddTrust) {
    const data = conditionData[condition];

    if (!data) return;

    if (deskGreetingBox) {
        deskGreetingBox.textContent = data.line;
    }

    renderOrders(data.orders);
    saveCondition(condition);

    conditionButtons.forEach(function (button) {
        button.classList.remove("selected");

        if (button.dataset.condition === condition) {
            button.classList.add("selected");
        }
    });

    if (shouldAddTrust && typeof addTrust === "function") {
        addTrust(data.trust);
    }

    if (typeof completeMission === "function") {
    completeMission("condition");
}
}

conditionButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        applyCondition(button.dataset.condition, true);
    });
});

function loadTodayCondition() {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem("meridianConditionDate");
    const savedCondition = localStorage.getItem("meridianTodayCondition");

    if (savedDate === today && savedCondition) {
        applyCondition(savedCondition, false);
    }
}

loadTodayCondition();
