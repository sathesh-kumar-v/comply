// "use client";

// import { useCallback, useEffect, useMemo, useState } from "react";
// import FiltersBar from "../../components/calendar/FiltersBar";
// import CalendarGrid from "../../components/calendar/CalendarGrid";
// import EventSheet from "../../components/calendar/EventSheet";
// import ProjectMiniPanel from "../../components/calendar/ProjectMiniPanel";
// import { Button } from "@/components/ui/button";
// import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { listEvents, getStats } from "@/lib/calendar-client";
// import type { CalendarEvent, CalendarStats } from "@/types/calendar";

// /** Local view + filter types */
// type View = "month" | "week" | "day" | "agenda";

// type Filters = {
//   status_filter: "All" | "Upcoming" | "In Progress" | "Completed" | "Overdue";
//   types: string[];
//   priority: string[];
//   departments: number[];
//   mine: boolean;
//   view: View;
// };

// /** Date helpers */
// function startOfDay(d: Date) {
//   const x = new Date(d);
//   x.setHours(0, 0, 0, 0);
//   return x;
// }
// function monthRange(anchor: Date) {
//   const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
//   const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
//   return { start: startOfDay(start), end: startOfDay(end) };
// }
// function weekRange(anchor: Date) {
//   const day = anchor.getDay(); // 0..6 (Sun = 0)
//   const start = startOfDay(new Date(anchor));
//   start.setDate(start.getDate() - day);
//   const end = startOfDay(new Date(start));
//   end.setDate(end.getDate() + 6);
//   return { start, end };
// }
// function dayRange(anchor: Date) {
//   const d = startOfDay(anchor);
//   return { start: d, end: d };
// }

// /**
//  * Shape compatible with EventSheet's `initial` prop.
//  * We don't import EventUpsertInput; we just provide a structurally compatible object.
//  */
// type EventSheetInitial =
//   | (Partial<
//       Pick<
//         CalendarEvent,
//         | "title"
//         | "type"
//         | "description"
//         | "location"
//         | "department_ids"
//         | "priority"
//         | "status"
//         | "all_day"
//         | "start_at"
//         | "end_at"
//       >
//     > & {
//       id?: string; // EventSheet expects id?: string | undefined
//       time_zone?: string;
//       attendees_required?: string[];
//       attendees_optional?: string[];
//       reminders?: number[]; // IMPORTANT: EventSheet wants minutes as numbers
//     })
//   | null;

// /** Type guards for reminder normalization (no `any`) */
// type MaybeReminderObject = {
//   minutes?: unknown;
//   offset_minutes?: unknown;
//   minutes_before?: unknown;
// };

// /** Normalize CalendarEvent.reminders (which may be ReminderIn/Out objects) to `number[]` minutes */
// function normalizeReminders(reminders: unknown): number[] {
//   if (!Array.isArray(reminders)) return [];
//   const out: number[] = [];
//   for (const item of reminders as unknown[]) {
//     if (typeof item === "number" && Number.isFinite(item)) {
//       out.push(item);
//       continue;
//     }
//     if (item && typeof item === "object") {
//       const r = item as MaybeReminderObject;
//       const candidates = [r.minutes, r.offset_minutes, r.minutes_before];
//       const num = candidates.find((v) => typeof v === "number" && Number.isFinite(v)) as number | undefined;
//       if (typeof num === "number") out.push(num);
//     }
//   }
//   return out;
// }

// /** Convert CalendarEvent to the shape EventSheet expects for `initial`. */
// function toEventSheetInitial(ev: CalendarEvent | null): EventSheetInitial {
//   if (!ev) return null;
//   return {
//     id: ev.id != null ? String(ev.id) : undefined,
//     title: ev.title,
//     type: ev.type,
//     description: ev.description ?? "",
//     location: ev.location ?? "",
//     department_ids: ev.department_ids ?? [],
//     priority: ev.priority,
//     status: ev.status,
//     all_day: ev.all_day,
//     start_at: ev.start_at,
//     end_at: ev.end_at,
//     // If your CalendarEvent actually has these, you can include them:
//     // time_zone: (ev as { time_zone?: string }).time_zone,
//     // attendees_required: (ev as { attendees_required?: string[] }).attendees_required,
//     // attendees_optional: (ev as { attendees_optional?: string[] }).attendees_optional,
//     reminders: normalizeReminders((ev as { reminders?: unknown }).reminders),
//   };
// }

