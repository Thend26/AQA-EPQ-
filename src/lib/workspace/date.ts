const STRICT_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function dateInTimeZone(
  now: Date,
  timeZone = "Asia/Shanghai",
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function isRealDate(value: string) {
  if (!STRICT_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveWorkspaceDate(
  value: string | string[] | undefined,
  fallback: string,
) {
  const candidate = typeof value === "string" ? value : "";
  return isRealDate(candidate)
    ? { date: candidate, provided: true }
    : { date: fallback, provided: false };
}
