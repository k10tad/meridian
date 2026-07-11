//========================
// Meridian Commander Engine v2.0
// advice.js - practical suggestions
//========================

window.MeridianCommanderAdvice = {
    startSmall: [
        "最初の任務だけ終わらせよう。",
        "小さい任務でいい。着手しろ。",
        "まず一つだ。勢いは後から来る。"
    ],
    reduceLoad: [
        "予定は削っても構わない。",
        "今日は余力を残せ。",
        "全部終わらせる必要はない。残す判断も仕事だ。"
    ],
    rest: [
        "休む判断も任務のうちだ。",
        "温かいものを飲め。",
        "身体を整える時間を先に確保しろ。"
    ],
    focus: [
        "一つに絞れ。",
        "同時に抱えるな。順番に処理しろ。",
        "重要なものから片付けろ。軽いものに逃げるな。"
    ],
    closeDay: [
        "今日はここで締めていい。",
        "終わったなら、増やすな。",
        "後は休め。明日の判断力を残せ。"
    ]
};

function commanderChooseAdviceKey(data, analysisKey) {
    const plannerCount = data.plannerCount || 0;
    const health = data.health || {};

    if (data.missionPercent >= 100) return "closeDay";

    if (
        analysisKey === "heavyDay" ||
        health.headache ||
        health.period ||
        health.pms ||
        data.cycle.isPeriod ||
        data.cycle.isPmsWindow
    ) {
        return "reduceLoad";
    }

    if (plannerCount === 0) return "rest";
    if (plannerCount >= 4) return "focus";
    return "startSmall";
}
