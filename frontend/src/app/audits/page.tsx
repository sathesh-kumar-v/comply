"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  aiReviewLaunch,
  aiSuggestBasicInfo,
  aiSuggestChecklist,
  aiSuggestCommunications,
  aiSuggestSchedule,
  createAuditPlan,
  fetchAuditTemplates,
  fetchPlanningDashboard,
} from "@/lib/audit-builder"
import type {
  AuditCreatePayload,
  AuditSummary,
  ChecklistSection,
  CommunicationAiResponse,
  PlanningDashboardResponse,
  ReviewAiResponse,
} from "@/types/audit-builder"
import { DEPARTMENT_OPTIONS, OTHER_DEPARTMENT_VALUE } from "@/constants/departments"
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  UploadCloud,
  Users,
} from "lucide-react"

const auditTypes = [
  "Internal Audit",
  "Compliance Audit",
  "Quality Management System Audit",
  "Financial Audit",
  "IT/Security Audit",
  "Operational Audit",
  "Environmental Audit",
  "Health & Safety Audit",
]

const riskLevels = ["Low", "Medium", "High", "Critical"]

const statusOptions = ["All Audits", "Scheduled", "In Progress", "Completed"]

const calendarViews: Array<{ label: string; value: "month" | "week" | "day" }> = [
  { label: "Month", value: "month" },
  { label: "Week", value: "week" },
  { label: "Day", value: "day" },
]

const questionTypes = ["Yes/No", "Multiple Choice", "Text", "Rating", "Evidence"]

function sanitizeChecklistSections(sections: ChecklistSection[]): ChecklistSection[] {
  return sections.map((section) => ({
    ...section,
    required: Boolean(section.required),
    questions: (section.questions ?? []).map((question) => {
      const evidenceValue = question.evidence_required
      const normalizedEvidence = typeof evidenceValue === "boolean" ? evidenceValue : Boolean(evidenceValue)
      const normalizedGuidance =
        typeof evidenceValue === "string" && evidenceValue.trim().length > 0 && !question.guidance_notes
          ? evidenceValue.trim()
          : question.guidance_notes

      return {
        ...question,
        evidence_required: normalizedEvidence,
        guidance_notes: normalizedGuidance,
      }
    }),
  }))
}

const meetingRooms = [
  "Virtual - Teams",
  "Executive Boardroom",
  "Operations Hub",
  "Hybrid War Room",
  "Audit Project Space",
]

type WizardStepKey = "basic" | "schedule" | "checklist" | "communications" | "review"

const wizardSteps: Array<{ key: WizardStepKey; title: string; description: string; progress: number }> = [
  { key: "basic", title: "Step 1 · Basic Information", description: "Audit foundations", progress: 20 },
  { key: "schedule", title: "Step 2 · Scheduling & Resources", description: "Timeline and team", progress: 40 },
  { key: "checklist", title: "Step 3 · Audit Checklist", description: "Testing coverage", progress: 60 },
  { key: "communications", title: "Step 4 · Communication & Notifications", description: "Stakeholder engagement", progress: 80 },
  { key: "review", title: "Step 5 · Review & Confirmation", description: "Launch readiness", progress: 100 },
]

interface CalendarDay {
  date: Date
  iso: string
  inMonth: boolean
  isToday: boolean
}

function startOfWeek(reference: Date): Date {
  const date = new Date(reference)
  const weekday = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - weekday)
  date.setHours(0, 0, 0, 0)
  return date
}

function buildMonthGrid(reference: Date): CalendarDay[] {
  const firstOfMonth = new Date(reference.getFullYear(), reference.getMonth(), 1)
  const start = startOfWeek(firstOfMonth)
  const days: CalendarDay[] = []
  for (let index = 0; index < 42; index += 1) {
    const current = new Date(start)
    current.setDate(start.getDate() + index)
    const iso = current.toISOString().split("T")[0]
    const isToday = iso === new Date().toISOString().split("T")[0]
    days.push({
      date: current,
      iso,
      inMonth: current.getMonth() === reference.getMonth(),
      isToday,
    })
  }
  return days
}

function buildWeek(reference: Date): CalendarDay[] {
  const start = startOfWeek(reference)
  return Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    const iso = day.toISOString().split("T")[0]
    return {
      date: day,
      iso,
      inMonth: true,
      isToday: iso === new Date().toISOString().split("T")[0],
    }
  })
}

function createDateFromISODate(value: string): Date {
  const [datePart] = value.split("T")
  const [year, month, day] = datePart.split("-").map(Number)

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return new Date(value)
  }

  return new Date(year, month - 1, day)
}

