import { api } from "./api";
import type {
  CalendarAiActionItems,
  CalendarAiOptimizeResult,
  CalendarAiSuggestTitleResult,
  CalendarAiSummarizeResult,
  CalendarAiOptimizePayload,
  CalendarAiSummarizePayload,
  CalendarAiSuggestTitlePayload,
  CalendarAiActionItemsPayload,
} from "@/types/calendar";

export async function suggestCalendarTitle(
  payload: CalendarAiSuggestTitlePayload,
) {
  return api<CalendarAiSuggestTitleResult>("api/calendar/ai/suggest-title", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function summarizeCalendarWindow(
  payload: CalendarAiSummarizePayload,
) {
  return api<CalendarAiSummarizeResult>("api/calendar/ai/summarize", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function optimizeCalendarSchedule(
  payload: CalendarAiOptimizePayload,
) {
  return api<CalendarAiOptimizeResult>("api/calendar/ai/optimize", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function extractCalendarActionItems(
  payload: CalendarAiActionItemsPayload,
) {
  return api<CalendarAiActionItems>("api/calendar/ai/action-items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
