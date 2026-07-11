//========================
// Meridian Commander Engine v2.0
// analysis.js - situational judgment
//========================

window.MeridianCommanderAnalysis = {
    heavyDay: [
        "体調と予定が重なっている。今日は全部を取りに行く日ではない。",
        "負荷が高い。通常より少なく見積もれ。",
        "予定量に対して身体条件が悪い。優先順位を変える。"
    ],
    recoveryDay: [
        "今日は回復に使える日だ。",
        "予定が少ないなら、身体を整える方へ回せ。",
        "動ける余地があるなら、まず回復を入れろ。"
    ],
    normalDay: [
        "通常運用で進められる。",
        "大きな警戒はない。だが油断はするな。",
        "状況は悪くない。順番に処理すればいい。"
    ],
    missionFocused: [
        "進捗は悪くない。残りは精度を落とさず処理しろ。",
        "ここまで来たなら、終わり方を整えろ。"
    ],
    missionComplete: [
        "完了を確認した。今日はもう増やすな。",
        "任務完了だ。後は回復に回せ。"
    ]
};

function commanderAnalyze(data) {
    const plannerCount = data.plannerCount || 0;
    const health = data.health || {};
    const lowPressure = data.weather && Number(data.weather.pressure) <= 1008;
    const hasHealthRisk = !!(
        health.headache ||
        health.dizzy ||
        health.period ||
        health.pms ||
        data.cycle.isPeriod ||
        data.cycle.isPmsWindow
    );

    if (data.missionPercent >= 100) return "missionComplete";
    if (data.missionPercent >= 80) return "missionFocused";
    if ((hasHealthRisk || lowPressure) && plannerCount >= 3) return "heavyDay";
    if (plannerCount === 0 && hasHealthRisk) return "recoveryDay";
    return "normalDay";
}
