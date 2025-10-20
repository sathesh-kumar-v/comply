"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Globe2, AlertTriangle, Upload, CheckCircle2, AlertCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AssessmentLogEntry {
  id: number
  assessment: string
  region: string
  owner: string
  status: string
  updated: string
}

interface RiskFormValues {
  title: string
  assessmentType: string
  selectedCountries: string
  framework: string
  startDate: string
  endDate: string
  updateFrequency: string
  assessor: string
  reviewTeam: string
  notes: string
}

interface LaunchFeedback {
  type: "success" | "error"
  title: string
  details: string[]
}

interface CountryRisk {
  country: string
  score: number
  level: "Low" | "Medium" | "High" | "Critical"
  nextAssessment: string
  trend: "Improving" | "Stable" | "Deteriorating"
}

const RISK_TYPES = ["Comprehensive", "Political", "Economic", "Compliance", "Operational"]
const RISK_LEVELS: CountryRisk["level"][] = ["Low", "Medium", "High", "Critical"]

const SAMPLE_COUNTRIES: CountryRisk[] = [
  { country: "Germany", score: 32, level: "Medium", nextAssessment: "Apr 18", trend: "Stable" },
  { country: "Brazil", score: 61, level: "High", nextAssessment: "Mar 25", trend: "Deteriorating" },
  { country: "Singapore", score: 18, level: "Low", nextAssessment: "May 2", trend: "Improving" },
  { country: "South Africa", score: 72, level: "Critical", nextAssessment: "Mar 30", trend: "Deteriorating" }
]

const DEFAULT_FORM_VALUES: RiskFormValues = {
  title: "",
  assessmentType: "Comprehensive",
  selectedCountries: "",
  framework: "",
  startDate: "",
  endDate: "",
  updateFrequency: "Quarterly",
  assessor: "",
  reviewTeam: "",
  notes: ""
}

const DEFAULT_WEIGHTS = {
  political: 20,
  economic: 20,
  regulatory: 15,
  corruption: 10,
  infrastructure: 10,
  currency: 10,
  trade: 10,
  security: 5
}

const INITIAL_ASSESSMENT_LOG: AssessmentLogEntry[] = [
  { id: 1, assessment: "LATAM Regulatory Pulse", region: "South America", owner: "D. Alvarez", status: "In Progress", updated: "Mar 4" },
  { id: 2, assessment: "EMEA Political Review", region: "Europe", owner: "S. Ibrahim", status: "Draft", updated: "Mar 1" },
  { id: 3, assessment: "Asia Pacific Compliance Update", region: "Asia Pacific", owner: "L. Chen", status: "Published", updated: "Feb 26" }
]

