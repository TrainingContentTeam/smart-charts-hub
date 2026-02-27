function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const n = Number.parseFloat(value.trim());
  return Number.isFinite(n) ? n : null;
}

function toYear(value: string): number | null {
  const match = value.match(/(\d{4})/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

function parseClockLike(value: string): number | null {
  const trimmed = value.trim();

  // 39:45 or 39:45:00 means 39h 45m (duration, not wall-clock time)
  const hhmmss = trimmed.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hhmmss) {
    const hours = Number.parseInt(hhmmss[1], 10);
    const minutes = Number.parseInt(hhmmss[2], 10);
    const seconds = hhmmss[3] ? Number.parseInt(hhmmss[3], 10) : 0;
    return hours + minutes / 60 + seconds / 3600;
  }

  // Handles "1/9/1900 3:45:00 PM" style strings from Excel when duration cells
  // are interpreted as date-times. Year 1900-style dates are treated as duration.
  const dateTime = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i
  );
  if (dateTime) {
    const month = Number.parseInt(dateTime[1], 10);
    const day = Number.parseInt(dateTime[2], 10);
    const year = Number.parseInt(dateTime[3], 10);
    let hour = Number.parseInt(dateTime[4], 10);
    const minute = Number.parseInt(dateTime[5], 10);
    const second = dateTime[6] ? Number.parseInt(dateTime[6], 10) : 0;
    const ampm = dateTime[7].toUpperCase();

    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;

    // Treat 1900 dates as duration buckets (days + time), not real timestamps.
    if (year === 1900) {
      const dayBucket = Math.max(0, day - 1);
      return dayBucket * 24 + hour + minute / 60 + second / 3600;
    }

    const jsDate = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}Z`);
    if (Number.isNaN(jsDate.getTime())) return null;
    return hour + minute / 60 + second / 3600;
  }

  return null;
}

export function parseDurationHours(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return 0;

  if (typeof raw === "string") {
    const clock = parseClockLike(raw);
    if (clock !== null) return clock;
  }

  const num = toNumber(raw);
  if (num === null) return 0;

  // Excel duration serials are usually fractions of a day.
  if (num >= 0 && num < 10) return num * 24;

  // Decimal hours typed directly should pass through.
  return num;
}

export function toReportingYear(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\s*Courses\s*$/i, "").trim();
  const year = toYear(text);
  return year ? String(year) : text;
}