// export default function CalendarPage() {
//   const [view, setView] = useState<View>("month");
//   const [anchor, setAnchor] = useState<Date>(() => new Date());
//   const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date }>(() => monthRange(new Date()));
//   const [activeFilters, setActiveFilters] = useState<Filters>({
//     status_filter: "All",
//     types: [],
//     priority: [],
//     departments: [],
//     mine: false,
//     view: "month",
//   });

//   const [events, setEvents] = useState<CalendarEvent[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [sheetOpen, setSheetOpen] = useState(false);
//   const [editing, setEditing] = useState<CalendarEvent | null>(null);
//   const [stats, setStats] = useState<CalendarStats | null>(null);

//   /** derive range from anchor + view */
//   useEffect(() => {
//     if (view === "month") setVisibleRange(monthRange(anchor));
//     else if (view === "week") setVisibleRange(weekRange(anchor));
//     else setVisibleRange(dayRange(anchor));
//   }, [anchor, view]);

//   /** Keep query params stable for listEvents */
//   const queryParams = useMemo(
//     () => ({
//       start: visibleRange.start.toISOString(),
//       // inclusive day for the UI; add one day to the end bound
//       end: new Date(visibleRange.end.getTime() + 24 * 60 * 60 * 1000).toISOString(),
//       status_filter: activeFilters.status_filter,
//       types: activeFilters.types,
//       priority: activeFilters.priority,
//       departments: activeFilters.departments,
//       mine: activeFilters.mine,
//       expand_recurrence: true,
//     }),
//     [
//       visibleRange.start,
//       visibleRange.end,
//       activeFilters.status_filter,
//       activeFilters.types,
//       activeFilters.priority,
//       activeFilters.departments,
//       activeFilters.mine,
//     ]
//   );

//   /** Fetch events + stats */
//   const fetchData = useCallback(async () => {
//     setLoading(true);
//     try {
//       const [evs, st] = await Promise.all([listEvents(queryParams), getStats(activeFilters.mine)]);
//       setEvents(evs);
//       setStats(st);
//     } finally {
//       setLoading(false);
//     }
//   }, [queryParams, activeFilters.mine]);

//   useEffect(() => {
//     fetchData();
//   }, [fetchData]);

//   /** Navigation helpers */
//   const gotoToday = () => setAnchor(new Date());
//   const gotoPrev = () => {
//     const a = new Date(anchor);
//     if (view === "month") a.setMonth(a.getMonth() - 1);
//     else if (view === "week") a.setDate(a.getDate() - 7);
//     else a.setDate(a.getDate() - 1);
//     setAnchor(a);
//   };
//   const gotoNext = () => {
//     const a = new Date(anchor);
//     if (view === "month") a.setMonth(a.getMonth() + 1);
//     else if (view === "week") a.setDate(a.getDate() + 7);
//     else a.setDate(a.getDate() + 1);
//     setAnchor(a);
//   };

//   /** Title */
//   const title = useMemo(() => {
//     const fmt: Intl.DateTimeFormatOptions =
//       view === "month"
//         ? { month: "long", year: "numeric" }
//         : { month: "short", day: "numeric", year: "numeric" };
//     return anchor.toLocaleDateString(undefined, fmt);
//   }, [anchor, view]);