function formatDisplayDate(value: string): string {
  const date = createDateFromISODate(value)
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const fallbackDashboard: PlanningDashboardResponse = {
  audits: [
    {
      id: "AUD-2025-001",
      title: "ISO 27001 Surveillance Audit",
      audit_type: "Compliance Audit",
      departments: ["Information Security"],
      status: "Scheduled",
      risk_level: "High",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split("T")[0],
      estimated_duration_hours: 32,
      lead_auditor: "Alex Johnson",
      progress: 30,
      audit_team: ["Sasha Lane", "Robin Clark"],
    },
    {
      id: "AUD-2025-002",
      title: "Manufacturing Quality Controls",
      audit_type: "Operational Audit",
      departments: ["Operations"],
      status: "In Progress",
      risk_level: "Medium",
      start_date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().split("T")[0],
      end_date: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split("T")[0],
      estimated_duration_hours: 24,
      lead_auditor: "Priya Desai",
      progress: 65,
      audit_team: ["Noah Jenkins", "Grace Park"],
    },
    {
      id: "AUD-2024-010",
      title: "GDPR Compliance Closure",
      audit_type: "Compliance Audit",
      departments: ["Legal"],
      status: "Completed",
      risk_level: "High",
      start_date: "2024-11-20",
      end_date: "2024-11-23",
      estimated_duration_hours: 30,
      lead_auditor: "Maria Rossi",
      progress: 100,
      audit_team: ["Daniel Kim", "Fatima Idris"],
    },
  ],
  ai_insights: {
    scheduling_priority: "ISO 27001 Surveillance Audit",
    resource_hotspots: ["Information Security"],
    duration_trend_hours: 28,
    notes: [
      "Prioritise high-risk audits for early scheduling blocks",
      "Average planned duration informs resourcing for upcoming engagements",
    ],
  },
  legend: {
    Scheduled: "Emerald",
    "In Progress": "Amber",
    Completed: "Slate",
  },
}

interface BasicInformationState {
  title: string
  auditType: string
  departments: string[]
  scope: string
  objective: string
  complianceFrameworks: string[]
  riskLevel: string
  otherDepartment?: string
}

interface SchedulingState {
  startDate: string
  endDate: string
  estimatedDuration: number
  leadAuditor: string
  auditTeam: string[]
  teamInput: string
  auditeeContacts: string[]
  auditeeInput: string
  externalAuditors: string
  meetingRoom: string
  specialRequirements: string
}

interface CommunicationState {
  distributionList: string[]
  distributionInput: string
  cc: string
  bcc: string
}

export default function AuditsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "create">("overview")
  const [dashboardData, setDashboardData] = useState<PlanningDashboardResponse | null>(null)
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<string[]>([])

  const [statusFilter, setStatusFilter] = useState<string>(statusOptions[0])
  const [departmentFilter, setDepartmentFilter] = useState<string>("All Departments")
  const [searchTerm, setSearchTerm] = useState<string>("")

  const [calendarView, setCalendarView] = useState<"month" | "week" | "day">("month")
  const [calendarReference, setCalendarReference] = useState<Date>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())

  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const [basicInfo, setBasicInfo] = useState<BasicInformationState>({
    title: "",
    auditType: "",
    departments: [],
    scope: "",
    objective: "",
    complianceFrameworks: [],
    riskLevel: "Medium",
    otherDepartment: undefined,
  })

  const [scheduling, setScheduling] = useState<SchedulingState>({
    startDate: "",
    endDate: "",
    estimatedDuration: 24,
    leadAuditor: "",
    auditTeam: [],
    teamInput: "",
    auditeeContacts: [],
    auditeeInput: "",
    externalAuditors: "",
    meetingRoom: "",
    specialRequirements: "",
  })

  const [checklistSections, setChecklistSections] = useState<ChecklistSection[]>([])
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [templateSelection, setTemplateSelection] = useState<string>("")

  const [notificationSettings, setNotificationSettings] = useState({
    audit_announcement: true,
    daily_reminders: false,
    progress_updates: true,
    completion_notifications: true,
  })

  const [notificationTemplates, setNotificationTemplates] = useState({
    announcement_email: "",
    daily_reminder_email: "",
    completion_email: "",
  })

  const [communications, setCommunications] = useState<CommunicationState>({
    distributionList: [],
    distributionInput: "",
    cc: "",
    bcc: "",
  })

  const [reviewOption, setReviewOption] = useState<"draft" | "later" | "now">("draft")
  const [reviewInsights, setReviewInsights] = useState<ReviewAiResponse | null>(null)
  const [scheduleNotes, setScheduleNotes] = useState<string[]>([])
  const [checklistNotes, setChecklistNotes] = useState<string[]>([])
  const [communicationInsights, setCommunicationInsights] = useState<CommunicationAiResponse | null>(null)

  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null)
  const [selectedAudit, setSelectedAudit] = useState<AuditSummary | null>(null)
  const [planDialogOpen, setPlanDialogOpen] = useState(false)

  const creationSectionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const loadData = async () => {
      setLoadingDashboard(true)
      try {
        const [dashboardResponse, templateResponse] = await Promise.all([
          fetchPlanningDashboard(),
          fetchAuditTemplates(),
        ])
        setDashboardData(dashboardResponse)
        setTemplates(templateResponse)
      } catch (error) {
        console.warn("Audit dashboard fetch failed, using fallback data", error)
        setDashboardData(fallbackDashboard)
        setTemplates([
          "Internal Audit",
          "Compliance Audit",
          "Quality Audit",
          "Financial Audit",
          "IT Audit",
          "Risk Assessment Audit",
          "Custom Template",
        ])
        setDashboardError("Live data unavailable. Displaying sample planning data.")
      } finally {
        setLoadingDashboard(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    if (scheduling.startDate && scheduling.endDate) {
      const start = new Date(scheduling.startDate)
      const end = new Date(scheduling.endDate)
      const diff = Math.max(Math.floor((end.getTime() - start.getTime()) / (3600 * 1000)), 8)
      setScheduling((prev) => ({ ...prev, estimatedDuration: diff }))
    }
  }, [scheduling.startDate, scheduling.endDate])

  const handleOpenCreateAudit = () => {
    setActiveTab("create")
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        creationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    } else {
      creationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const handleDialogOpenChange = (open: boolean) => {
    setPlanDialogOpen(open)
    if (!open) {
      setSelectedAudit(null)
    }
  }

  const toggleAuditExpansion = (auditId: string) => {
    setExpandedAuditId((current) => (current === auditId ? null : auditId))
  }

  const handleViewPlan = (audit: AuditSummary) => {
    setSelectedAudit(audit)
    setPlanDialogOpen(true)
  }

  const downloadFile = (content: string, mimeType: string, filename: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.rel = "noopener"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const formatDateForIcs = (date: Date) => {
    const pad = (value: number) => value.toString().padStart(2, "0")
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(
      date.getUTCMinutes(),
    )}${pad(date.getUTCSeconds())}Z`
  }

  const handleExportSchedule = (audit: AuditSummary) => {
    const start = new Date(audit.start_date)
    const end = new Date(audit.end_date)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setAlert({ type: "error", message: `Unable to export schedule for ${audit.title}. Missing or invalid dates.` })
      return
    }

    start.setHours(9, 0, 0, 0)
    end.setHours(17, 0, 0, 0)

    const newline = "\r\n"
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Comply//Audit Builder//EN",
      "BEGIN:VEVENT",
      `UID:${audit.id}@comply`,
      `DTSTAMP:${formatDateForIcs(new Date())}`,
      `DTSTART:${formatDateForIcs(start)}`,
      `DTEND:${formatDateForIcs(end)}`,
      `SUMMARY:${audit.title}`,
      `DESCRIPTION:${audit.audit_type} led by ${audit.lead_auditor} for ${audit.departments.join(", ")}`,
      "CATEGORIES:Audit",
      `LOCATION:${audit.departments.join("; ")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]

    downloadFile(lines.join(newline), "text/calendar", `${audit.id}-schedule.ics`)
    setAlert({ type: "success", message: `Exported schedule for ${audit.title}.` })
  }

  const handleExportPlan = (audit: AuditSummary | null) => {
    if (!audit) {
      setAlert({ type: "error", message: "Unable to export audit plan. No audit selected." })
      return
    }

    const recommendations: string[] = []
    switch (audit.status) {
      case "Scheduled":
        recommendations.push("Confirm kickoff readiness and circulate the audit announcement to stakeholders.")
        break
      case "In Progress":
        recommendations.push("Capture interim findings and review progress checkpoints with the audit team.")
        break
      case "Completed":
        recommendations.push("Finalise documentation and schedule a retrospective with the auditee to close actions.")
        break
      default:
        recommendations.push("Keep the engagement team aligned on next milestones and stakeholder updates.")
        break
    }

    recommendations.push(`Risk level: ${audit.risk_level}. Prioritise mitigations for ${audit.departments.join(", ")}.`)

    const planExport = {
      id: audit.id,
      title: audit.title,
      status: audit.status,
      risk_level: audit.risk_level,
      audit_type: audit.audit_type,
      departments: audit.departments,
      schedule: {
        start_date: audit.start_date,
        end_date: audit.end_date,
        estimated_duration_hours: audit.estimated_duration_hours,
      },
      team: {
        lead: audit.lead_auditor,
        members: audit.audit_team,
      },
      recommendations,
    }

    downloadFile(JSON.stringify(planExport, null, 2), "application/json", `${audit.id}-plan.json`)
    setAlert({ type: "success", message: `Exported plan for ${audit.title}.` })
  }

  const audits = dashboardData?.audits ?? []

  const filteredAudits = useMemo(() => {
    return audits.filter((audit) => {
      const matchesStatus =
        statusFilter === "All Audits" ? true : audit.status.toLowerCase() === statusFilter.toLowerCase()
      const matchesDepartment =
        departmentFilter === "All Departments" ? true : audit.departments.includes(departmentFilter)
      const lowerSearch = searchTerm.trim().toLowerCase()
      const matchesSearch =
        lowerSearch.length === 0 ||
        audit.title.toLowerCase().includes(lowerSearch) ||
        audit.audit_type.toLowerCase().includes(lowerSearch) ||
        audit.lead_auditor.toLowerCase().includes(lowerSearch) ||
        audit.id.toLowerCase().includes(lowerSearch)

      return matchesStatus && matchesDepartment && matchesSearch
    })
  }, [audits, statusFilter, departmentFilter, searchTerm])

  const calendarDays = useMemo(() => {
    if (calendarView === "month") {
      return buildMonthGrid(calendarReference)
    }
    return buildWeek(calendarReference)
  }, [calendarReference, calendarView])

  const calendarEvents = useMemo(() => {
    return audits.map((audit) => ({
      ...audit,
      start: createDateFromISODate(audit.start_date),
      end: createDateFromISODate(audit.end_date),
      primaryDepartment: audit.departments[0] ?? "",
    }))
  }, [audits])

  const departmentsForFilter = useMemo(() => {
    const unique = new Set<string>()
    audits.forEach((audit) => {
      audit.departments.forEach((department) => unique.add(department))
    })
    return ["All Departments", ...Array.from(unique)]
  }, [audits])

  const currentStep = wizardSteps[currentStepIndex]
  const currentProgress = currentStep.progress
  const isLastStep = currentStepIndex === wizardSteps.length - 1

  const handleNavigateCalendar = (direction: -1 | 1) => {
    setCalendarReference((prev) => {
      const next = new Date(prev)
      if (calendarView === "month") {
        next.setMonth(prev.getMonth() + direction)
      } else if (calendarView === "week") {
        next.setDate(prev.getDate() + direction * 7)
      } else {
        next.setDate(prev.getDate() + direction)
      }
      return next
    })
  }

  const handleAddValue = (value: string, existing: string[], setter: (values: string[]) => void) => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (existing.includes(trimmed)) return
    setter([...existing, trimmed])
  }

  const handleSectionAdd = () => {
    const newSection: ChecklistSection = {
      id: crypto.randomUUID(),
      title: "New Section",
      description: "",
      weight: 10,
      required: false,
      questions: [],
    }
    setChecklistSections((prev) => [...prev, newSection])
    setActiveSectionId(newSection.id ?? null)
  }

  const handleQuestionAdd = () => {
    if (!activeSectionId) return
    setChecklistSections((prev) =>
      prev.map((section) =>
        section.id === activeSectionId
          ? {
              ...section,
              questions: [
                ...section.questions,
                {
                  id: crypto.randomUUID(),
                  text: "New question",
                  type: "Yes/No",
                  evidence_required: false,
                  scoring_weight: 1,
                  risk_impact: basicInfo.riskLevel,
                  guidance_notes: "",
                },
              ],
            }
          : section,
      ),
    )
  }

  const handleQuestionUpdate = (sectionId: string, questionId: string, key: string, value: string | number | boolean) => {
    setChecklistSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section
        return {
          ...section,
          questions: section.questions.map((question) =>
            question.id === questionId
              ? {
                  ...question,
                  [key]: value,
                }
              : question,
          ),
        }
      }),
    )
  }

  const handleRemoveFromList = (value: string, list: string[], setter: (values: string[]) => void) => {
    setter(list.filter((item) => item !== value))
  }

  const handleAiAction = async <T,>(key: string, action: () => Promise<T>, onSuccess: (response: T) => void) => {
    setAiLoading((prev) => ({ ...prev, [key]: true }))
    try {
      const response = await action()
      onSuccess(response)
    } catch (error) {
      console.error("AI action failed", error)
      setAlert({ type: "error", message: "We couldn't fetch AI assistance right now. Please try again later." })
    } finally {
      setAiLoading((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handleSubmit = async () => {
    setAlert(null)

    if (!basicInfo.title || !basicInfo.auditType || basicInfo.departments.length === 0) {
      setAlert({ type: "error", message: "Provide the audit title, type, and at least one department." })
      return
    }

    if (!scheduling.startDate || !scheduling.endDate || !scheduling.leadAuditor) {
      setAlert({
        type: "error",
        message: "Please complete the scheduling fields, including planned dates and lead auditor.",
      })
      return
    }

    const sanitizedChecklistSections = sanitizeChecklistSections(checklistSections)
    setChecklistSections(sanitizedChecklistSections)

    const payload: AuditCreatePayload = {
      title: basicInfo.title,
      audit_type: basicInfo.auditType,
      departments: basicInfo.departments,
      risk_level: basicInfo.riskLevel,
      start_date: scheduling.startDate,
      end_date: scheduling.endDate,
      audit_scope: basicInfo.scope,
      audit_objective: basicInfo.objective,
      compliance_frameworks: basicInfo.complianceFrameworks,
      lead_auditor: scheduling.leadAuditor,
      audit_team: scheduling.auditTeam,
      auditee_contacts: scheduling.auditeeContacts,
      meeting_room: scheduling.meetingRoom || undefined,
      special_requirements: scheduling.specialRequirements || undefined,
      notification_settings: notificationSettings,
      notification_templates: notificationTemplates,
      checklist_sections: sanitizedChecklistSections,
    }

    try {
      await createAuditPlan(payload)
      setAlert({ type: "success", message: "Audit plan created successfully and added to the planning dashboard." })
      setActiveTab("overview")
      setCurrentStepIndex(0)
      setBasicInfo({
        title: "",
        auditType: "",
        departments: [],
        scope: "",
        objective: "",
        complianceFrameworks: [],
        riskLevel: "Medium",
        otherDepartment: undefined,
      })
      setScheduling({
        startDate: "",
        endDate: "",
        estimatedDuration: 24,
        leadAuditor: "",
        auditTeam: [],
        teamInput: "",
        auditeeContacts: [],
        auditeeInput: "",
        externalAuditors: "",
        meetingRoom: "",
        specialRequirements: "",
      })
      setChecklistSections([])
      setActiveSectionId(null)
      setNotificationSettings({
        audit_announcement: true,
        daily_reminders: false,
        progress_updates: true,
        completion_notifications: true,
      })
      setNotificationTemplates({ announcement_email: "", daily_reminder_email: "", completion_email: "" })
      setCommunications({ distributionList: [], distributionInput: "", cc: "", bcc: "" })
      setReviewOption("draft")
      setReviewInsights(null)
      setScheduleNotes([])
      setChecklistNotes([])
      setCommunicationInsights(null)

      fetchPlanningDashboard()
        .then((data) => setDashboardData(data))
        .catch(() => {
          /* non-fatal */
        })
    } catch (error) {
      console.error("Audit creation failed", error)
      setAlert({ type: "error", message: "Unable to create the audit plan right now. Please try again." })
    }
  }

  const renderCalendarCellEvents = (day: CalendarDay) => {
    const eventsForDay = calendarEvents.filter((event) => {
      const startIso = event.start.toISOString().split("T")[0]
      const endIso = event.end.toISOString().split("T")[0]
      return day.iso >= startIso && day.iso <= endIso
    })

    if (eventsForDay.length === 0) {
      return <p className="text-xs text-muted-foreground">No audits</p>
    }

    return (
      <div className="space-y-2">
        {eventsForDay.slice(0, 3).map((event) => (
          <div key={event.id} className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-emerald-900">{event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {event.audit_type} · {event.primaryDepartment}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>View Plan</DropdownMenuItem>
                  <DropdownMenuItem>Reschedule</DropdownMenuItem>
                  <DropdownMenuItem>Assign Team</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              {formatDisplayDate(event.start_date)} – {formatDisplayDate(event.end_date)}
            </p>
            <p className="text-xs text-emerald-700">Lead: {event.lead_auditor}</p>
          </div>
        ))}
        {eventsForDay.length > 3 ? (
          <p className="text-xs text-muted-foreground">+{eventsForDay.length - 3} more</p>
        ) : null}
      </div>
    )
  }

  const activeSection = checklistSections.find((section) => section.id === activeSectionId) ?? checklistSections[0]

  useEffect(() => {
    if (!activeSectionId && checklistSections.length > 0) {
      setActiveSectionId(checklistSections[0].id ?? null)
    }
  }, [checklistSections, activeSectionId])

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Audit Builder</h1>
          <p className="text-sm text-gray-600">Plan, schedule, and orchestrate audits with AI-assisted recommendations.</p>
        </div>

        {alert ? (
          <div
            className={`rounded-xl border p-4 text-sm shadow-sm ${
              alert.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{alert.message}</span>
              <Button variant="ghost" size="sm" onClick={() => setAlert(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "overview" | "create")} className="space-y-6">
          <TabsList className="bg-emerald-50/60">
            <TabsTrigger value="overview">Planning Dashboard</TabsTrigger>
            <TabsTrigger value="create">Create Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card className="border border-emerald-100 shadow-sm">
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <CalendarDays className="h-5 w-5" /> Audit Planning Dashboard
                  </CardTitle>
                  <CardDescription>Monitor audit portfolio, calendar alignment, and resource allocation.</CardDescription>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="flex items-center gap-2">
                    <Button className="bg-primary text-white" onClick={handleOpenCreateAudit}>
                      <Plus className="mr-2 h-4 w-4" /> Create Audit
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="bg-emerald-600 text-white">
                          <UploadCloud className="mr-2 h-4 w-4" /> Import Template
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Internal Audit</DropdownMenuItem>
                        <DropdownMenuItem>Compliance Audit</DropdownMenuItem>
                        <DropdownMenuItem>Quality Audit</DropdownMenuItem>
                        <DropdownMenuItem>Financial Audit</DropdownMenuItem>
                        <DropdownMenuItem>IT Audit</DropdownMenuItem>
                        <DropdownMenuItem>Risk Assessment Audit</DropdownMenuItem>
                        <DropdownMenuItem>Custom Template</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-white p-1">
                    {calendarViews.map((option) => (
                      <Button
                        key={option.value}
                        size="sm"
                        variant={calendarView === option.value ? "default" : "ghost"}
                        className={calendarView === option.value ? "bg-emerald-600 text-white" : "text-emerald-700"}
                        onClick={() => setCalendarView(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                    <Filter className="h-4 w-4 text-emerald-700" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-white p-3">
                    <Filter className="h-4 w-4 text-emerald-600" />
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentsForFilter.map((department) => (
                          <SelectItem key={department} value={department}>
                            {department}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-white p-3 md:col-span-2 xl:col-span-2">
                    <Search className="h-4 w-4 text-emerald-600" />
                    <Input
                      placeholder="Search audits, leads, or IDs"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-white p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Audit Calendar</h3>
                      <p className="text-sm text-gray-500">Visualise scheduled and in-progress audits with quick actions.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleNavigateCalendar(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium text-gray-600">
                        {calendarReference.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                      </span>
                      <Button variant="outline" size="icon" onClick={() => handleNavigateCalendar(1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {loadingDashboard ? (
                    <div className="flex items-center justify-center py-12 text-emerald-700">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading calendar...
                    </div>
                  ) : (
                    <div className={calendarView === "month" ? "grid grid-cols-7 gap-2" : "grid gap-3"}>
                      {calendarView === "day" ? (
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs uppercase text-emerald-700">Selected day</p>
                              <p className="text-lg font-semibold text-emerald-900">
                                {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                              </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
                              Today
                            </Button>
                          </div>
                          <Separator className="my-3" />
                          {renderCalendarCellEvents({
                            date: selectedDate,
                            iso: selectedDate.toISOString().split("T")[0],
                            inMonth: true,
                            isToday: true,
                          })}
                        </div>
                      ) : null}

                      {calendarView !== "day"
                        ? calendarDays.map((day) => (
                            <button
                              type="button"
                              key={day.iso}
                              onClick={() => {
                                setSelectedDate(day.date)
                                setCalendarView("day")
                              }}
                              className={`rounded-lg border p-3 text-left transition hover:border-emerald-400 hover:shadow-sm ${
                                day.inMonth ? "bg-white" : "bg-muted"
                              } ${day.isToday ? "border-emerald-400" : "border-emerald-100"}`}
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <span className={`text-sm font-medium ${day.isToday ? "text-emerald-700" : "text-gray-600"}`}>
                                  {day.date.getDate()}
                                </span>
                                {day.isToday ? <Badge className="bg-emerald-600 text-xs text-white">Today</Badge> : null}
                              </div>
                              {renderCalendarCellEvents(day)}
                            </button>
                          ))
                        : null}
                    </div>
                  )}

                  <Separator className="my-4" />

                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="font-semibold uppercase">Legend</span>
                    {Object.entries(dashboardData?.legend ?? fallbackDashboard.legend).map(([status, color]) => (
                      <span key={status} className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full bg-${color.toLowerCase()}-500`} />
                        {status}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <Card className="border border-emerald-100 shadow-sm lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-primary">
                        <ListChecks className="h-5 w-5" /> Audit List View
                      </CardTitle>
                      <CardDescription>Detailed cards for upcoming and active audits.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {filteredAudits.map((audit) => (
                        <div key={audit.id} className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-lg font-semibold text-gray-900">{audit.title}</h3>
                                  <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                                    {audit.audit_type}
                                  </Badge>
                                  <Badge className="bg-emerald-100 text-emerald-700">{audit.status}</Badge>
                                </div>
                                <p className="text-sm text-gray-500">Departments: {audit.departments.join(", ")}</p>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                  <span>
                                    <strong>Start:</strong> {formatDisplayDate(audit.start_date)}
                                  </span>
                                  <span>
                                    <strong>End:</strong> {formatDisplayDate(audit.end_date)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="h-4 w-4 text-emerald-500" /> {audit.lead_auditor}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>Progress</span>
                                    <span>{audit.progress}%</span>
                                  </div>
                                  <Progress value={audit.progress} className="h-2" />
                                </div>
                              </div>
                              <div className="flex flex-col items-start gap-2 text-sm text-gray-500 md:items-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="border-emerald-200">
                                      Quick Actions
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => handleViewPlan(audit)}>View plan</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleExportPlan(audit)}>Export plan</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => toggleAuditExpansion(audit.id)}>
                                      {expandedAuditId === audit.id ? "Collapse details" : "Expand details"}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex items-center gap-1 text-emerald-700"
                                  onClick={() => handleExportSchedule(audit)}
                                >
                                  <Download className="h-4 w-4" /> Export schedule
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex items-center gap-1 text-emerald-700"
                                  onClick={() => toggleAuditExpansion(audit.id)}
                                  aria-expanded={expandedAuditId === audit.id}
                                >
                                  <ChevronDown
                                    className={`h-4 w-4 transition-transform ${expandedAuditId === audit.id ? "rotate-180" : ""}`}
                                  />
                                  {expandedAuditId === audit.id ? "Collapse details" : "Expand details"}
                                </Button>
                              </div>
                            </div>
                            {expandedAuditId === audit.id ? (
                              <div className="space-y-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-900">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <p className="text-xs font-semibold uppercase text-emerald-700">Audit ID</p>
                                    <p className="font-medium text-emerald-900">{audit.id}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold uppercase text-emerald-700">Risk level</p>
                                    <p className="font-medium text-emerald-900">{audit.risk_level}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold uppercase text-emerald-700">Duration</p>
                                    <p className="font-medium text-emerald-900">{audit.estimated_duration_hours} hours</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold uppercase text-emerald-700">Team</p>
                                    <p className="font-medium text-emerald-900">
                                      {audit.audit_team.length ? audit.audit_team.join(", ") : "Team to be confirmed"}
                                    </p>
                                  </div>
                                </div>
                                <div className="grid gap-2">
                                  <p className="text-xs font-semibold uppercase text-emerald-700">Next steps</p>
                                  <ul className="list-disc space-y-1 pl-5">
                                    <li>
                                      {audit.status === "Completed"
                                        ? "Close out any outstanding corrective actions and communicate final results."
                                        : audit.status === "In Progress"
                                        ? "Align daily with the audit team on findings and stakeholder updates."
                                        : "Confirm kickoff logistics and ensure stakeholders receive the announcement."}
                                    </li>
                                    <li>
                                      {`Focus on mitigating ${audit.risk_level.toLowerCase()}-risk issues within ${audit.departments.join(", ")}.`}
                                    </li>
                                  </ul>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button variant="outline" size="sm" onClick={() => handleViewPlan(audit)}>
                                    View expansion plan
                                  </Button>
                                  <Button size="sm" className="bg-emerald-600 text-white" onClick={() => handleExportPlan(audit)}>
                                    Export expansion plan
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      {filteredAudits.length === 0 ? (
                        <p className="text-sm text-gray-500">No audits match the current filters.</p>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card className="border border-purple-100 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-purple-700">
                        <Sparkles className="h-5 w-5" /> AI Recommendations
                      </CardTitle>
                      <CardDescription>Insights based on risk and compliance requirements.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-lg border border-dashed border-purple-200 bg-purple-50/50 p-4 text-sm text-purple-900">
                        <p className="font-semibold">Scheduling Priority</p>
                        <p>{dashboardData?.ai_insights.scheduling_priority ?? fallbackDashboard.ai_insights.scheduling_priority}</p>
                      </div>
                      <div className="rounded-lg border border-dashed border-purple-200 bg-purple-50/50 p-4 text-sm text-purple-900">
                        <p className="font-semibold">Resource Hotspots</p>
                        <p>
                          {(dashboardData?.ai_insights.resource_hotspots ?? fallbackDashboard.ai_insights.resource_hotspots).join(
                            ", ",
                          ) || "Balanced allocation"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-dashed border-purple-200 bg-purple-50/50 p-4 text-sm text-purple-900">
                        <p className="font-semibold">Predictive Duration Trend</p>
                        <p>
                          Average planned engagement length is
                          {" "}
                          {dashboardData?.ai_insights.duration_trend_hours ?? fallbackDashboard.ai_insights.duration_trend_hours} hours.
                        </p>
                      </div>
                      <ul className="list-disc space-y-2 pl-4 text-sm text-purple-900">
                        {(dashboardData?.ai_insights.notes ?? fallbackDashboard.ai_insights.notes).map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                      <Button variant="secondary" className="w-full border-purple-200 bg-white text-purple-700">
                        Generate more insights
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {dashboardError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{dashboardError}</div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="create" className="space-y-6" ref={creationSectionRef}>
            <Card className="border border-emerald-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-primary">Audit Creation Wizard</CardTitle>
                <CardDescription>Define audit parameters, resources, communications, and launch readiness.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">{currentStep.title}</p>
                      <p className="text-xs text-gray-500">{currentStep.description}</p>
                    </div>
                    <div className="text-xs text-gray-500">Progress {currentProgress}%</div>
                  </div>
                  <Progress value={currentProgress} className="h-2" />
                </div>

                {currentStep.key === "basic" ? (
                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Basic Information</h3>
                        <p className="text-sm text-gray-500">Provide foundational details for the audit engagement.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleAiAction("basic", () =>
                            aiSuggestBasicInfo({
                              audit_type: basicInfo.auditType,
                              departments: basicInfo.departments,
                              scope: basicInfo.scope,
                              objective: basicInfo.objective,
                              compliance_frameworks: basicInfo.complianceFrameworks,
                            }),
                          (response) => {
                            setBasicInfo((prev) => ({
                              ...prev,
                              scope: response.suggested_scope,
                              objective: response.suggested_objective,
                              complianceFrameworks: response.suggested_frameworks,
                              riskLevel: response.predicted_risk_level,
                            }))
                            setAlert({
                              type: "success",
                              message: "AI updated the scope, objectives, and risk profile based on similar audits.",
                            })
                          },
                        )
                        }
                        disabled={aiLoading.basic}
                      >
                        {aiLoading.basic ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        AI Assist
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="auditTitle">Audit Title</Label>
                        <Input
                          id="auditTitle"
                          placeholder="Q2 Regulatory Compliance Review"
                          value={basicInfo.title}
                          onChange={(event) => setBasicInfo((prev) => ({ ...prev, title: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Audit Type</Label>
                        <Select
                          value={basicInfo.auditType}
                          onValueChange={(value) => setBasicInfo((prev) => ({ ...prev, auditType: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {auditTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Departments</Label>
                        <Select
                          onValueChange={(value) => {
                            if (value === OTHER_DEPARTMENT_VALUE) {
                              setBasicInfo((prev) => ({ ...prev, otherDepartment: "" }))
                            } else {
                              handleAddValue(value, basicInfo.departments, (updated) =>
                                setBasicInfo((prev) => ({ ...prev, departments: updated, otherDepartment: undefined }))
                              )
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENT_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {basicInfo.departments.length > 0 ? (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {basicInfo.departments.map((department) => (
                              <Badge key={department} variant="secondary" className="flex items-center gap-1">
                                {department}
                                <button
                                  type="button"
                                  className="ml-1 text-xs"
                                  onClick={() =>
                                    setBasicInfo((prev) => ({
                                      ...prev,
                                      departments: prev.departments.filter((item) => item !== department),
                                    }))
                                  }
                                >
                                  ×
                                </button>
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        {basicInfo.otherDepartment !== undefined ? (
                          <div className="mt-2 flex items-center gap-2">
                            <Input
                              placeholder="Enter department"
                              value={basicInfo.otherDepartment}
                              onChange={(event) =>
                                setBasicInfo((prev) => ({ ...prev, otherDepartment: event.target.value }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  const value = basicInfo.otherDepartment?.trim() ?? ""
                                  if (!value) return
                                  handleAddValue(value, basicInfo.departments, (updated) =>
                                    setBasicInfo((prev) => ({ ...prev, departments: updated, otherDepartment: "" })),
                                  )
                                }
                              }}
                            />
                            <Button
                              type="button"
                              onClick={() => {
                                const value = basicInfo.otherDepartment?.trim() ?? ""
                                if (!value) return
                                handleAddValue(value, basicInfo.departments, (updated) =>
                                  setBasicInfo((prev) => ({ ...prev, departments: updated, otherDepartment: "" })),
                                )
                              }}
                            >
                              Add
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>Risk Level</Label>
                        <Select
                          value={basicInfo.riskLevel}
                          onValueChange={(value) => setBasicInfo((prev) => ({ ...prev, riskLevel: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {riskLevels.map((level) => (
                              <SelectItem key={level} value={level}>
                                {level}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Compliance Frameworks</Label>
                        <Input
                          placeholder="Add framework and press Enter"
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              const target = event.target as HTMLInputElement
                              handleAddValue(target.value, basicInfo.complianceFrameworks, (updated) =>
                                setBasicInfo((prev) => ({ ...prev, complianceFrameworks: updated }))
                              )
                              target.value = ""
                            }
                          }}
                        />
                        <div className="flex flex-wrap gap-2">
                          {basicInfo.complianceFrameworks.map((framework) => (
                            <Badge key={framework} variant="outline" className="flex items-center gap-1">
                              {framework}
                              <button
                                type="button"
                                className="ml-1 text-xs"
                                onClick={() =>
                                  setBasicInfo((prev) => ({
                                    ...prev,
                                    complianceFrameworks: prev.complianceFrameworks.filter((item) => item !== framework),
                                  }))
                                }
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="scope">Audit Scope</Label>
                        <Textarea
                          id="scope"
                          rows={3}
                          maxLength={1000}
                          placeholder="Describe processes, locations, and systems in scope"
                          value={basicInfo.scope}
                          onChange={(event) => setBasicInfo((prev) => ({ ...prev, scope: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="objective">Audit Objective</Label>
                        <Textarea
                          id="objective"
                          rows={3}
                          maxLength={1000}
                          placeholder="Summarise objectives, control focus, and regulatory drivers"
                          value={basicInfo.objective}
                          onChange={(event) => setBasicInfo((prev) => ({ ...prev, objective: event.target.value }))}
                        />
                      </div>
                    </div>
                  </section>
                ) : null}

                {currentStep.key === "schedule" ? (
                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Scheduling & Resources</h3>
                        <p className="text-sm text-gray-500">Coordinate timelines, team members, and resource needs.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleAiAction("schedule", () =>
                            aiSuggestSchedule({
                              start_date: scheduling.startDate,
                              end_date: scheduling.endDate,
                              team: scheduling.auditTeam,
                              lead_auditor: scheduling.leadAuditor,
                              risk_level: basicInfo.riskLevel,
                              departments: basicInfo.departments,
                              existing_duration_hours: scheduling.estimatedDuration,
                            }),
                          (response) => {
                            setScheduling((prev) => ({
                              ...prev,
                              estimatedDuration: response.estimated_duration_hours,
                              meetingRoom: response.meeting_room_suggestion,
                              auditTeam:
                                response.team_recommendations.length > 0 ? response.team_recommendations : prev.auditTeam,
                            }))
                            setScheduleNotes(response.timeline_notes)
                          },
                        )
                        }
                        disabled={aiLoading.schedule}
                      >
                        {aiLoading.schedule ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Optimise Schedule
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Planned Start Date</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={scheduling.startDate}
                          onChange={(event) => {
                            const value = event.target.value
                            setScheduling((prev) => {
                              const next: SchedulingState = { ...prev, startDate: value }
                              if (prev.endDate && value && prev.endDate < value) {
                                next.endDate = value
                              }
                              return next
                            })
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endDate">Planned End Date</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={scheduling.endDate}
                          min={scheduling.startDate || undefined}
                          onChange={(event) => {
                            const value = event.target.value
                            setScheduling((prev) => {
                              if (prev.startDate && value && value < prev.startDate) {
                                return { ...prev, endDate: prev.startDate }
                              }
                              return { ...prev, endDate: value }
                            })
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Estimated Duration (hours)</Label>
                        <Input
                          type="number"
                          min={8}
                          value={scheduling.estimatedDuration}
                          onChange={(event) =>
                            setScheduling((prev) => ({ ...prev, estimatedDuration: Number(event.target.value) }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="leadAuditor">Lead Auditor</Label>
                        <Input
                          id="leadAuditor"
                          placeholder="Assign primary audit lead"
                          value={scheduling.leadAuditor}
                          onChange={(event) => setScheduling((prev) => ({ ...prev, leadAuditor: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Audit Team</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Add team member"
                            value={scheduling.teamInput}
                            onChange={(event) => setScheduling((prev) => ({ ...prev, teamInput: event.target.value }))}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              handleAddValue(scheduling.teamInput, scheduling.auditTeam, (updated) =>
                                setScheduling((prev) => ({ ...prev, auditTeam: updated, teamInput: "" }))
                              )
                            }}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {scheduling.auditTeam.map((member) => (
                            <Badge key={member} variant="outline" className="flex items-center gap-1">
                              {member}
                              <button
                                type="button"
                                className="ml-1 text-xs"
                                onClick={() =>
                                  setScheduling((prev) => ({
                                    ...prev,
                                    auditTeam: prev.auditTeam.filter((item) => item !== member),
                                  }))
                                }
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Auditee Contacts</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Add auditee contact"
                            value={scheduling.auditeeInput}
                            onChange={(event) => setScheduling((prev) => ({ ...prev, auditeeInput: event.target.value }))}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              handleAddValue(scheduling.auditeeInput, scheduling.auditeeContacts, (updated) =>
                                setScheduling((prev) => ({ ...prev, auditeeContacts: updated, auditeeInput: "" }))
                              )
                            }}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {scheduling.auditeeContacts.map((contact) => (
                            <Badge key={contact} variant="outline" className="flex items-center gap-1">
                              {contact}
                              <button
                                type="button"
                                className="ml-1 text-xs"
                                onClick={() =>
                                  setScheduling((prev) => ({
                                    ...prev,
                                    auditeeContacts: prev.auditeeContacts.filter((item) => item !== contact),
                                  }))
                                }
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="external">External Auditors</Label>
                        <Input
                          id="external"
                          placeholder="External firms or SMEs"
                          value={scheduling.externalAuditors}
                          onChange={(event) => setScheduling((prev) => ({ ...prev, externalAuditors: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Meeting Room</Label>
                        <Select
                          value={scheduling.meetingRoom}
                          onValueChange={(value) => setScheduling((prev) => ({ ...prev, meetingRoom: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select room" />
                          </SelectTrigger>
                          <SelectContent>
                            {meetingRooms.map((room) => (
                              <SelectItem key={room} value={room}>
                                {room}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="requirements">Special Requirements</Label>
                        <Textarea
                          id="requirements"
                          rows={3}
                          placeholder="Travel, security clearances, tooling"
                          value={scheduling.specialRequirements}
                          onChange={(event) => setScheduling((prev) => ({ ...prev, specialRequirements: event.target.value }))}
                        />
                      </div>
                    </div>

                    {scheduleNotes.length > 0 ? (
                      <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                        <p className="font-semibold">AI Timeline Notes</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {scheduleNotes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {currentStep.key === "checklist" ? (
                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Audit Checklist Builder</h3>
                        <p className="text-sm text-gray-500">Structure sections, assign weights, and define testing questions.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={templateSelection} onValueChange={setTemplateSelection}>
                          <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Use existing template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map((template) => (
                              <SelectItem key={template} value={template}>
                                {template}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleAiAction("checklist", () =>
                            aiSuggestChecklist({
                              audit_type: basicInfo.auditType,
                              compliance_frameworks: basicInfo.complianceFrameworks,
                              risk_level: basicInfo.riskLevel,
                              departments: basicInfo.departments,
                            }),
                            (response) => {
                              const normalizedSections = sanitizeChecklistSections(response.sections)
                              setChecklistSections(
                                normalizedSections.map((section) => ({
                                  ...section,
                                  id: crypto.randomUUID(),
                                  questions: section.questions.map((question) => ({
                                    ...question,
                                    id: crypto.randomUUID(),
                                  })),
                                })),
                              )
                              setChecklistNotes(response.risk_alignment_notes)
                              setAlert({
                                type: "success",
                                message: "AI generated checklist sections tailored to the audit type and frameworks.",
                              })
                            },
                          )
                          }
                          disabled={aiLoading.checklist}
                        >
                          {aiLoading.checklist ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          Generate Sections
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 lg:flex-row">
                      <div className="w-full space-y-3 lg:w-1/3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-700">Checklist Sections</h4>
                          <Button variant="outline" size="sm" onClick={handleSectionAdd}>
                            <Plus className="mr-1 h-4 w-4" /> Add Section
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {checklistSections.map((section) => (
                            <button
                              type="button"
                              key={section.id}
                              onClick={() => setActiveSectionId(section.id ?? null)}
                              className={`w-full rounded-lg border p-3 text-left text-sm transition hover:border-emerald-400 ${
                                section.id === activeSection?.id
                                  ? "border-emerald-400 bg-emerald-50/70"
                                  : "border-emerald-100 bg-white"
                              }`}
                            >
                              <p className="font-semibold text-gray-800">{section.title}</p>
                              <p className="text-xs text-gray-500">Weight {section.weight ?? 0} · {section.required ? "Required" : "Optional"}</p>
                            </button>
                          ))}
                          {checklistSections.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900">
                              No sections added yet. Use AI generation or create your own structure.
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {activeSection ? (
                        <div className="w-full space-y-4 rounded-xl border border-emerald-100 bg-white p-4 lg:w-2/3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Section Title</Label>
                              <Input
                                value={activeSection.title}
                                onChange={(event) =>
                                  setChecklistSections((prev) =>
                                    prev.map((section) =>
                                      section.id === activeSection.id
                                        ? { ...section, title: event.target.value }
                                        : section,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Weight</Label>
                              <Input
                                type="number"
                                min={0}
                                value={activeSection.weight ?? 0}
                                onChange={(event) =>
                                  setChecklistSections((prev) =>
                                    prev.map((section) =>
                                      section.id === activeSection.id
                                        ? { ...section, weight: Number(event.target.value) }
                                        : section,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label>Description</Label>
                              <Textarea
                                rows={3}
                                value={activeSection.description ?? ""}
                                onChange={(event) =>
                                  setChecklistSections((prev) =>
                                    prev.map((section) =>
                                      section.id === activeSection.id
                                        ? { ...section, description: event.target.value }
                                        : section,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={activeSection.required}
                                onCheckedChange={(checked) =>
                                  setChecklistSections((prev) =>
                                    prev.map((section) =>
                                      section.id === activeSection.id
                                        ? { ...section, required: checked }
                                        : section,
                                    ),
                                  )
                                }
                              />
                              <span className="text-sm text-gray-600">Required section</span>
                            </div>
                          </div>

                          <Separator />

                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-700">Questions</h4>
                            <Button variant="outline" size="sm" onClick={handleQuestionAdd}>
                              <Plus className="mr-1 h-4 w-4" /> Add Question
                            </Button>
                          </div>
                          <div className="space-y-3">
                            {activeSection.questions.map((question) => (
                              <div key={question.id} className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="space-y-2 md:col-span-2">
                                    <Label>Question Text</Label>
                                    <Textarea
                                      rows={2}
                                      value={question.text}
                                      onChange={(event) =>
                                        handleQuestionUpdate(activeSection.id ?? "", question.id ?? "", "text", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Question Type</Label>
                                    <Select
                                      value={question.type}
                                      onValueChange={(value) =>
                                        handleQuestionUpdate(activeSection.id ?? "", question.id ?? "", "type", value)
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {questionTypes.map((type) => (
                                          <SelectItem key={type} value={type}>
                                            {type}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Scoring Weight</Label>
                                    <Input
                                      type="number"
                                      value={question.scoring_weight ?? 0}
                                      onChange={(event) =>
                                        handleQuestionUpdate(
                                          activeSection.id ?? "",
                                          question.id ?? "",
                                          "scoring_weight",
                                          Number(event.target.value),
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Risk Impact</Label>
                                    <Select
                                      value={question.risk_impact ?? "Medium"}
                                      onValueChange={(value) =>
                                        handleQuestionUpdate(activeSection.id ?? "", question.id ?? "", "risk_impact", value)
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {riskLevels.map((level) => (
                                          <SelectItem key={level} value={level}>
                                            {level}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2 md:col-span-2">
                                    <Label>Guidance Notes</Label>
                                    <Textarea
                                      rows={2}
                                      value={question.guidance_notes ?? ""}
                                      onChange={(event) =>
                                        handleQuestionUpdate(
                                          activeSection.id ?? "",
                                          question.id ?? "",
                                          "guidance_notes",
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={question.evidence_required}
                                      onCheckedChange={(checked) =>
                                        handleQuestionUpdate(
                                          activeSection.id ?? "",
                                          question.id ?? "",
                                          "evidence_required",
                                          checked,
                                        )
                                      }
                                    />
                                    <span className="text-xs text-gray-600">Evidence required</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {activeSection.questions.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900">
                                No questions defined yet. Add custom prompts or import suggestions.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {checklistNotes.length > 0 ? (
                      <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                        <p className="font-semibold">AI Risk Alignment Notes</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {checklistNotes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {currentStep.key === "communications" ? (
                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Communication & Notifications</h3>
                        <p className="text-sm text-gray-500">Automate stakeholder updates throughout the audit lifecycle.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleAiAction("communications", () =>
                            aiSuggestCommunications({
                              audit_title: basicInfo.title || "Audit Announcement",
                              recipients: communications.distributionList,
                              include_daily_reminders: notificationSettings.daily_reminders,
                            }),
                          (response) => {
                            setNotificationTemplates({
                              announcement_email: response.announcement_email,
                              daily_reminder_email: response.daily_reminder_email,
                              completion_email: response.completion_email,
                            })
                            setCommunicationInsights(response)
                          },
                        )
                        }
                        disabled={aiLoading.communications}
                      >
                        {aiLoading.communications ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Draft Messages
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Distribution List</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Add recipient"
                            value={communications.distributionInput}
                            onChange={(event) =>
                              setCommunications((prev) => ({ ...prev, distributionInput: event.target.value }))
                            }
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              handleAddValue(communications.distributionInput, communications.distributionList, (updated) =>
                                setCommunications((prev) => ({
                                  ...prev,
                                  distributionList: updated,
                                  distributionInput: "",
                                }))
                              )
                            }}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {communications.distributionList.map((recipient) => (
                            <Badge key={recipient} variant="outline" className="flex items-center gap-1">
                              {recipient}
                              <button
                                type="button"
                                className="ml-1 text-xs"
                                onClick={() =>
                                  setCommunications((prev) => ({
                                    ...prev,
                                    distributionList: prev.distributionList.filter((item) => item !== recipient),
                                  }))
                                }
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>CC / BCC</Label>
                        <Input
                          placeholder="CC emails"
                          value={communications.cc}
                          onChange={(event) => setCommunications((prev) => ({ ...prev, cc: event.target.value }))}
                        />
                        <Input
                          placeholder="BCC emails"
                          value={communications.bcc}
                          onChange={(event) => setCommunications((prev) => ({ ...prev, bcc: event.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="announcement">Announcement Email</Label>
                        <Textarea
                          id="announcement"
                          rows={4}
                          value={notificationTemplates.announcement_email}
                          onChange={(event) =>
                            setNotificationTemplates((prev) => ({ ...prev, announcement_email: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reminder">Daily Reminder Template</Label>
                        <Textarea
                          id="reminder"
                          rows={4}
                          value={notificationTemplates.daily_reminder_email}
                          onChange={(event) =>
                            setNotificationTemplates((prev) => ({ ...prev, daily_reminder_email: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="completion">Completion Notice</Label>
                        <Textarea
                          id="completion"
                          rows={4}
                          value={notificationTemplates.completion_email}
                          onChange={(event) =>
                            setNotificationTemplates((prev) => ({ ...prev, completion_email: event.target.value }))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3 rounded-lg border border-emerald-100 bg-white p-4">
                        <h4 className="text-sm font-semibold text-gray-700">Notification Settings</h4>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-700">Audit Announcement</p>
                            <p className="text-xs text-gray-500">Send an initial message to auditees and sponsors.</p>
                          </div>
                          <Switch
                            checked={notificationSettings.audit_announcement}
                            onCheckedChange={(checked) =>
                              setNotificationSettings((prev) => ({ ...prev, audit_announcement: checked }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-700">Progress Updates</p>
                            <p className="text-xs text-gray-500">Share status summaries with the audit team.</p>
                          </div>
                          <Switch
                            checked={notificationSettings.progress_updates}
                            onCheckedChange={(checked) =>
                              setNotificationSettings((prev) => ({ ...prev, progress_updates: checked }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-700">Daily Reminders</p>
                            <p className="text-xs text-gray-500">Remind auditees of evidence collection tasks.</p>
                          </div>
                          <Switch
                            checked={notificationSettings.daily_reminders}
                            onCheckedChange={(checked) =>
                              setNotificationSettings((prev) => ({ ...prev, daily_reminders: checked }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-700">Completion Notice</p>
                            <p className="text-xs text-gray-500">Distribute final reports and outcomes.</p>
                          </div>
                          <Switch
                            checked={notificationSettings.completion_notifications}
                            onCheckedChange={(checked) =>
                              setNotificationSettings((prev) => ({ ...prev, completion_notifications: checked }))
                            }
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                        <p className="font-semibold">Distribution Insights</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {communicationInsights?.distribution_insights?.map((note) => (
                            <li key={note}>{note}</li>
                          )) || <li>Align recipients by stakeholder group and escalation path.</li>}
                        </ul>
                      </div>
                    </div>
                  </section>
                ) : null}

                {currentStep.key === "review" ? (
                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Review & Confirmation</h3>
                        <p className="text-sm text-gray-500">Confirm schedule, stakeholders, and activation preference.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleAiAction("review", () =>
                            aiReviewLaunch({
                              audit_title: basicInfo.title,
                              start_date: scheduling.startDate,
                              end_date: scheduling.endDate,
                              risk_level: basicInfo.riskLevel,
                              team: scheduling.auditTeam,
                              notifications_enabled: notificationSettings,
                              duration_hours: scheduling.estimatedDuration,
                            }),
                          (response) => {
                            setReviewInsights(response)
                            setAlert({
                              type: "success",
                              message: "AI reviewed the launch readiness and provided optimisation guidance.",
                            })
                          },
                        )
                        }
                        disabled={aiLoading.review}
                      >
                        {aiLoading.review ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Run AI Review
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3 rounded-lg border border-emerald-100 bg-white p-4">
                        <h4 className="text-sm font-semibold text-gray-700">Audit Summary</h4>
                        <p className="text-sm text-gray-600">{basicInfo.title || "Untitled audit"}</p>
                        <p className="text-xs text-gray-500">{basicInfo.auditType || "Select an audit type"}</p>
                        <p className="text-xs text-gray-500">Departments: {basicInfo.departments.join(", ") || "Pending"}</p>
                        <p className="text-xs text-gray-500">Risk level: {basicInfo.riskLevel}</p>
                      </div>
                      <div className="space-y-3 rounded-lg border border-emerald-100 bg-white p-4">
                        <h4 className="text-sm font-semibold text-gray-700">Schedule & Resources</h4>
                        <p className="text-xs text-gray-500">
                          {scheduling.startDate ? formatDisplayDate(scheduling.startDate) : "TBD"} –
                          {" "}
                          {scheduling.endDate ? formatDisplayDate(scheduling.endDate) : "TBD"}
                        </p>
                        <p className="text-xs text-gray-500">Estimated duration: {scheduling.estimatedDuration} hours</p>
                        <p className="text-xs text-gray-500">Lead auditor: {scheduling.leadAuditor || "Not assigned"}</p>
                        <p className="text-xs text-gray-500">Team: {scheduling.auditTeam.join(", ") || "Pending"}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-emerald-100 bg-white p-4">
                      <h4 className="text-sm font-semibold text-gray-700">Timeline Overview</h4>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-900">
                          <p className="font-semibold">Planning</p>
                          <p>Complete by {scheduling.startDate ? formatDisplayDate(scheduling.startDate) : "TBD"}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-900">
                          <p className="font-semibold">Fieldwork</p>
                          <p>{scheduling.estimatedDuration} hours scheduled</p>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-900">
                          <p className="font-semibold">Reporting</p>
                          <p>Close-out {scheduling.endDate ? formatDisplayDate(scheduling.endDate) : "TBD"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 rounded-lg border border-emerald-100 bg-white p-4">
                        <h4 className="text-sm font-semibold text-gray-700">Launch Options</h4>
                        <div className="space-y-2 text-sm text-gray-600">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="launchOption"
                              value="draft"
                              checked={reviewOption === "draft"}
                              onChange={() => setReviewOption("draft")}
                            />
                            Save as Draft
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="launchOption"
                              value="later"
                              checked={reviewOption === "later"}
                              onChange={() => setReviewOption("later")}
                            />
                            Schedule for Later
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="launchOption"
                              value="now"
                              checked={reviewOption === "now"}
                              onChange={() => setReviewOption("now")}
                            />
                            Launch Immediately
                          </label>
                        </div>
                      </div>

                      <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                        <p className="font-semibold">AI Review Summary</p>
                        <p className="mt-1 text-sm">
                          {reviewInsights?.readiness_summary || "Request AI review to validate launch readiness."}
                        </p>
                        <p className="mt-2 text-xs text-gray-600">
                          Success probability: {reviewInsights ? Math.round(reviewInsights.success_probability * 100) : 0}%
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {reviewInsights?.follow_up_actions?.map((action) => (
                            <li key={action}>{action}</li>
                          )) || <li>Validate evidence repository access for the team.</li>}
                        </ul>
                      </div>
                    </div>
                  </section>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStepIndex((prev) => Math.max(prev - 1, 0))}
                      disabled={currentStepIndex === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStepIndex((prev) => Math.min(prev + 1, wizardSteps.length - 1))}
                      disabled={currentStepIndex === wizardSteps.length - 1}
                    >
                      Next
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" className="border-emerald-200" onClick={() => setReviewOption('draft')}>
                      Save as Draft
                    </Button>
                    <Button
                      className="bg-primary text-white"
                      onClick={handleSubmit}
                      disabled={!isLastStep}
                      title={!isLastStep ? "Complete all steps before creating the audit" : undefined}
                    >
                      Create Audit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <Dialog open={planDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedAudit?.title ?? "Audit plan"}</DialogTitle>
              <DialogDescription>
                Review the audit schedule, team assignments, and recommended next steps. Export artifacts for stakeholders.
              </DialogDescription>
            </DialogHeader>
            {selectedAudit ? (
              <div className="space-y-4 text-sm text-gray-600">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Audit ID</p>
                    <p className="text-base font-medium text-gray-900">{selectedAudit.id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Status</p>
                    <p className="text-base font-medium text-gray-900">{selectedAudit.status}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Schedule</p>
                    <p className="text-base font-medium text-gray-900">
                      {formatDisplayDate(selectedAudit.start_date)} – {formatDisplayDate(selectedAudit.end_date)}
                    </p>
                    <p className="text-xs text-gray-500">Estimated {selectedAudit.estimated_duration_hours} hours</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Lead Auditor</p>
                    <p className="text-base font-medium text-gray-900">{selectedAudit.lead_auditor}</p>
                    <p className="text-xs text-gray-500">
                      Team: {selectedAudit.audit_team.length ? selectedAudit.audit_team.join(", ") : "To be assigned"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">Departments</p>
                  <p className="text-base font-medium text-gray-900">{selectedAudit.departments.join(", ")}</p>
                  <p className="text-xs text-gray-500">Risk level: {selectedAudit.risk_level}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-gray-500">Recommended focus</p>
                  <ul className="list-disc space-y-1 pl-4">
                    <li>
                      {selectedAudit.status === "Completed"
                        ? "Close outstanding actions, capture lessons learned, and circulate the final report."
                        : selectedAudit.status === "In Progress"
                        ? "Hold daily stand-ups to unblock evidence collection and monitor risk hotspots."
                        : "Confirm kickoff logistics, stakeholder communications, and evidence readiness."}
                    </li>
                    <li>
                      {`Address ${selectedAudit.risk_level.toLowerCase()}-risk areas impacting ${selectedAudit.departments.join(", ")}.`}
                    </li>
                  </ul>
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-3">
                <Button variant="ghost" onClick={() => handleDialogOpenChange(false)}>
                  Close
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    variant="outline"
                    onClick={() => (selectedAudit ? handleExportSchedule(selectedAudit) : undefined)}
                    disabled={!selectedAudit}
                  >
                    Export schedule
                  </Button>
                  <Button onClick={() => handleExportPlan(selectedAudit)} disabled={!selectedAudit}>
                    Export plan
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
