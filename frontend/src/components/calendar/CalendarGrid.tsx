"use client";

import React, { useMemo } from "react";
import type { CalendarEvent } from "@/types/calendar";
import {
  formatInTimeZone,
  resolveTimeZone,
  toDateOnly,
  todayInTimeZone,
} from "@/lib/timezone";
import EventCard from "./EventCard";

type View = "month" | "week" | "day" | "agenda";

type Props = {
  view: View;
  start: Date;
  end: Date;
  events: CalendarEvent[];
  onEdit: (ev: CalendarEvent) => void;
};

export default function CalendarGrid({
  view,
  start,
  end,
  events,
  onEdit,
}: Props) {
  // Hooks must run on every render, so compute everything up front.
  const days: Date[] = useMemo(() => {
    const out: Date[] = [];
    const d = new Date(start); // prefer-const is happy; we mutate its date value
    while (d <= end) {
      out.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }, [start, end]);

  const viewerTimeZone = resolveTimeZone();

  const byDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const key = toDateOnly(ev.start_at, ev.tz ?? viewerTimeZone);
      (map[key] ||= []).push(ev);
    }
    return map;
  }, [events, viewerTimeZone]);

  const todayStr = todayInTimeZone(viewerTimeZone);

  const agendaSorted = useMemo(
    () =>
      [...events].sort(
        (a, b) => +new Date(a.start_at) - +new Date(b.start_at)
      ),
    [events]
  );

  if (view === "agenda") {
    return (
      <div className="grid gap-3">
        {agendaSorted.map((ev) => (
          <EventCard
            key={`${ev.id}-${ev.start_at}`}
            ev={ev}
            onEdit={() => onEdit(ev)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid gap-2"
      style={{
        gridTemplateColumns:
          view === "month" || view === "week"
            ? "repeat(7, minmax(0, 1fr))"
            : "repeat(1, minmax(0, 1fr))",
      }}
    >
      {days.map((d) => {
        const key = toDateOnly(d.toISOString(), viewerTimeZone);
        const dayEvents = byDay[key] || [];
        const isToday = key === todayStr;
        return (
          <div
            key={key}
            className={`border rounded-lg p-2 min-h-[120px] ${isToday ? "bg-muted" : ""}`}
          >
            <div className="text-xs mb-2 opacity-70">{d.toDateString()}</div>
            <div className="flex flex-col gap-2">
              {dayEvents.slice(0, 3).map((ev) => (
                <button
                  key={`${ev.id}-${ev.start_at}`}
                  className="text-left cursor-pointer"
                  onClick={() => onEdit(ev)}
                >
                  <div className="text-sm font-medium">{ev.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {ev.all_day
                      ? "All day"
                      : formatInTimeZone(ev.start_at, ev.tz ?? viewerTimeZone, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                    {" – "}
                    {ev.type} • {ev.priority}
                  </div>
                </button>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
