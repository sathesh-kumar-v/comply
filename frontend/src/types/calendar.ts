export type EventType =
  | "Audit"
  | "Risk Assessment"
  | "Training Session"
  | "Compliance Review"
  | "Document Review"
  | "Incident Investigation"
  | "Meeting"
  | "Deadline"
  | "Other";

export type Priority = "Low" | "Medium" | "High" | "Critical";
export type EventStatus =
  | "Scheduled"
  | "In Progress"
  | "Completed"
  | "Cancelled";
export type ReminderMethod = "Email" | "SMS" | "Push";

export type AttendeeIn = {
  user_id?: number;
  email?: string;
  required?: boolean;
};
export type ReminderIn = {
  minutes_before: number;
  method: ReminderMethod;
  custom_message?: string;
};

export type CalendarEventIn = {
  title: string;
  type: EventType;
  description?: string;
  location?: string;
  virtual_meeting_link?: string;
  department_ids?: number[];
  equipment?: string[];
  meeting_room?: string;
  catering_required?: boolean;
  priority?: Priority;
  status?: EventStatus;
  all_day?: boolean;
  tz?: string;
  start_at: string; // ISO
  end_at: string; // ISO
  rrule?: string | null;
  send_invitations?: boolean;
  attendees?: AttendeeIn[];
  reminders?: ReminderIn[];
};

export type AttendeeOut = AttendeeIn & {
  id: number;
  required: boolean;
  user_id?: number;
  email?: string;
  status: "Invited" | "Accepted" | "Declined" | "Tentative";
};

export type ReminderOut = ReminderIn & { id: number };

export type CalendarEvent = CalendarEventIn & {
  id: number;
  organizer_id: number;
  attendees: AttendeeOut[];
  reminders: ReminderOut[];
  created_at: string;
  updated_at: string;
  cancelled_at?: string | null;
};

export type CalendarStats = {
  total: number;
  upcoming: number;
  in_progress: number;
  completed: number;
  overdue: number;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
};

export type CalendarAiSuggestTitlePayload = {
  description: string;
  event_type?: string | null;
  departments?: string[] | null;
  priority?: string | null;
};

export type CalendarAiSuggestTitleResult = {
  title: string;
};

export type CalendarAiSummarizePayload = {
  tz?: string | null;
  window_label?: string | null;
  events: Array<Partial<CalendarEvent> & { id?: string | number | null }>;
};

export type CalendarAiSummarizeResult = {
  summary: string;
};

export type CalendarAiOptimizeConstraints = {
  working_hours?: { start?: string; end?: string } | null;
  avoid_days?: number[] | null;
  max_daily_meetings?: number | null;
  buffer_minutes?: number | null;
};

export type CalendarAiOptimizePayload = {
  constraints: CalendarAiOptimizeConstraints;
  events: Array<
    Pick<
      CalendarEvent,
      | "id"
      | "title"
      | "type"
      | "priority"
      | "status"
      | "all_day"
      | "start_at"
      | "end_at"
    > & { description?: string | null }
  >;
};

export type CalendarAiOptimizeMove = {
  id?: string | number | null;
  reason?: string | null;
  new_start_at?: string | null;
  new_end_at?: string | null;
};

export type CalendarAiOptimizeResult = {
  moves: CalendarAiOptimizeMove[];
  notes: string[];
  raw?: string | null;
};

export type CalendarAiActionItemsPayload = {
  description: string;
};

export type CalendarAiActionItems = {
  items: string[];
};
