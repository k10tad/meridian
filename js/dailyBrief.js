//========================
// Meridian Daily Brief
//========================

const briefDate = document.getElementById("briefDate");
const briefCondition = document.getElementById("briefCondition");
const briefMessage = document.getElementById("briefMessage");

const conditionLabels = {
    good: "元気",
    normal: "普通",
    tired: "疲れてる",
    headache: "頭痛",
    period: "生理中",
    low: "気分低下"
};

function renderBriefDate() {
    if (!briefDate) return;

    const today = new Date();

    briefDate.textContent = today.toLocaleDateString("ja-JP", {
        month: "long",
        day: "numeric",
        weekday: "short"
    });
}

function renderDailyBrief() {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem("meridianConditionDate");
    const savedCondition = localStorage.getItem("meridianTodayCondition");

    if (savedDate === today && savedCondition) {
        const label = conditionLabels[savedCondition] || "確認済み";

        if (briefCondition) {
            briefCondition.textContent = label;
        }

        if (briefMessage) {
            briefMessage.textContent = getBriefMessage(savedCondition);
        }

        return;
    }

    if (briefCondition) {
        briefCondition.textContent = "未確認";
    }

    if (briefMessage) {
        briefMessage.textContent = "まず今日の状態を確認する。そこから予定を組む。";
    }
}

function getBriefMessage(condition) {
    const messages = {
        good: "今日は少し攻められる。だが、調子に乗りすぎるな。",
        normal: "いつも通りでいい。崩さず進める。",
        tired: "今日は量より質だ。予定は少し絞れ。",
        headache: "頭痛があるなら、画面と光を減らせ。無理はするな。",
        period: "身体の負担を優先しろ。予定は調整できる。",
        low: "今日は一つでいい。戻ってきたなら、それで十分だ。"
    };

    return messages[condition] || "今日の状態を確認した。";
}

renderBriefDate();
renderDailyBrief();
