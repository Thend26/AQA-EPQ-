const STRICT_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function calendarDateUtc(value: string) {
  const match = STRICT_DATE.exec(value);
  if (!match) return null;

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatCalendarDate(date: Date) {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function campDayForDate(campStartDate: string, date: string) {
  const start = calendarDateUtc(campStartDate);
  const current = calendarDateUtc(date);
  if (!current || !start || current < start) return null;

  return Math.round((current.getTime() - start.getTime()) / DAY_IN_MS) + 1;
}

export function dateForCampDay(campStartDate: string, campDay: number) {
  const start = calendarDateUtc(campStartDate);
  if (!start || !Number.isInteger(campDay) || campDay < 1) return null;

  start.setUTCDate(start.getUTCDate() + campDay - 1);
  return formatCalendarDate(start);
}

export function defaultWorkspaceDate(
  today: string,
  campStartDate: string,
) {
  const current = calendarDateUtc(today);
  const start = calendarDateUtc(campStartDate);
  if (!current || !start) {
    throw new Error("Expected strict YYYY-MM-DD calendar dates");
  }

  return current < start ? campStartDate : today;
}
