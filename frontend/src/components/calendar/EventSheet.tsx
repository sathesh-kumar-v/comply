"use client";

import * as React from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  extractCalendarActionItems,
  suggestCalendarTitle,
} from "@/lib/calendar-ai-client";
import {
  resolveTimeZone,
  toDateOnly,
  toTimeOnly,
  zonedDateTimeToUtc,
  todayInTimeZone,
} from "@/lib/timezone";

type ReminderInput = { minutes_before: number };

// ---------- types kept minimal for upsert ----------
type EventType =
  | "Audit"
  | "Risk Assessment"
  | "Training Session"
  | "Compliance Review"
  | "Document Review"
  | "Incident Investigation"
  | "Meeting"
  | "Deadline"
  | "Other";

type Priority = "Low" | "Medium" | "High" | "Critical";
type EventStatus = "Scheduled" | "In Progress" | "Completed" | "Cancelled";

export type EventUpsertInput = {
  id?: string;
  title: string;
  type: EventType;
  description?: string;
  location?: string;
  department_ids?: number[];
  priority: Priority;
  status: EventStatus;
  all_day: boolean;
  start_at: string; // ISO
  end_at: string; // ISO
  tz?: string;
  attendees?: Array<{ email?: string; user_id?: number; required: boolean }>;
  reminders?: Array<{
    minutes_before: number;
    method: string;
    custom_message?: string;
  }>;
};

type EventFormValues = {
  title: string;
  type: EventType;
  description?: string;
  location?: string;
  department_ids: number[];
  priority: Priority;
  status: EventStatus;
  all_day: boolean;
  start_date: string;
  start_time?: string;
  end_date: string;
  end_time?: string;
  time_zone?: string;
  attendees_required_csv?: string;
  attendees_optional_csv?: string;
  reminders: number[];
  recurring: boolean;
};

type InitialEvent = Partial<
  Omit<EventUpsertInput, "reminders" | "attendees"> & {
    id?: string | number;
    reminders?: number[];
    time_zone?: string;
    tz?: string;
    attendees_required?: string[];
    attendees_optional?: string[];
  }
>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: InitialEvent | null;
  onSaved: () => void;
  upsertEvent?: (payload: EventUpsertInput) => Promise<unknown>;
};

function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year || 0, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const REMINDER_OPTIONS_MIN = [15, 30, 60, 24 * 60, 7 * 24 * 60] as const;

