// components/calendar/FiltersBar.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type View = "month" | "week" | "day" | "agenda";
type Status = "All" | "Upcoming" | "In Progress" | "Completed" | "Overdue";

type Props = {
  onChange: (filters: {
    status_filter: Status;
    types: string[];
    priority: string[];
    departments: number[];
    mine: boolean;
    view: View;
  }) => void;
};

const EVENT_TYPES = [
  "Audit",
  "Risk Assessment",
  "Training Session",
  "Compliance Review",
  "Document Review",
  "Incident Investigation",
  "Meeting",
  "Deadline",
  "Other",
] as const;

const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

const isView = (v: string): v is View => ["month", "week", "day", "agenda"].includes(v);
const isStatus = (v: string): v is Status =>
  ["All", "Upcoming", "In Progress", "Completed", "Overdue"].includes(v);

export default function FiltersBar({ onChange }: Props) {
  const [status, setStatus] = useState<Status>("All");
  const [types, setTypes] = useState<string[]>([]);
  const [priority, setPriority] = useState<string[]>([]);
  const [departments, setDepartments] = useState<number[]>([]);
  const [mine, setMine] = useState(false);
  const [view, setView] = useState<View>("month");

  // helper: emit with an override so we never rely on stale state
  const emit = (overrides?: Partial<{
    status_filter: Status;
    types: string[];
    priority: string[];
    departments: number[];
    mine: boolean;
    view: View;
  }>) => {
    onChange({
      status_filter: overrides?.status_filter ?? status,
      types: overrides?.types ?? types,
      priority: overrides?.priority ?? priority,
      departments: overrides?.departments ?? departments,
      mine: overrides?.mine ?? mine,
      view: overrides?.view ?? view,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs
        value={view}
        onValueChange={(v) => {
          if (!isView(v)) return;
          setView(v);
          emit({ view: v }); // <-- send the new view immediately
        }}
      >
        <TabsList>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
        </TabsList>
      </Tabs>

      <Separator className="mx-2" />

      <Select
        value={status}
        onValueChange={(v) => {
          if (!isStatus(v)) return;
          setStatus(v);
          emit({ status_filter: v });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {(["All", "Upcoming", "In Progress", "Completed", "Overdue"] as const).map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(v) => {
          const next = types.includes(v) ? types.filter((x) => x !== v) : [...types, v];
          setTypes(next);
          emit({ types: next });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Event Types" />
        </SelectTrigger>
        <SelectContent>
          {EVENT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(v) => {
          const next = priority.includes(v) ? priority.filter((x) => x !== v) : [...priority, v];
          setPriority(next);
          emit({ priority: next });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(v) => {
          const id = Number(v);
          const next = departments.includes(id) ? departments.filter((x) => x !== id) : [...departments, id];
          setDepartments(next);
          emit({ departments: next });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Departments" />
        </SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4].map((d) => (
            <SelectItem key={d} value={String(d)}>
              Dept {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Tooltip>
        <TooltipTrigger asChild>
          <label className="flex items-center gap-2 ml-2 text-sm">
            <span>My Events</span>
            <Switch
              checked={mine}
              onCheckedChange={(v: boolean) => {
                setMine(v);
                emit({ mine: v });
              }}
            />
          </label>
        </TooltipTrigger>
        <TooltipContent side="bottom">Show only events you organized. (Spec 7.7.1)</TooltipContent>
      </Tooltip>

      {/* Optional: keep Apply for manual refresh; it's no longer required for correctness */}
      <Button className="ml-auto" onClick={() => emit()}>
        Apply
      </Button>
    </div>
  );
}
