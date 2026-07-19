//========================
// Meridian Medication Knowledge v2.3
// Conservative reminder engine. It never decides dose or replaces a clinician.
//========================
(function () {
    "use strict";

    const KNOWLEDGE = {
        "ロメリジン": {
            category: "片頭痛予防薬",
            ingredient: "ロメリジン塩酸塩",
            routine: true,
            baseline: "眠気、めまい、ふらつきなどの変化を確認しろ。",
            caution: "強い眠気、著しいふらつき、動悸など普段と違う症状があれば、追加判断をせず医療者へ確認しろ。"
        },
        "イブプロフェン": {
            category: "NSAIDs / 解熱鎮痛薬",
            ingredient: "イブプロフェン",
            routine: false,
            baseline: "空腹時を避け、ほかの解熱鎮痛薬との重複がないか確認しろ。",
            caution: "胃痛、黒い便、息苦しさ、むくみなどがあれば使用を重ねず医療者へ相談しろ。"
        },
        "レイボー": {
            category: "片頭痛急性期治療薬",
            ingredient: "ラスミジタンコハク酸塩",
            routine: false,
            baseline: "眠気、めまい、ふらつきが出ることがある。服用後の運転や危険作業は避けろ。",
            caution: "強い眠気や平衡感覚の異常があるなら、一人で無理に動くな。"
        },
        "トラベルミン": {
            category: "抗ヒスタミン系鎮暈薬",
            ingredient: "ジフェンヒドラミンサリチル酸塩として管理",
            routine: false,
            baseline: "眠気、口渇、ふらつき、目のかすみなどに注意し、運転と飲酒は避けろ。",
            caution: "ほかの抗ヒスタミン薬や眠気を起こす薬との重複がないか確認しろ。"
        },
        "エルペイン": {
            category: "生理痛専用薬 / NSAIDs・鎮痙薬配合",
            ingredient: "イブプロフェン・ブチルスコポラミン臭化物",
            routine: false,
            baseline: "ほかの解熱鎮痛薬、鎮痙薬、乗物酔い薬との重複を避け、運転と飲酒を控えろ。",
            caution: "目のかすみ、異常なまぶしさ、排尿困難、強い胃症状などがあれば服用を重ねず医療者へ相談しろ。"
        }
    };

    const INTERACTIONS = [
        {
            medicines: ["エルペイン", "イブプロフェン"],
            level: "high",
            title: "イブプロフェンが重複している",
            message: "エルペインにはイブプロフェンが含まれる。追加服用はせず、記録違いでなければ薬剤師か処方元へ確認しろ。",
            detail: "解熱鎮痛薬の重複アラート"
        },
        {
            medicines: ["エルペイン", "トラベルミン"],
            level: "high",
            title: "エルペインと乗物酔い薬の併用警告",
            message: "エルペイン服用中は乗物酔い薬を服用しないよう添付文書に記載されている。自己判断で追加せず確認しろ。",
            detail: "併用回避アラート"
        },
        {
            medicines: ["レイボー", "トラベルミン"],
            level: "high",
            title: "眠気とふらつきが重なる組み合わせだ",
            message: "ラスミジタンとジフェンヒドラミン系薬では、中枢神経抑制が相加的に強まる可能性がある。自己判断で併用を進めず、医師か薬剤師へ確認しろ。",
            detail: "鎮静作用の重複アラート"
        },
        {
            medicines: ["レイボー", "エルペイン"],
            level: "warning",
            title: "急性期薬が同日に重なっている",
            message: "一律の併用禁止とは扱わないが、眠気、めまい、目のかすみ、胃症状が重なる可能性がある。追加前に処方指示を確認しろ。",
            detail: "自己判断での追加服用を避ける確認アラート"
        }
    ];


    const PREVENTIVE_RULES = [
        {
            trigger: "エルペイン",
            avoid: ["イブプロフェン", "トラベルミン"],
            level: "high",
            title: "今日は避ける薬がある",
            message: "エルペインを記録した。今日は追加のイブプロフェンとトラベルミンを自己判断で服用するな。",
            detail: "エルペインにはイブプロフェンが含まれ、乗物酔い薬との併用回避も必要だ。"
        },
        {
            trigger: "イブプロフェン",
            avoid: ["エルペイン"],
            level: "high",
            title: "エルペインは今日は避けろ",
            message: "イブプロフェンを記録した。今日はエルペインを自己判断で追加するな。",
            detail: "エルペインにもイブプロフェンが含まれるため、成分が重複する。"
        },
        {
            trigger: "トラベルミン",
            avoid: ["エルペイン"],
            confirm: ["レイボー"],
            level: "high",
            title: "今日は追加薬を慎重に選べ",
            message: "トラベルミンを記録した。今日はエルペインを避け、レイボーは処方指示を確認してからにしろ。",
            detail: "エルペインとは併用回避、レイボーとは眠気・めまい・ふらつきの重複に注意が必要だ。"
        },
        {
            trigger: "レイボー",
            avoid: [],
            confirm: ["トラベルミン", "エルペイン"],
            level: "warning",
            title: "今日は鎮静作用の重複に注意しろ",
            message: "レイボーを記録した。トラベルミンやエルペインを追加する前に、処方指示を確認しろ。",
            detail: "眠気、めまい、ふらつき、目のかすみなどが重なる可能性がある。"
        }
    ];

    function parseTime(value) {
        const time = new Date(value).getTime();
        return Number.isFinite(time) ? time : 0;
    }

    function dateOnly(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + d;
    }

    function logsForMedicine(logs, medicine) {
        return (Array.isArray(logs) ? logs : []).filter(function (log) {
            return log && log.name === medicine && parseTime(log.takenAt) > 0;
        });
    }

    function uniqueDaysWithin(logs, days, now) {
        const since = now.getTime() - ((days - 1) * 86400000);
        const dates = new Set();
        logs.forEach(function (log) {
            const time = parseTime(log.takenAt);
            if (time >= since && time <= now.getTime()) dates.add(dateOnly(log.takenAt));
        });
        return dates.size;
    }

    function findInteraction(medicine, logs, currentLog, now) {
        const sameDayNames = new Set((Array.isArray(logs) ? logs : []).filter(function (log) {
            return log && log.id !== (currentLog && currentLog.id) && dateOnly(log.takenAt) === dateOnly(now);
        }).map(function (log) { return log.name; }));

        return INTERACTIONS.find(function (rule) {
            if (rule.medicines.indexOf(medicine) === -1) return false;
            return rule.medicines.some(function (name) {
                return name !== medicine && sameDayNames.has(name);
            });
        }) || null;
    }

    function getPreventiveRule(medicine) {
        return PREVENTIVE_RULES.find(function (rule) {
            return rule.trigger === medicine;
        }) || null;
    }

    function getPreventiveAlert(medicine, currentLog) {
        const info = KNOWLEDGE[medicine];
        const rule = getPreventiveRule(medicine);
        if (!info || !rule) return null;
        const now = currentLog && currentLog.takenAt ? new Date(currentLog.takenAt) : new Date();
        return {
            medicine: medicine,
            ingredient: info.ingredient,
            category: info.category,
            level: rule.level,
            title: rule.title,
            message: rule.message,
            detail: rule.detail,
            avoidToday: (rule.avoid || []).slice(),
            confirmToday: (rule.confirm || []).slice(),
            preventive: true,
            createdAt: now.toISOString()
        };
    }

    function getTodayRestrictions(logs, now) {
        const date = dateOnly(now || new Date());
        const avoid = new Set();
        const confirm = new Set();
        const reasons = {};
        (Array.isArray(logs) ? logs : []).forEach(function (log) {
            if (!log || dateOnly(log.takenAt) !== date) return;
            const rule = getPreventiveRule(log.name);
            if (!rule) return;
            (rule.avoid || []).forEach(function (name) {
                avoid.add(name);
                reasons[name] = rule.message;
            });
            (rule.confirm || []).forEach(function (name) {
                if (!avoid.has(name)) confirm.add(name);
                if (!reasons[name]) reasons[name] = rule.message;
            });
        });
        return { avoid: Array.from(avoid), confirm: Array.from(confirm), reasons: reasons };
    }

    function evaluate(medicine, logs, currentLog) {
        const info = KNOWLEDGE[medicine];
        if (!info) return null;

        const now = currentLog && currentLog.takenAt ? new Date(currentLog.takenAt) : new Date();
        const relevant = logsForMedicine(logs, medicine).sort(function (a, b) {
            return parseTime(a.takenAt) - parseTime(b.takenAt);
        });
        const currentId = currentLog && currentLog.id;
        const previous = relevant.filter(function (log) { return !currentId || log.id !== currentId; }).pop();
        const sameDayCount = relevant.filter(function (log) { return dateOnly(log.takenAt) === dateOnly(now); }).length;
        const sevenDayUseDays = uniqueDaysWithin(relevant, 7, now);
        const thirtyDayUseDays = uniqueDaysWithin(relevant, 30, now);
        const hoursSincePrevious = previous ? (now.getTime() - parseTime(previous.takenAt)) / 3600000 : null;
        const interaction = findInteraction(medicine, logs, currentLog, now);
        const preventive = getPreventiveAlert(medicine, currentLog);

        let level = "info";
        let title = medicine + "を記録した";
        let message = info.baseline;
        let detail = info.caution;

        if (interaction) {
            level = interaction.level;
            title = interaction.title;
            message = interaction.message;
            detail = interaction.detail + "。" + info.caution;
        } else if (preventive) {
            level = preventive.level;
            title = preventive.title;
            message = preventive.message;
            detail = preventive.detail + " " + info.caution;
        } else if (!info.routine && hoursSincePrevious !== null && hoursSincePrevious >= 0 && hoursSincePrevious < 4) {
            level = "high";
            title = "前回の記録から間隔が短い";
            message = "追加で服用する判断はせず、処方・製品の用法と前回時刻を確認しろ。";
        } else if (!info.routine && sameDayCount >= 2) {
            level = "warning";
            title = "本日" + sameDayCount + "回目の記録だ";
            message = "同日の使用が重なっている。用法、他剤との重複、症状の変化を確認しろ。";
        } else if (!info.routine && sevenDayUseDays >= 3) {
            level = "warning";
            title = "直近7日で" + sevenDayUseDays + "日使用している";
            message = "頓服の使用日が増えている。症状の頻度ごと記録し、続くなら主治医へ共有しろ。";
        } else if (!info.routine && thirtyDayUseDays >= 10) {
            level = "warning";
            title = "直近30日の使用頻度が高めだ";
            message = "薬だけで押さえ込まず、症状日数と効き方を主治医へ共有できる形で残せ。";
        }

        return {
            medicine: medicine,
            ingredient: info.ingredient,
            category: info.category,
            level: level,
            title: title,
            message: message,
            detail: detail,
            avoidToday: preventive ? preventive.avoidToday : [],
            confirmToday: preventive ? preventive.confirmToday : [],
            preventive: Boolean(preventive && !interaction),
            sameDayCount: sameDayCount,
            sevenDayUseDays: sevenDayUseDays,
            thirtyDayUseDays: thirtyDayUseDays,
            createdAt: now.toISOString()
        };
    }

    function saveLatest(alert) {
        if (!alert) return;
        localStorage.setItem("meridianMedicationAlert", JSON.stringify(alert));
        window.dispatchEvent(new CustomEvent("meridian:medication-alert", { detail: alert }));
    }

    function readLatest() {
        try {
            const value = JSON.parse(localStorage.getItem("meridianMedicationAlert"));
            return value && value.medicine ? value : null;
        } catch (error) {
            return null;
        }
    }

    window.MeridianMedicationKnowledge = {
        knowledge: KNOWLEDGE,
        interactions: INTERACTIONS,
        preventiveRules: PREVENTIVE_RULES,
        getPreventiveAlert: getPreventiveAlert,
        getTodayRestrictions: getTodayRestrictions,
        evaluate: evaluate,
        saveLatest: saveLatest,
        readLatest: readLatest
    };
})();
