//========================
// Meridian Commander Engine v2.0
// engine.js - compose hero and intelligence messages
//========================

window.MeridianCommanderEngine = {
    pick: function (list, fallback) {
        if (!Array.isArray(list) || list.length === 0) return fallback || "";
        return list[Math.floor(Math.random() * list.length)];
    },

    getGreeting: function () {
        const hour = new Date().getHours();
        const greetings = window.MeridianCommanderMessages.greetings;

        if (hour >= 5 && hour < 12) return this.pick(greetings.morning);
        if (hour >= 12 && hour < 18) return this.pick(greetings.afternoon);
        if (hour >= 18 && hour < 23) return this.pick(greetings.evening);
        return this.pick(greetings.night);
    },

    getFirstConnection: function () {
        return this.pick(window.MeridianCommanderMessages.firstConnection);
    },

    getSeasonKey: function () {
        const month = new Date().getMonth() + 1;
        if (month >= 3 && month <= 5) return "spring";
        if (month >= 6 && month <= 8) return "summer";
        if (month >= 9 && month <= 11) return "autumn";
        return "winter";
    },

    getWeekdayKey: function () {
        const day = new Date().getDay();
        return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][day];
    },

    getWeatherObservation: function (data) {
        const weather = data.weather;
        const obs = window.MeridianCommanderObservations.weather;

        if (!weather) return "";
        if (Number(weather.pressure) <= 1008) return this.pick(obs.lowPressure);
        if (weather.text && (weather.text.includes("雨") || weather.text.includes("雷"))) return this.pick(obs.rain);
        return this.pick(obs.stable);
    },

    getHealthObservation: function (data) {
        const health = data.health || {};
        const obs = window.MeridianCommanderObservations.health;

        if (health.headache) return this.pick(obs.headache);
        if (health.dizzy) return this.pick(obs.dizzy);
        if (data.cycle.isPeriod || health.period) return this.pick(obs.period);
        if (data.cycle.isPmsWindow || health.pms) return this.pick(obs.pms);
        return this.pick(obs.stable);
    },

    getPlannerObservation: function (data) {
        const count = data.plannerCount || 0;
        const obs = window.MeridianCommanderObservations.planner;

        if (count === 0) return this.pick(obs.none);
        if (count >= 5) return this.pick(obs.many);
        return this.pick(obs.few);
    },

    getCalendarObservation: function () {
        const weekdayKey = this.getWeekdayKey();
        const seasonKey = this.getSeasonKey();
        const weekdayBlock = window.MeridianCommanderObservations.weekday[weekdayKey];
        const seasonBlock = window.MeridianCommanderObservations.season[seasonKey];
        const lines = [];

        if (weekdayBlock) lines.push(this.pick(weekdayBlock));
        if (seasonBlock) lines.push(this.pick(seasonBlock));

        return lines.filter(Boolean);
    },

    buildPriorityList: function (data, readiness) {
        const priorities = [];
        const health = data.health || {};

        if (health.medicine === false) priorities.push("服薬確認");
        if (health.headache || health.dizzy) {
            priorities.push("Rest");
            priorities.push("Health");
        }
        if (data.cycle.isPeriod || health.period) {
            priorities.push("Warmth");
            priorities.push("Health");
        }
        if (readiness === "READY" || readiness === "CAUTION") {
            priorities.push("Planner");
            priorities.push("Focus");
        }
        priorities.push("Mission");

        return Array.from(new Set(priorities)).slice(0, 4);
    },

    calculateRisk: function (data) {
        let risk = 0;
        const health = data.health || {};
        const weather = data.weather;

        if (weather && Number(weather.pressure) <= 1008) risk += 2;
        if (weather && Number(weather.pressure) <= 1000) risk += 2;
        if (health.headache) risk += 3;
        if (health.dizzy) risk += 3;
        if (health.period) risk += 2;
        if (health.pms) risk += 2;
        if (data.cycle.isPeriod) risk += 2;
        if (data.cycle.isPmsWindow) risk += 1;
        if (health.sleepMemo && (health.sleepMemo.includes("4") || health.sleepMemo.includes("5"))) risk += 2;

        return Math.min(risk, 10);
    },

    getReadiness: function (risk) {
        if (risk >= 8) return "RECOVERY";
        if (risk >= 5) return "LIMITED";
        if (risk >= 3) return "CAUTION";
        return "READY";
    },

    buildIntelligence: function (data) {
        const risk = this.calculateRisk(data);
        const readiness = this.getReadiness(risk);
        const analysisKey = commanderAnalyze(data);
        const adviceKey = commanderChooseAdviceKey(data, analysisKey);
        const relationship = data.relationship || { affinity: 18 };
        const lines = [];

        lines.push(this.getGreeting());
        lines.push(this.getWeatherObservation(data));
        lines.push(this.getHealthObservation(data));

        if (data.missionPercent >= 100) {
            lines.push(this.pick(window.MeridianCommanderAnalysis.missionComplete));
        } else if (data.missionPercent >= 80) {
            lines.push(this.pick(window.MeridianCommanderAnalysis.missionFocused));
        } else {
            lines.push(this.getPlannerObservation(data));
            lines.push(this.pick(window.MeridianCommanderAnalysis[analysisKey]));
            lines.push(this.pick(window.MeridianCommanderAdvice[adviceKey]));
        }

        this.getCalendarObservation().forEach(function (line) {
            lines.push(line);
        });

        const memoryLine = commanderGetMemoryObservation();
        if (memoryLine) lines.push(memoryLine);

        const personalityLine = commanderGetPersonalityLine(relationship.affinity || 0);
        if (personalityLine) lines.push(personalityLine);

        lines.push(this.pick(window.MeridianCommanderClosings));

        return {
            message: lines.filter(Boolean).join("\n\n"),
            risk: risk,
            readiness: readiness,
            priorities: this.buildPriorityList(data, readiness)
        };
    },

    buildHero: function (data) {
        const lines = [this.getGreeting()];
        const health = data.health || {};

        if (health.headache) {
            lines.push("頭痛があるなら、今日は少し抑えろ。");
        } else if (data.cycle.isPeriod || health.period) {
            lines.push("今日は身体を優先しろ。");
        } else if (data.weather && Number(data.weather.pressure) <= 1008) {
            lines.push("気圧が低い。無理に押し切るな。");
        } else {
            lines.push("今日の状況は確認済みだ。");
        }

        if (data.relationship && Number(data.relationship.affinity) >= 50) {
            lines.push("一つずつでいい。");
        }

        return lines.filter(Boolean).join(" ");
    }
};
