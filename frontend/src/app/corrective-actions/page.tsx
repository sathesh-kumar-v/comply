"use client"

import { useEffect, useMemo, useState } from "react"
import {
  PieChart as PieChartIcon,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Brain,
  Activity,
  Users,
  CalendarDays,
  Loader2,
  Target,
  LineChart as LineChartIcon
} from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from "recharts"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"

import { buildApiUrl } from "@/lib/api-url"
import { DEPARTMENT_OPTIONS, OTHER_DEPARTMENT_VALUE } from "@/constants/departments"
import {
  type CorrectiveActionDashboardResponse,
  type CorrectiveActionDetail,
  type CorrectiveActionListEntry,
  type CorrectiveActionSummaryMetric,
  type CorrectiveActionAIInsights,
  type ActionPriority,
  type ActionStatus,
  type StepStatus,
  type AiPlanResponse,
  type ImplementationStepDetail
} from "@/types/corrective-actions"

const ACTION_TYPES = [
  "Immediate Action",
  "Short-term Corrective Action",
  "Long-term Corrective Action",
  "Preventive Action",
  "Improvement Action"
] as const

const SOURCE_OPTIONS = [
  "Incident Report",
  "Audit Finding",
  "Risk Assessment",
  "Customer Complaint",
  "Management Review",
  "FMEA",
  "Other"
] as const

const PRIORITY_OPTIONS: ActionPriority[] = ["Low", "Medium", "High", "Critical"]
const IMPACT_OPTIONS: ActionPriority[] = PRIORITY_OPTIONS
const URGENCY_OPTIONS: ActionPriority[] = PRIORITY_OPTIONS

const ACTION_STATUS_OPTIONS: ActionStatus[] = ["Open", "In Progress", "Completed", "Closed", "Cancelled"]
const STEP_STATUS_OPTIONS: StepStatus[] = ["Not Started", "In Progress", "Completed", "Delayed"]
const UPDATE_TYPES = [
  "Progress Update",
  "Issue Report",
  "Resource Change",
  "Timeline Change",
  "Escalation",
  "Review",
  "Comment"
]

const TEAM_DIRECTORY = Array.from(
  new Set([
    "Jordan Smith",
    "Maria Chen",
    "Alex Martinez",
    "Lena Ortiz",
    "Priya Patel",
    "Rahul Iyer",
    "Quality Director",
    "Compliance Lead",
    "Internal Audit",
    "CISO",
    "Risk Manager",
    "EHS Director",
    "Operations VP",
    "Learning & Development",
    "Training Team",
    "Communications",
    "Customer Success",
    "Data Analytics",
    "Program Manager",
    "Process Excellence",
    "Operations Excellence Coach",
    "Security Architect"
  ])
)

const DEPARTMENT_MULTISELECT_OPTIONS: MultiSelectOption[] = DEPARTMENT_OPTIONS.map((department) => ({
  value: department,
  label: department
}))

const REVIEW_TEAM_OPTIONS: MultiSelectOption[] = TEAM_DIRECTORY.map((member) => ({
  value: member,
  label: member
}))

const STATUS_COLORS: Record<string, string> = {
  Open: "#f97316",
  "In Progress": "#0ea5e9",
  Completed: "#22c55e",
  Closed: "#6366f1",
  Cancelled: "#94a3b8",
  Overdue: "#ef4444"
}

const PRIORITY_BADGE_CLASS: Record<ActionPriority, string> = {
  Low: "bg-emerald-50 text-emerald-700",
  Medium: "bg-yellow-50 text-yellow-700",
  High: "bg-orange-50 text-orange-700",
  Critical: "bg-red-50 text-red-700"
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  Open: "bg-orange-50 text-orange-700",
  "In Progress": "bg-sky-50 text-sky-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Closed: "bg-indigo-50 text-indigo-700",
  Cancelled: "bg-slate-200 text-slate-600",
  Overdue: "bg-red-50 text-red-700"
}

interface ImplementationStepForm {
  description: string
  responsiblePerson: string
  dueDate: string
  resourcesRequired: string
  successCriteria: string
}

const INITIAL_STEP: ImplementationStepForm = {
  description: "",
  responsiblePerson: "",
  dueDate: "",
  resourcesRequired: "",
  successCriteria: ""
}

const INITIAL_FORM_VALUES = {
  title: "",
  actionType: "",
  source: "",
  reference: "",
  priority: "Medium" as ActionPriority,
  impact: "Medium" as ActionPriority,
  urgency: "Medium" as ActionPriority,
  problem: "",
  rootCause: "",
  factors: "",
  impactAssessment: "",
  currentControls: "",
  actionPlan: "",
  dueDate: "",
  owner: "",
  budget: "",
  approvalRequired: "No",
  approver: ""
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
})

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit"
})

function formatDateValue(value?: string | null): string {
  if (!value) return "TBD"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return dateFormatter.format(parsed)
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return dateTimeFormatter.format(parsed)
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()
}

