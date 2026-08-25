export const MAX_DURATION_MINUTES = 12 * 60;

export function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function durationMinutes(start: string, end: string): number | null {
  const startMinutes = parseTime(start);
  const endMinutes = parseTime(end);
  if (startMinutes === null || endMinutes === null) return null;
  const duration = (endMinutes - startMinutes + 24 * 60) % (24 * 60);
  return duration <= MAX_DURATION_MINUTES ? duration : null;
}

export function snapDateToInterval(date: Date, interval: number): string {
  const total = date.getHours() * 60 + date.getMinutes();
  const snapped = Math.round(total / interval) * interval;
  const normalized = snapped % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function calculateWage(rate: number, minutes: number): number {
  return rate * (minutes / 60);
}

export function timeOptions(interval: number): string[] {
  return Array.from({ length: (24 * 60) / interval }, (_, index) => {
    const total = index * interval;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  });
}