//   return (
//     <div className="flex flex-col gap-4 p-4">
//       <div className="flex flex-wrap items-center gap-2">
//         <h1 className="text-xl font-semibold">Calendar</h1>
//         <div className="ml-auto flex items-center gap-2">
//           <Button variant="outline" onClick={gotoPrev} disabled={loading}>
//             <ChevronLeft className="h-4 w-4" />
//           </Button>
//           <Button variant="outline" onClick={gotoToday} disabled={loading}>
//             Today
//           </Button>
//           <Button variant="outline" onClick={gotoNext} disabled={loading}>
//             <ChevronRight className="h-4 w-4" />
//           </Button>
//           <Button
//             onClick={() => {
//               setEditing(null);
//               setSheetOpen(true);
//             }}
//             // disabled={loading}
//           >
//             {/* Add Event */}
//             <Plus className="mr-2 h-4 w-4" /> Add Task
//           </Button>
//           <Button variant="outline" onClick={fetchData} disabled={loading}>
//             {loading ? "Refreshing…" : "Refresh"}
//           </Button>
//         </div>
//       </div>

//       <FiltersBar
//         onChange={(f) => {
//           setActiveFilters(f);
//           setView(f.view);
//         }}
//       />

//       <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
//         <div className="lg:col-span-3">
//           <Card>
//             <CardHeader className="flex items-center justify-between">
//               <CardTitle>
//                 {title} — {view.toUpperCase()} View
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <CalendarGrid
//                 view={view}
//                 start={visibleRange.start}
//                 end={visibleRange.end}
//                 events={events}
//                 onEdit={(ev) => {
//                   setEditing(ev);
//                   setSheetOpen(true);
//                 }}
//               />
//             </CardContent>
//           </Card>
//         </div>

//         <div className="grid gap-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Stats</CardTitle>
//             </CardHeader>
//             <CardContent>
//               {!stats ? (
//                 <div className="text-sm opacity-70">{loading ? "Loading…" : "No stats yet"}</div>
//               ) : (
//                 <ul className="text-sm space-y-1">
//                   <li>
//                     Total: <b>{stats.total}</b>
//                   </li>
//                   <li>
//                     Upcoming: <b>{stats.upcoming}</b>
//                   </li>
//                   <li>
//                     In Progress: <b>{stats.in_progress}</b>
//                   </li>
//                   <li>
//                     Completed: <b>{stats.completed}</b>
//                   </li>
//                   <li>
//                     Overdue: <b>{stats.overdue}</b>
//                   </li>
//                 </ul>
//               )}
//             </CardContent>
//           </Card>

//           <ProjectMiniPanel progress={42} />
//         </div>
//       </div>

//       <EventSheet
//         open={sheetOpen}
//         onOpenChange={setSheetOpen}
//         initial={toEventSheetInitial(editing)}
//         onSaved={fetchData}
//       />
//     </div>
//   );
// }

// src/app/calendar/page.tsx
// "use client";

// import { useCallback, useEffect, useMemo, useState } from "react";
// import FiltersBar from "../../components/calendar/FiltersBar";
// import CalendarGrid from "../../components/calendar/CalendarGrid";
// import EventSheet from "../../components/calendar/EventSheet";
// import ProjectMiniPanel from "../../components/calendar/ProjectMiniPanel";
// import { Button } from "@/components/ui/button";
// import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { listEvents, getStats } from "@/lib/calendar-client";
// import type { CalendarEvent, CalendarStats } from "@/types/calendar";

// type View = "month" | "week" | "day" | "agenda";

// type Filters = {
//   status_filter: "All" | "Upcoming" | "In Progress" | "Completed" | "Overdue";
//   types: string[];
//   priority: string[];
//   departments: number[];
//   mine: boolean;
//   view: View;
// };

// function startOfDay(d: Date) {
//   const x = new Date(d);
//   x.setHours(0, 0, 0, 0);
//   return x;
// }
// function monthRange(anchor: Date) {
//   const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
//   const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
//   return { start: startOfDay(start), end: startOfDay(end) };
// }
// function weekRange(anchor: Date) {
//   const day = anchor.getDay();
//   const start = startOfDay(new Date(anchor));
//   start.setDate(start.getDate() - day);
//   const end = startOfDay(new Date(start));
//   end.setDate(end.getDate() + 6);
//   return { start, end };
// }
// function dayRange(anchor: Date) {
//   const d = startOfDay(anchor);
//   return { start: d, end: d };
// }