export default function EventSheet({
  open,
  onOpenChange,
  initial,
  onSaved,
  upsertEvent,
}: Props) {
  const defaultValues: EventFormValues = React.useMemo(() => {
    if (initial) {
      const isAllDay = Boolean(initial.all_day);
      const startISO = initial.start_at ?? new Date().toISOString();
      const endISO = initial.end_at ?? new Date().toISOString();
      const initialTz = resolveTimeZone(
        initial.time_zone ?? ("tz" in initial ? initial.tz : undefined),
      );

      return {
        title: initial.title ?? "",
        type: (initial.type as EventType) ?? "Meeting",
        description: initial.description ?? "",
        location: initial.location ?? "",
        department_ids: initial.department_ids ?? [],
        priority: (initial.priority as Priority) ?? "Medium",
        status: (initial.status as EventStatus) ?? "Scheduled",
        all_day: isAllDay,
        start_date: toDateOnly(startISO, initialTz),
        start_time: isAllDay ? undefined : toTimeOnly(startISO, initialTz),
        end_date: toDateOnly(endISO, initialTz),
        end_time: isAllDay ? undefined : toTimeOnly(endISO, initialTz),
        time_zone: initialTz,
        attendees_required_csv: (initial.attendees_required ?? []).join(", "),
        attendees_optional_csv: (initial.attendees_optional ?? []).join(", "),
        reminders: initial.reminders ?? [],
        recurring: false,
      };
    }
    const today = toDateOnly(new Date().toISOString());
    return {
      title: "",
      type: "Meeting",
      description: "",
      location: "",
      department_ids: [],
      priority: "Medium",
      status: "Scheduled",
      all_day: false,
      start_date: today,
      start_time: "10:00",
      end_date: today,
      end_time: "11:00",
      time_zone: resolveTimeZone(),
      attendees_required_csv: "",
      attendees_optional_csv: "",
      reminders: [],
      recurring: false,
    };
  }, [initial]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<EventFormValues>({ defaultValues, shouldUnregister: true });

  React.useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, defaultValues, reset]);

  const allDay = watch("all_day");
  const startDateValue = watch("start_date");
  const endDateValue = watch("end_date");
  const startTimeValue = watch("start_time");
  const endTimeValue = watch("end_time");
  const timeZoneValue = watch("time_zone");

  const effectiveTimeZone = React.useMemo(
    () => resolveTimeZone(timeZoneValue),
    [timeZoneValue],
  );

  const todayInTz = React.useMemo(
    () => todayInTimeZone(effectiveTimeZone),
    [effectiveTimeZone],
  );

  React.useEffect(() => {
    if (startDateValue && endDateValue && endDateValue < startDateValue) {
      setValue("end_date", startDateValue, { shouldDirty: true });
    }
  }, [startDateValue, endDateValue, setValue]);

  React.useEffect(() => {
    if (
      !allDay &&
      startDateValue &&
      endDateValue &&
      startTimeValue &&
      endTimeValue &&
      startDateValue === endDateValue &&
      endTimeValue <= startTimeValue
    ) {
      const [startHour, startMinute] = startTimeValue
        .split(":")
        .map((part) => Number(part) || 0);
      const [endHour, endMinute] = endTimeValue
        .split(":")
        .map((part) => Number(part) || 0);

      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;

      if (endTotalMinutes <= startTotalMinutes) {
        let adjustedMinutes = startTotalMinutes + 30; // default buffer
        let targetDate = startDateValue;

        if (adjustedMinutes >= 24 * 60) {
          adjustedMinutes -= 24 * 60;
          targetDate = shiftDate(startDateValue, 1);
          setValue("end_date", targetDate, { shouldDirty: true });
        }

        const hours = Math.floor(adjustedMinutes / 60)
          .toString()
          .padStart(2, "0");
        const minutes = (adjustedMinutes % 60).toString().padStart(2, "0");

        setValue("end_time", `${hours}:${minutes}`, { shouldDirty: true });
      }
    }
  }, [
    allDay,
    startDateValue,
    endDateValue,
    startTimeValue,
    endTimeValue,
    setValue,
  ]);

  const [titleLoading, setTitleLoading] = React.useState(false);
  const [titleError, setTitleError] = React.useState<string | null>(null);
  const [titleMessage, setTitleMessage] = React.useState<string | null>(null);

  const [actionItems, setActionItems] = React.useState<string[]>([]);
  const [actionItemsLoading, setActionItemsLoading] = React.useState(false);
  const [actionItemsError, setActionItemsError] = React.useState<string | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setTitleLoading(false);
      setTitleError(null);
      setTitleMessage(null);
      setActionItems([]);
      setActionItemsError(null);
    }
  }, [open]);

  const handleSuggestTitle = async () => {
    const { description, type, priority, department_ids } = getValues();
    if (!description || description.trim().length < 3) {
      setTitleError("Add a short description first so AI has context.");
      setTitleMessage(null);
      return;
    }

    setTitleLoading(true);
    setTitleError(null);
    setTitleMessage(null);
    try {
      const result = await suggestCalendarTitle({
        description: description.trim(),
        event_type: type,
        priority,
        departments: (department_ids ?? []).map((d) => String(d)),
      });

      if (result?.title) {
        setValue("title", result.title, { shouldDirty: true });
        setTitleMessage("AI suggestion applied");
      } else {
        setTitleError("No suggestion returned. Try expanding the description.");
      }
    } catch (err) {
      setTitleError(err instanceof Error ? err.message : String(err));
    } finally {
      setTitleLoading(false);
    }
  };

  const handleExtractActionItems = async () => {
    const { description } = getValues();
    if (!description || description.trim().length < 3) {
      setActionItemsError("Add more detail to the description first.");
      setActionItems([]);
      return;
    }

    setActionItemsLoading(true);
    setActionItemsError(null);
    try {
      const result = await extractCalendarActionItems({
        description: description.trim(),
      });
      const items = Array.isArray(result?.items)
        ? result.items.filter(Boolean)
        : [];
      setActionItems(items);
      if (!items.length) {
        setActionItemsError(
          "AI didn't find clear action items. Try elaborating the description.",
        );
      }
    } catch (err) {
      setActionItems([]);
      setActionItemsError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionItemsLoading(false);
    }
  };

  const onSubmit: SubmitHandler<EventFormValues> = async (values) => {
    const startISO = zonedDateTimeToUtc(
      values.start_date,
      values.all_day ? undefined : values.start_time,
      values.time_zone,
    );
    const endISO = zonedDateTimeToUtc(
      values.end_date,
      values.all_day ? undefined : values.end_time,
      values.time_zone,
    );

    const attendees_required = values.attendees_required_csv
      ? values.attendees_required_csv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const attendees_optional = values.attendees_optional_csv
      ? values.attendees_optional_csv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // Convert attendee strings to proper attendee objects
    const attendees = [
      ...attendees_required.map((email) => ({ email, required: true })),
      ...attendees_optional.map((email) => ({ email, required: false })),
    ];

    const payload: EventUpsertInput = {
      ...(initial?.id != null ? { id: String(initial.id) } : {}),
      title: values.title.trim(),
      type: values.type,
      description: values.description?.trim() || "",
      location: values.location?.trim() || "",
      department_ids: values.department_ids,
      priority: values.priority,
      status: values.status,
      all_day: Boolean(values.all_day),
      start_at: startISO,
      end_at: endISO,
      tz: resolveTimeZone(values.time_zone),
      attendees,
      reminders: values.reminders.map((m) => ({
        minutes_before: m,
        method: "Email",
      })),
    };

    if (upsertEvent) {
      await upsertEvent(payload);
    } else {
      // ✅ Call the FastAPI backend (goes through lib/api.ts -> API_BASE)
      const path = payload.id
        ? `/api/calendar/events/${payload.id}`
        : `/api/calendar/events`;
      await api(path, {
        method: payload.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
    }

    onSaved();
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!initial?.id || isDeleting) return;
    const confirmed = window.confirm(
      "Are you sure you want to erase this meeting? This action cannot be undone.",
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await api(`/api/calendar/events/${initial.id}`, { method: "DELETE" });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to delete calendar event", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Task" : "Add Task"}</DialogTitle>
        </DialogHeader>

        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="title" className="flex-1">
                Task Title
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSuggestTitle}
                disabled={titleLoading}
              >
                {titleLoading ? "Suggesting…" : "AI Suggest Title"}
              </Button>
            </div>
            <Input
              id="title"
              {...register("title", {
                required: true,
                minLength: 2,
                maxLength: 200,
              })}
            />
            {titleMessage && (
              <p className="text-xs text-muted-foreground">{titleMessage}</p>
            )}
            {titleError && (
              <p className="text-xs text-destructive">{titleError}</p>
            )}
          </div>

          <div>
            <Label>Task Type</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Audit",
                      "Risk Assessment",
                      "Training Session",
                      "Compliance Review",
                      "Document Review",
                      "Incident Investigation",
                      "Meeting",
                      "Deadline",
                      "Other",
                    ].map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <Label>Priority</Label>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["Low", "Medium", "High", "Critical"] as const).map(
                      (opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <Label>Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        "Scheduled",
                        "In Progress",
                        "Completed",
                        "Cancelled",
                      ] as const
                    ).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="description" className="flex-1">
                Description
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleExtractActionItems}
                disabled={actionItemsLoading}
              >
                {actionItemsLoading ? "Analyzing…" : "AI Action Items"}
              </Button>
            </div>
            <Textarea id="description" {...register("description")} />
            {actionItemsError && (
              <p className="text-xs text-destructive">{actionItemsError}</p>
            )}
            {!!actionItems.length && (
              <div className="rounded-md border border-border p-2">
                <p className="text-xs font-medium mb-1">
                  Suggested action items
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  {actionItems.map((item, idx) => (
                    <li key={`${item}-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" {...register("location")} />
          </div>

          <div className="md:col-span-2">
            <Label>All Day Task</Label>
            <Controller
              control={control}
              name="all_day"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <div>
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              type="date"
              id="start_date"
              min={todayInTz}
              aria-invalid={errors.start_date ? "true" : "false"}
              {...register("start_date", {
                required: "Start date is required",
                validate: (value) =>
                  value >= todayInTz ||
                  `Start date cannot be before ${todayInTz.replaceAll("-", "/")}`,
              })}
            />
            {errors.start_date && (
              <p className="text-xs text-destructive mt-1">
                {errors.start_date.message as string}
              </p>
            )}
          </div>

          {!allDay && (
            <div>
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                type="time"
                id="start_time"
                aria-invalid={errors.start_time ? "true" : "false"}
                {...register("start_time", {
                  required: "Start time is required",
                })}
              />
              {errors.start_time && (
                <p className="text-xs text-destructive mt-1">
                  {errors.start_time.message as string}
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="end_date">End Date</Label>
            <Input
              type="date"
              id="end_date"
              min={startDateValue || todayInTz}
              aria-invalid={errors.end_date ? "true" : "false"}
              {...register("end_date", {
                required: "End date is required",
                validate: (value) =>
                  !startDateValue ||
                  value >= startDateValue ||
                  "End date cannot be before start date",
              })}
            />
            {errors.end_date && (
              <p className="text-xs text-destructive mt-1">
                {errors.end_date.message as string}
              </p>
            )}
          </div>

          {!allDay && (
            <div>
              <Label htmlFor="end_time">End Time</Label>
              <Input
                type="time"
                id="end_time"
                aria-invalid={errors.end_time ? "true" : "false"}
                {...register("end_time", {
                  required: "End time is required",
                  validate: (value) => {
                    if (!value) return "End time is required";
                    if (
                      startDateValue &&
                      endDateValue &&
                      startTimeValue &&
                      startDateValue === endDateValue &&
                      value <= startTimeValue
                    ) {
                      return "End time must be after the start time";
                    }
                    return true;
                  },
                })}
              />
              {errors.end_time && (
                <p className="text-xs text-destructive mt-1">
                  {errors.end_time.message as string}
                </p>
              )}
            </div>
          )}

          <div className="md:col-span-2">
            <Label htmlFor="time_zone">Time Zone</Label>
            <Input
              id="time_zone"
              placeholder="e.g., Asia/Kolkata"
              {...register("time_zone")}
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="attendees_required_csv">
              Required Attendees (comma separated)
            </Label>
            <Input
              id="attendees_required_csv"
              {...register("attendees_required_csv")}
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="attendees_optional_csv">
              Optional Attendees (comma separated)
            </Label>
            <Input
              id="attendees_optional_csv"
              {...register("attendees_optional_csv")}
            />
          </div>

          <div className="md:col-span-2">
            <Label>Reminders</Label>
            <Controller
              control={control}
              name="reminders"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {REMINDER_OPTIONS_MIN.map((min) => {
                    const checked = field.value.includes(min);
                    return (
                      <label
                        key={min}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            const next = new Set<number>(field.value);
                            if (e.target.checked) next.add(min);
                            else next.delete(min);
                            field.onChange(Array.from(next));
                          }}
                        />
                        {min < 60
                          ? `${min} minutes`
                          : min < 24 * 60
                            ? `${min / 60} hour${min === 60 ? "" : "s"}`
                            : `${min / (24 * 60)} day${min === 24 * 60 ? "" : "s"}`}
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </div>

          <div className="md:col-span-2">
            <Label>Recurring</Label>
            <Controller
              control={control}
              name="recurring"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <DialogFooter className="md:col-span-2 gap-2">
            {initial?.id && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting || isDeleting}
              >
                {isDeleting ? "Erasing…" : "Erase Meeting"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting
                ? "Saving…"
                : initial?.id
                  ? "Save Changes"
                  : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
