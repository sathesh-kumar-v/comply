"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CalendarEvent } from "@/types/calendar";
import { formatInTimeZone, resolveTimeZone } from "@/lib/timezone";

function formatEventRange(ev: CalendarEvent): string {
  if (ev.all_day) {
    const start = formatInTimeZone(ev.start_at, ev.tz, { dateStyle: "medium" });
    const end = formatInTimeZone(ev.end_at, ev.tz, { dateStyle: "medium" });
    if (start === end) {
      return `${start} (All day)`;
    }
    return `${start} – ${end} (All day)`;
  }

  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };
  const start = formatInTimeZone(ev.start_at, ev.tz, options);
  const end = formatInTimeZone(ev.end_at, ev.tz, options);
  const tzLabel = resolveTimeZone(ev.tz).replace(/_/g, " ");
  return `${start} – ${end} (${tzLabel})`;
}

export default function EventCard({
  ev,
  onEdit,
}: {
  ev: CalendarEvent;
  onEdit: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {ev.title}
          <Badge variant="secondary">{ev.type}</Badge>
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <Badge variant="outline">{ev.priority}</Badge>
          <Badge>{ev.status}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {formatEventRange(ev)}
        </div>
        <Button size="sm" onClick={onEdit}>
          Edit
        </Button>
      </CardContent>
    </Card>
  );
}