// /** Keep EventSheet initial compatible with your CalendarEvent */
// type EventSheetInitial =
//   | (Partial<
//       Pick<
//         CalendarEvent,
//         | "title"
//         | "type"
//         | "description"
//         | "location"
//         | "department_ids"
//         | "priority"
//         | "status"
//         | "all_day"
//         | "start_at"
//         | "end_at"
//       >
//     > & {
//       id?: string;
//       time_zone?: string;
//       attendees_required?: string[];
//       attendees_optional?: string[];
//       reminders?: number[];
//     })
//   | null;

// type MaybeReminderObject = {
//   minutes?: unknown;
//   offset_minutes?: unknown;
//   minutes_before?: unknown;
// };

// function normalizeReminders(reminders: unknown): number[] {
//   if (!Array.isArray(reminders)) return [];
//   const out: number[] = [];
//   for (const item of reminders as unknown[]) {
//     if (typeof item === "number" && Number.isFinite(item)) out.push(item);
//     else if (item && typeof item === "object") {
//       const r = item as MaybeReminderObject;
//       const candidates = [r.minutes, r.offset_minutes, r.minutes_before];
//       const num = candidates.find((v) => typeof v === "number" && Number.isFinite(v)) as number | undefined;
//       if (typeof num === "number") out.push(num);
//     }
//   }
//   return out;
// }

// function toEventSheetInitial(ev: CalendarEvent | null): EventSheetInitial {
//   if (!ev) return null;
//   return {
//     id: ev.id != null ? String(ev.id) : undefined,
//     title: ev.title,
//     type: ev.type,
//     description: ev.description ?? "",
//     location: ev.location ?? "",
//     department_ids: ev.department_ids ?? [],
//     priority: ev.priority,
//     status: ev.status,
//     all_day: ev.all_day,
//     start_at: ev.start_at,
//     end_at: ev.end_at,
//     reminders: normalizeReminders((ev as { reminders?: unknown }).reminders),
//   };
// }

// export default function CalendarPage() {
//   const [view, setView] = useState<View>("month");
//   const [anchor, setAnchor] = useState<Date>(() => new Date());
//   const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date }>(() => monthRange(new Date()));
//   const [activeFilters, setActiveFilters] = useState<Filters>({
//     status_filter: "All",
//     types: [],
//     priority: [],
//     departments: [],
//     mine: false,
//     view: "month",
//   });

//   const [events, setEvents] = useState<CalendarEvent[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [sheetOpen, setSheetOpen] = useState(false);
//   const [editing, setEditing] = useState<CalendarEvent | null>(null);
//   const [stats, setStats] = useState<CalendarStats | null>(null);

//   useEffect(() => {
//     if (view === "month") setVisibleRange(monthRange(anchor));
//     else if (view === "week") setVisibleRange(weekRange(anchor));
//     else setVisibleRange(dayRange(anchor));
//   }, [anchor, view]);

//   const queryParams = useMemo(
//     () => ({
//       start: visibleRange.start.toISOString(),
//       end: new Date(visibleRange.end.getTime() + 24 * 60 * 60 * 1000).toISOString(),
//       status_filter: activeFilters.status_filter,
//       types: activeFilters.types,
//       priority: activeFilters.priority,
//       departments: activeFilters.departments,
//       mine: activeFilters.mine,
//       expand_recurrence: true,
//     }),
//     [
//       visibleRange.start,
//       visibleRange.end,
//       activeFilters.status_filter,
//       activeFilters.types,
//       activeFilters.priority,
//       activeFilters.departments,
//       activeFilters.mine,
//     ]
//   );

//   const fetchData = useCallback(async () => {
//     setLoading(true);
//     try {
//       // Load events first; stats are best-effort and shouldn't block the UI.
//       const evs = await listEvents(queryParams);
//       setEvents(evs);

//       // Fetch stats, but don’t let failures crash the page
//       getStats(activeFilters.mine)
//         .then((st) => setStats(st))
//         .catch((err) => {
//           console.warn("Stats fetch failed (non-fatal):", err);
//           setStats(null);
//         });
//     } finally {
//       setLoading(false);
//     }
//   }, [queryParams, activeFilters.mine]);

