//========================
// Meridian Weather v1.1
// Display: Madrid Headquarters
// Data: Osaka local weather
//========================

const weatherTemp = document.getElementById("weatherTemp");
const weatherDesc = document.getElementById("weatherDesc");
const weatherIcon = document.getElementById("weatherIcon");
const weatherPressure = document.getElementById("weatherPressure");
const weatherHumidity = document.getElementById("weatherHumidity");
const weatherPressureNote = document.getElementById("weatherPressureNote");
const weatherLocation = document.getElementById("weatherLocation");

const MERIDIAN_WEATHER = {
    displayName: "Madrid Headquarters",
    sourceName: "Osaka Local Conditions",
    latitude: 34.6937,
    longitude: 135.5023,
    timezone: "Asia%2FTokyo"
};

const weatherCodeMap = {
    0: { text: "快晴", icon: "☀" },
    1: { text: "晴れ", icon: "🌤" },
    2: { text: "一部くもり", icon: "⛅" },
    3: { text: "くもり", icon: "☁" },
    45: { text: "霧", icon: "🌫" },
    48: { text: "霧氷", icon: "🌫" },
    51: { text: "弱い霧雨", icon: "🌦" },
    53: { text: "霧雨", icon: "🌦" },
    55: { text: "強い霧雨", icon: "🌧" },
    61: { text: "小雨", icon: "🌧" },
    63: { text: "雨", icon: "🌧" },
    65: { text: "強い雨", icon: "🌧" },
    71: { text: "小雪", icon: "🌨" },
    73: { text: "雪", icon: "🌨" },
    75: { text: "強い雪", icon: "🌨" },
    80: { text: "にわか雨", icon: "🌦" },
    81: { text: "にわか雨", icon: "🌧" },
    82: { text: "強いにわか雨", icon: "🌧" },
    95: { text: "雷雨", icon: "⛈" },
    96: { text: "雷雨・雹", icon: "⛈" },
    99: { text: "強い雷雨・雹", icon: "⛈" }
};

function getPressureNote(pressure) {
    if (pressure <= 1000) {
        return "低気圧注意";
    }

    if (pressure <= 1008) {
        return "やや低め";
    }

    if (pressure >= 1020) {
        return "高め";
    }

    return "安定";
}

function getCommanderWeatherLine(pressure, weatherText) {
    if (pressure <= 1000) {
        return "現地気圧が低い。今日は頭痛に注意しろ。予定は詰めすぎるな。";
    }

    if (weatherText.includes("雨") || weatherText.includes("雷")) {
        return "現地は天候が崩れている。移動と体調に気を付けろ。";
    }

    if (pressure <= 1008) {
        return "気圧がやや低い。無理に押し切るな。";
    }

    return "Local conditions synced. 今日は通常通り進められる。";
}

function getWeatherUrl() {
    return (
        "https://api.open-meteo.com/v1/forecast" +
        "?latitude=" + MERIDIAN_WEATHER.latitude +
        "&longitude=" + MERIDIAN_WEATHER.longitude +
        "&current=temperature_2m,relative_humidity_2m,weather_code,surface_pressure" +
        "&timezone=" + MERIDIAN_WEATHER.timezone
    );
}

function renderWeather(data) {
    if (!data || !data.current) {
        renderWeatherError();
        return;
    }

    const current = data.current;

    const temp = Math.round(current.temperature_2m);
    const humidity = Math.round(current.relative_humidity_2m);
    const pressure = Math.round(current.surface_pressure);
    const code = current.weather_code;

    const weatherInfo =
        weatherCodeMap[code] || { text: "天気不明", icon: "—" };

    const note = getPressureNote(pressure);

    if (weatherLocation) {
        weatherLocation.textContent = MERIDIAN_WEATHER.displayName;
    }

    if (weatherTemp) {
        weatherTemp.textContent = temp + "℃";
    }

    if (weatherDesc) {
        weatherDesc.textContent = weatherInfo.text;
    }

    if (weatherIcon) {
        weatherIcon.textContent = weatherInfo.icon;
    }

    if (weatherPressure) {
        weatherPressure.textContent = pressure + " hPa";
    }

    if (weatherHumidity) {
        weatherHumidity.textContent = "湿度 " + humidity + "%";
    }

    if (weatherPressureNote) {
        weatherPressureNote.textContent = note;
    }

    const commanderLine =
        getCommanderWeatherLine(pressure, weatherInfo.text);

    localStorage.setItem(
        "meridianWeather",
        JSON.stringify({
            displayName: MERIDIAN_WEATHER.displayName,
            sourceName: MERIDIAN_WEATHER.sourceName,
            temp: temp,
            humidity: humidity,
            pressure: pressure,
            code: code,
            text: weatherInfo.text,
            note: note,
            commanderLine: commanderLine,
            savedAt: Date.now()
        })
    );

    window.dispatchEvent(new Event("meridianWeatherUpdated"));
}

function renderWeatherError() {
    if (weatherLocation) {
        weatherLocation.textContent = MERIDIAN_WEATHER.displayName;
    }

    if (weatherDesc) {
        weatherDesc.textContent = "Local sync failed.";
    }

    if (weatherIcon) {
        weatherIcon.textContent = "—";
    }

    if (weatherPressureNote) {
        weatherPressureNote.textContent = "再取得が必要";
    }
}

async function fetchWeather() {
    try {
        if (weatherLocation) {
            weatherLocation.textContent = MERIDIAN_WEATHER.displayName;
        }

        const response = await fetch(getWeatherUrl());

        if (!response.ok) {
            throw new Error("Weather API error");
        }

        const data = await response.json();
        renderWeather(data);

    } catch (error) {
        renderWeatherError();
    }
}

fetchWeather();