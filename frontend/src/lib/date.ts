// lib/date.ts
export function toLocalISO(dt: Date) {
  // yyyy-MM-ddTHH:mm
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function dayKey(d: Date) {
  return d.toISOString().slice(0,10);
}
