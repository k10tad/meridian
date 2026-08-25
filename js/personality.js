//========================
// Meridian Commander Engine v2.0
// personality.js - relationship tone
//========================

window.MeridianCommanderPersonality = {
    relationship: [
        {
            min: 80,
            lines: [
                "……頑張り過ぎるな。帰ってきたら休め。",
                "戻ってこい。俺はここにいる。",
                "今日は少し安心して送り出せそうだ。",
                "無事に帰ってこい。それでいい。",
                "強がるな、レイ。俺には分かる。"
            ]
        },
        {
            min: 50,
            lines: [
                "昨日より顔色はいい。その調子だ。",
                "無理をしなければ、今日は進める。",
                "状況は見ている。無茶だけはするな。",
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
                "お前の速度で構わない。崩すな。"
            ]
        },
        {
            min: 0,
            lines: [
                "無理をする必要はない。",
                "まず状態を見せろ。",
                "準備はできている。",
                "一つずつ進めればいい。",
                "記録は俺が預かる。"
            ]
        }
    ]
};

function commanderGetPersonalityLine(affinity) {
    const blocks = window.MeridianCommanderPersonality.relationship;
    const block = blocks.find(function (item) {
        return affinity >= item.min;
    });

    return window.MeridianCommanderEngine.pick(block ? block.lines : [""]);
}
