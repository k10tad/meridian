//========================
// Meridian Commander Messages v1.4.2
// Sebastián voice database
//========================

const CommanderMessages = {
    greetings: {
        morning: "Buenos días, Rei.",
        afternoon: "Buenas tardes, Rei.",
        evening: "Buenas noches, Rei.",
        night: "遅い時間だ。無理はするな、レイ。"
    },

    readiness: {
        READY: [
            "Operational Status: READY。状況は悪くない。まず一つ終わらせるぞ。",
            "今日は通常任務で進められる。焦る必要はない。"
        ],

        CAUTION: [
            "Operational Status: CAUTION。動けるが、長時間の集中は避けろ。",
            "少し注意が必要だ。予定には余白を残せ。"
        ],

        LIMITED: [
            "Operational Status: LIMITED。通常任務は絞れ。重要な一つだけを片付けろ。",
            "今日は量より質だ。無駄に押し切るな。"
        ],

        RECOVERY: [
            "Operational Status: RECOVERY。今日は回復を優先しろ。予定は削れるものから削れ。",
            "今日は身体の方を優先しろ。任務は逃げない。"
        ]
    },

    special: {
        headachePressure: "頭痛と低気圧が重なっている。午前は無理をするな。画面と光を減らせ。",
        period: "生理中だ。身体の負担を優先しろ。任務は逃げない。",
        pms: "PMSが出やすい時期だ。睡眠と頭痛に注意しろ。予定は余白を残せ。",
        missionHigh: "進捗は良い。最後まで整えて終われ。",
        missionComplete: "任務完了だ。今日はよくやった、レイ。"
    },

    relationshipTone: [
        {
            min: 80,
            suffix: "……頑張り過ぎるな。帰ってきたら休め。"
        },
        {
            min: 50,
            suffix: "昨日より顔色はいい。その調子だ。"
        },
        {
            min: 20,
            suffix: "焦る必要はない。こちらで状況は見ている。"
        },
        {
            min: 0,
            suffix: ""
        }
    ]
};

function pickCommanderMessage(list) {
    if (!Array.isArray(list) || list.length === 0) return "";
    return list[Math.floor(Math.random() * list.length)];
}
