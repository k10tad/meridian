//========================
// Meridian Planner
// Calendar Skeleton
//========================

const plannerToday = document.getElementById("plannerToday");
const plannerMonth = document.getElementById("plannerMonth");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonthButton = document.getElementById("prevMonth");
const nextMonthButton = document.getElementById("nextMonth");
const plannerBrief = document.getElementById("plannerBrief");

let plannerDate = new Date();

function formatTodayLabel(date) {
    return date.toLocaleDateString("ja-JP", {
        month: "long",
        day: "numeric",
        weekday: "short"
    });
}

function formatMonthLabel(date) {
    return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
    });
}

function renderPlannerToday() {
    const today = new Date();

    if (plannerToday) {
        plannerToday.textContent = formatTodayLabel(today);
    }

    if (plannerBrief) {
        plannerBrief.textContent = "今日の予定はまだ登録されていない。";
    }
}

function renderCalendar() {
    if (!calendarGrid || !plannerMonth) return;

    calendarGrid.innerHTML = "";

    const year = plannerDate.getFullYear();
    const month = plannerDate.getMonth();

    plannerMonth.textContent = formatMonthLabel(plannerDate);

    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();

    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const today = new Date();
    const isCurrentMonth =
        today.getFullYear() === year &&
        today.getMonth() === month;

    for (let i = 0; i < firstWeekday; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "calendar-day empty";
        calendarGrid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement("button");
        dayCell.className = "calendar-day";
        dayCell.textContent = day;

        if (isCurrentMonth && today.getDate() === day) {
            dayCell.classList.add("today");
        }

        dayCell.addEventListener("click", function () {
            if (plannerBrief) {
                plannerBrief.textContent =
                    `${month + 1}月${day}日：予定はまだ登録されていない。`;
            }
        });

        calendarGrid.appendChild(dayCell);
    }
}

if (prevMonthButton) {
    prevMonthButton.addEventListener("click", function () {
        plannerDate.setMonth(plannerDate.getMonth() - 1);
        renderCalendar();
    });
}

if (nextMonthButton) {
    nextMonthButton.addEventListener("click", function () {
        plannerDate.setMonth(plannerDate.getMonth() + 1);
        renderCalendar();
    });
}

renderPlannerToday();
renderCalendar();

