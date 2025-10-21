"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  BarChart3,
  CheckCircle2,
  CloudLightning,
  FileDown,
  Layers,
  LineChart as LineChartIcon,
  Minus,
  NotebookPen,
  PlusCircle,
  Upload,
} from "lucide-react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  addIncidentActivity,
  fetchIncidentDashboard,
  fetchIncidentDetail,
  fetchIncidentList,
  fetchIncidentMetadata,
  requestIncidentIntakeInsights,
  saveIncidentRootCause,
  submitIncident,
  uploadIncidentAttachment,
} from "@/lib/incidents"
import {
  IncidentDashboardResponse,
  IncidentDetail,
  IncidentFormPayload,
  IncidentIntakeAssessmentResponse,
  IncidentMetadataResponse,
  IncidentRecord,
  IncidentSeverity,
} from "@/types/incidents"

function TimerIcon({ className }: { className?: string }) {
  return <Activity className={className} />
}

const SUMMARY_CARD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  totalIncidents: LineChartIcon,
  openIncidents: AlertTriangle,
  resolvedThisMonth: CheckCircle2,
  averageResolutionHours: TimerIcon,
  overdueIncidents: AlertCircle,
}

const SUMMARY_CARD_ACCENTS: Record<string, string> = {
  totalIncidents: "bg-indigo-500",
  openIncidents: "bg-red-500",
  resolvedThisMonth: "bg-green-500",
  averageResolutionHours: "bg-emerald-500",
  overdueIncidents: "bg-orange-500",
}

const TREND_ICONS = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
} as const

const TREND_TEXT_COLORS = {
  up: "text-emerald-600",
  down: "text-red-600",
  flat: "text-slate-500",
} as const

const SEVERITY_BADGES: Record<IncidentSeverity, string> = {
  Low: "bg-emerald-100 text-emerald-700",
  Medium: "bg-amber-100 text-amber-700",
  High: "bg-orange-100 text-orange-700",
  Critical: "bg-red-100 text-red-700",
}

const QUICK_ACTION_STYLES: Record<string, string> = {
  report: "bg-red-600 hover:bg-red-700",
  mine: "bg-blue-600 hover:bg-blue-700",
  reporting: "bg-emerald-600 hover:bg-emerald-700",
  export: "bg-purple-600 hover:bg-purple-700",
}

const QUICK_ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  report: PlusCircle,
  mine: Activity,
  reporting: NotebookPen,
  export: FileDown,
}

const CATEGORY_COLORS = ["#6366f1", "#22c55e", "#f97316", "#14b8a6", "#ef4444", "#a855f7", "#0ea5e9"]
const NOTIFICATION_SUGGESTIONS = [
  "compliance@company.com",
  "safety@company.com",
  "security-team@company.com",
  "operations-lead@company.com",
]

const TEAM_DIRECTORY = [
  "Alex Lee",
  "Priya Patel",
  "Jordan Smith",
  "Taylor Johnson",
  "Morgan Chen",
  "Jamie Rivera",
]

const DEFAULT_SEVERITY_OPTIONS = [
  { value: "Low" as IncidentSeverity, description: "Minor impact, no immediate action required" },
  { value: "Medium" as IncidentSeverity, description: "Moderate impact, action required within 24 hours" },
  { value: "High" as IncidentSeverity, description: "Significant impact, immediate action required" },
  { value: "Critical" as IncidentSeverity, description: "Major impact, emergency response required" },
]

const DEFAULT_ACTIVITY_TYPES = [
  "Interview",
  "Evidence Collection",
  "Analysis",
  "Site Visit",
  "Expert Consultation",
  "Testing",
  "Research",
  "Other",
]

function stripHtml(html: string): string {
  if (!html) return ""
  const tmp = document.createElement("div")
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ""
}

function formatDate(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  return Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "2-digit" }).format(date)
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  return Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function durationFromHours(hours: number): string {
  if (!hours || Number.isNaN(hours)) return "—"
  if (hours < 24) return `${Math.round(hours)} hrs`
  const days = Math.floor(hours / 24)
  const remainder = Math.round(hours % 24)
  return remainder ? `${days}d ${remainder}h` : `${days}d`
}
interface TokenInputProps {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  suggestions?: string[]
  required?: boolean
}

function TokenInput({ label, values, onChange, placeholder, suggestions = [], required }: TokenInputProps) {
  const [inputValue, setInputValue] = useState("")

  const addToken = useCallback(
    (token: string) => {
      const trimmed = token.trim()
      if (!trimmed || values.includes(trimmed)) return
      onChange([...values, trimmed])
      setInputValue("")
    },
    [values, onChange],
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      addToken(inputValue)
    }
    if (event.key === "Backspace" && !inputValue && values.length) {
      event.preventDefault()
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {label}
        {required ? <span className="text-red-600">*</span> : null}
      </Label>
      <div className="flex flex-wrap gap-2">
        {values.map((value, index) => (
          <Badge key={value} variant="secondary" className="bg-slate-100 text-slate-700">
            {value}
            <button
              type="button"
              className="ml-2 text-slate-500 hover:text-slate-800"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addToken(inputValue)}
        placeholder={placeholder}
      />
      {suggestions.length ? (
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-full border border-dashed border-slate-300 px-2 py-1 hover:bg-slate-100"
              onClick={() => addToken(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

interface RichTextEditorProps {
  label: string
  value: string
  onChange: (html: string, plain: string) => void
  minLength?: number
  required?: boolean
}

function RichTextEditor({ label, value, onChange, minLength = 0, required }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    const node = editorRef.current
    if (node && node.innerHTML !== value) {
      node.innerHTML = value || ""
    }
  }, [value])

  const handleInput = () => {
    const node = editorRef.current
    if (!node) return
    const html = node.innerHTML
    onChange(html, stripHtml(html))
  }

  const applyCommand = (command: string) => {
    document.execCommand(command)
    handleInput()
  }

  const plainLength = value ? stripHtml(value).length : 0
  const belowMinimum = minLength > 0 && plainLength < minLength

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {label}
        {required ? <span className="text-red-600">*</span> : null}
      </Label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => applyCommand("bold")}>
          Bold
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => applyCommand("italic")}>
          Italic
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => applyCommand("insertUnorderedList")}>
          Bullets
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          "min-h-[160px] rounded-md border bg-white p-4 text-sm shadow-sm focus:outline-none",
          isFocused ? "ring-2 ring-indigo-200" : "border-slate-200",
        )}
      />
      <div className={cn("text-xs", belowMinimum ? "text-red-600" : "text-slate-500")}>Minimum {minLength} characters. Current length: {plainLength}.</div>
    </div>
  )
}