export default function CountryRiskPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "create">("dashboard")
  const [countries] = useState(SAMPLE_COUNTRIES)
  const [formValues, setFormValues] = useState<RiskFormValues>({ ...DEFAULT_FORM_VALUES })
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS })
  const [assessmentLog, setAssessmentLog] = useState<AssessmentLogEntry[]>(INITIAL_ASSESSMENT_LOG)
  const [launchFeedback, setLaunchFeedback] = useState<LaunchFeedback | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const highRiskCountries = useMemo(() => countries.filter((item) => item.level === "High" || item.level === "Critical"), [countries])

  useEffect(() => {
    if (typeof window === "undefined") return
    const intent = new URLSearchParams(window.location.search).get("intent")
    if (intent === "create") {
      setActiveTab("create")
    }
  }, [])

  const updateFormValue = <K extends keyof RiskFormValues>(key: K, value: RiskFormValues[K]) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
    if (launchFeedback?.type === "error") {
      setLaunchFeedback(null)
    }
  }

  const handleWeightChange = (key: keyof typeof weights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }))
  }

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    setIsDragging(false)
    setAttachments((prev) => {
      const existingKeys = new Set(prev.map((file) => `${file.name}-${file.size}`))
      const incoming = Array.from(files).filter((file) => {
        const key = `${file.name}-${file.size}`
        if (existingKeys.has(key)) {
          return false
        }
        existingKeys.add(key)
        return true
      })

      return [...prev, ...incoming]
    })
  }

  const handleAttachmentClick = () => {
    fileInputRef.current?.click()
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    handleFilesSelected(event.dataTransfer.files)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, fileIndex) => fileIndex !== index))
  }

  const handleDropAreaKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      handleAttachmentClick()
    }
  }

  const handleSubmit = () => {
    const trimmedTitle = formValues.title.trim()
    const normalizedCountries = formValues.selectedCountries
      .split(/[\n,]/)
      .map((country) => country.trim())
      .filter(Boolean)

    if (!trimmedTitle) {
      setActiveTab("create")
      setLaunchFeedback({
        type: "error",
        title: "Add an assessment name",
        details: ["Provide a descriptive title before launching the risk assessment."]
      })
      return
    }

    const now = new Date()
    const formattedDate = now.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const owner = formValues.assessor.trim() || "Unassigned"
    const regionSummary =
      normalizedCountries.length === 0
        ? "Scope TBD"
        : normalizedCountries.length === 1
          ? normalizedCountries[0]
          : `${normalizedCountries[0]} + ${normalizedCountries.length - 1} more`
    const attachmentSummary =
      attachments.length === 0
        ? "No supporting documents attached."
        : `Attachments: ${attachments.map((file) => file.name).join(", ")}`

    const newEntry: AssessmentLogEntry = {
      id: now.valueOf(),
      assessment: trimmedTitle,
      region: regionSummary,
      owner,
      status: "Scheduled",
      updated: formattedDate
    }

    setAssessmentLog((prev) => [newEntry, ...prev])
    setLaunchFeedback({
      type: "success",
      title: "Risk assessment scheduled",
      details: [
        `${trimmedTitle} will run as a ${formValues.assessmentType.toLowerCase()} review.`,
        normalizedCountries.length
          ? `Scope includes ${normalizedCountries.length > 1 ? `${normalizedCountries[0]} and ${normalizedCountries.length - 1} additional regions` : normalizedCountries[0]}.`
          : "Add operating regions to finalise the scope.",
        `Primary owner: ${owner}.`,
        `Review team: ${formValues.reviewTeam.trim() || "Not specified"}.`,
        `Updates planned ${formValues.updateFrequency.toLowerCase()}.`,
        attachmentSummary
      ]
    })

    const { assessmentType, updateFrequency } = formValues
    setFormValues(() => ({
      ...DEFAULT_FORM_VALUES,
      assessmentType,
      updateFrequency
    }))
    setAttachments([])
    setActiveTab("dashboard")
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Country Risk Assessment</h1>
          <p className="text-sm text-gray-600">
            Monitor geopolitical and regulatory exposure with AI-curated insights.
          </p>
        </div>

        {launchFeedback && (
          <Alert
            className={
              launchFeedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLaunchFeedback(null)}
                className="self-end sm:self-start"
              >
                Dismiss
              </Button>
            </div>
          </Alert>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "dashboard" | "create")}
          className="space-y-6"
        >
          <TabsList className="bg-blue-50/70">
            <TabsTrigger value="dashboard">Risk Dashboard</TabsTrigger>
            <TabsTrigger value="create">Create Assessment</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-blue-100 shadow-sm lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700">
                    <Globe2 className="h-5 w-5" /> Global Heat Map
                  </CardTitle>
                  <CardDescription>Risk distribution across operating regions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="h-72 w-full rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-6 text-sm text-blue-900">
                    Interactive heat map will render here using company telemetry. Current prototype highlights risk bands and AI
                    commentary for each jurisdiction.
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {countries.map((item) => (
                      <div key={item.country} className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-800">{item.country}</p>
                          <Badge className={
                            item.level === "Critical"
                              ? "bg-red-100 text-red-700"
                              : item.level === "High"
                                ? "bg-orange-100 text-orange-700"
                                : item.level === "Medium"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                          }>
                            {item.level}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">Composite score: {item.score}</p>
                        <p className="text-xs text-gray-500">Next assessment: {item.nextAssessment}</p>
                        <p className="text-xs text-gray-500">Trend: {item.trend}</p>
                      </div>
                    ))}
                  </div>
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
                  {highRiskCountries.map((item) => (
                    <div key={item.country} className="rounded-lg border border-dashed border-orange-200 bg-orange-50/60 p-4">
                      <p className="font-semibold text-orange-800">{item.country}</p>
                      <p>Escalating {item.level.toLowerCase()} risk driven by regulatory changes and macroeconomic volatility.</p>
                      <p className="text-xs text-orange-700 mt-2">Recommended action: trigger mitigation workshop within 7 days.</p>
                    </div>
                  ))}
                  <Button variant="secondary" className="w-full border-orange-200 bg-white text-orange-700">
                    Generate Risk Bulletin
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-blue-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-blue-700">Assessment Log</CardTitle>
                <CardDescription>Recent updates across geographic portfolios</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="min-w-full divide-y divide-blue-100 text-sm">
                  <thead className="bg-blue-50/60 text-left text-xs uppercase tracking-wide text-blue-600">
                    <tr>
                      <th className="px-4 py-3">Assessment</th>
                      <th className="px-4 py-3">Region</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50 bg-white">
                    {assessmentLog.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3">{entry.assessment}</td>
                        <td className="px-4 py-3">{entry.region}</td>
                        <td className="px-4 py-3">{entry.owner}</td>
                        <td className="px-4 py-3">{entry.status}</td>
                        <td className="px-4 py-3">{entry.updated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <Card className="border-blue-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-blue-700">Assessment Configuration</CardTitle>
                <CardDescription>Define scope, criteria, and monitoring cadence.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Scope Definition</h3>
                    <p className="text-sm text-gray-500">Identify impacted countries and frameworks.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="title">Assessment Title</Label>
                      <Input
                        id="title"
                        placeholder="Q2 Cross-Border Compliance Risk Review"
                        value={formValues.title}
                        onChange={(event) => updateFormValue("title", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Assessment Type</Label>
                      <Select
                        value={formValues.assessmentType}
                        onValueChange={(value) => updateFormValue("assessmentType", value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RISK_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="countries">Country Selection</Label>
                      <Textarea
                        id="countries"
                        rows={3}
                        placeholder="Type to search and list countries included"
                        value={formValues.selectedCountries}
                        onChange={(event) => updateFormValue("selectedCountries", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="framework">Assessment Framework</Label>
                      <Input
                        id="framework"
                        placeholder="ISO 31000, COSO ERM"
                        value={formValues.framework}
                        onChange={(event) => updateFormValue("framework", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="updateFrequency">Update Frequency</Label>
                      <Select
                        value={formValues.updateFrequency}
                        onValueChange={(value) => updateFormValue("updateFrequency", value)}
                      >
                        <SelectTrigger className="w-full">
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
                        value={formValues.startDate}
                        onChange={(event) => {
                          const value = event.target.value
                          setFormValues((prev) => ({
                            ...prev,
                            startDate: value,
                            endDate:
                              prev.endDate && value && prev.endDate < value ? value : prev.endDate
                          }))
                          if (launchFeedback?.type === "error") {
                            setLaunchFeedback(null)
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">Assessment Period End</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formValues.endDate}
                        min={formValues.startDate || undefined}
                        onChange={(event) => {
                          const value = event.target.value
                          setFormValues((prev) => ({
                            ...prev,
                            endDate:
                              prev.startDate && value && value < prev.startDate ? prev.startDate : value
                          }))
                          if (launchFeedback?.type === "error") {
                            setLaunchFeedback(null)
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assessor">Assigned Assessor</Label>
                      <Input
                        id="assessor"
                        placeholder="Primary owner"
                        value={formValues.assessor}
                        onChange={(event) => updateFormValue("assessor", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reviewTeam">Review Team</Label>
                      <Input
                        id="reviewTeam"
                        placeholder="Review committee or peers"
                        value={formValues.reviewTeam}
                        onChange={(event) => updateFormValue("reviewTeam", event.target.value)}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Risk Criteria Weighting</h3>
                    <p className="text-sm text-gray-500">Adjust weightings to emphasise risk categories.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.entries(weights).map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="capitalize text-sm font-medium text-gray-700">{key.replace('_', ' ')}</p>
                          <Badge variant="outline" className="border-blue-200 text-blue-700">{value}%</Badge>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={value}
                          className="mt-3 w-full"
                          onChange={(event) => handleWeightChange(key as keyof typeof weights, Number(event.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Documentation & Notes</h3>
                    <p className="text-sm text-gray-500">Attach supporting analysis and context.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="notes">Assessment Notes</Label>
                      <Textarea
                        id="notes"
                        rows={4}
                        placeholder="Summarise key concerns, triggers, and data sources"
                        value={formValues.notes}
                        onChange={(event) => updateFormValue("notes", event.target.value)}
                      />
                    </div>
                    <div className="space-y-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.rtf,.zip,.rar,.7z,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(event) => {
                          handleFilesSelected(event.target.files)
                          event.target.value = ""
                        }}
                      />
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Upload supporting documents"
                        onClick={handleAttachmentClick}
                        onKeyDown={handleDropAreaKeyDown}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragEnter={() => setIsDragging(true)}
                        onDragLeave={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            setIsDragging(false)
                          }
                        }}
                        className={cn(
                          "flex h-full min-h-[176px] flex-col justify-center rounded-lg border border-dashed p-6 text-center text-sm transition",
                          isDragging ? "border-blue-400 bg-blue-50 text-blue-800" : "border-blue-200 bg-blue-50/40 text-blue-700"
                        )}
                      >
                        <Upload className="mx-auto h-8 w-8" />
                        <p className="mt-2 font-medium">Upload briefing decks or intelligence reports</p>
                        <p className="text-xs">Drag & drop files or browse</p>
                      </div>
                      {attachments.length > 0 && (
                        <ul className="space-y-2 text-sm">
                          {attachments.map((file, index) => (
                            <li
                              key={`${file.name}-${file.size}-${index}`}
                              className="flex items-center justify-between rounded-md border border-blue-100 bg-white/60 px-3 py-2 text-blue-900"
                            >
                              <span className="truncate pr-2" title={file.name}>
                                {file.name}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-blue-700 hover:text-blue-900"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  removeAttachment(index)
                                }}
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
                  <Button className="bg-primary text-white" onClick={handleSubmit}>
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
