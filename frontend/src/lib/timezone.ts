export function resolveTimeZone(tz?: string | null): string {
  return tz && tz.trim()
    ? tz
    : Intl.DateTimeFormat().resolvedOptions().timeZone;
}

type DateParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function getPartsInZone(iso: string, tz?: string | null): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(iso));
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

export function toDateOnly(iso: string, tz?: string | null): string {
  const { year, month, day } = getPartsInZone(iso, tz);
  return `${year}-${month}-${day}`;
}

export function toTimeOnly(iso: string, tz?: string | null): string {
  const { hour, minute } = getPartsInZone(iso, tz);
  return `${hour}:${minute}`;
}

export function zonedDateTimeToUtc(
  dateStr: string,
  timeStr: string | undefined,
  tz?: string | null,
): string {
  const timeZone = resolveTimeZone(tz);

  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = (timeStr ?? "00:00").split(":").map(Number);

  const candidate = new Date(
    Date.UTC(year || 0, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0),
  );

  const zoned = new Date(candidate.toLocaleString("en-US", { timeZone }));
  const offset = candidate.getTime() - zoned.getTime();

  return new Date(candidate.getTime() + offset).toISOString();
}

export function formatInTimeZone(
  iso: string,
  tz?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(tz),
    ...options,
  });
  return formatter.format(new Date(iso));
}

export function todayInTimeZone(tz?: string | null): string {
  return toDateOnly(new Date().toISOString(), tz);
}
