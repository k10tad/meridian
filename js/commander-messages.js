//========================
// Meridian Commander Messages v1.6.1
// Sebastián Voice / Gentle Starting Tone
//========================

const CommanderMessages = {
    firstConnection: [
        "Madrid Headquarters\n\nConnection established.\n\n……ようこそ、レイ。\n\nこれから君の記録を預かる。\n\n準備ができたら始めよう。",
        "Meridian online.\n\n接続を確認した。\n\nようこそ、レイ。\n\nここからは、君の一日を一緒に組み立てる。",
        "Madrid HQ synchronized.\n\n……来たか、レイ。\n\n今日から記録を始める。\n\n無理に急がなくていい。"
    ],

    greetings: {
        morning: [
            "Buenos días, Rei.",
            "おはよう、レイ。",
            "Morning briefing ready.",
            "Madrid Headquarters, online.",
            "今日の状況を確認する。",
            "……おはよう。始めよう。"
        ],
        afternoon: [
            "Buenas tardes, Rei.",
            "午後の状況を確認する。",
            "Afternoon briefing ready.",
            "まだ十分立て直せる時間だ。",
            "午後の任務を整理する。"
        ],
        evening: [
            "Buenas noches, Rei.",
            "夜間モードに入る。",
            "今日の残りを整えるぞ。",
            "ここからは無理に増やすな。",
            "一日の終わり方を決めよう。"
        ],
        night: [
            "遅い時間だ、レイ。",
            "Night watch active.",
            "まだ起きているのか。無理はするな。",
            "今日はもう、休む準備をしていい。",
            "この時間の判断は鈍る。自分を追い込むな。"
        ]
    },

    weather: {
        lowPressure: [
            "気圧が低い。頭痛に注意しろ。",
            "今日は無理に押し切る日じゃない。",
            "低気圧だ。画面と光を少し減らせ。",
            "外部条件は少し悪い。予定には余白を残せ。",
            "今日は身体の反応を見ながら動け。"
        ],
        rain: [
            "天候が崩れている。移動は慎重に。",
            "雨の日は予定を詰め込みすぎるな。",
            "外に出るなら、身体を冷やすな。",
            "足元と体温に気を配れ。",
            "今日は急がなくていい。濡れる方が面倒だ。"
        ],
        stable: [
            "気象条件は安定している。",
            "外部条件は悪くない。",
            "Local conditions are stable.",
            "天候面で大きな警戒はない。",
            "今日は通常運用で問題ない。"
        ]
    },

    health: {
        headache: [
            "頭痛があるなら、予定は少し削れ。",
            "今日は頭を使いすぎるな。",
            "痛みを無視するな。判断力も落ちる。",
            "光と音を少し減らせ。",
            "今日は短い集中で区切れ。"
        ],
        period: [
            "生理中だ。身体を優先しろ。",
            "任務は逃げない。今日は負担を下げる。",
            "温かくしておけ。命令だ。",
            "今日は体力を残す方を選べ。",
            "予定は削っても構わない。身体の方が先だ。"
        ],
        pms: [
            "PMSが出やすい時期だ。余白を残せ。",
            "感情も身体も揺れやすい。予定は軽く見積もれ。",
            "今日は自分に厳しくしすぎるな。",
            "集中力が落ちても異常ではない。",
            "いつも通りを求めすぎるな。"
        ],
        normal: [
            "Medical logに大きな異常はない。",
            "体調記録は安定している。",
            "通常運用でいい。",
            "今日は大きく崩れてはいない。",
            "身体の反応は落ち着いている。"
        ]
    },

    mission: {
        low: [
            "まず一つ終わらせるぞ。",
            "最初の任務を決めろ。そこからだ。",
            "進捗はこれから作ればいい。",
            "小さい任務でいい。着手しろ。",
            "今日は最初の一手を雑にしないことだ。"
        ],
        middle: [
            "悪くない進み方だ。",
            "その調子で次に移れ。",
            "焦らず、確実に進める。",
            "半分見えてきた。ここで崩すな。",
            "順調だ。次は一つだけ選べ。"
        ],
        high: [
            "かなり進んでいる。最後まで整えろ。",
            "今日はよく動けている。",
            "終盤だ。雑に締めるな。",
            "ここまで来たなら、終わり方を整えろ。",
            "あと少しだ。焦る必要はない。"
        ],
        complete: [
            "任務完了だ。今日はよくやった、レイ。",
            "Operation complete. よく持ちこたえた。",
            "今日は十分だ。休め。",
            "完了を確認した。今日はここまででいい。",
            "よくやった。後は回復に回せ。"
        ]
    },

    relationship: [
        {
            min: 80,
            lines: [
                "……頑張り過ぎるな。帰ってきたら休め。",
                "ちゃんと戻ってこい。待っている。",
                "今日は少し安心して送り出せそうだ。",
                "無事に帰ってこい。それでいい。",
                "あまり強がるな。私は見ている。"
            ]
        },
        {
            min: 50,
            lines: [
                "昨日より顔色はいい。その調子だ。",
                "無理をしなければ、今日は進める。",
                "こちらで状況は見ている。",
                "少しずつ整ってきている。",
                "焦らなくていい。進め方は悪くない。"
            ]
        },
        {
            min: 20,
            lines: [
                "焦る必要はない。",
                "一つずつでいい。",
                "状況を確認してから動け。",
                "急がなくていい。崩さないことが先だ。",
                "君のペースで構わない。"
            ]
        },
        {
            min: 0,
            lines: [
                "無理をする必要はない。",
                "まずは状態を見よう。",
                "こちらの準備はできている。",
                "一つずつ進めればいい。",
                "記録は私が預かる。"
            ]
        }
    ],

    observations: {
        monday: [
            "月曜日は最初から全力で走るな。",
            "週の初めだ。まずは流れを作れ。"
        ],
        friday: [
            "一週間よく持ちこたえた。",
            "金曜だ。最後まで雑に締めるな。"
        ],
        noPlans: [
            "今日は珍しく余白がある。",
            "予定は少ない。回復に回せる。"
        ],
        manyPlans: [
            "予定が多い。優先順位を間違えるな。",
            "詰め込みすぎだ。削る判断も必要だ。"
        ]
    },

    analysis: {
        heavyDay: [
            "体調と予定が重なっている。今日は全部を取りに行く日ではない。",
            "負荷が高い。通常より少なく見積もれ。"
        ],
        recoveryDay: [
            "今日は回復に使える日だ。",
            "予定が少ないなら、身体を整える方へ回せ。"
        ],
        normalDay: [
            "通常運用で進められる。",
            "大きな警戒はない。だが油断はするな。"
        ]
    },

    advice: {
        startSmall: [
            "最初の任務だけ終わらせよう。",
            "小さい任務でいい。着手しろ。"
        ],
        reduceLoad: [
            "予定は削っても構わない。",
            "今日は余力を残せ。"
        ],
        rest: [
            "休む判断も任務のうちだ。",
            "温かいものを飲め。"
        ],
        focus: [
            "一つに絞れ。",
            "同時に抱えるな。順番に処理しろ。"
        ]
    },

    closings: [
        "行ってこい。",
        "無事に戻れ。",
        "今日はそれで十分だ。",
        "報告を待つ。",
        "まずは一つだ。",
        "落ち着いて行け。",
        "焦るな。",
        "必要なら、また戻ってこい。"
    ]
};

function commanderPick(list) {
    if (!Array.isArray(list) || list.length === 0) return "";
    return list[Math.floor(Math.random() * list.length)];
}

function commanderGetGreetingLine() {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
        return commanderPick(CommanderMessages.greetings.morning);
    }

    if (hour >= 12 && hour < 18) {
        return commanderPick(CommanderMessages.greetings.afternoon);
    }

    if (hour >= 18 && hour < 23) {
        return commanderPick(CommanderMessages.greetings.evening);
    }

    return commanderPick(CommanderMessages.greetings.night);
}

function commanderGetRelationshipLine(affinity) {
    const block = CommanderMessages.relationship.find(function (item) {
        return affinity >= item.min;
    });

    if (!block) return "";

    return commanderPick(block.lines);
}

function commanderGetFirstConnectionMessage() {
    return commanderPick(CommanderMessages.firstConnection);
}

