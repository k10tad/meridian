//========================
// Meridian Focus Messages
// Phase 3: Commander integration
//========================

window.MeridianFocusMessages = {
    start: {
        normal: [
            "最初の25分だけでいい。今は一つだけ見ろ。",
            "Roundを開始する。順番に処理しろ。",
            "焦るな。まずこの25分を使え。",
            "余計な窓は閉じろ。集中先は一つでいい。",
            "始めよう。完璧ではなく、着手を優先しろ。"
        ],

        gentle: [
            "無理に速度を上げなくていい。最初の25分だけ進めよう。",
            "こちらで時間は見ている。君は一つだけ進めればいい。",
            "焦らなくていい。今はこのRoundだけ考えろ。",
            "少しずつで構わない。始めよう、レイ。",
            "君のペースでいい。25分だけ付き合おう。"
        ],

        headache: [
            "頭痛がある。画面の明るさを落として、短く集中しろ。",
            "今日は痛みを無視するな。無理なら途中で止めていい。",
            "頭痛がある日は精度を優先しろ。速度はいらない。",
            "刺激を減らせ。今日は静かな25分にする。",
            "痛みが強くなる前に切り上げろ。開始する。"
        ],

        period: [
            "今日は身体を優先しろ。25分すべて使う必要はない。",
            "生理中だ。無理なら途中で止めて構わない。",
            "温かくして、負担の少ない作業から始めろ。",
            "今日は量より消耗管理だ。静かに進めよう。",
            "身体の反応を見ながらでいい。開始する。"
        ],

        tired: [
            "疲れているなら、成果は一つで十分だ。",
            "今日は量を求めるな。このRoundだけ整えろ。",
            "疲労がある。重い作業は避けて始めよう。",
            "25分を使い切らなくてもいい。状態を優先しろ。",
            "今は小さい任務だけでいい。始めるぞ。"
        ]
    },

    pause: [
        "一時停止した。再開できる時に戻れ。",
        "止めた判断でいい。焦る必要はない。",
        "ここで区切る。状態が整ったら戻ればいい。",
        "時間は逃げない。落ち着いてから再開しろ。",
        "一度止めた。無理にすぐ戻るな。"
    ],

    focusComplete: {
        normal: [
            "よく集中した。今は5分、画面から離れろ。",
            "Round完了。立って少し身体を動かせ。",
            "25分終わった。目と肩を休ませろ。",
            "ここで休憩だ。次のことはまだ考えるな。",
            "よくやった。5分は回復に使え。"
        ],

        warm: [
            "よくやった、レイ。今はきちんと休め。",
            "集中できたな。5分だけこちらに任せろ。",
            "十分だ。目を閉じて少し休め。",
            "Round完了。無理に次へ急がなくていい。",
            "よく持ちこたえた。今は休憩だ。"
        ],

        headache: [
            "Round完了。頭痛が強くなっていないか確認しろ。",
            "ここで画面から離れろ。光と音を減らせ。",
            "25分終わった。痛みが増えたなら次は休め。",
            "休憩だ。目を閉じて刺激を減らせ。",
            "よく止まれた。次のRoundは状態を見て決めろ。"
        ],

        period: [
            "Round完了。身体を冷やすな。5分休め。",
            "よくやった。今は姿勢を楽にしろ。",
            "休憩だ。温かいものがあるなら取れ。",
            "25分終わった。次を急ぐ必要はない。",
            "十分進んだ。身体の反応を確認しろ。"
        ]
    },

    breakStart: [
        "休憩を開始する。画面から目を離せ。",
        "5分休め。今は成果を増やす時間じゃない。",
        "Breakに入る。肩と手を緩めろ。",
        "休憩だ。水分を確認しろ。",
        "この5分は何もしなくていい。"
    ],

    breakComplete: {
        normal: [
            "休憩終了。戻れるなら次のRoundを始めよう。",
            "5分経った。状態を確認してから戻れ。",
            "Break完了。次へ進めるなら開始しろ。",
            "戻る準備はできたか。焦らず始めればいい。",
            "次のRoundへ移れる。無理ならもう少し休め。"
        ],

        warm: [
            "戻れるか、レイ。無理ならもう少し休んでいい。",
            "休憩は終わった。君の準備ができたら始めよう。",
            "こちらは準備できている。急がなくていい。",
            "戻ってこられたなら十分だ。次を始めよう。",
            "状態はどうだ。進める範囲で構わない。"
        ],

        caution: [
            "休憩終了。ただし、状態が悪いなら次は始めるな。",
            "戻る前に痛みや疲労を確認しろ。",
            "次のRoundは必須ではない。身体を優先しろ。",
            "無理に再開する必要はない。今日はここまででもいい。",
            "状態が戻っていなければ、休憩を延長しろ。"
        ]
    },

    reset: [
        "タイマーを初期状態へ戻した。",
        "Roundをリセットした。必要な時に始めればいい。",
        "最初から組み直した。焦る必要はない。",
        "Focusを待機状態へ戻した。",
        "準備は整っている。開始は君のタイミングでいい。"
    ]
};