interface LocationSelectorProps {
  hierarchy: IncidentMetadataResponse["locationHierarchy"]
  value: string[]
  onChange: (value: string[]) => void
}

function LocationSelector({ hierarchy, value, onChange }: LocationSelectorProps) {
  const level1 = hierarchy
  const level2 = level1.find((item) => item.value === value[0])?.children ?? []
  const level3 = level2?.find((item) => item.value === value[1])?.children ?? []

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label className="flex items-center gap-1">Site <span className="text-red-600">*</span></Label>
        <select
          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:outline-none"
          value={value[0] ?? ""}
          onChange={(event) => onChange(event.target.value ? [event.target.value] : [])}
        >
          <option value="">Select region</option>
          {level1.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Area</Label>
        <select
          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:outline-none"
          value={value[1] ?? ""}
          onChange={(event) => {
            const next = event.target.value
            if (!next) {
              onChange(value[0] ? [value[0]] : [])
            } else {
              onChange(value[0] ? [value[0], next] : [next])
            }
          }}
          disabled={!value[0]}
        >
          <option value="">Select campus</option>
          {level2?.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Specific Location</Label>
        <select
          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:outline-none"
          value={value[2] ?? ""}
          onChange={(event) => {
            const next = event.target.value
            if (!next) {
              onChange(value.slice(0, 2))
            } else {
              onChange([value[0], value[1], next].filter(Boolean) as string[])
            }
          }}
          disabled={!value[1]}
        >
          <option value="">Select location</option>
          {level3?.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
export default function IncidentsPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "report" | "investigation">("dashboard")
  const [dashboardData, setDashboardData] = useState<IncidentDashboardResponse | null>(null)
  const [metadata, setMetadata] = useState<IncidentMetadataResponse | null>(null)
  const [incidents, setIncidents] = useState<IncidentRecord[]>([])
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<IncidentDetail | null>(null)
  const [attachments, setAttachments] = useState<Array<{ file: File; description: string }>>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const captureInputRef = useRef<HTMLInputElement | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [formFeedback, setFormFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const [loadingIncidents, setLoadingIncidents] = useState(true)
  const [loadingIncidentDetail, setLoadingIncidentDetail] = useState(false)
  const [aiAssessment, setAiAssessment] = useState<IncidentIntakeAssessmentResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const [formState, setFormState] = useState({
    title: "",
    incidentType: "",
    incidentCategory: "",
    department: "",
    locationPath: [] as string[],
    occurredAt: "",
    severity: "Medium" as IncidentSeverity,
    impactAssessment: "",
    immediateActions: "",
    detailedDescriptionHtml: "",
    detailedDescriptionText: "",
    whatHappened: "",
    rootCause: "",
    contributingFactors: [] as string[],
    peopleInvolved: [] as string[],
    witnesses: [] as string[],
    equipmentInvolved: "",
    immediateNotification: [NOTIFICATION_SUGGESTIONS[0]],
    externalNotifications: {
      regulatoryBodies: false,
      customers: false,
      vendors: false,
    },
    publicDisclosureRequired: false,
  })

  useEffect(() => {
    let active = true
    async function loadInitial() {
      try {
        const [dashboard, list, meta] = await Promise.all([
          fetchIncidentDashboard(),
          fetchIncidentList(),
          fetchIncidentMetadata(),
        ])
        if (!active) return
        setDashboardData(dashboard)
        setIncidents(list.items)
        setMetadata(meta)
        if (list.items.length) {
          setSelectedIncidentId(list.items[0].id)
        }
      } catch (error) {
        console.error("Failed to load incident data", error)
      } finally {
        if (active) {
          setLoadingDashboard(false)
          setLoadingIncidents(false)
        }
      }
    }
    loadInitial()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedIncidentId) {
      setSelectedIncident(null)
      return
    }
    let active = true
    setLoadingIncidentDetail(true)
    fetchIncidentDetail(selectedIncidentId)
      .then((detail) => {
        if (!active) return
        setSelectedIncident(detail)
      })
      .catch((error) => console.error("Failed to load incident detail", error))
      .finally(() => {
        if (active) setLoadingIncidentDetail(false)
      })
    return () => {
      active = false
    }
  }, [selectedIncidentId])

  useEffect(() => {
    const plain = formState.detailedDescriptionText
    if (!formState.title || !plain || plain.length < 80) {
      setAiAssessment(null)
      return
    }
    const timer = setTimeout(() => {
      setAiLoading(true)
      requestIncidentIntakeInsights({
        title: formState.title,
        incidentType: formState.incidentType,
        detailedDescription: plain,
        department: formState.department || "",
        severity: formState.severity,
      })
        .then(setAiAssessment)
        .catch((error) => console.warn("AI assessment failed", error))
        .finally(() => setAiLoading(false))
    }, 800)
    return () => {
      clearTimeout(timer)
    }
  }, [formState.title, formState.incidentType, formState.detailedDescriptionText, formState.department, formState.severity])

  const filteredCategories = useMemo(() => {
    if (!metadata || !formState.incidentType) return []
    return metadata.incidentCategories[formState.incidentType] ?? []
  }, [metadata, formState.incidentType])

  const severityOptions = metadata?.severityOptions ?? DEFAULT_SEVERITY_OPTIONS
  const severityDescriptions = useMemo(() => {
    const map = new Map<string, string>()
    severityOptions.forEach((option) => map.set(option.value, option.description))
    return map
  }, [severityOptions])
  const handleFileSelection = (files: FileList | null) => {
    if (!files) return
    const unique = Array.from(files).filter(
      (file) =>
        !attachments.some((existing) => existing.file.name === file.name && existing.file.size === file.size),
    )
    if (!unique.length) return
    setAttachments((prev) => [...prev, ...unique.map((file) => ({ file, description: "" }))])
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const updateAttachmentDescription = (index: number, description: string) => {
    setAttachments((prev) =>
      prev.map((item, i) => (i === index ? { ...item, description } : item)),
    )
  }

  const handleSubmit = async () => {
    const errors: string[] = []
    if (!formState.title.trim()) errors.push("Incident title is required.")
    if (formState.title.trim().length > 200) errors.push("Incident title must be 200 characters or fewer.")
    if (!formState.incidentType) errors.push("Select an incident type.")
    if (!formState.incidentCategory && filteredCategories.length) errors.push("Select an incident category.")
    if (!formState.department.trim()) errors.push("Department is required.")
    if (!formState.locationPath.length) errors.push("Select a location.")
    if (!formState.occurredAt) errors.push("Provide date and time of the incident.")
    if (!formState.impactAssessment.trim()) errors.push("Impact assessment is required.")
    if (formState.detailedDescriptionText.length < 100) errors.push("Detailed description must be at least 100 characters.")
    if (!formState.whatHappened.trim()) errors.push("Describe what happened.")
    if (!formState.immediateNotification.length) errors.push("Add at least one immediate notification recipient.")

    if (errors.length) {
      setFormErrors(errors)
      setFormFeedback({ type: "error", message: "Resolve the highlighted issues before submitting." })
      setActiveTab("report")
      return
    }

    setFormErrors([])
    setFormFeedback(null)
    try {
      const payload: IncidentFormPayload = {
        title: formState.title.trim(),
        incidentType: formState.incidentType,
        incidentCategory: formState.incidentCategory || null,
        department: formState.department.trim(),
        locationPath: formState.locationPath,
        occurredAt: new Date(formState.occurredAt).toISOString(),
        severity: formState.severity,
        impactAssessment: formState.impactAssessment.trim(),
        immediateActions: formState.immediateActions?.trim() || undefined,
        detailedDescription: formState.detailedDescriptionText,
        whatHappened: formState.whatHappened.trim(),
        rootCause: formState.rootCause?.trim() || undefined,
        contributingFactors: formState.contributingFactors,
        peopleInvolved: formState.peopleInvolved,
        witnesses: formState.witnesses,
        equipmentInvolved: formState.equipmentInvolved?.trim() || undefined,
        immediateNotification: formState.immediateNotification,
        externalNotifications: formState.externalNotifications,
        publicDisclosureRequired: formState.publicDisclosureRequired,
      }

      const created = await submitIncident(payload)
      setIncidents((prev) => [created, ...prev])
      setDashboardData(await fetchIncidentDashboard())
      if (attachments.length) {
        for (const attachment of attachments) {
          await uploadIncidentAttachment(
            created.id,
            attachment.file,
            attachment.description?.trim() ? attachment.description.trim() : undefined,
          )
        }
      }
      setAttachments([])
      setFormFeedback({ type: "success", message: `${created.referenceId} reported successfully.` })
      setFormState((prev) => ({
        ...prev,
        title: "",
        incidentType: "",
        incidentCategory: "",
        department: "",
        locationPath: [],
        occurredAt: "",
        impactAssessment: "",
        immediateActions: "",
        detailedDescriptionHtml: "",
        detailedDescriptionText: "",
        whatHappened: "",
        rootCause: "",
        contributingFactors: [],
        peopleInvolved: [],
        witnesses: [],
        equipmentInvolved: "",
      }))
      setAiAssessment(null)
      setActiveTab("dashboard")
    } catch (error) {
      console.error("Submit incident failed", error)
      setFormFeedback({ type: "error", message: "Failed to submit incident. Please try again." })
    }
  }

  const severityInsight = useMemo(() => {
    if (!aiAssessment) return null
    const description = severityDescriptions.get(aiAssessment.severity.suggestedSeverity)
    return {
      severity: aiAssessment.severity.suggestedSeverity,
      confidence: aiAssessment.severity.confidence,
      description,
    }
  }, [aiAssessment, severityDescriptions])

  const investigationActivities = selectedIncident?.activities ?? []
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Incident Reporting</h1>
            <p className="text-sm text-slate-500">Monitor incidents, submit new reports, and coordinate investigations with AI support.</p>
          </div>
          <Button className="bg-red-600 hover:bg-red-700" onClick={() => setActiveTab("report")}>
            <PlusCircle className="mr-2 h-4 w-4" /> Report Incident
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="report">Report Incident</TabsTrigger>
            <TabsTrigger value="investigation">Investigation Workspace</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {loadingDashboard ? (
                <div className="col-span-5 text-sm text-slate-500">Loading metrics...</div>
              ) : (
                dashboardData && (
                  <>
                    {(
                      [
                        { key: "totalIncidents", title: "Total Incidents", description: "Captured across all departments" },
                        { key: "openIncidents", title: "Open Incidents", description: "Currently active investigations" },
                        { key: "resolvedThisMonth", title: "Resolved This Month", description: "Closed within current month" },
                        { key: "averageResolutionHours", title: "Average Resolution", description: "Mean closure time" },
                        { key: "overdueIncidents", title: "Overdue", description: "Past target resolution date" },
                      ] as const
                    ).map((item) => {
                      const Icon = SUMMARY_CARD_ICONS[item.key]
                      const metric = dashboardData.summary[item.key]
                      const TrendIcon = TREND_ICONS[metric.trend.direction]
                      const trendColor = TREND_TEXT_COLORS[metric.trend.direction]
                      const valueDisplay =
                        item.key === "averageResolutionHours"
                          ? durationFromHours(metric.value)
                          : metric.value
                      const formattedTrend =
                        metric.trend.percentage === 0
                          ? "0%"
                          : `${metric.trend.direction === "down" ? "-" : "+"}${metric.trend.percentage.toFixed(1)}%`
                      return (
                        <Card key={item.key} className="shadow-sm">
                          <CardHeader className="flex items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-600">{item.title}</CardTitle>
                            <Icon className="h-4 w-4 text-indigo-500" />
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="text-2xl font-bold text-slate-900">{valueDisplay}</span>
                              <span className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
                                <TrendIcon className="h-3.5 w-3.5" />
                                {formattedTrend}
                                <span className="ml-1 text-slate-400">vs last month</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className={cn("h-2.5 w-2.5 rounded-full", SUMMARY_CARD_ACCENTS[item.key])} />
                              <span>{item.description}</span>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </>
                )
              )}
            </div>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <LineChartIcon className="h-5 w-5 text-indigo-600" /> Incident Trend
                </CardTitle>
                <CardDescription>Track incident inflow and resolution cadence over time.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData?.analytics.incidentTrend ?? []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="incidents" stroke="#6366f1" strokeWidth={2} name="Reported" />
                      <Line type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={2} name="Resolved" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <Layers className="h-5 w-5 text-purple-600" /> Incident Categories
                  </CardTitle>
                  <CardDescription>Distribution of incidents by category.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dashboardData?.analytics.incidentCategories ?? []}
                          dataKey="count"
                          nameKey="category"
                          innerRadius={60}
                          outerRadius={100}
                        >
                          {(dashboardData?.analytics.incidentCategories ?? []).map((entry, index) => (
                            <Cell key={entry.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <BarChart3 className="h-5 w-5 text-sky-600" /> Severity &amp; Department Performance
                  </CardTitle>
                  <CardDescription>Risk intensity and departmental response times.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData?.analytics.severityDistribution ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="severity" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData?.analytics.departmentPerformance ?? []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="department" type="category" width={120} />
                        <Tooltip formatter={(value: number) => `${Math.round(value)} hrs`} />
                        <Bar dataKey="averageResolutionHours" fill="#22c55e" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <NotebookPen className="h-5 w-5 text-amber-600" /> AI Insights
                </CardTitle>
                <CardDescription>Predictive analytics, categorisation, and resource guidance.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700">Forecasted Trend</h3>
                  <p className="mt-2 text-xs text-slate-500">Next 3 months incident outlook.</p>
                  <div className="mt-3 space-y-2 text-sm">
                    {(dashboardData?.aiInsights.forecast.forecast ?? []).map((point) => (
                      <div key={point.month} className="flex justify-between rounded bg-slate-50 p-2">
                        <span>{point.month}</span>
                        <span className="font-medium text-slate-900">{point.incidents}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700">Severity Outlook</h3>
                  <p className="mt-2 text-xs text-slate-500">Proportion of high and critical incidents.</p>
                  <div className="mt-4 flex items-end gap-4">
                    <div className="flex-1">
                      <div className="text-3xl font-bold text-red-600">
                        {dashboardData ? Math.round(dashboardData.aiInsights.severityOutlook.criticalShare * 100) : 0}%
                      </div>
                      <div className="text-xs text-slate-500">Critical</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-3xl font-bold text-orange-500">
                        {dashboardData ? Math.round(dashboardData.aiInsights.severityOutlook.highShare * 100) : 0}%
                      </div>
                      <div className="text-xs text-slate-500">High</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700">Automated Categorisation</h3>
                  <p className="mt-2 text-xs text-slate-500">Recent AI-assisted recommendations.</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {(dashboardData?.aiInsights.recentCategorisations ?? []).map((item, index) => (
                      <li key={index} className="rounded bg-slate-50 p-2">
                        {(item?.predictedCategory as string) ?? "Awaiting data"}
                      </li>
                    ))}
                    {!dashboardData?.aiInsights.recentCategorisations?.length ? (
                      <li className="text-xs text-slate-400">Submit new incidents to train recommendations.</li>
                    ) : null}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <CloudLightning className="h-5 w-5 text-fuchsia-600" /> Quick Actions
                </CardTitle>
                <CardDescription>Launch common workflows directly from the dashboard.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                {(dashboardData?.quickActions ?? []).map((action) => {
                  const ActionIcon = QUICK_ACTION_ICONS[action.intent] ?? PlusCircle
                  return (
                    <Button
                      key={action.intent}
                      className={cn("h-24 w-full rounded-xl text-sm font-semibold", QUICK_ACTION_STYLES[action.intent])}
                      onClick={() => {
                        if (action.intent === "report") setActiveTab("report")
                        if (action.intent === "mine") setActiveTab("investigation")
                      }}
                    >
                      <ActionIcon className="mr-2 h-4 w-4" />
                      {action.label}
                    </Button>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="report" className="space-y-6">
            {formFeedback ? (
              <Alert variant={formFeedback.type === "success" ? "default" : "destructive"}>
                <AlertTitle>{formFeedback.type === "success" ? "Incident submitted" : "Submission failed"}</AlertTitle>
                <AlertDescription>{formFeedback.message}</AlertDescription>
              </Alert>
            ) : null}
            {formErrors.length ? (
              <Alert variant="destructive">
                <AlertTitle>Resolve the highlighted issues</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5">
                    {formErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-6">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900">Incident Details</CardTitle>
                    <CardDescription>Capture the core information about the incident.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">Incident Title <span className="text-red-600">*</span></Label>
                      <Input
                        value={formState.title}
                        onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                        placeholder="e.g. Unauthorized database access"
                        maxLength={200}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">Incident Type <span className="text-red-600">*</span></Label>
                        <select
                          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:outline-none"
                          value={formState.incidentType}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              incidentType: event.target.value,
                              incidentCategory: "",
                            }))
                          }
                        >
                          <option value="">Select type</option>
                          {(metadata?.incidentTypes ?? []).map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>Incident Category</Label>
                        <select
                          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:outline-none"
                          value={formState.incidentCategory}
                          onChange={(event) => setFormState((prev) => ({ ...prev, incidentCategory: event.target.value }))}
                          disabled={!filteredCategories.length}
                        >
                          <option value="">Select category</option>
                          {filteredCategories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">Department <span className="text-red-600">*</span></Label>
                        <Input
                          value={formState.department}
                          onChange={(event) => setFormState((prev) => ({ ...prev, department: event.target.value }))}
                          placeholder="e.g. IT Security"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">Severity <span className="text-red-600">*</span></Label>
                        <select
                          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:outline-none"
                          value={formState.severity}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              severity: event.target.value as IncidentSeverity,
                            }))
                          }
                        >
                          {severityOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.value}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-slate-500">{severityDescriptions.get(formState.severity)}</p>
                      </div>
                    </div>

                    {metadata ? (
                      <LocationSelector
                        hierarchy={metadata.locationHierarchy}
                        value={formState.locationPath}
                        onChange={(value) => setFormState((prev) => ({ ...prev, locationPath: value }))}
                      />
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">Date &amp; Time <span className="text-red-600">*</span></Label>
                        <Input
                          type="datetime-local"
                          value={formState.occurredAt}
                          onChange={(event) => setFormState((prev) => ({ ...prev, occurredAt: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Immediate Actions Taken</Label>
                        <Textarea
                          value={formState.immediateActions}
                          onChange={(event) => setFormState((prev) => ({ ...prev, immediateActions: event.target.value }))}
                          placeholder="Steps taken to contain the incident"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">Impact Assessment <span className="text-red-600">*</span></Label>
                      <Textarea
                        value={formState.impactAssessment}
                        onChange={(event) => setFormState((prev) => ({ ...prev, impactAssessment: event.target.value }))}
                        placeholder="Describe the potential or observed impact"
                      />
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900">Incident Narrative</CardTitle>
                    <CardDescription>Provide a comprehensive description for automated classification.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RichTextEditor
                      label="Detailed Description"
                      value={formState.detailedDescriptionHtml}
                      minLength={100}
                      required
                      onChange={(html, plain) =>
                        setFormState((prev) => ({
                          ...prev,
                          detailedDescriptionHtml: html,
                          detailedDescriptionText: plain,
                        }))
                      }
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">What Happened <span className="text-red-600">*</span></Label>
                        <Textarea
                          value={formState.whatHappened}
                          onChange={(event) => setFormState((prev) => ({ ...prev, whatHappened: event.target.value }))}
                          placeholder="Chronological summary of events"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Known Root Cause</Label>
                        <Textarea
                          value={formState.rootCause}
                          onChange={(event) => setFormState((prev) => ({ ...prev, rootCause: event.target.value }))}
                          placeholder="If identified, describe the likely root cause"
                        />
                      </div>
                    </div>

                    <TokenInput
                      label="Contributing Factors"
                      values={formState.contributingFactors}
                      onChange={(values) => setFormState((prev) => ({ ...prev, contributingFactors: values }))}
                      placeholder="Press enter to add factor"
                    />

                    <TokenInput
                      label="People Involved"
                      values={formState.peopleInvolved}
                      onChange={(values) => setFormState((prev) => ({ ...prev, peopleInvolved: values }))}
                      placeholder="Type a name and press enter"
                      suggestions={TEAM_DIRECTORY}
                    />

                    <TokenInput
                      label="Witnesses"
                      values={formState.witnesses}
                      onChange={(values) => setFormState((prev) => ({ ...prev, witnesses: values }))}
                      placeholder="Type a name and press enter"
                      suggestions={TEAM_DIRECTORY}
                    />

                    <div className="space-y-2">
                      <Label>Equipment / Systems Involved</Label>
                      <Textarea
                        value={formState.equipmentInvolved}
                        onChange={(event) => setFormState((prev) => ({ ...prev, equipmentInvolved: event.target.value }))}
                        placeholder="List affected equipment or systems"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900">Evidence &amp; Attachments</CardTitle>
                    <CardDescription>Upload supporting files, photos, or documentation (max 50MB each).</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div
                      className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 p-6 text-center transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault()
                        handleFileSelection(event.dataTransfer.files)
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          fileInputRef.current?.click()
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <Upload className="h-10 w-10 text-slate-400" />
                      <p className="mt-2 text-sm text-slate-600">Drag &amp; drop evidence files, or click to upload.</p>
                      <p className="mt-1 text-xs text-slate-500">Supported: images, videos, documents, and audio up to 50MB each.</p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            fileInputRef.current?.click()
                          }}
                        >
                          <Upload className="mr-2 h-4 w-4" /> Browse Files
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            captureInputRef.current?.click()
                          }}
                        >
                          <Camera className="mr-2 h-4 w-4" /> Capture Photo/Video
                        </Button>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                      className="hidden"
                      onChange={(event) => {
                        handleFileSelection(event.target.files)
                        if (event.target.value) event.target.value = ""
                      }}
                    />
                    <input
                      ref={captureInputRef}
                      type="file"
                      accept="image/*,video/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => {
                        handleFileSelection(event.target.files)
                        if (event.target.value) event.target.value = ""
                      }}
                    />
                    {attachments.length ? (
                      <div className="space-y-3">
                        {attachments.map((attachment, index) => (
                          <div key={`${attachment.file.name}-${index}`} className="rounded border border-slate-200 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{attachment.file.name}</p>
                                <p className="text-xs text-slate-500">{Math.round(attachment.file.size / 1024)} KB</p>
                              </div>
                              <button className="text-xs font-medium text-red-600" type="button" onClick={() => removeAttachment(index)}>
                                Remove
                              </button>
                            </div>
                            <Textarea
                              className="mt-3"
                              value={attachment.description}
                              onChange={(event) => updateAttachmentDescription(index, event.target.value)}
                              placeholder="Evidence description (e.g., context, observations, people involved)"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No evidence files added yet.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900">Notifications</CardTitle>
                    <CardDescription>Ensure the right teams are alerted immediately.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <TokenInput
                      label="Immediate Notification"
                      required
                      values={formState.immediateNotification}
                      onChange={(values) => setFormState((prev) => ({ ...prev, immediateNotification: values }))}
                      placeholder="Add email or team name"
                      suggestions={NOTIFICATION_SUGGESTIONS}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center justify-between rounded border border-slate-200 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">Notify Regulators</p>
                          <p className="text-xs text-slate-500">Automatically alert regulatory bodies.</p>
                        </div>
                        <Switch
                          checked={formState.externalNotifications.regulatoryBodies}
                          onCheckedChange={(checked) =>
                            setFormState((prev) => ({
                              ...prev,
                              externalNotifications: {
                                ...prev.externalNotifications,
                                regulatoryBodies: checked,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between rounded border border-slate-200 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">Notify Customers</p>
                          <p className="text-xs text-slate-500">Prepare customer communications if required.</p>
                        </div>
                        <Switch
                          checked={formState.externalNotifications.customers}
                          onCheckedChange={(checked) =>
                            setFormState((prev) => ({
                              ...prev,
                              externalNotifications: {
                                ...prev.externalNotifications,
                                customers: checked,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded border border-slate-200 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">Public Disclosure Required?</p>
                        <p className="text-xs text-slate-500">Flag incidents that require disclosure statements.</p>
                      </div>
                      <Switch
                        checked={formState.publicDisclosureRequired}
                        onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, publicDisclosureRequired: checked }))}
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setFormState((prev) => ({
                        ...prev,
                        title: "",
                        incidentType: "",
                        incidentCategory: "",
                        department: "",
                        locationPath: [],
                        occurredAt: "",
                      }))
                    }
                  >
                    Reset
                  </Button>
                  <Button className="bg-red-600 hover:bg-red-700" onClick={handleSubmit}>
                    Submit Incident
                  </Button>
                </div>
              </div>
              <div className="space-y-6">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900">AI Assessment</CardTitle>
                    <CardDescription>Real-time severity, categorisation, and escalation guidance.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {aiLoading ? <p className="text-sm text-slate-500">Evaluating incident context...</p> : null}
                    {severityInsight ? (
                      <div className="rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase text-slate-400">Suggested Severity</p>
                            <p className="text-lg font-semibold text-slate-900">{severityInsight.severity}</p>
                          </div>
                          <Badge className={cn("text-xs", SEVERITY_BADGES[severityInsight.severity])}>
                            {Math.round(severityInsight.confidence * 100)}% confidence
                          </Badge>
                        </div>
                        {severityInsight.description ? (
                          <p className="mt-2 text-xs text-slate-500">{severityInsight.description}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Add a detailed description to activate AI insights.</p>
                    )}
                    {aiAssessment?.categorisation?.resourceSuggestions ? (
                      <div className="rounded-lg border border-slate-200 p-4">
                        <p className="text-xs uppercase text-slate-400">Resource Suggestions</p>
                        <ul className="mt-2 space-y-2 text-sm text-slate-600">
                          {(aiAssessment.categorisation.resourceSuggestions as string[]).map((suggestion) => (
                            <li key={suggestion} className="rounded bg-slate-50 p-2">
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {aiAssessment?.categorisation?.escalationPath ? (
                      <div className="rounded-lg border border-slate-200 p-4">
                        <p className="text-xs uppercase text-slate-400">Escalation Path</p>
                        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-600">
                          {(aiAssessment.categorisation.escalationPath as string[]).map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900">Recent Incidents</CardTitle>
                    <CardDescription>Quick glance at latest submissions.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loadingIncidents ? (
                      <p className="text-sm text-slate-500">Loading incidents...</p>
                    ) : (
                      incidents.slice(0, 5).map((incident) => (
                        <div key={incident.id} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{incident.referenceId}</p>
                              <p className="text-xs text-slate-500">{incident.title}</p>
                            </div>
                            <Badge className={cn("text-xs", SEVERITY_BADGES[incident.severity])}>{incident.severity}</Badge>
                          </div>
                          <div className="mt-2 flex justify-between text-xs text-slate-500">
                            <span>{incident.incidentType}</span>
                            <span>{formatDate(incident.occurredAt)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
  const [activityForm, setActivityForm] = useState({
    activityType: "Interview",
    description: "",
    findings: "",
    followUpRequired: false,
  })
  const [rcaForm, setRcaForm] = useState({
    method: "5 Whys",
    primary: "",
    factors: [] as Array<{ description: string; category: string; impactLevel: IncidentSeverity }>,
  })

  useEffect(() => {
    if (!selectedIncident) return
    setRcaForm({
      method: selectedIncident.rootCause.rcaMethod || "5 Whys",
      primary: selectedIncident.rootCause.primaryRootCause || "",
      factors: selectedIncident.rootCause.factors.map((factor) => ({
        description: factor.description,
        category: factor.category,
        impactLevel: factor.impactLevel,
      })),
    })
  }, [selectedIncident])

  const handleAddActivity = async () => {
    if (!selectedIncidentId) return
    try {
      await addIncidentActivity(selectedIncidentId, {
        activityType: activityForm.activityType,
        description: activityForm.description,
        findings: activityForm.findings,
        followUpRequired: activityForm.followUpRequired,
      })
      setActivityForm({ activityType: "Interview", description: "", findings: "", followUpRequired: false })
      const detail = await fetchIncidentDetail(selectedIncidentId)
      setSelectedIncident(detail)
    } catch (error) {
      console.error("Failed to add activity", error)
    }
  }

  const handleSaveRootCause = async () => {
    if (!selectedIncidentId) return
    try {
      const payload = {
        rcaMethod: rcaForm.method,
        primaryRootCause: rcaForm.primary,
        factors: rcaForm.factors,
        rcaDiagram: selectedIncident?.rootCause.rcaDiagram ?? null,
        rcaEvidence: selectedIncident?.rootCause.rcaEvidence ?? [],
      }
      const detail = await saveIncidentRootCause(selectedIncidentId, payload)
      setSelectedIncident(detail)
    } catch (error) {
      console.error("Failed to save root cause", error)
    }
  }
  const [factorDraft, setFactorDraft] = useState({ description: "", category: "Human", impactLevel: "Medium" as IncidentSeverity })
  const factorCategories = ["Human", "Process", "System", "Environment"]

  const addFactor = () => {
    if (!factorDraft.description.trim()) return
    setRcaForm((prev) => ({
      ...prev,
      factors: [...prev.factors, { ...factorDraft, description: factorDraft.description.trim() }],
    }))
    setFactorDraft({ description: "", category: "Human", impactLevel: "Medium" })
  }

  const removeFactor = (index: number) => {
    setRcaForm((prev) => ({
      ...prev,
      factors: prev.factors.filter((_, i) => i !== index),
    }))
  }
          <TabsContent value="investigation" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-slate-900">Incident Queue</CardTitle>
                  <CardDescription>Select an incident to manage the investigation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="max-h-[360px] overflow-auto rounded border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Incident</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Severity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incidents.map((incident) => (
                          <TableRow
                            key={incident.id}
                            className={cn(
                              "cursor-pointer",
                              incident.id === selectedIncidentId ? "bg-indigo-50" : "hover:bg-slate-50",
                            )}
                            onClick={() => setSelectedIncidentId(incident.id)}
                          >
                            <TableCell>
                              <div className="text-sm font-semibold text-slate-800">{incident.referenceId}</div>
                              <div className="text-xs text-slate-500">{incident.title}</div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">{incident.status}</TableCell>
                            <TableCell>
                              <Badge className={cn("text-xs", SEVERITY_BADGES[incident.severity])}>{incident.severity}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900">Investigation Overview</CardTitle>
                    <CardDescription>Key metadata and escalations for the selected incident.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingIncidentDetail ? (
                      <p className="text-sm text-slate-500">Loading incident details...</p>
                    ) : selectedIncident ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase text-slate-400">Reference</p>
                          <p className="text-sm font-semibold text-slate-900">{selectedIncident.referenceId}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-400">Status</p>
                          <p className="text-sm font-semibold text-slate-900">{selectedIncident.status}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-400">Severity</p>
                          <Badge className={cn("mt-1", SEVERITY_BADGES[selectedIncident.severity])}>{selectedIncident.severity}</Badge>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-400">Target Resolution</p>
                          <p className="text-sm text-slate-700">{formatDate(selectedIncident.targetResolutionDate)}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-xs uppercase text-slate-400">Escalation Path</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedIncident.escalationPath.map((step) => (
                              <Badge key={step} variant="outline" className="border-indigo-200 text-xs text-indigo-700">
                                {step}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Select an incident to view details.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900">Investigation Timeline</CardTitle>
                    <CardDescription>Chronological log of investigation activities.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {investigationActivities.length ? (
                        investigationActivities.map((activity) => (
                          <div key={activity.id} className="rounded-lg border border-slate-200 p-3">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{formatDateTime(activity.timestamp)}</span>
                              <Badge variant="outline" className="text-xs">
                                {activity.activityType}
                              </Badge>
                            </div>
                            {activity.description ? (
                              <p className="mt-2 text-sm text-slate-700">{activity.description}</p>
                            ) : null}
                            {activity.findings ? (
                              <p className="mt-2 text-xs text-slate-500">Findings: {activity.findings}</p>
                            ) : null}
                            {activity.followUpRequired ? (
                              <p className="mt-2 text-xs font-semibold text-amber-600">Follow-up required</p>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No activities logged yet.</p>
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-800">Add Activity</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Activity Type</Label>
                          <select
                            className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:outline-none"
                            value={activityForm.activityType}
                            onChange={(event) => setActivityForm((prev) => ({ ...prev, activityType: event.target.value }))}
                          >
                            {(metadata?.activityTypes ?? DEFAULT_ACTIVITY_TYPES).map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>Follow-up Required</Label>
                          <div className="flex h-10 items-center gap-3 rounded-md border border-slate-200 px-3">
                            <Switch
                              checked={activityForm.followUpRequired}
                              onCheckedChange={(checked) =>
                                setActivityForm((prev) => ({ ...prev, followUpRequired: checked }))
                              }
                            />
                            <span className="text-xs text-slate-500">Mark if additional action needed</span>
                          </div>
                        </div>
                      </div>
                      <Textarea
                        value={activityForm.description}
                        onChange={(event) => setActivityForm((prev) => ({ ...prev, description: event.target.value }))}
                        placeholder="Describe the investigation step"
                      />
                      <Textarea
                        value={activityForm.findings}
                        onChange={(event) => setActivityForm((prev) => ({ ...prev, findings: event.target.value }))}
                        placeholder="Capture findings or notes"
                      />
                      <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleAddActivity}>
                        Add Activity
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900">Root Cause Analysis</CardTitle>
                    <CardDescription>Document the investigation findings and contributing factors.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>RCA Method</Label>
                        <select
                          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:outline-none"
                          value={rcaForm.method}
                          onChange={(event) => setRcaForm((prev) => ({ ...prev, method: event.target.value }))}
                        >
                          {(metadata?.rcaMethods ?? ["5 Whys", "Fishbone", "Fault Tree", "Apollo", "Custom"]).map((method) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label>Primary Root Cause</Label>
                        <Input
                          value={rcaForm.primary}
                          onChange={(event) => setRcaForm((prev) => ({ ...prev, primary: event.target.value }))}
                          placeholder="Summarise the primary root cause"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-800">Contributing Factors</h4>
                      {rcaForm.factors.length ? (
                        <ul className="space-y-2 text-sm">
                          {rcaForm.factors.map((factor, index) => (
                            <li key={`${factor.description}-${index}`} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
                              <div>
                                <p className="font-medium text-slate-800">{factor.description}</p>
                                <p className="text-xs text-slate-500">
                                  {factor.category} · Impact {factor.impactLevel}
                                </p>
                              </div>
                              <button className="text-xs text-red-500" type="button" onClick={() => removeFactor(index)}>
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500">No contributing factors logged yet.</p>
                      )}

                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          value={factorDraft.description}
                          onChange={(event) => setFactorDraft((prev) => ({ ...prev, description: event.target.value }))}
                          placeholder="Factor description"
                        />
                        <select
                          className="h-10 rounded-md border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:outline-none"
                          value={factorDraft.category}
                          onChange={(event) => setFactorDraft((prev) => ({ ...prev, category: event.target.value }))}
                        >
                          {factorCategories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                        <select
                          className="h-10 rounded-md border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:outline-none"
                          value={factorDraft.impactLevel}
                          onChange={(event) => setFactorDraft((prev) => ({ ...prev, impactLevel: event.target.value as IncidentSeverity }))}
                        >
                          {(["Low", "Medium", "High", "Critical"] as IncidentSeverity[]).map((level) => (
                            <option key={level} value={level}>
                              {level}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button variant="outline" onClick={addFactor}>
                        Add Factor
                      </Button>
                    </div>

                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveRootCause}>
                      Save Root Cause Analysis
                    </Button>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900">AI Guidance</CardTitle>
                    <CardDescription>Next steps, root cause hypotheses, and resolution forecast.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedIncident?.aiInvestigation ? (
                      <div className="space-y-4 text-sm text-slate-700">
                        {selectedIncident.aiInvestigation.suggestedActivities ? (
                          <div>
                            <p className="text-xs uppercase text-slate-400">Suggested Activities</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                              {(selectedIncident.aiInvestigation.suggestedActivities as string[]).map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {selectedIncident.aiInvestigation.rootCauseHypotheses ? (
                          <div>
                            <p className="text-xs uppercase text-slate-400">Root Cause Hypotheses</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                              {(selectedIncident.aiInvestigation.rootCauseHypotheses as string[]).map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {selectedIncident.aiInvestigation.predictedResolutionHours ? (
                          <div>
                            <p className="text-xs uppercase text-slate-400">Predicted Resolution Time</p>
                            <p className="text-sm font-semibold text-slate-900">
                              {durationFromHours(Number(selectedIncident.aiInvestigation.predictedResolutionHours))}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">AI guidance will appear after updating the root cause analysis.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
