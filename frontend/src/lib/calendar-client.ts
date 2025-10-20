// lib/calendar-client.ts
import { api } from "./api";
import type { CalendarEvent, CalendarEventIn, CalendarStats } from "@/types/calendar";

export async function listEvents(params?: {
  start?: string; end?: string; mine?: boolean;
  types?: string[]; departments?: number[]; priority?: string[];
  status_filter?: "All" | "Upcoming" | "In Progress" | "Completed" | "Overdue";
  expand_recurrence?: boolean;
}) {
  const q = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach((x) => q.append(k, String(x)));
      else if (v !== undefined) q.set(k, String(v));
    });
  }
  return api<CalendarEvent[]>(`api/calendar/events?${q.toString()}`);
}

export async function createEvent(payload: CalendarEventIn) {
  return api<CalendarEvent>("api/calendar/events", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateEvent(id: number, payload: Partial<CalendarEventIn>) {
  return api<CalendarEvent>(`api/calendar/events/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteEvent(id: number, hard = false) {
  const q = hard ? "?hard=true" : "";
  return api<void>(`api/calendar/events/${id}${q}`, { method: "DELETE" });
}

export async function getStats(mine = false) {
  const q = mine ? "?mine=true" : "";
  return api<CalendarStats>(`api/calendar/stats${q}`);
}
