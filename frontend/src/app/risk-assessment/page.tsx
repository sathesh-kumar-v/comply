"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  AlertDescription,
  AlertTitle
} from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { buildApiUrl } from "@/lib/api-url"
import { mapDimensions, projectPoint, getRiskColor, formatNumber } from "@/lib/risk-utils"
import type { RiskAssessmentListItem, RiskDashboardData } from "@/types/risk"
import { createMockDashboard, getOfflineAssessments } from "@/data/risk-assessment"
import { COUNTRY_OPTIONS, TEAM_MEMBERS } from "@/data/countries"
import { cn } from "@/lib/utils"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Download,
  FileText,
  Globe2,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Target,
  Upload,
  Users,
  X
} from "lucide-react"

const DEFAULT_CATEGORY_CONFIG = [
  { key: "political_stability", label: "Political Stability", weight: 20 },
  { key: "economic_outlook", label: "Economic Indicators", weight: 20 },
  { key: "regulatory_index", label: "Regulatory Environment", weight: 15 },
  { key: "corruption_index", label: "Corruption Index", weight: 10 },
  { key: "infrastructure", label: "Infrastructure Quality", weight: 10 },
  { key: "currency_stability", label: "Currency Stability", weight: 10 },
  { key: "trade_relations", label: "Trade Relations", weight: 10 },
  { key: "security", label: "Security Environment", weight: 5 }
]

const CONTINENT_SHAPES = [
  {
    id: "north-america",
    d: "M60 100 L320 70 L440 140 L380 210 L300 220 L230 260 L120 240 Z"
  },
  {
    id: "south-america",
    d: "M260 220 L340 260 L320 400 L260 490 L210 360 Z"
  },
  {
    id: "europe-asia",
    d: "M420 130 L620 90 L820 120 L950 200 L860 240 L760 230 L700 280 L560 250 L480 280 L420 230 Z"
  },
  {
    id: "africa",
    d: "M520 260 L600 270 L650 340 L630 430 L560 450 L500 350 Z"
  },
  {
    id: "middle-east",
    d: "M620 230 L720 230 L700 290 L630 290 Z"
  },
  {
    id: "australia",
    d: "M780 370 L870 370 L920 430 L860 470 L770 430 Z"
  }
]

const RISK_TYPE_OPTIONS = [
  "Overall",
  "Political",
  "Economic",
  "Compliance",
  "Operational"
]

const DATA_SOURCE_OPTIONS = [
  "Internal",
  "External",
  "Combined"
]

interface FormState {
  title: string
  assessmentType: string
  selectedCountryCodes: string[]
  framework: string
  scoringScale: string
  startDate: string
  endDate: string
  updateFrequency: string
  assessor: string
  reviewTeam: string[]
  notes: string
  impactLevels: Record<string, string>
  probabilityLevels: Record<string, string>
  dataSource: string
}

interface AttachmentPreview {
  name: string
  size: number
}

const DEFAULT_FORM: FormState = {
  title: "",
  assessmentType: "Comprehensive Risk Assessment",
  selectedCountryCodes: [],
  framework: "ISO 31000 Risk Management",
  scoringScale: "1-100",
  startDate: "",
  endDate: "",
  updateFrequency: "Quarterly",
  assessor: "",
  reviewTeam: [],
  notes: "",
  impactLevels: {
    Low: "Minimal disruption managed within existing controls",
    Medium: "Requires coordination across impacted functions",
    High: "Executive oversight required for mitigation",
    Critical: "Threatens strategic objectives and continuity"
  },
  probabilityLevels: {
    Rare: "Unlikely to occur (<10%)",
    Possible: "May occur occasionally (10-40%)",
    Likely: "Expected periodically (40-70%)",
    "Almost Certain": "Anticipated frequently (>70%)"
  },
  dataSource: "Combined"
}