window.MeridianFocusMessageEngine = {
    pick: function (list, fallback) {
        if (!Array.isArray(list) || list.length === 0) {
            return fallback || "";
        }

        return list[Math.floor(Math.random() * list.length)];
    },

    safeReadJson: function (key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            console.warn("Meridian Focus: storage parse failed.", key, error);
            return fallback;
        }
    },

    getContext: function () {
        const todayKey = new Date().toDateString();

        const health = this.safeReadJson(
            "meridianHealthLog_" + todayKey,
            {}
        );

        const relationship = this.safeReadJson(
            "relationship",
            {
                level: 1,
                affinity: 0,
                totalTrust: 0
            }
        );

        return {
            health: health || {},
            relationship: relationship || {}
        };
    },

    getStartMessage: function () {
        const context = this.getContext();
        const health = context.health;
        const relationship = context.relationship;

        if (health.headache) {
            return this.pick(
                window.MeridianFocusMessages.start.headache
            );
        }

        if (health.period) {
            return this.pick(
                window.MeridianFocusMessages.start.period
            );
        }

        if (health.dizzy || health.pms) {
            return this.pick(
                window.MeridianFocusMessages.start.tired
            );
        }

        if (
            Number(relationship.level || 1) >= 3 ||
            Number(relationship.affinity || 0) >= 50
        ) {
            return this.pick(
                window.MeridianFocusMessages.start.gentle
            );
        }

        return this.pick(
            window.MeridianFocusMessages.start.normal
        );
    },

    getPauseMessage: function () {
        return this.pick(
            window.MeridianFocusMessages.pause
        );
    },

    getFocusCompleteMessage: function () {
        const context = this.getContext();
        const health = context.health;
        const relationship = context.relationship;

        if (health.headache) {
            return this.pick(
                window.MeridianFocusMessages.focusComplete.headache
            );
        }

        if (health.period) {
            return this.pick(
                window.MeridianFocusMessages.focusComplete.period
            );
        }

        if (
            Number(relationship.level || 1) >= 3 ||
            Number(relationship.affinity || 0) >= 50
        ) {
            return this.pick(
                window.MeridianFocusMessages.focusComplete.warm
            );
        }

        return this.pick(
            window.MeridianFocusMessages.focusComplete.normal
        );
    },

    getBreakStartMessage: function () {
        return this.pick(
            window.MeridianFocusMessages.breakStart
        );
    },

    getBreakCompleteMessage: function () {
        const context = this.getContext();
        const health = context.health;
        const relationship = context.relationship;

        if (
            health.headache ||
            health.dizzy ||
            health.period ||
            health.pms
        ) {
            return this.pick(
                window.MeridianFocusMessages.breakComplete.caution
            );
        }

        if (
            Number(relationship.level || 1) >= 3 ||
            Number(relationship.affinity || 0) >= 50
        ) {
            return this.pick(
                window.MeridianFocusMessages.breakComplete.warm
            );
        }

        return this.pick(
            window.MeridianFocusMessages.breakComplete.normal
        );
    },

    getResetMessage: function () {
        return this.pick(
            window.MeridianFocusMessages.reset
        );
    }
};