//   useEffect(() => {
//     fetchData();
//   }, [fetchData]);

//   const gotoToday = () => setAnchor(new Date());
//   const gotoPrev = () => {
//     const a = new Date(anchor);
//     if (view === "month") a.setMonth(a.getMonth() - 1);
//     else if (view === "week") a.setDate(a.getDate() - 7);
//     else a.setDate(a.getDate() - 1);
//     setAnchor(a);
//   };
//   const gotoNext = () => {
//     const a = new Date(anchor);
//     if (view === "month") a.setMonth(a.getMonth() + 1);
//     else if (view === "week") a.setDate(a.getDate() + 7);
//     else a.setDate(a.getDate() + 1);
//     setAnchor(a);
//   };

//   const title = useMemo(() => {
//     const fmt: Intl.DateTimeFormatOptions =
//       view === "month" ? { month: "long", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" };
//     return anchor.toLocaleDateString(undefined, fmt);
//   }, [anchor, view]);

//   return (
//     <div className="flex flex-col gap-4 p-4">
//       <div className="flex flex-wrap items-center gap-2">
//         <h1 className="text-xl font-semibold">Calendar</h1>
//         <div className="ml-auto flex items-center gap-2">
//           <Button variant="outline" onClick={gotoPrev} disabled={loading}>
//             <ChevronLeft className="h-4 w-4" />
//           </Button>
//           <Button variant="outline" onClick={gotoToday} disabled={loading}>
//             Today
//           </Button>
//           <Button variant="outline" onClick={gotoNext} disabled={loading}>
//             <ChevronRight className="h-4 w-4" />
//           </Button>
//           <Button
//             onClick={() => {
//               setEditing(null);
//               setSheetOpen(true);
//             }}
//           >
//             <Plus className="mr-2 h-4 w-4" /> Add Task
//           </Button>
//           <Button variant="outline" onClick={fetchData} disabled={loading}>
//             {loading ? "Refreshing…" : "Refresh"}
//           </Button>
//         </div>
//       </div>

//       <FiltersBar
//         onChange={(f) => {
//           setActiveFilters(f);
//           setView(f.view);
//         }}
//       />

//       <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
//         <div className="lg:col-span-3">
//           <Card>
//             <CardHeader className="flex items-center justify-between">
//               <CardTitle>
//                 {title} — {view.toUpperCase()} View
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <CalendarGrid
//                 view={view}
//                 start={visibleRange.start}
//                 end={visibleRange.end}
//                 events={events}
//                 onEdit={(ev) => {
//                   setEditing(ev);
//                   setSheetOpen(true);
//                 }}
//               />
//             </CardContent>
//           </Card>
//         </div>

//         <div className="grid gap-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Stats</CardTitle>
//             </CardHeader>
//             <CardContent>
//               {!stats ? (
//                 <div className="text-sm opacity-70">{loading ? "Loading…" : "No stats yet"}</div>
//               ) : (
//                 <ul className="text-sm space-y-1">
//                   <li> Total: <b>{stats.total}</b> </li>
//                   <li> Upcoming: <b>{stats.upcoming}</b> </li>
//                   <li> In Progress: <b>{stats.in_progress}</b> </li>
//                   <li> Completed: <b>{stats.completed}</b> </li>
//                   <li> Overdue: <b>{stats.overdue}</b> </li>
//                 </ul>
//               )}
//             </CardContent>
//           </Card>

//           <ProjectMiniPanel progress={42} />
//         </div>
//       </div>

//       <EventSheet
//         open={sheetOpen}
//         onOpenChange={setSheetOpen}
//         initial={toEventSheetInitial(editing)}
//         onSaved={fetchData}
//       />
//     </div>
//   );
// }

// app/calendar/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

import FiltersBar from "@/components/calendar/FiltersBar";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import EventSheet from "@/components/calendar/EventSheet";
import ProjectMiniPanel from "@/components/calendar/ProjectMiniPanel";