function CountryMultiSelect({
  value,
  onChange
}: {
  value: string[]
  onChange: (codes: string[]) => void
}) {
  const [search, setSearch] = useState("")
  const selected = useMemo(() => new Set(value), [value])
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return COUNTRY_OPTIONS
    return COUNTRY_OPTIONS.filter((option) =>
      option.name.toLowerCase().includes(term) || option.code.toLowerCase().includes(term)
    )
  }, [search])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="justify-between">
          {value.length === 0 ? "Select countries" : `${value.length} selected`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 space-y-2 p-2">
        <DropdownMenuLabel>Search countries</DropdownMenuLabel>
        <Input
          placeholder="Type to filter"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <DropdownMenuSeparator />
        <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
          {filtered.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.code}
              checked={selected.has(option.code)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange([...selected, option.code])
                } else {
                  const updated = Array.from(selected).filter((code) => code !== option.code)
                  onChange(updated)
                }
              }}
            >
              <span className="flex flex-col">
                <span className="font-medium">{option.name}</span>
                <span className="text-xs text-muted-foreground">
                  {option.code} · {option.region}
                </span>
              </span>
            </DropdownMenuCheckboxItem>
          ))}
          {filtered.length === 0 && (
            <div className="py-3 text-center text-sm text-muted-foreground">No countries found</div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ReviewTeamSelect({ value, onChange }: { value: string[]; onChange: (members: string[]) => void }) {
  const selected = useMemo(() => new Set(value), [value])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="justify-between">
          {value.length === 0 ? "Select reviewers" : `${value.length} team members`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        <DropdownMenuLabel>Review team</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TEAM_MEMBERS.map((member) => (
          <DropdownMenuCheckboxItem
            key={member.id}
            checked={selected.has(member.name)}
            onCheckedChange={(checked) => {
              if (checked) {
                onChange([...selected, member.name])
              } else {
                onChange(Array.from(selected).filter((name) => name !== member.name))
              }
            }}
          >
            <span className="flex flex-col">
              <span className="font-medium">{member.name}</span>
              <span className="text-xs text-muted-foreground">{member.role}</span>
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RiskMap({
  countries,
  selected,
  onSelect
}: {
  countries: RiskDashboardData["map"]["countries"]
  selected: string | null
  onSelect: (code: string) => void
}) {
  const [zoom, setZoom] = useState(1.1)

  const handleZoom = (delta: number) => {
    setZoom((current) => {
      const next = current + delta
      if (next < 0.8) return 0.8
      if (next > 2.5) return 2.5
      return Number(next.toFixed(2))
    })
  }

  const handleReset = () => setZoom(1.1)

  return (
    <div className="relative">
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
        <Button size="icon" variant="secondary" onClick={() => handleZoom(0.2)} aria-label="Zoom in">
          +
        </Button>
        <Button size="icon" variant="secondary" onClick={() => handleZoom(-0.2)} aria-label="Zoom out">
          -
        </Button>
        <Button size="icon" variant="secondary" onClick={handleReset} aria-label="Reset view">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <svg viewBox={`0 0 ${mapDimensions.width} ${mapDimensions.height}`} className="w-full" role="img" aria-label="Global risk map">
          <rect width={mapDimensions.width} height={mapDimensions.height} fill="#e0f2fe" />
          <g transform={`scale(${zoom}) translate(${(mapDimensions.width * (1 - zoom)) / (2 * zoom)} ${(mapDimensions.height * (1 - zoom)) / (2 * zoom)})`}>
            {CONTINENT_SHAPES.map((shape) => (
              <path key={shape.id} d={shape.d} fill="#bfdbfe" stroke="#93c5fd" strokeWidth={2} opacity={0.75} />
            ))}
            {countries.map((country) => {
              const meta = COUNTRY_OPTIONS.find((option) => option.code === country.code)
              if (!meta) return null
              const { x, y } = projectPoint(meta.lat, meta.lon)
              const radius = selected === country.code ? 12 : 10
              return (
                <g key={country.code} className="cursor-pointer" onClick={() => onSelect(country.code)}>
                  <circle cx={x} cy={y} r={radius + 4} fill="#0ea5e9" opacity={selected === country.code ? 0.2 : 0.1} />
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={getRiskColor(country)}
                    stroke={selected === country.code ? "#1d4ed8" : "#0f172a"}
                    strokeWidth={selected === country.code ? 3 : 1.5}
                  />
                  <text x={x} y={y - radius - 6} className="fill-slate-800 text-xs" textAnchor="middle">
                    {country.code}
                  </text>
                  <title>
                    {country.name} · Score {country.score} ({country.riskLevel})
                  </title>
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}

export default function CountryRiskPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "create">("dashboard")
  const [dashboardData, setDashboardData] = useState<RiskDashboardData | null>(null)
  const [assessments, setAssessments] = useState<RiskAssessmentListItem[]>([])
  const [riskType, setRiskType] = useState<string>(RISK_TYPE_OPTIONS[0])
  const [dataSource, setDataSource] = useState<string>(DATA_SOURCE_OPTIONS[2])
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(false)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [formState, setFormState] = useState<FormState>({ ...DEFAULT_FORM })
  const [categoryConfig, setCategoryConfig] = useState(DEFAULT_CATEGORY_CONFIG)
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([])
  const [launchFeedback, setLaunchFeedback] = useState<{
    type: "success" | "error"
    title: string
    details: string[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const offlineAssessmentsRef = useRef<RiskAssessmentListItem[] | null>(null)
  const hasShownOfflineNoticeRef = useRef(false)

  const ensureOfflineAssessments = (): RiskAssessmentListItem[] => {
    if (!offlineAssessmentsRef.current) {
      offlineAssessmentsRef.current = getOfflineAssessments()
    }
    return offlineAssessmentsRef.current!
  }

  const activateOfflineMode = (message?: { title: string; details: string[] }) => {
    setIsOfflineMode(true)
    if (!hasShownOfflineNoticeRef.current) {
      hasShownOfflineNoticeRef.current = true
      setLaunchFeedback((current) =>
        current && current.type === "success"
          ? current
          : {
              type: "error",
              title: message?.title ?? "Live risk data unavailable",
              details:
                message?.details ?? [
                  "We couldn't reach the risk assessment API.",
                  "Showing intelligent sample data so you can continue working while offline."
                ]
            }
      )
    }
  }

  const loadOfflineDashboard = (params?: { riskType?: string; dataSource?: string }) => {
    const mock = createMockDashboard({
      riskType: params?.riskType ?? riskType,
      dataSource: params?.dataSource ?? dataSource
    })
    setDashboardData(mock)
    setSelectedCountry((current) => {
      if (current && mock.map.countries.some((country) => country.code === current)) {
        return current
      }
      return mock.map.countries[0]?.code ?? null
    })
  }

  const loadOfflineAssessments = () => {
    const data = ensureOfflineAssessments()
    setAssessments([...data])
  }

  const fetchDashboard = async (params?: { riskType?: string; dataSource?: string }) => {
    if (typeof window === "undefined") return
    if (isOfflineMode) {
      loadOfflineDashboard(params)
      return
    }
    setIsLoadingDashboard(true)
    try {
      const baseUrl = buildApiUrl("/api/risk-assessment/dashboard")
      const url = new URL(baseUrl, window.location.origin)
      url.searchParams.set("riskType", params?.riskType ?? riskType)
      url.searchParams.set("dataSource", params?.dataSource ?? dataSource)
      const response = await fetch(url.toString())
      if (!response.ok) throw new Error("Unable to load dashboard data")
      const data: RiskDashboardData = await response.json()
      setDashboardData(data)
      if (!selectedCountry && data.map.countries.length) {
        setSelectedCountry(data.map.countries[0].code)
      }
    } catch (error) {
      console.error(error)
      if (error instanceof TypeError) {
        activateOfflineMode()
        loadOfflineDashboard(params)
      } else {
        setLaunchFeedback({
          type: "error",
          title: "Unable to refresh dashboard",
          details: ["Check network connectivity or backend availability and try again."],
        })
      }
    } finally {
      setIsLoadingDashboard(false)
    }
  }

  const fetchAssessments = async () => {
    if (isOfflineMode) {
      loadOfflineAssessments()
      return
    }
    setIsLoadingAssessments(true)
    try {
      const response = await fetch(buildApiUrl("/api/risk-assessment/assessments"))
      if (!response.ok) throw new Error("Unable to load assessments")
      const data: RiskAssessmentListItem[] = await response.json()
      setAssessments(data)
    } catch (error) {
      console.error(error)
      if (error instanceof TypeError) {
        activateOfflineMode()
        loadOfflineAssessments()
      }
    } finally {
      setIsLoadingAssessments(false)
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    fetchDashboard()
    fetchAssessments()
  }, [])

  const selectedCountryDetail = useMemo(() => {
    if (!dashboardData || !selectedCountry) return null
    return dashboardData.countryDetails.find((country) => country.countryCode === selectedCountry) ?? null
  }, [dashboardData, selectedCountry])

  const highRiskWatchlist = useMemo(() => {
    if (!dashboardData) return []
    return dashboardData.aiInsights.watchlist.slice(0, 4)
  }, [dashboardData])

  const handleCountryWeights = (key: string, weight: number) => {
    setCategoryConfig((current) => current.map((category) => (category.key === key ? { ...category, weight } : category)))
  }

  const handleFileSelection = (files: FileList | null) => {
    if (!files) return
    const unique: AttachmentPreview[] = []
    const existing = new Set(attachments.map((file) => `${file.name}-${file.size}`))
    Array.from(files).forEach((file) => {
      const key = `${file.name}-${file.size}`
      if (!existing.has(key)) {
        existing.add(key)
        unique.push({ name: file.name, size: file.size })
      }
    })
    setAttachments((prev) => [...prev, ...unique])
  }

  const handleCreateAssessment = async () => {
    const trimmedTitle = formState.title.trim()
    if (!trimmedTitle || !formState.startDate || !formState.endDate || formState.selectedCountryCodes.length === 0 || !formState.assessor) {
      setLaunchFeedback({
        type: "error",
        title: "Missing required information",
        details: [
          "Provide an assessment title, date range, assigned assessor, and at least one country before launching.",
        ],
      })
      setActiveTab("create")
      return
    }

    try {
      if (isOfflineMode) {
        const newAssessment: RiskAssessmentListItem = {
          id: Date.now(),
          title: trimmedTitle,
          assessmentType: formState.assessmentType,
          status: "Scheduled",
          startDate: formState.startDate,
          endDate: formState.endDate,
          nextAssessmentDue: formState.endDate,
          totalCountries: formState.selectedCountryCodes.length,
          highRiskCountries: Math.max(1, Math.round(formState.selectedCountryCodes.length / 3)),
          assignedAssessor: formState.assessor,
        }
        const offlineData = ensureOfflineAssessments()
        const updatedAssessments = [newAssessment, ...offlineData]
        offlineAssessmentsRef.current = updatedAssessments
        setAssessments([...updatedAssessments])
        loadOfflineDashboard()
        setLaunchFeedback({
          type: "success",
          title: "Risk assessment scheduled (offline mode)",
          details: [
            `${trimmedTitle} has been staged locally with ${formState.selectedCountryCodes.length} country scope.`,
            `Assigned assessor: ${formState.assessor}.`,
            `Update cadence: ${formState.updateFrequency}.`,
            "The request will sync once the risk API is reachable.",
          ],
        })
        setFormState({ ...DEFAULT_FORM, assessmentType: formState.assessmentType, updateFrequency: formState.updateFrequency })
        setCategoryConfig(DEFAULT_CATEGORY_CONFIG)
        setAttachments([])
        setActiveTab("dashboard")
        return
      }

      const payload = {
        title: trimmedTitle,
        assessmentType: formState.assessmentType,
        countries: formState.selectedCountryCodes.map((code) => {
          const option = COUNTRY_OPTIONS.find((country) => country.code === code)
          return {
            code,
            name: option?.name ?? code,
          }
        }),
        framework: formState.framework || undefined,
        scoringScale: formState.scoringScale,
        assessmentPeriodStart: formState.startDate,
        assessmentPeriodEnd: formState.endDate,
        updateFrequency: formState.updateFrequency,
        assignedAssessor: formState.assessor,
        reviewTeam: formState.reviewTeam,
        categories: categoryConfig,
        impactLevels: formState.impactLevels,
        probabilityLevels: formState.probabilityLevels,
        dataSource: formState.dataSource,
      }

      const response = await fetch(buildApiUrl("/api/risk-assessment/assessments"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error("Failed to create assessment")

      await response.json()

      setLaunchFeedback({
        type: "success",
        title: "Risk assessment scheduled",
        details: [
          `${trimmedTitle} has been created with ${formState.selectedCountryCodes.length} country scope.`,
          `Assigned assessor: ${formState.assessor}.`,
          `Update cadence: ${formState.updateFrequency}.`,
          `AI scoring baseline applied using ${formState.scoringScale} scale.`,
        ],
      })

      setFormState({ ...DEFAULT_FORM, assessmentType: formState.assessmentType, updateFrequency: formState.updateFrequency })
      setCategoryConfig(DEFAULT_CATEGORY_CONFIG)
      setAttachments([])
      fetchAssessments()
      fetchDashboard()
      setActiveTab("dashboard")
    } catch (error) {
      console.error(error)
      if (error instanceof TypeError) {
        activateOfflineMode({
          title: "Risk API unreachable",
          details: [
            "We could not send the assessment to the server.",
            "Captured the request locally so you can continue planning while offline.",
          ],
        })
        const offlineData = ensureOfflineAssessments()
        const stagedAssessment: RiskAssessmentListItem = {
          id: Date.now(),
          title: trimmedTitle,
          assessmentType: formState.assessmentType,
          status: "Scheduled",
          startDate: formState.startDate,
          endDate: formState.endDate,
          nextAssessmentDue: formState.endDate,
          totalCountries: formState.selectedCountryCodes.length,
          highRiskCountries: Math.max(1, Math.round(formState.selectedCountryCodes.length / 3)),
          assignedAssessor: formState.assessor,
        }
        const stagedList = [stagedAssessment, ...offlineData]
        offlineAssessmentsRef.current = stagedList
        setAssessments([...stagedList])
        loadOfflineDashboard()
        setLaunchFeedback({
          type: "success",
          title: "Risk assessment staged for sync",
          details: [
            `${trimmedTitle} has been saved locally with ${formState.selectedCountryCodes.length} country scope.`,
            `Assigned assessor: ${formState.assessor}.`,
            `Update cadence: ${formState.updateFrequency}.`,
            "It will be submitted automatically when the connection is restored.",
          ],
        })
        setFormState({ ...DEFAULT_FORM, assessmentType: formState.assessmentType, updateFrequency: formState.updateFrequency })
        setCategoryConfig(DEFAULT_CATEGORY_CONFIG)
        setAttachments([])
        setActiveTab("dashboard")
      } else {
        setLaunchFeedback({
          type: "error",
          title: "Unable to create assessment",
          details: ["Check inputs and backend availability. If the problem persists contact system administrator."],
        })
      }
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Country Risk Assessment</h1>
          <p className="text-sm text-gray-600">AI-enhanced geopolitical and compliance intelligence with live scoring, predictive alerts, and workflow orchestration.</p>
        </div>

        {launchFeedback && (
          <Alert
            className={cn(
              "border",
              launchFeedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                {launchFeedback.type === "success" ? (
                  <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="mt-1 h-5 w-5 text-red-600" />
                )}
                <div>
                  <AlertTitle>{launchFeedback.title}</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {launchFeedback.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLaunchFeedback(null)}>
                Dismiss
              </Button>
            </div>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "dashboard" | "create")}
          className="space-y-6">
          <TabsList className="bg-blue-50/70">
            <TabsTrigger value="dashboard">Risk Dashboard</TabsTrigger>
            <TabsTrigger value="create">Create Assessment</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-blue-100 shadow-sm lg:col-span-2">
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-blue-700">
                      <Globe2 className="h-5 w-5" /> Global Risk Map
                    </CardTitle>
                    <CardDescription>Interactive heat map with AI-driven country scoring</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={riskType} onValueChange={(value) => {
                      setRiskType(value)
                      fetchDashboard({ riskType: value })
                    }}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Risk type" />
                      </SelectTrigger>
                      <SelectContent>
                        {RISK_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={dataSource} onValueChange={(value) => {
                      setDataSource(value)
                      fetchDashboard({ dataSource: value })
                    }}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Data source" />
                      </SelectTrigger>
                      <SelectContent>
                        {DATA_SOURCE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => fetchDashboard()}>
                      <RefreshCw className={cn("mr-2 h-4 w-4", isLoadingDashboard && "animate-spin")}
                      /> Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dashboardData ? (
                    <RiskMap countries={dashboardData.map.countries} selected={selectedCountry} onSelect={setSelectedCountry} />
                  ) : (
                    <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                      {isLoadingDashboard ? (
                        <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading risk telemetry…</span>
                      ) : (
                        "Global risk intelligence will load once data is available."
                      )}
                    </div>
                  )}
                  {dashboardData && (
                    <div className="grid gap-3 sm:grid-cols-4">
                      {dashboardData.map.legend.map((item) => (
                        <div key={item.label} className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50/40 p-2 text-xs text-blue-800">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span>{item.label}: {item.min} - {item.max}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-orange-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700">
                    <AlertTriangle className="h-5 w-5" /> High Risk Alerts
                  </CardTitle>
                  <CardDescription>AI-detected shifts requiring immediate attention</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-gray-700">
                  {highRiskWatchlist.length === 0 && (
                    <p className="text-sm text-muted-foreground">No escalations detected in the latest scoring cycle.</p>
                  )}
                  {highRiskWatchlist.map((item) => (
                    <div key={item.country} className="rounded-lg border border-dashed border-orange-200 bg-orange-50/60 p-4">
                      <p className="font-semibold text-orange-800">{item.country}</p>
                      <p className="text-sm">Risk level {item.riskLevel} · Confidence {item.confidence}</p>
                      <p className="text-xs text-orange-700 mt-2">
                        Signals: volatility {Math.round((item.signals.volatility ?? 0) * 100)}% · sentiment {(item.signals.news_sentiment ?? 0).toFixed(2)}
                      </p>
                    </div>
                  ))}
                  <Button variant="secondary" className="w-full border-orange-200 bg-white text-orange-700">
                    Generate Risk Bulletin
                  </Button>
                </CardContent>
              </Card>
            </div>

            {dashboardData && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-blue-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-blue-700 text-sm">
                      <Globe2 className="h-4 w-4" /> Total Countries Assessed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-slate-900">{formatNumber(dashboardData.summary.totalCountries)}</p>
                    <p className="text-xs text-muted-foreground">Active coverage across strategic regions</p>
                  </CardContent>
                </Card>
                <Card className="border-red-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertTriangle className="h-4 w-4" /> High Risk Countries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-red-600">{formatNumber(dashboardData.summary.highRiskCountries)}</p>
                    <p className="text-xs text-muted-foreground">Immediate mitigation required</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-amber-600 text-sm">
                      <Activity className="h-4 w-4" /> Recent Risk Changes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-amber-600">{formatNumber(dashboardData.summary.recentRiskChanges)}</p>
                    <p className="text-xs text-muted-foreground">Updated in the last 14 days</p>
                  </CardContent>
                </Card>
                <Card className="border-emerald-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-emerald-600 text-sm">
                      <Target className="h-4 w-4" /> Next Assessment Due
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-emerald-600">{dashboardData.summary.nextAssessmentDue ?? "Scheduled"}</p>
                    <p className="text-xs text-muted-foreground">Auto-tracked across all programs</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-blue-100 shadow-sm lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700">
                    <Layers className="h-5 w-5" /> Country Insight Panel
                  </CardTitle>
                  <CardDescription>Drill-down view with AI-generated commentary</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dashboardData && selectedCountryDetail ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{selectedCountryDetail.countryName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedCountryDetail.updateSource} · Last updated {selectedCountryDetail.lastUpdated ? new Date(selectedCountryDetail.lastUpdated).toLocaleString() : "N/A"}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "text-sm",
                            selectedCountryDetail.riskLevel === "Critical" && "bg-red-100 text-red-700",
                            selectedCountryDetail.riskLevel === "High" && "bg-orange-100 text-orange-700",
                            selectedCountryDetail.riskLevel === "Medium" && "bg-yellow-100 text-yellow-700",
                            selectedCountryDetail.riskLevel === "Low" && "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {selectedCountryDetail.riskLevel}
                        </Badge>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                          <p className="text-xs uppercase tracking-wide text-blue-700">Overall Score</p>
                          <p className="text-3xl font-bold text-blue-800">{selectedCountryDetail.overallScore}</p>
                          <p className="text-xs text-muted-foreground">Trend: {selectedCountryDetail.trend}</p>
                        </div>
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-600">AI Alerts</p>
                          <ul className="space-y-1 text-sm text-slate-700">
                            {selectedCountryDetail.aiAlerts.length === 0 && <li>No active alerts.</li>}
                            {selectedCountryDetail.aiAlerts.map((alert) => (
                              <li key={alert} className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-orange-500" />
                                <span>{alert}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {selectedCountryDetail.categories.map((category) => (
                          <div key={category.id} className="rounded-md border border-slate-200 bg-white p-3">
                            <p className="text-sm font-semibold text-slate-800">
                              {category.name.replace(/_/g, " ")}
                            </p>
                            <p className="text-lg font-bold text-slate-900">{category.score.toFixed(1)}</p>
                            <p className="text-xs text-muted-foreground">
                              AI benchmark {category.aiSuggestion?.toFixed(1) ?? "--"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a country on the map to view detailed scoring and intelligence feed.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-800">
                    <ShieldCheck className="h-5 w-5" /> Quick Actions
                  </CardTitle>
                  <CardDescription>Launch workflows and intelligence exports</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => setActiveTab("create")}>Create Assessment</Button>
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    <Upload className="mr-2 h-4 w-4" /> Import Risk Data
                  </Button>
                  <Button className="w-full bg-purple-600 hover:bg-purple-700">
                    <FileText className="mr-2 h-4 w-4" /> Generate Report
                  </Button>
                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    <Download className="mr-2 h-4 w-4" /> Export Data
                  </Button>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="font-medium text-slate-700">AI Enhancement</p>
                    <p>Real-time scoring ingests global news, macro indicators, and anomaly detection to alert on critical shifts.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-slate-800">
                    <BarChart3 className="h-5 w-5" /> Active Risk Assessments
                  </CardTitle>
                  <CardDescription>Monitor progress and jump into execution workspace</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchAssessments}>
                  <RefreshCw className={cn("mr-2 h-4 w-4", isLoadingAssessments && "animate-spin")}
                  /> Sync Assessments
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {assessments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assessments created yet. Use the Create Assessment tab to start a new program.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {assessments.map((assessment) => (
                      <div key={assessment.id} className="flex h-full flex-col justify-between rounded-lg border border-slate-200 bg-white p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-slate-900">{assessment.title}</h3>
                            <Badge variant="outline" className="border-slate-200 text-xs text-slate-600">
                              {assessment.status}
                            </Badge>
                          </div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">{assessment.assessmentType}</p>
                          <p className="text-sm text-slate-600">Countries: {assessment.totalCountries} · High risk: {assessment.highRiskCountries}</p>
                          <p className="text-xs text-muted-foreground">
                            Next assessment due {assessment.nextAssessmentDue ?? "Scheduled"}
                          </p>
                        </div>
                        <Link
                          href={`/risk-assessment/${assessment.id}`}
                          className="mt-3 inline-flex items-center justify-between rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        >
                          Open Execution Workspace
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create" className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Users className="h-5 w-5" /> Configure Country Risk Assessment
                </CardTitle>
                <CardDescription>Define scope, cadence, and AI weighting for the assessment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Scope Definition</h3>
                    <p className="text-sm text-gray-500">Identify impacted countries, frameworks, and ownership.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="title">Assessment Title</Label>
                      <Input
                        id="title"
                        placeholder="Q3 Global Compliance Exposure Review"
                        value={formState.title}
                        onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Assessment Type</Label>
                      <Select
                        value={formState.assessmentType}
                        onValueChange={(value) => setFormState((prev) => ({ ...prev, assessmentType: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Comprehensive Risk Assessment">Comprehensive Risk Assessment</SelectItem>
                          <SelectItem value="Political Risk Assessment">Political Risk Assessment</SelectItem>
                          <SelectItem value="Economic Risk Assessment">Economic Risk Assessment</SelectItem>
                          <SelectItem value="Compliance Risk Assessment">Compliance Risk Assessment</SelectItem>
                          <SelectItem value="Operational Risk Assessment">Operational Risk Assessment</SelectItem>
                          <SelectItem value="Custom Assessment">Custom Assessment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Country Selection</Label>
                      <CountryMultiSelect
                        value={formState.selectedCountryCodes}
                        onChange={(codes) => setFormState((prev) => ({ ...prev, selectedCountryCodes: codes }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Assessment Framework</Label>
                      <Select
                        value={formState.framework}
                        onValueChange={(value) => setFormState((prev) => ({ ...prev, framework: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ISO 31000 Risk Management">ISO 31000 Risk Management</SelectItem>
                          <SelectItem value="COSO Enterprise Risk Management">COSO Enterprise Risk Management</SelectItem>
                          <SelectItem value="NIST Risk Management Framework">NIST Risk Management Framework</SelectItem>
                          <SelectItem value="Custom Framework">Custom Framework</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Update Frequency</Label>
                      <Select
                        value={formState.updateFrequency}
                        onValueChange={(value) => setFormState((prev) => ({ ...prev, updateFrequency: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['Monthly', 'Quarterly', 'Annually', 'As Needed'].map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Assessment Period Start</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formState.startDate}
                        onChange={(event) => setFormState((prev) => ({ ...prev, startDate: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">Assessment Period End</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formState.endDate}
                        min={formState.startDate || undefined}
                        onChange={(event) => setFormState((prev) => ({ ...prev, endDate: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assessor">Assigned Assessor</Label>
                      <Input
                        id="assessor"
                        placeholder="Primary owner"
                        value={formState.assessor}
                        onChange={(event) => setFormState((prev) => ({ ...prev, assessor: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Review Team</Label>
                      <ReviewTeamSelect
                        value={formState.reviewTeam}
                        onChange={(members) => setFormState((prev) => ({ ...prev, reviewTeam: members }))}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Risk Criteria Matrix</h3>
                      <p className="text-sm text-gray-500">Adjust weights or apply AI recommendations per category.</p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!dashboardData) return
                        const suggested = dashboardData.aiInsights.regionalClusters
                        if (Object.keys(suggested).length === 0) return
                        const highVariance = [...categoryConfig].map((category) => {
                          const emphasis = category.key.includes("regulatory") || category.key.includes("political") ? 1.1 : 1
                          return { ...category, weight: Math.min(35, Math.max(5, Math.round(category.weight * emphasis))) }
                        })
                        setCategoryConfig(highVariance)
                      }}
                    >
                      <Activity className="mr-2 h-4 w-4" /> Apply AI Weighting
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {categoryConfig.map((category) => (
                      <div key={category.key} className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-700">{category.label}</p>
                          <Badge variant="outline" className="border-blue-200 text-blue-700">{category.weight}%</Badge>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={40}
                          value={category.weight}
                          className="mt-3 w-full"
                          onChange={(event) => handleCountryWeights(category.key, Number(event.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Scoring Scale</Label>
                      <Select
                        value={formState.scoringScale}
                        onValueChange={(value) => setFormState((prev) => ({ ...prev, scoringScale: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-5">1-5</SelectItem>
                          <SelectItem value="1-10">1-10</SelectItem>
                          <SelectItem value="1-100">1-100</SelectItem>
                          <SelectItem value="Custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Data Source Preference</Label>
                      <Select
                        value={formState.dataSource}
                        onValueChange={(value) => setFormState((prev) => ({ ...prev, dataSource: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATA_SOURCE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        rows={3}
                        placeholder="Summarise key concerns, triggers, and data sources"
                        value={formState.notes}
                        onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700">Impact Levels</h4>
                      {Object.entries(formState.impactLevels).map(([level, description]) => (
                        <div key={level} className="space-y-1">
                          <Label className="text-xs uppercase tracking-wide text-slate-500">{level}</Label>
                          <Textarea
                            rows={2}
                            value={description}
                            onChange={(event) => setFormState((prev) => ({
                              ...prev,
                              impactLevels: { ...prev.impactLevels, [level]: event.target.value },
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700">Probability Levels</h4>
                      {Object.entries(formState.probabilityLevels).map(([level, description]) => (
                        <div key={level} className="space-y-1">
                          <Label className="text-xs uppercase tracking-wide text-slate-500">{level}</Label>
                          <Textarea
                            rows={2}
                            value={description}
                            onChange={(event) => setFormState((prev) => ({
                              ...prev,
                              probabilityLevels: { ...prev.probabilityLevels, [level]: event.target.value },
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Documentation &amp; Attachments</h3>
                    <p className="text-sm text-gray-500">Attach supporting intelligence reports or frameworks.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="notes">AI Guidance</Label>
                      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-sm text-blue-900">
                        <p className="font-semibold">Predictive trend analysis</p>
                        <p>Automated weighting factors align with regional volatility, news sentiment, and macro-economic indicators to anticipate emerging hotspots.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          handleFileSelection(event.target.files)
                          event.target.value = ""
                        }}
                      />
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            fileInputRef.current?.click()
                          }
                        }}
                        className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-6 text-center text-sm text-blue-700"
                      >
                        <Upload className="h-8 w-8" />
                        <p className="font-medium">Upload intelligence dossiers</p>
                        <p className="text-xs">Drag &amp; drop files or click to browse</p>
                      </div>
                      {attachments.length > 0 && (
                        <ul className="space-y-2 text-sm">
                          {attachments.map((file) => (
                            <li key={`${file.name}-${file.size}`} className="flex items-center justify-between rounded-md border border-blue-100 bg-white/60 px-3 py-2 text-blue-900">
                              <span className="truncate pr-2" title={file.name}>{file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-blue-700 hover:text-blue-900"
                                onClick={() => setAttachments((prev) => prev.filter((item) => item.name !== file.name || item.size !== file.size))}
                              >
                                <X className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Remove attachment</span>
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </section>

                <Separator />

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button variant="outline" className="border-blue-200">Save as Draft</Button>
                  <Button className="bg-primary text-white" onClick={handleCreateAssessment}>
                    Launch Assessment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