function renderTrend(metric: CorrectiveActionSummaryMetric, preference: "up" | "down" = "up") {
  if (!metric || metric.direction === "flat" || Math.abs(metric.trend) < 0.1) {
    return <span className="text-xs text-muted-foreground">No change</span>
  }
  const Icon = metric.direction === "up" ? TrendingUp : TrendingDown
  const isPositive = metric.direction === preference
  const tone = isPositive ? "text-emerald-600" : "text-red-600"
  const trendValue = metric.trend > 0 ? `+${metric.trend}` : metric.trend
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${tone}`}>
      <Icon className="h-3 w-3" />
      {trendValue}
    </span>
  )
}

function computeStepProgress(steps: ImplementationStepDetail[]): number {
  if (!steps || steps.length === 0) return 0
  const score = steps.reduce((total, step) => {
    if (step.status === "Completed") return total + 1
    if (step.status === "In Progress") return total + 0.5
    if (step.status === "Delayed") return total + 0.25
    return total
  }, 0)
  return Math.min(100, Math.round((score / steps.length) * 100))
}
export default function CorrectiveActionsPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "create" | "tracking">("dashboard")
  const [dashboardData, setDashboardData] = useState<CorrectiveActionDashboardResponse | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  const [actionDetail, setActionDetail] = useState<CorrectiveActionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [formValues, setFormValues] = useState({ ...INITIAL_FORM_VALUES })
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [otherDepartment, setOtherDepartment] = useState("")
  const [selectedReviewTeam, setSelectedReviewTeam] = useState<string[]>([])
  const [implementationSteps, setImplementationSteps] = useState<ImplementationStepForm[]>([{ ...INITIAL_STEP }])
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [aiPlan, setAiPlan] = useState<AiPlanResponse | null>(null)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [newUpdateType, setNewUpdateType] = useState<string>(UPDATE_TYPES[0])
  const [newUpdateDescription, setNewUpdateDescription] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      setDashboardLoading(true)
      setDashboardError(null)
      try {
        const response = await fetch(buildApiUrl("/api/corrective-actions/dashboard"))
        if (!response.ok) {
          throw new Error("Failed to load corrective actions dashboard data")
        }
        const data = (await response.json()) as CorrectiveActionDashboardResponse
        setDashboardData(data)
      } catch (error) {
        console.error(error)
        setDashboardError(error instanceof Error ? error.message : "Unable to load dashboard data")
      } finally {
        setDashboardLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const intent = new URLSearchParams(window.location.search).get("intent")
    if (intent === "create") {
      setActiveTab("create")
    }
  }, [])

  useEffect(() => {
    if (!dashboardData) return
    if (selectedActionId && dashboardData.actions.some((action) => action.id === selectedActionId)) {
      return
    }
    const fallback =
      dashboardData.priorityLists.highPriority[0]?.id || dashboardData.actions[0]?.id || null
    setSelectedActionId(fallback)
  }, [dashboardData, selectedActionId])

  useEffect(() => {
    if (!selectedActionId) {
      setActionDetail(null)
      return
    }
    const fetchDetail = async () => {
      setDetailLoading(true)
      setDetailError(null)
      try {
        const response = await fetch(
          buildApiUrl(`/api/corrective-actions/actions/${selectedActionId}`)
        )
        if (!response.ok) {
          throw new Error("Failed to load corrective action detail")
        }
        const detail = (await response.json()) as CorrectiveActionDetail
        setActionDetail({
          ...detail,
          progress: detail.progress ?? computeStepProgress(detail.implementationSteps)
        })
      } catch (error) {
        console.error(error)
        setDetailError(error instanceof Error ? error.message : "Unable to load action detail")
      } finally {
        setDetailLoading(false)
      }
    }

    fetchDetail()
  }, [selectedActionId])

  const departmentList = useMemo(() => {
    const base = selectedDepartments.filter((department) => department !== OTHER_DEPARTMENT_VALUE)
    if (selectedDepartments.includes(OTHER_DEPARTMENT_VALUE) && otherDepartment.trim()) {
      return [...base, otherDepartment.trim()]
    }
    return base
  }, [selectedDepartments, otherDepartment])

  const handleDepartmentChange = (values: string[]) => {
    if (!values.includes(OTHER_DEPARTMENT_VALUE)) {
      setOtherDepartment("")
    }
    setSelectedDepartments(values)
    if (values.length > 0) {
      setFormError(null)
    }
  }

  const handleReviewTeamChange = (values: string[]) => {
    setSelectedReviewTeam(values)
  }

  const handleImplementationStepChange = (
    index: number,
    key: keyof ImplementationStepForm,
    value: string
  ) => {
    setImplementationSteps((previous) => {
      const next = [...previous]
      next[index] = { ...next[index], [key]: value }
      return next
    })
  }

  const addImplementationStep = () => {
    setImplementationSteps((previous) => [...previous, { ...INITIAL_STEP }])
  }

  const removeImplementationStep = (index: number) => {
    if (implementationSteps.length === 1) return
    setImplementationSteps((previous) => previous.filter((_, stepIndex) => stepIndex !== index))
  }

  const handleEvidenceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    setEvidenceFiles(files)
  }

  const handleGenerateAiPlan = async () => {
    const trimmedProblem = formValues.problem.trim()
    if (!formValues.actionType || !trimmedProblem) {
      setFormError(
        "Provide an action type and problem statement before requesting AI planning support."
      )
      setActiveTab("create")
      return
    }
    setFormError(null)
    setAiGenerating(true)
    try {
      const response = await fetch(buildApiUrl("/api/corrective-actions/actions/ai/plan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionTitle: formValues.title || "Corrective Action",
          actionType: formValues.actionType,
          problemStatement: trimmedProblem,
          rootCause: formValues.rootCause,
          impact: formValues.impact,
          urgency: formValues.urgency,
          departments: departmentList
        })
      })
      if (!response.ok) {
        throw new Error("AI planning service unavailable. Please try again shortly.")
      }
      const plan = (await response.json()) as AiPlanResponse
      setAiPlan(plan)
      setFormValues((previous) => ({
        ...previous,
        actionPlan: plan.actionNarrative,
        dueDate: previous.dueDate || plan.timeline.targetCompletionDate || "",
        budget: plan.resourcePlan.budgetEstimate.toString()
      }))
      setImplementationSteps(
        plan.steps.map((step) => ({
          description: `${step.title}: ${step.description}`,
          responsiblePerson: step.ownerRole,
          dueDate: "",
          resourcesRequired: step.resources,
          successCriteria: step.successCriteria
        }))
      )
      setFormError(null)
    } catch (error) {
      console.error(error)
      setFormError(error instanceof Error ? error.message : "Unable to generate AI-assisted plan")
    } finally {
      setAiGenerating(false)
    }
  }

  const resetForm = () => {
    setFormValues({ ...INITIAL_FORM_VALUES })
    setSelectedDepartments([])
    setOtherDepartment("")
    setSelectedReviewTeam([])
    setImplementationSteps([{ ...INITIAL_STEP }])
    setEvidenceFiles([])
    setAiPlan(null)
    setFormError(null)
    setSubmissionSuccess(null)
  }
  const handleSubmit = async () => {
    setFormError(null)
    setSubmissionSuccess(null)

    const trimmedTitle = formValues.title.trim()
    const trimmedActionType = formValues.actionType.trim()
    const trimmedSource = formValues.source.trim()
    const trimmedProblem = formValues.problem.trim()
    const trimmedRootCause = formValues.rootCause.trim()
    const trimmedImpactAssessment = formValues.impactAssessment.trim()
    const trimmedPlanText = stripHtml(formValues.actionPlan)

    const missing: string[] = []
    if (!trimmedTitle) missing.push("Provide an action title.")
    if (!trimmedActionType) missing.push("Select an action type.")
    if (!trimmedSource) missing.push("Choose a source reference.")
    if (departmentList.length === 0) missing.push("Select at least one department (or specify other).")
    if (!trimmedProblem) missing.push("Problem statement is required.")
    if (!trimmedRootCause) missing.push("Root cause is required.")
    if (!trimmedImpactAssessment) missing.push("Impact assessment is required.")
    if (!trimmedPlanText) missing.push("Provide a corrective action description.")
    if (!formValues.dueDate) missing.push("Overall due date is required.")
    if (!formValues.owner) missing.push("Select an action owner.")
    if (formValues.approvalRequired === "Yes" && !formValues.approver.trim()) {
      missing.push("Approval is required; specify an approver.")
    }

    const normalizedSteps = implementationSteps
      .filter((step) => step.description.trim())
      .map((step, index) => ({
        stepNumber: index + 1,
        stepDescription: step.description.trim(),
        responsiblePerson: step.responsiblePerson.trim(),
        dueDate: step.dueDate ? step.dueDate : null,
        resourcesRequired: step.resourcesRequired.trim() || undefined,
        successCriteria: step.successCriteria.trim() || undefined
      }))

    if (normalizedSteps.length === 0) {
      missing.push("Add at least one implementation step.")
    }

    if (missing.length > 0) {
      setFormError(missing.join(" "))
      setActiveTab("create")
      return
    }

    const payload = {
      actionTitle: trimmedTitle,
      actionType: trimmedActionType,
      sourceReference: trimmedSource,
      referenceId: formValues.reference.trim() || null,
      departments: departmentList,
      priority: formValues.priority,
      impact: formValues.impact,
      urgency: formValues.urgency,
      problemStatement: trimmedProblem,
      rootCause: trimmedRootCause,
      contributingFactors: formValues.factors.trim() || null,
      impactAssessment: trimmedImpactAssessment,
      currentControls: formValues.currentControls.trim() || null,
      evidence: evidenceFiles.map((file) => file.name),
      actionPlanDescription: formValues.actionPlan,
      implementationSteps: normalizedSteps,
      overallDueDate: formValues.dueDate,
      actionOwner: formValues.owner,
      reviewTeam: selectedReviewTeam,
      budgetRequired: formValues.budget ? Number(formValues.budget) : null,
      approvalRequired: formValues.approvalRequired === "Yes",
      approver: formValues.approver.trim() || null,
      aiAssisted: Boolean(aiPlan),
      predictedSuccessProbability: aiPlan?.successProbability ?? null
    }

    setSubmitting(true)
    try {
      const response = await fetch(buildApiUrl("/api/corrective-actions/actions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        throw new Error("Unable to create corrective action. Please try again.")
      }
      const result = await response.json()
      setSubmissionSuccess(`Corrective action ${result.actionId} created successfully.`)
      resetForm()
      setActiveTab("tracking")
      await refreshDashboard()
      setSelectedActionId(result.actionId)
    } catch (error) {
      console.error(error)
      setFormError(error instanceof Error ? error.message : "Failed to create corrective action")
    } finally {
      setSubmitting(false)
    }
  }

  const refreshDashboard = async () => {
    setDashboardLoading(true)
    setDashboardError(null)
    try {
      const response = await fetch(buildApiUrl("/api/corrective-actions/dashboard"))
      if (!response.ok) {
        throw new Error("Failed to refresh dashboard data")
      }
      const data = (await response.json()) as CorrectiveActionDashboardResponse
      setDashboardData(data)
    } catch (error) {
      console.error(error)
      setDashboardError(error instanceof Error ? error.message : "Unable to refresh dashboard data")
    } finally {
      setDashboardLoading(false)
    }
  }

  const handleActionStatusChange = (status: ActionStatus) => {
    if (!actionDetail) return
    setActionDetail((previous) =>
      previous
        ? {
            ...previous,
            status,
            lastUpdated: new Date().toISOString()
          }
        : previous
    )
  }

  const handleStepStatusChange = (stepId: string, status: StepStatus) => {
    if (!actionDetail) return
    setActionDetail((previous) => {
      if (!previous) return previous
      const updatedSteps = previous.implementationSteps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              status,
              completionDate:
                status === "Completed" && !step.completionDate
                  ? new Date().toISOString()
                  : step.completionDate
            }
          : step
      )
      return {
        ...previous,
        implementationSteps: updatedSteps,
        progress: computeStepProgress(updatedSteps)
      }
    })
  }

  const handleSaveUpdate = () => {
    if (!actionDetail) return
    if (!newUpdateDescription.trim()) return
    const newEntry = {
      id: `${actionDetail.id}-log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      updateType: newUpdateType,
      user: "You",
      description: newUpdateDescription.trim(),
      attachments: [] as { name: string }[]
    }
    setActionDetail((previous) =>
      previous
        ? {
            ...previous,
            communicationLog: [newEntry, ...previous.communicationLog],
            lastUpdated: newEntry.timestamp
          }
        : previous
    )
    setNewUpdateDescription("")
    setUpdateDialogOpen(false)
  }

  const summaryCards = useMemo(() => {
    if (!dashboardData) return []
    return [
      {
        label: "Total Actions",
        metric: dashboardData.summary.totalActions,
        icon: ClipboardList,
        tone: "text-primary",
        background: "bg-primary/10",
        formatter: (value: number) => value.toString(),
        preference: "up" as const
      },
      {
        label: "Open Actions",
        metric: dashboardData.summary.openActions,
        icon: AlertTriangle,
        tone: "text-orange-600",
        background: "bg-orange-50",
        formatter: (value: number) => value.toString(),
        preference: "down" as const
      },
      {
        label: "Overdue Actions",
        metric: dashboardData.summary.overdueActions,
        icon: AlertTriangle,
        tone: "text-red-600",
        background: "bg-red-50",
        formatter: (value: number) => value.toString(),
        preference: "down" as const
      },
      {
        label: "Completed This Month",
        metric: dashboardData.summary.completedThisMonth,
        icon: CheckCircle,
        tone: "text-emerald-600",
        background: "bg-emerald-50",
        formatter: (value: number) => value.toString(),
        preference: "up" as const
      },
      {
        label: "Effectiveness Rating",
        metric: dashboardData.summary.effectivenessRating,
        icon: TrendingUp,
        tone: "text-sky-600",
        background: "bg-sky-50",
        formatter: (value: number) => `${value.toFixed(1)}%`,
        preference: "up" as const
      }
    ]
  }, [dashboardData])

  const aiInsights: CorrectiveActionAIInsights | null = dashboardData?.aiInsights ?? null
  const effectivenessInsights = (aiInsights?.effectivenessScores ?? []).slice(0, 3)
  const priorityInsights = (aiInsights?.priorityRanking ?? []).slice(0, 3)
  const resourceInsights = (aiInsights?.resourceRecommendations ?? []).slice(0, 2)
  const escalationInsights = (aiInsights?.escalationPaths ?? []).slice(0, 2)

  const renderActionTable = (
    title: string,
    description: string,
    items: CorrectiveActionListEntry[]
  ) => (
    <Card key={title} className="border-emerald-100 shadow-sm">
      <CardHeader>
        <CardTitle className="text-primary">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actions to display.</p>
        ) : (
          <Table>
            <TableHeader className="bg-emerald-50/70 text-primary">
              <TableRow className="uppercase text-xs tracking-wide">
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((action) => (
                <TableRow key={action.id}>
                  <TableCell className="font-medium text-gray-900">{action.id}</TableCell>
                  <TableCell className="text-sm text-gray-700">{action.title}</TableCell>
                  <TableCell>
                    <Badge className={PRIORITY_BADGE_CLASS[action.priority]}>{action.priority}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">{formatDateValue(action.dueDate)}</TableCell>
                  <TableCell className="w-32">
                    <Progress value={action.progress} className="h-2" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Corrective Actions</h1>
          <p className="text-sm text-gray-600">
            Monitor remediation performance, orchestrate action plans, and leverage AI to predict effectiveness.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as typeof activeTab)}
          className="space-y-6"
        >
          <TabsList className="bg-emerald-50/70">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="create">Create Action</TabsTrigger>
            <TabsTrigger value="tracking">Tracking &amp; Monitoring</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {dashboardLoading ? (
              <Card className="border-emerald-100 shadow-sm">
                <CardContent className="flex items-center gap-3 p-6 text-sm text-gray-600">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Loading corrective action intelligence...
                </CardContent>
              </Card>
            ) : dashboardError ? (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertTitle>Unable to load dashboard</AlertTitle>
                <AlertDescription>{dashboardError}</AlertDescription>
                <Button className="mt-4" onClick={refreshDashboard} variant="outline">
                  Retry
                </Button>
              </Alert>
            ) : dashboardData ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {summaryCards.map((card) => (
                    <Card key={card.label} className="border-emerald-100 shadow-sm">
                      <CardContent className="space-y-3 p-4">
                        <div className={`flex items-center gap-2 text-sm font-medium ${card.tone}`}>
                          <card.icon className="h-4 w-4" />
                          {card.label}
                        </div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {card.formatter(card.metric.value)}
                        </div>
                        {renderTrend(card.metric, card.preference)}
                        <p className="text-xs text-gray-500">
                          AI monitors trajectory and surfaces proactive risk signals for this metric.
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <Card className="border-emerald-100 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-primary">
                        <PieChartIcon className="h-4 w-4" /> Action Status Distribution
                      </CardTitle>
                      <CardDescription>Real-time insight into the stage of every action.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dashboardData.analytics.statusDistribution}
                            dataKey="count"
                            nameKey="status"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                          >
                            {dashboardData.analytics.statusDistribution.map((entry) => (
                              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#0f766e"} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={32} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="border-emerald-100 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-primary">
                        <Activity className="h-4 w-4" /> Actions by Department
                      </CardTitle>
                      <CardDescription>Compare progress and backlog across departments.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboardData.analytics.actionsByDepartment}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-emerald-100" />
                          <XAxis dataKey="department" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="open" stackId="a" fill="#f97316" name="Open" />
                          <Bar dataKey="inProgress" stackId="a" fill="#0ea5e9" name="In Progress" />
                          <Bar dataKey="completed" stackId="a" fill="#22c55e" name="Completed" />
                          <Bar dataKey="overdue" fill="#ef4444" name="Overdue" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="border-emerald-100 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-primary">
                        <Target className="h-4 w-4" /> Action Type Distribution
                      </CardTitle>
                      <CardDescription>Understand where corrective, preventive, and improvement work is focused.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboardData.analytics.actionTypeDistribution} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-emerald-100" />
                          <XAxis type="number" allowDecimals={false} />
                          <YAxis type="category" dataKey="type" width={170} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-emerald-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <LineChartIcon className="h-4 w-4" /> Completion Trend
                    </CardTitle>
                    <CardDescription>Track completion velocity and AI forecasts to anticipate throughput.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dashboardData.analytics.completionTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-emerald-100" />
                        <XAxis dataKey="period" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} name="Completed" />
                        <Line type="monotone" dataKey="overdue" stroke="#ef4444" strokeWidth={2} name="Overdue" />
                        <Line type="monotone" dataKey="forecast" stroke="#6366f1" strokeDasharray="5 5" strokeWidth={2} name="AI Forecast" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card className="border-emerald-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <Brain className="h-4 w-4" /> AI Recommendations
                    </CardTitle>
                    <CardDescription>
                      Predictive insights on effectiveness, resourcing, and smart escalation paths.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-900">Top effectiveness scores</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        {effectivenessInsights.length > 0 ? (
                          effectivenessInsights.map((item) => (
                            <li key={item.actionId} className="flex items-center justify-between gap-4 rounded-md bg-emerald-50/60 px-3 py-2">
                              <span className="font-medium text-gray-900">{item.title}</span>
                              <span className="text-primary">{item.score.toFixed(1)}%</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-xs text-muted-foreground">No AI insights available.</li>
                        )}
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-900">Immediate focus actions</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        {priorityInsights.length > 0 ? (
                          priorityInsights.map((item) => (
                            <li key={item.actionId} className="rounded-md border border-emerald-100 px-3 py-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900">{item.title}</span>
                                <Badge className={PRIORITY_BADGE_CLASS[item.suggestedPriority]}>AI {item.suggestedPriority}</Badge>
                              </div>
                              <p className="text-xs text-gray-500">Priority score {item.priorityScore.toFixed(1)} · Overdue days {item.overdueDays}</p>
                            </li>
                          ))
                        ) : (
                          <li className="text-xs text-muted-foreground">No priority recommendations available.</li>
                        )}
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-900">Resource recommendations</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        {resourceInsights.length > 0 ? (
                          resourceInsights.map((item) => (
                            <li key={item.actionId} className="rounded-md bg-white px-3 py-2 shadow-sm">
                              <p className="font-medium text-gray-900">{item.title}</p>
                              <ul className="mt-1 list-disc pl-4 text-xs text-gray-600">
                                {item.recommendations.map((rec) => (
                                  <li key={rec}>{rec}</li>
                                ))}
                              </ul>
                            </li>
                          ))
                        ) : (
                          <li className="text-xs text-muted-foreground">AI has no resource adjustments at this time.</li>
                        )}
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-900">Smart escalation paths</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        {escalationInsights.length > 0 ? (
                          escalationInsights.map((item) => (
                            <li key={item.actionId} className="rounded-md border border-emerald-100 px-3 py-2">
                              <p className="font-medium text-gray-900">{item.title}</p>
                              <p className="text-xs text-gray-500">Trigger: {item.trigger}</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.escalationPath.map((role) => (
                                  <Badge key={role} variant="secondary" className="bg-emerald-50 text-emerald-700">
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                            </li>
                          ))
                        ) : (
                          <li className="text-xs text-muted-foreground">All actions operating within standard escalation.</li>
                        )}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                  {renderActionTable(
                    "High Priority Actions",
                    "Critical actions prioritized by AI risk scoring",
                    dashboardData.priorityLists?.highPriority ?? []
                  )}
                  {renderActionTable(
                    "Overdue Actions",
                    "Past-due actions requiring immediate follow-up",
                    dashboardData.priorityLists?.overdue ?? []
                  )}
                  {renderActionTable(
                    "Due This Week",
                    "Upcoming deadlines to keep on track",
                    dashboardData.priorityLists?.dueThisWeek ?? []
                  )}
                  {renderActionTable(
                    "Recently Completed",
                    "Latest actions closed with outcomes",
                    dashboardData.priorityLists?.recentlyCompleted ?? []
                  )}
                </div>

                <Card className="border-emerald-100 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-primary">All Actions</CardTitle>
                    <CardDescription>Comprehensive view of every corrective action and its status.</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-emerald-50/70 text-primary">
                        <TableRow className="uppercase text-xs tracking-wide">
                          <TableHead>ID</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Departments</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead>Effectiveness</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboardData.actions.map((action) => (
                          <TableRow key={action.id}>
                            <TableCell className="font-medium text-gray-900">{action.id}</TableCell>
                            <TableCell className="text-sm text-gray-700">{action.title}</TableCell>
                            <TableCell className="text-xs text-gray-500">{action.type}</TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {action.departments.join(", ") || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge className={PRIORITY_BADGE_CLASS[action.priority]}>{action.priority}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={STATUS_BADGE_CLASS[action.status] || "bg-slate-200 text-slate-600"}>
                                {action.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">{action.owner}</TableCell>
                            <TableCell className="text-xs text-gray-500">{formatDateValue(action.dueDate)}</TableCell>
                            <TableCell className="w-32">
                              <Progress value={action.progress} className="h-2" />
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {action.effectivenessScore ? `${action.effectivenessScore.toFixed(1)}%` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>
          <TabsContent value="create">
            <Card className="border-emerald-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-primary">Create Corrective Action</CardTitle>
                <CardDescription>
                  Capture action details, implementation steps, and leverage AI for intelligent planning.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {formError && (
                  <Alert variant="destructive">
                    <AlertTitle>Missing required information</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                {submissionSuccess && (
                  <Alert className="border-emerald-200 bg-emerald-50">
                    <AlertTitle>Action created</AlertTitle>
                    <AlertDescription>{submissionSuccess}</AlertDescription>
                  </Alert>
                )}

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Action Details</h3>
                    <p className="text-sm text-gray-500">Define the corrective or preventive action parameters.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="title">Action Title</Label>
                      <Input
                        id="title"
                        placeholder="Describe the corrective action"
                        value={formValues.title}
                        onChange={(event) => setFormValues((previous) => ({ ...previous, title: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Action Type</Label>
                      <Select
                        value={formValues.actionType || undefined}
                        onValueChange={(value) => setFormValues((previous) => ({ ...previous, actionType: value }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select action type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Source Reference</Label>
                      <Select
                        value={formValues.source || undefined}
                        onValueChange={(value) => setFormValues((previous) => ({ ...previous, source: value }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCE_OPTIONS.map((source) => (
                            <SelectItem key={source} value={source}>
                              {source}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reference">Reference ID</Label>
                      <Input
                        id="reference"
                        placeholder="Link to source document (e.g., AUD-2025-014)"
                        value={formValues.reference}
                        onChange={(event) => setFormValues((previous) => ({ ...previous, reference: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Departments</Label>
                      <MultiSelect
                        options={DEPARTMENT_MULTISELECT_OPTIONS}
                        selected={selectedDepartments}
                        onChange={handleDepartmentChange}
                        placeholder="Select departments"
                      />
                      {selectedDepartments.includes(OTHER_DEPARTMENT_VALUE) && (
                        <Input
                          className="mt-2"
                          placeholder="Specify department"
                          value={otherDepartment}
                          onChange={(event) => setOtherDepartment(event.target.value)}
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={formValues.priority}
                        onValueChange={(value) =>
                          setFormValues((previous) => ({ ...previous, priority: value as ActionPriority }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {priority}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Impact</Label>
                      <Select
                        value={formValues.impact}
                        onValueChange={(value) =>
                          setFormValues((previous) => ({ ...previous, impact: value as ActionPriority }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {IMPACT_OPTIONS.map((impact) => (
                            <SelectItem key={impact} value={impact}>
                              {impact}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Urgency</Label>
                      <Select
                        value={formValues.urgency}
                        onValueChange={(value) =>
                          setFormValues((previous) => ({ ...previous, urgency: value as ActionPriority }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {URGENCY_OPTIONS.map((urgency) => (
                            <SelectItem key={urgency} value={urgency}>
                              {urgency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="problem">Problem Statement</Label>
                      <Textarea
                        id="problem"
                        rows={3}
                        placeholder="Describe the issue being addressed"
                        value={formValues.problem}
                        onChange={(event) => setFormValues((previous) => ({ ...previous, problem: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="rootCause">Root Cause</Label>
                      <Textarea
                        id="rootCause"
                        rows={3}
                        placeholder="Document confirmed or suspected root cause"
                        value={formValues.rootCause}
                        onChange={(event) => setFormValues((previous) => ({ ...previous, rootCause: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="factors">Contributing Factors</Label>
                      <Textarea
                        id="factors"
                        rows={3}
                        placeholder="Process, environmental, or human factors"
                        value={formValues.factors}
                        onChange={(event) => setFormValues((previous) => ({ ...previous, factors: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="impactAssessment">Impact Assessment</Label>
                      <Textarea
                        id="impactAssessment"
                        rows={3}
                        placeholder="Detail the business, compliance, and operational impacts"
                        value={formValues.impactAssessment}
                        onChange={(event) =>
                          setFormValues((previous) => ({ ...previous, impactAssessment: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="currentControls">Current Controls</Label>
                      <Textarea
                        id="currentControls"
                        rows={3}
                        placeholder="Existing controls mitigating the issue"
                        value={formValues.currentControls}
                        onChange={(event) =>
                          setFormValues((previous) => ({ ...previous, currentControls: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Action Plan</h3>
                      <p className="text-sm text-gray-500">Outline implementation steps and ownership.</p>
                    </div>
                    <Button onClick={handleGenerateAiPlan} disabled={aiGenerating} variant="outline">
                      {aiGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                      Generate AI Plan
                    </Button>
                  </div>

                  {aiPlan && (
                    <Card className="border-emerald-200 bg-emerald-50/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-emerald-900">AI-generated plan overview</CardTitle>
                        <CardDescription>Predicted success probability {aiPlan.successProbability.toFixed(1)}%</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm text-gray-700">
                        <div>
                          <h4 className="font-medium text-gray-900">Timeline</h4>
                          <p>
                            Estimated duration {aiPlan.timeline.overallDurationDays} days · Target completion {formatDateValue(aiPlan.timeline.targetCompletionDate)}
                          </p>
                          <ul className="mt-1 list-disc pl-5">
                            {aiPlan.timeline.milestones.map((milestone) => (
                              <li key={milestone.name}>{milestone.name} – {formatDateValue(milestone.targetDate)}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Resource highlights</h4>
                          <p>Roles: {aiPlan.resourcePlan.roles.join(", ")}</p>
                          <p>Tools: {aiPlan.resourcePlan.tools.join(", ")}</p>
                          <p>Budget estimate: ${aiPlan.resourcePlan.budgetEstimate.toLocaleString()}</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Risk considerations</h4>
                          <ul className="list-disc pl-5">
                            {aiPlan.riskConsiderations.map((risk) => (
                              <li key={risk}>{risk}</li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Corrective Action Description</Label>
                      <RichTextEditor
                        id="actionPlan"
                        value={formValues.actionPlan}
                        onChange={(value) => setFormValues((previous) => ({ ...previous, actionPlan: value }))}
                        placeholder="Detail the tasks required to address the issue"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Overall Due Date</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={formValues.dueDate}
                        onChange={(event) => setFormValues((previous) => ({ ...previous, dueDate: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Action Owner</Label>
                      <Select
                        value={formValues.owner || undefined}
                        onValueChange={(value) => setFormValues((previous) => ({ ...previous, owner: value }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select owner" />
                        </SelectTrigger>
                        <SelectContent>
                          {TEAM_DIRECTORY.map((user) => (
                            <SelectItem key={user} value={user}>
                              {user}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Review Team</Label>
                      <MultiSelect
                        options={REVIEW_TEAM_OPTIONS}
                        selected={selectedReviewTeam}
                        onChange={handleReviewTeamChange}
                        placeholder="Select reviewers"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budget">Budget Required</Label>
                      <Input
                        id="budget"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Optional budget estimate"
                        value={formValues.budget}
                        onChange={(event) => setFormValues((previous) => ({ ...previous, budget: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Approval Required</Label>
                      <div className="flex items-center gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="approvalRequired"
                            value="Yes"
                            checked={formValues.approvalRequired === "Yes"}
                            onChange={(event) =>
                              setFormValues((previous) => ({ ...previous, approvalRequired: event.target.value }))
                            }
                          />
                          Yes
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="approvalRequired"
                            value="No"
                            checked={formValues.approvalRequired === "No"}
                            onChange={(event) =>
                              setFormValues((previous) => ({ ...previous, approvalRequired: event.target.value, approver: "" }))
                            }
                          />
                          No
                        </label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Approver</Label>
                      <Select
                        value={formValues.approver || undefined}
                        onValueChange={(value) => setFormValues((previous) => ({ ...previous, approver: value }))}
                        disabled={formValues.approvalRequired !== "Yes"}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select approver" />
                        </SelectTrigger>
                        <SelectContent>
                          {TEAM_DIRECTORY.map((user) => (
                            <SelectItem key={user} value={user}>
                              {user}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Evidence</Label>
                      <Input type="file" multiple onChange={handleEvidenceChange} />
                      {evidenceFiles.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-xs text-gray-500">
                          {evidenceFiles.map((file) => (
                            <li key={file.name}>{file.name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">Implementation Steps</h4>
                      <Button variant="outline" size="sm" onClick={addImplementationStep}>
                        Add Step
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {implementationSteps.map((step, index) => (
                        <Card key={index} className="border-emerald-100 shadow-sm">
                          <CardContent className="space-y-4 p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-900">Step {index + 1}</span>
                              {implementationSteps.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeImplementationStep(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2 md:col-span-2">
                                <Label>Description</Label>
                                <Textarea
                                  rows={2}
                                  value={step.description}
                                  onChange={(event) =>
                                    handleImplementationStepChange(index, "description", event.target.value)
                                  }
                                  placeholder="Detail the step"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Responsible Person</Label>
                                <Select
                                  value={step.responsiblePerson || undefined}
                                  onValueChange={(value) =>
                                    handleImplementationStepChange(index, "responsiblePerson", value)
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TEAM_DIRECTORY.map((user) => (
                                      <SelectItem key={user} value={user}>
                                        {user}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Due Date</Label>
                                <Input
                                  type="date"
                                  value={step.dueDate}
                                  onChange={(event) =>
                                    handleImplementationStepChange(index, "dueDate", event.target.value)
                                  }
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label>Resources Required</Label>
                                <Textarea
                                  rows={2}
                                  value={step.resourcesRequired}
                                  onChange={(event) =>
                                    handleImplementationStepChange(index, "resourcesRequired", event.target.value)
                                  }
                                  placeholder="People, tools, or budget needs"
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label>Success Criteria</Label>
                                <Textarea
                                  rows={2}
                                  value={step.successCriteria}
                                  onChange={(event) =>
                                    handleImplementationStepChange(index, "successCriteria", event.target.value)
                                  }
                                  placeholder="How success for this step will be measured"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </section>

                <Separator />

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button variant="outline" className="border-emerald-200" onClick={resetForm} disabled={submitting}>
                    Clear Form
                  </Button>
                  <Button className="bg-primary text-white" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Action
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tracking">
            <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
              <Card className="border-emerald-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-primary">Actions</CardTitle>
                  <CardDescription>Select an action to review progress and AI insights.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dashboardData?.actions.map((action) => (
                    <button
                      key={action.id}
                      className={`w-full rounded-md border px-3 py-2 text-left transition hover:bg-emerald-50/70 ${
                        selectedActionId === action.id
                          ? "border-primary bg-emerald-50"
                          : "border-transparent bg-white"
                      }`}
                      onClick={() => setSelectedActionId(action.id)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                        <Badge className={PRIORITY_BADGE_CLASS[action.priority]}>{action.priority}</Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                        <span>{action.status}</span>
                        <span>{formatDateValue(action.dueDate)}</span>
                      </div>
                    </button>
                  )) || <p className="text-sm text-muted-foreground">No actions available.</p>}
                </CardContent>
              </Card>

              <Card className="border-emerald-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-primary">Action Tracking</CardTitle>
                  <CardDescription>Update implementation progress, review communication logs, and evaluate effectiveness.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {detailLoading ? (
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      Loading action detail...
                    </div>
                  ) : detailError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Unable to load action detail</AlertTitle>
                      <AlertDescription>{detailError}</AlertDescription>
                    </Alert>
                  ) : actionDetail ? (
                    <div className="space-y-6">
                      <div className="rounded-md border border-emerald-100 bg-emerald-50/50 p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <h2 className="text-lg font-semibold text-gray-900">{actionDetail.title}</h2>
                            <p className="text-xs text-gray-500">
                              Last updated {formatDateTime(actionDetail.lastUpdated)}
                            </p>
                          </div>
                          <div className="flex flex-col gap-3 md:items-end">
                            <Select
                              value={actionDetail.status}
                              onValueChange={(value) => handleActionStatusChange(value as ActionStatus)}
                            >
                              <SelectTrigger className="w-44">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACTION_STATUS_OPTIONS.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-gray-700">Progress</span>
                              <Progress value={actionDetail.progress} className="h-2 w-40" />
                              <span className="text-xs text-gray-500">{actionDetail.progress}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="space-y-1 text-xs text-gray-600">
                            <p><span className="font-medium text-gray-900">Owner:</span> {actionDetail.owner}</p>
                            <p>
                              <span className="font-medium text-gray-900">Departments:</span> {actionDetail.departments.join(", ")}
                            </p>
                            <p>
                              <span className="font-medium text-gray-900">Review team:</span> {actionDetail.reviewTeam.join(", ") || "—"}
                            </p>
                          </div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <p>
                              <span className="font-medium text-gray-900">Due date:</span> {formatDateValue(actionDetail.dueDate)}
                              {typeof actionDetail.daysToDueDate === "number" && (
                                <Badge
                                  className={`ml-2 ${
                                    actionDetail.daysToDueDate < 0
                                      ? "bg-red-100 text-red-700"
                                      : actionDetail.daysToDueDate <= 3
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {actionDetail.daysToDueDate < 0
                                    ? `${Math.abs(actionDetail.daysToDueDate)} days overdue`
                                    : `${actionDetail.daysToDueDate} days remaining`}
                                </Badge>
                              )}
                            </p>
                            <p>
                              <span className="font-medium text-gray-900">Priority:</span> {actionDetail.priority}
                            </p>
                            <p>
                              <span className="font-medium text-gray-900">Impact:</span> {actionDetail.impact}
                            </p>
                          </div>
                        </div>
                      </div>

                      <section className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900">Implementation Steps</h3>
                          <span className="text-xs text-gray-500">
                            Progress recalculates automatically as step status changes.
                          </span>
                        </div>
                        <div className="space-y-3">
                          {actionDetail.implementationSteps.map((step) => (
                            <div key={step.id} className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    Step {step.stepNumber}: {step.description}
                                  </p>
                                  <p className="text-xs text-gray-500">Owner: {step.responsiblePerson || actionDetail.owner}</p>
                                </div>
                                <Select
                                  value={step.status}
                                  onValueChange={(value) => handleStepStatusChange(step.id, value as StepStatus)}
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STEP_STATUS_OPTIONS.map((status) => (
                                      <SelectItem key={status} value={status}>
                                        {status}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="mt-2 grid gap-2 text-xs text-gray-600 md:grid-cols-2">
                                <p>
                                  <span className="font-medium text-gray-900">Due:</span> {formatDateValue(step.dueDate)}
                                </p>
                                <p>
                                  <span className="font-medium text-gray-900">Resources:</span> {step.resourcesRequired || "—"}
                                </p>
                                <p className="md:col-span-2">
                                  <span className="font-medium text-gray-900">Success criteria:</span> {step.successCriteria || "—"}
                                </p>
                                {step.progressNotes && (
                                  <p className="md:col-span-2">
                                    <span className="font-medium text-gray-900">Notes:</span> {step.progressNotes}
                                  </p>
                                )}
                                {step.issues && (
                                  <p className="md:col-span-2 text-red-600">
                                    <span className="font-medium">Issues:</span> {step.issues}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900">Communication Log</h3>
                          <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                Add Update
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Log an update</DialogTitle>
                                <DialogDescription>Share progress, issues, or escalate concerns.</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-3 py-3">
                                <div className="space-y-2">
                                  <Label>Update Type</Label>
                                  <Select value={newUpdateType} onValueChange={setNewUpdateType}>
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {UPDATE_TYPES.map((type) => (
                                        <SelectItem key={type} value={type}>
                                          {type}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Description</Label>
                                  <Textarea
                                    rows={3}
                                    value={newUpdateDescription}
                                    onChange={(event) => setNewUpdateDescription(event.target.value)}
                                    placeholder="Summarize the update"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button onClick={handleSaveUpdate} disabled={!newUpdateDescription.trim()}>
                                  Save Update
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                        <div className="space-y-3">
                          {actionDetail.communicationLog.map((entry) => (
                            <div key={entry.id} className="rounded-md border border-emerald-100 bg-white p-3 text-sm">
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                                  {entry.updateType}
                                </Badge>
                                <span className="text-xs text-gray-500">{formatDateTime(entry.timestamp)}</span>
                              </div>
                              <p className="mt-2 text-gray-700">{entry.description}</p>
                              <p className="mt-1 text-xs text-gray-500">By {entry.user}</p>
                            </div>
                          )) || <p className="text-sm text-muted-foreground">No updates logged yet.</p>}
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900">Effectiveness Evaluation</h3>
                        <div className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm">
                          <div className="flex flex-col gap-2 text-sm text-gray-700 md:flex-row md:items-center md:justify-between">
                            <p>
                              Evaluation method: <span className="font-medium text-gray-900">{actionDetail.effectivenessEvaluation.evaluationMethod}</span>
                            </p>
                            <p>
                              Due: <span className="font-medium text-gray-900">{formatDateValue(actionDetail.effectivenessEvaluation.evaluationDueDate)}</span>
                            </p>
                            <Badge className="bg-emerald-50 text-emerald-700">
                              {actionDetail.effectivenessEvaluation.rating}
                            </Badge>
                          </div>
                          <Table className="mt-3">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Metric</TableHead>
                                <TableHead>Target</TableHead>
                                <TableHead>Actual</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Measured</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {actionDetail.effectivenessEvaluation.successMetrics.map((metric) => (
                                <TableRow key={metric.name}>
                                  <TableCell>{metric.name}</TableCell>
                                  <TableCell>{metric.targetValue}</TableCell>
                                  <TableCell>{metric.actualValue ?? "—"}</TableCell>
                                  <TableCell>{metric.measurementMethod}</TableCell>
                                  <TableCell>{formatDateValue(metric.measurementDate)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {actionDetail.effectivenessEvaluation.comments && (
                            <p className="mt-3 text-xs text-gray-500">
                              Comments: {actionDetail.effectivenessEvaluation.comments}
                            </p>
                          )}
                          {actionDetail.effectivenessEvaluation.furtherActionsRequired && (
                            <p className="mt-2 text-sm text-red-600">
                              Follow-up required: {actionDetail.effectivenessEvaluation.followUpActions || "Provide follow-up plan."}
                            </p>
                          )}
                        </div>
                      </section>

                      <section className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-900">AI Intelligence</h3>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-md border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-gray-700">
                            <p className="font-medium text-gray-900">Effectiveness Score</p>
                            <p>{actionDetail.aiIntelligence.effectivenessScore.toFixed(1)}%</p>
                          </div>
                          <div className="rounded-md border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-gray-700">
                            <p className="font-medium text-gray-900">Success Probability</p>
                            <p>{actionDetail.aiIntelligence.successProbability.toFixed(1)}%</p>
                          </div>
                          <div className="rounded-md border border-emerald-100 bg-white p-3 text-sm text-gray-700">
                            <p className="font-medium text-gray-900">Predicted Completion</p>
                            <p>{formatDateValue(actionDetail.aiIntelligence.predictedCompletionDate)}</p>
                          </div>
                          <div className="rounded-md border border-emerald-100 bg-white p-3 text-sm text-gray-700">
                            <p className="font-medium text-gray-900">Progress Confidence</p>
                            <p>{actionDetail.aiIntelligence.progressConfidence.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm text-gray-700">
                          <p>
                            <span className="font-medium text-gray-900">Risk alerts:</span> {actionDetail.aiIntelligence.riskAlerts.join(" · ")}
                          </p>
                          <p>
                            <span className="font-medium text-gray-900">Automated tracking:</span> {actionDetail.aiIntelligence.automatedTracking}
                          </p>
                          <p>
                            <span className="font-medium text-gray-900">Risk assessment:</span> {actionDetail.aiIntelligence.riskAssessment}
                          </p>
                          <p>
                            <span className="font-medium text-gray-900">Effectiveness review:</span> {actionDetail.aiIntelligence.effectivenessReview}
                          </p>
                          <p>
                            <span className="font-medium text-gray-900">Completion forecast:</span> {actionDetail.aiIntelligence.completionForecast}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {actionDetail.aiIntelligence.escalationPath.map((role) => (
                              <Badge key={role} variant="secondary" className="bg-emerald-50 text-emerald-700">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </section>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select an action to view tracking details.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