import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, Sparkles, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listEvents, getStats } from "@/lib/calendar-client";
import {
  optimizeCalendarSchedule,
  summarizeCalendarWindow,
} from "@/lib/calendar-ai-client";
import type {
  CalendarEvent,
  CalendarStats,
  CalendarAiOptimizeResult,
} from "@/types/calendar";

type View = "month" | "week" | "day" | "agenda";

type Filters = {
  status_filter: "All" | "Upcoming" | "In Progress" | "Completed" | "Overdue";
  types: string[];
  priority: string[];
  departments: number[];
  mine: boolean;
  view: View;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function monthRange(anchor: Date) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: startOfDay(start), end: startOfDay(end) };
}
function weekRange(anchor: Date) {
  const day = anchor.getDay();
  const start = startOfDay(new Date(anchor));
  start.setDate(start.getDate() - day);
  const end = startOfDay(new Date(start));
  end.setDate(end.getDate() + 6);
  return { start, end };
}
function dayRange(anchor: Date) {
  const d = startOfDay(anchor);
  return { start: d, end: d };
}

/** EventSheet initial shape */
type EventSheetInitial =
  | (Partial<
      Pick<
        CalendarEvent,
        | "title"
        | "type"
        | "description"
        | "location"
        | "department_ids"
        | "priority"
        | "status"
        | "all_day"
        | "start_at"
        | "end_at"
      >
    > & {
      id?: string;
      time_zone?: string;
      attendees_required?: string[];
      attendees_optional?: string[];
      reminders?: number[];
    })
  | null;

type MaybeReminderObject = {
  minutes?: unknown;
  offset_minutes?: unknown;
  minutes_before?: unknown;
};

function normalizeReminders(reminders: unknown): number[] {
  if (!Array.isArray(reminders)) return [];
  const out: number[] = [];
  for (const item of reminders as unknown[]) {
    if (typeof item === "number" && Number.isFinite(item)) out.push(item);
    else if (item && typeof item === "object") {
      const r = item as MaybeReminderObject;
      const candidates = [r.minutes, r.offset_minutes, r.minutes_before];
      const num = candidates.find(
        (v) => typeof v === "number" && Number.isFinite(v),
      ) as number | undefined;
      if (typeof num === "number") out.push(num);
    }
  }
  return out;
}

function toEventSheetInitial(ev: CalendarEvent | null): EventSheetInitial {
  if (!ev) return null;
  return {
    id: ev.id != null ? String(ev.id) : undefined,
    title: ev.title,
    type: ev.type,
    description: ev.description ?? "",
    location: ev.location ?? "",
    department_ids: ev.department_ids ?? [],
    priority: ev.priority,
    status: ev.status,
    all_day: ev.all_day,
    start_at: ev.start_at,
    end_at: ev.end_at,
    time_zone: (ev as { tz?: string | null }).tz ?? undefined,
    reminders: normalizeReminders((ev as { reminders?: unknown }).reminders),
  };
}

export default function CalendarPage() {
  const { user, loading } = useAuth();

  // Match the dashboard UX while auth is loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-primary">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      <CalendarContent />
    </DashboardLayout>
  );
}

function CalendarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsString = searchParams.toString();
  const intent = searchParams.get("intent");
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date }>(
    () => monthRange(new Date()),
  );
  const [activeFilters, setActiveFilters] = useState<Filters>({
    status_filter: "All",
    types: [],
    priority: [],
    departments: [],
    mine: false,
    view: "month",
  });

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [stats, setStats] = useState<CalendarStats | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiOptimizeResult, setAiOptimizeResult] =
    useState<CalendarAiOptimizeResult | null>(null);
  const [aiOptimizeError, setAiOptimizeError] = useState<string | null>(null);
  const [aiOptimizeLoading, setAiOptimizeLoading] = useState(false);
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  useEffect(() => {
    if (intent !== "new-meeting") return;

    setEditing(null);
    setSheetOpen(true);

    const params = new URLSearchParams(searchParamsString);
    params.delete("intent");
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [intent, pathname, router, searchParamsString]);

  useEffect(() => {
    if (view === "month") setVisibleRange(monthRange(anchor));
    else if (view === "week") setVisibleRange(weekRange(anchor));
    else setVisibleRange(dayRange(anchor));
  }, [anchor, view]);

  const queryParams = useMemo(
    () => ({
      start: visibleRange.start.toISOString(),
      end: new Date(
        visibleRange.end.getTime() + 24 * 60 * 60 * 1000,
      ).toISOString(),
      status_filter: activeFilters.status_filter,
      types: activeFilters.types,
      priority: activeFilters.priority,
      departments: activeFilters.departments,
      mine: activeFilters.mine,
      expand_recurrence: true,
    }),
    [
      visibleRange.start,
      visibleRange.end,
      activeFilters.status_filter,
      activeFilters.types,
      activeFilters.priority,
      activeFilters.departments,
      activeFilters.mine,
    ],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const evs = await listEvents(queryParams);
      setEvents(evs);
      getStats(activeFilters.mine)
        .then((st) => setStats(st))
        .catch(() => setStats(null));
    } finally {
      setLoading(false);
    }
  }, [queryParams, activeFilters.mine]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setAiSummary(null);
    setAiSummaryError(null);
    setAiOptimizeResult(null);
    setAiOptimizeError(null);
  }, [queryParams]);

  const gotoToday = () => setAnchor(new Date());
  const gotoPrev = () => {
    const a = new Date(anchor);
    if (view === "month") a.setMonth(a.getMonth() - 1);
    else if (view === "week") a.setDate(a.getDate() - 7);
    else a.setDate(a.getDate() - 1);
    setAnchor(a);
  };
  const gotoNext = () => {
    const a = new Date(anchor);
    if (view === "month") a.setMonth(a.getMonth() + 1);
    else if (view === "week") a.setDate(a.getDate() + 7);
    else a.setDate(a.getDate() + 1);
    setAnchor(a);
  };

  const formatAiDate = useCallback((iso?: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString();
    } catch (err) {
      return iso ?? null;
    }
  }, []);

  const title = useMemo(() => {
    const fmt: Intl.DateTimeFormatOptions =
      view === "month"
        ? { month: "long", year: "numeric" }
        : { month: "short", day: "numeric", year: "numeric" };
    return anchor.toLocaleDateString(undefined, fmt);
  }, [anchor, view]);

  const handleSummarize = useCallback(async () => {
    if (!events.length) {
      setAiSummary(null);
      setAiSummaryError("No events in the current window.");
      return;
    }

    setAiSummaryLoading(true);
    setAiSummaryError(null);
    try {
      const response = await summarizeCalendarWindow({
        tz: timezone,
        window_label: `${view.toUpperCase()} • ${title}`,
        events: events.map((ev) => ({
          id: ev.id,
          title: ev.title,
          type: ev.type,
          priority: ev.priority,
          status: ev.status,
          all_day: ev.all_day,
          start_at: ev.start_at,
          end_at: ev.end_at,
          description: ev.description,
        })),
      });
      setAiSummary(response.summary);
    } catch (err) {
      setAiSummary(null);
      setAiSummaryError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiSummaryLoading(false);
    }
  }, [events, timezone, view, title]);

  const handleOptimize = useCallback(async () => {
    if (!events.length) {
      setAiOptimizeResult(null);
      setAiOptimizeError("No events in the current window.");
      return;
    }

    setAiOptimizeLoading(true);
    setAiOptimizeError(null);
    try {
      const response = await optimizeCalendarSchedule({
        constraints: {
          working_hours: { start: "09:00", end: "17:00" },
          avoid_days: [0, 6],
          buffer_minutes: 15,
          max_daily_meetings: 6,
        },
        events: events.map((ev) => ({
          id: ev.id,
          title: ev.title,
          type: ev.type,
          priority: ev.priority,
          status: ev.status,
          all_day: ev.all_day,
          start_at: ev.start_at,
          end_at: ev.end_at,
          description: ev.description,
        })),
      });
      setAiOptimizeResult(response);
    } catch (err) {
      setAiOptimizeResult(null);
      setAiOptimizeError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiOptimizeLoading(false);
    }
  }, [events]);

  return (
    // padding & height match the visual rhythm inside DashboardLayout
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 min-h-[calc(100vh-4rem)]">
      {/* Top Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl lg:text-2xl font-semibold text-primary">
          Calendar
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={gotoPrev} disabled={loading}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={gotoToday} disabled={loading}>
            Today
          </Button>
          <Button variant="outline" onClick={gotoNext} disabled={loading}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Task
          </Button>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <FiltersBar
        onChange={(f) => {
          setActiveFilters(f);
          setView(f.view);
        }}
      />

      {/* Main content (calendar takes the remaining width; right column optional) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>
                {title} — {view.toUpperCase()} View
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarGrid
                view={view}
                start={visibleRange.start}
                end={visibleRange.end}
                events={events}
                onEdit={(ev) => {
                  setEditing(ev);
                  setSheetOpen(true);
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Remove this entire right column if you want the calendar to be TRUE full-width */}
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent>
              {!stats ? (
                <div className="text-sm opacity-70">
                  {loading ? "Loading…" : "No stats yet"}
                </div>
              ) : (
                <ul className="text-sm space-y-1">
                  <li>
                    {" "}
                    Total: <b>{stats.total}</b>{" "}
                  </li>
                  <li>
                    {" "}
                    Upcoming: <b>{stats.upcoming}</b>{" "}
                  </li>
                  <li>
                    {" "}
                    In Progress: <b>{stats.in_progress}</b>{" "}
                  </li>
                  <li>
                    {" "}
                    Completed: <b>{stats.completed}</b>{" "}
                  </li>
                  <li>
                    {" "}
                    Overdue: <b>{stats.overdue}</b>{" "}
                  </li>
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Summary
              </CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSummarize}
                disabled={aiSummaryLoading || loading}
              >
                {aiSummaryLoading ? "Summarizing…" : "Summarize"}
              </Button>
            </CardHeader>
            <CardContent>
              {aiSummaryError ? (
                <p className="text-sm text-destructive">{aiSummaryError}</p>
              ) : aiSummary ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {aiSummary}
                </p>
              ) : (
                <p className="text-sm opacity-70">
                  {loading
                    ? "Load events to summarize."
                    : "Let AI brief you on the tasks in the current view."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wand2 className="h-4 w-4 text-primary" />
                AI Schedule Helper
              </CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleOptimize}
                disabled={aiOptimizeLoading || loading}
              >
                {aiOptimizeLoading ? "Optimizing…" : "Optimize"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiOptimizeError ? (
                <p className="text-sm text-destructive">{aiOptimizeError}</p>
              ) : aiOptimizeResult ? (
                <>
                  {aiOptimizeResult.notes?.length ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Notes
                      </p>
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        {aiOptimizeResult.notes.map((note, idx) => (
                          <li key={`note-${idx}`}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {aiOptimizeResult.moves?.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Suggested moves
                      </p>
                      <ul className="space-y-2">
                        {aiOptimizeResult.moves.map((move, idx) => {
                          const start = formatAiDate(move.new_start_at);
                          const end = formatAiDate(move.new_end_at);
                          return (
                            <li
                              key={`move-${idx}`}
                              className="rounded-md border border-border p-2 text-sm space-y-1"
                            >
                              {move.reason && (
                                <div className="font-medium">{move.reason}</div>
                              )}
                              {(start || end) && (
                                <div className="text-xs text-muted-foreground">
                                  {start ?? ""}
                                  {end ? ` → ${end}` : ""}
                                </div>
                              )}
                              {move.id != null && (
                                <div className="text-xs text-muted-foreground">
                                  Event ID: {move.id}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm opacity-70">
                      No schedule changes recommended.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm opacity-70">
                  Ask the assistant for quick optimizations once events are
                  loaded.
                </p>
              )}
            </CardContent>
          </Card>

          <ProjectMiniPanel progress={42} />
        </div>
      </div>

      <EventSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initial={toEventSheetInitial(editing)}
        onSaved={fetchData}
      />
    </div>
  );
}
