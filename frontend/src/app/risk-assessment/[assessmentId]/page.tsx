"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { buildApiUrl } from "@/lib/api-url"
import { cn } from "@/lib/utils"
import type { RiskAssessmentCountryDetail, RiskAssessmentDetail } from "@/types/risk"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Globe2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
  Zap,
  X
} from "lucide-react"

interface AttachmentPreview {
  name: string
  size?: number
}

interface CountryFormState {
  trend: string
  confidence: string
  impactLevel: string
  probabilityLevel: string
  evidence: string
  comments: string
  updateSource: string
  categories: Array<{ id: number; name: string; score: number; trend?: string | null }>
  attachments: AttachmentPreview[]
}

const TREND_OPTIONS = ["Improving", "Stable", "Deteriorating"]
const CONFIDENCE_OPTIONS = ["High", "Medium", "Low"]
const UPDATE_SOURCE_OPTIONS = ["Manual", "External Data", "AI Analysis"]

export default function RiskAssessmentExecutionPage({ params }: { params: { assessmentId: string } }) {
  const router = useRouter()
  const { assessmentId } = params
  const [assessment, setAssessment] = useState<RiskAssessmentDetail | null>(null)
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null)
  const [countryForms, setCountryForms] = useState<Record<string, CountryFormState>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    title: string
    details: string[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fetchAssessment = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(buildApiUrl(`/api/risk-assessment/assessments/${assessmentId}`))
      if (!response.ok) throw new Error("Unable to load assessment")
      const data: RiskAssessmentDetail = await response.json()
      setAssessment(data)
      if (!selectedCountryCode && data.countries.length > 0) {
        setSelectedCountryCode(data.countries[0].countryCode)
      }
      const nextForms: Record<string, CountryFormState> = {}
      data.countries.forEach((country) => {
        nextForms[country.countryCode] = {
          trend: country.trend,
          confidence: country.confidence,
          impactLevel: country.impactLevel ?? "Medium",
          probabilityLevel: country.probabilityLevel ?? "Possible",
          evidence: country.evidence ?? "",
          comments: country.comments ?? "",
          updateSource: country.updateSource,
          categories: country.categories.map((category) => ({ ...category })),
          attachments: (country.attachments || []).map((attachment) => ({
            name: typeof attachment.name === "string" ? attachment.name : "Attachment",
            size: typeof attachment.size === "number" ? attachment.size : undefined,
          })),
        }
      })
      setCountryForms(nextForms)
    } catch (error) {
      console.error(error)
      setFeedback({
        type: "error",
        title: "Unable to load assessment",
        details: ["Please verify the assessment ID and backend availability."],
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    fetchAssessment()
  }, [assessmentId])

  const selectedCountry = useMemo(() => {
    if (!assessment || !selectedCountryCode) return null
    return assessment.countries.find((country) => country.countryCode === selectedCountryCode) ?? null
  }, [assessment, selectedCountryCode])

  const selectedForm = selectedCountryCode ? countryForms[selectedCountryCode] : undefined

  const executionProgress = useMemo(() => {
    if (!selectedCountry || !selectedForm) return 0
    const completedCategories = selectedForm.categories.filter((category) => category.score > 0).length
    const evidenceScore = selectedForm.evidence.trim().length > 0 ? 1 : 0
    const confidenceScore = selectedForm.confidence ? 1 : 0
    const total = selectedForm.categories.length + 2
    return Math.round(((completedCategories + evidenceScore + confidenceScore) / total) * 100)
  }, [selectedCountry, selectedForm])

  const handleAttachmentSelection = (files: FileList | null) => {
    if (!files || !selectedCountryCode) return
    setCountryForms((prev) => {
      const current = prev[selectedCountryCode]
      if (!current) return prev
      const existing = new Set(current.attachments.map((item) => `${item.name}-${item.size ?? 0}`))
      const additions: AttachmentPreview[] = []
      Array.from(files).forEach((file) => {
        const key = `${file.name}-${file.size}`
        if (!existing.has(key)) {
          existing.add(key)
          additions.push({ name: file.name, size: file.size })
        }
      })
      return {
        ...prev,
        [selectedCountryCode]: {
          ...current,
          attachments: [...current.attachments, ...additions],
        },
      }
    })
  }

  const handleCategoryScoreChange = (categoryId: number, score: number) => {
    if (!selectedCountryCode) return
    setCountryForms((prev) => {
      const current = prev[selectedCountryCode]
      if (!current) return prev
      return {
        ...prev,
        [selectedCountryCode]: {
          ...current,
          categories: current.categories.map((category) =>
            category.id === categoryId ? { ...category, score } : category
          ),
        },
      }
    })
  }

  const handleSave = async () => {
    if (!assessment || !selectedCountry || !selectedCountryCode || !selectedForm) return
    setIsSaving(true)
    try {
      const payload = {
        countryCode: selectedCountry.countryCode,
        countryName: selectedCountry.countryName,
        trend: selectedForm.trend,
        confidence: selectedForm.confidence,
        impactLevel: selectedForm.impactLevel,
        probabilityLevel: selectedForm.probabilityLevel,
        evidence: selectedForm.evidence,
        comments: selectedForm.comments,
        updateSource: selectedForm.updateSource,
        categories: selectedForm.categories.map((category) => ({
          name: category.name,
          score: category.score,
          trend: category.trend ?? undefined,
        })),
        attachments: selectedForm.attachments,
      }
      const response = await fetch(buildApiUrl(`/api/risk-assessment/assessments/${assessment.id}/countries`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error("Unable to save country assessment")
      const updated: RiskAssessmentCountryDetail = await response.json()
      setAssessment((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          countries: prev.countries.map((country) =>
            country.countryCode === updated.countryCode ? updated : country
          ),
        }
      })
      setCountryForms((prev) => ({
        ...prev,
        [updated.countryCode]: {
          trend: updated.trend,
          confidence: updated.confidence,
          impactLevel: updated.impactLevel ?? "Medium",
          probabilityLevel: updated.probabilityLevel ?? "Possible",
          evidence: updated.evidence ?? "",
          comments: updated.comments ?? "",
          updateSource: updated.updateSource,
          categories: updated.categories.map((category) => ({ ...category })),
          attachments: (updated.attachments || []).map((attachment) => ({
            name: typeof attachment.name === "string" ? attachment.name : "Attachment",
            size: typeof attachment.size === "number" ? attachment.size : undefined,
          })),
        },
      }))
      setFeedback({
        type: "success",
        title: "Country assessment updated",
        details: [
          `${updated.countryName} recalibrated to ${updated.riskLevel} risk level with ${updated.confidence} confidence.`,
          `Next review scheduled for ${updated.nextAssessmentDue ?? "upcoming cycle"}.`,
        ],
      })
    } catch (error) {
      console.error(error)
      setFeedback({
        type: "error",
        title: "Unable to save assessment",
        details: ["Review inputs and retry. Persistent issues should be escalated to the compliance engineering team."],
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRefreshIntelligence = async () => {
    if (!assessment) return
    setIsRefreshing(true)
    try {
      const response = await fetch(buildApiUrl(`/api/risk-assessment/assessments/${assessment.id}/ai-refresh`), {
        method: "POST",
      })
      if (!response.ok) throw new Error("Unable to refresh AI intelligence")
      await fetchAssessment()
      setFeedback({
        type: "success",
        title: "AI intelligence refreshed",
        details: ["Scores and predictive alerts updated using the latest external data feeds."],
      })
    } catch (error) {
      console.error(error)
      setFeedback({
        type: "error",
        title: "Unable to refresh AI intelligence",
        details: ["Verify connectivity to the AI service and retry."],
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-blue-600">Country Risk Assessment Execution</p>
            <h1 className="text-2xl font-bold text-slate-900">{assessment?.title ?? "Execution Workspace"}</h1>
            <p className="text-sm text-muted-foreground">
              Update country risk scoring, attach evidence, and trigger AI recalculations with real-time intelligence feeds.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/risk-assessment")}> 
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </div>

        {feedback && (
          <Alert
            className={cn(
              "border",
              feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                {feedback.type === "success" ? (
                  <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="mt-1 h-5 w-5 text-red-600" />
                )}
                <div>
                  <AlertTitle>{feedback.title}</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {feedback.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFeedback(null)}>
                Dismiss
              </Button>
            </div>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading assessment workspace…
          </div>
        ) : assessment && selectedCountry && selectedForm ? (
          <div className="space-y-6">
            <Card className="border-blue-100 shadow-sm">
              <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-blue-700">
                    <Globe2 className="h-5 w-5" /> {selectedCountry.countryName}
                  </CardTitle>
                  <CardDescription>
                    {assessment.assessmentType} · {assessment.framework}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={selectedCountryCode ?? undefined} onValueChange={setSelectedCountryCode}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {assessment.countries.map((country) => (
                        <SelectItem key={country.countryCode} value={country.countryCode}>
                          {country.countryName} ({country.riskLevel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleRefreshIntelligence}>
                    <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} /> Refresh External Data
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2">
                    <span className="text-xs uppercase tracking-wide text-blue-700">Overall Score</span>
                    <span className="text-2xl font-semibold text-blue-900">{selectedCountry.overallScore.toFixed(1)}</span>
                  </div>
                  <Badge
                    className={cn(
                      "text-sm",
                      selectedCountry.riskLevel === "Critical" && "bg-red-100 text-red-700",
                      selectedCountry.riskLevel === "High" && "bg-orange-100 text-orange-700",
                      selectedCountry.riskLevel === "Medium" && "bg-yellow-100 text-yellow-700",
                      selectedCountry.riskLevel === "Low" && "bg-emerald-100 text-emerald-700"
                    )}
                  >
                    {selectedCountry.riskLevel}
                  </Badge>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> Confidence {selectedCountry.confidence}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Activity className="h-4 w-4 text-blue-600" /> Trend {selectedCountry.trend}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">Assessment Progress</p>
                    <span className="text-sm text-muted-foreground">{executionProgress}% complete</span>
                  </div>
                  <Progress value={executionProgress} />
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="categories" className="space-y-6">
              <TabsList>
                <TabsTrigger value="categories">Risk Categories</TabsTrigger>
                <TabsTrigger value="evidence">Evidence &amp; Commentary</TabsTrigger>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
                <TabsTrigger value="intel">Data Sources &amp; AI</TabsTrigger>
              </TabsList>
              <TabsContent value="categories" className="space-y-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-800">Risk Category Scoring</CardTitle>
                    <CardDescription>Adjust risk scores, capture trend, and align with probability/impact ratings.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      {selectedForm.categories.map((category) => (
                        <div key={category.id} className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-800">{category.name.replace(/_/g, " ")}</p>
                            <Badge variant="outline" className="border-slate-200 text-xs text-slate-600">
                              AI benchmark {category.aiSuggestion?.toFixed(1) ?? "--"}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={category.score}
                              onChange={(event) => handleCategoryScoreChange(category.id, Number(event.target.value))}
                            />
                            <Select
                              value={category.trend ?? "Stable"}
                              onValueChange={(value) => {
                                setCountryForms((prev) => {
                                  const current = prev[selectedCountryCode!]
                                  if (!current) return prev
                                  return {
                                    ...prev,
                                    [selectedCountryCode!]: {
                                      ...current,
                                      categories: current.categories.map((item) =>
                                        item.id === category.id ? { ...item, trend: value } : item
                                      ),
                                    },
                                  }
                                })
                              }}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Trend" />
                              </SelectTrigger>
                              <SelectContent>
                                {TREND_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>Impact &amp; Probability Ratings</CardTitle>
                    <CardDescription>Align with the configured risk matrix definitions.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Trend</Label>
                      <Select
                        value={selectedForm.trend}
                        onValueChange={(value) =>
                          setCountryForms((prev) => ({
                            ...prev,
                            [selectedCountryCode!]: { ...prev[selectedCountryCode!], trend: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TREND_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Confidence Level</Label>
                      <Select
                        value={selectedForm.confidence}
                        onValueChange={(value) =>
                          setCountryForms((prev) => ({
                            ...prev,
                            [selectedCountryCode!]: { ...prev[selectedCountryCode!], confidence: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONFIDENCE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Update Source</Label>
                      <Select
                        value={selectedForm.updateSource}
                        onValueChange={(value) =>
                          setCountryForms((prev) => ({
                            ...prev,
                            [selectedCountryCode!]: { ...prev[selectedCountryCode!], updateSource: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UPDATE_SOURCE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Impact Level</Label>
                      <Input
                        value={selectedForm.impactLevel}
                        onChange={(event) =>
                          setCountryForms((prev) => ({
                            ...prev,
                            [selectedCountryCode!]: { ...prev[selectedCountryCode!], impactLevel: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Probability Level</Label>
                      <Input
                        value={selectedForm.probabilityLevel}
                        onChange={(event) =>
                          setCountryForms((prev) => ({
                            ...prev,
                            [selectedCountryCode!]: { ...prev[selectedCountryCode!], probabilityLevel: event.target.value },
                          }))
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="evidence" className="space-y-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>Evidence &amp; Analyst Commentary</CardTitle>
                    <CardDescription>Provide supporting analysis. Markdown formatting is supported.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Evidence / Sources</Label>
                      <Textarea
                        rows={10}
                        value={selectedForm.evidence}
                        onChange={(event) =>
                          setCountryForms((prev) => ({
                            ...prev,
                            [selectedCountryCode!]: { ...prev[selectedCountryCode!], evidence: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Comments (Rich Text)</Label>
                      <Textarea
                        rows={10}
                        value={selectedForm.comments}
                        onChange={(event) =>
                          setCountryForms((prev) => ({
                            ...prev,
                            [selectedCountryCode!]: { ...prev[selectedCountryCode!], comments: event.target.value },
                          }))
                        }
                        placeholder="Summarise mitigation steps, stakeholder communications, and next review requirements."
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="attachments" className="space-y-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>Supporting Documents</CardTitle>
                    <CardDescription>Upload or review intelligence attachments for the country.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        handleAttachmentSelection(event.target.files)
                        if (event.target) event.target.value = ""
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
                      className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-700"
                    >
                      <Upload className="h-8 w-8" />
                      <p className="font-medium">Drop files or click to browse</p>
                      <p className="text-xs text-muted-foreground">Accepted formats: PDF, Office, image, and archive files.</p>
                    </div>
                    {selectedForm.attachments.length > 0 ? (
                      <ul className="space-y-2 text-sm">
                        {selectedForm.attachments.map((file) => (
                          <li key={`${file.name}-${file.size ?? 0}`} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                            <span className="truncate" title={file.name}>{file.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setCountryForms((prev) => ({
                                  ...prev,
                                  [selectedCountryCode!]: {
                                    ...prev[selectedCountryCode!],
                                    attachments: prev[selectedCountryCode!].attachments.filter((item) => item.name !== file.name),
                                  },
                                }))
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No attachments uploaded yet.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="intel" className="space-y-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>External Data Sources</CardTitle>
                    <CardDescription>Live feeds powering automated scoring.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      {(assessment.externalDataSources || []).map((source) => (
                        <div key={source.name} className="rounded-lg border border-slate-200 bg-white p-4">
                          <p className="text-sm font-semibold text-slate-800">{source.name}</p>
                          <p className="text-xs text-muted-foreground">Last refreshed {source.lastUpdated ? new Date(source.lastUpdated).toLocaleString() : "--"}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-md border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-800">
                      <p className="font-semibold">AI Enhancement</p>
                      <p>Predictive modelling analyses news, macro indicators, and anomaly detection to forecast risk movements and surface intelligent groupings for regional review.</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>AI Watchlist &amp; Alerts</CardTitle>
                    <CardDescription>Highlights generated by automated intelligence for this assessment.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(assessment.aiRecommendations?.watchlist as Array<Record<string, unknown>> | undefined)?.length ? (
                      <ul className="space-y-2 text-sm">
                        {(assessment.aiRecommendations!.watchlist as Array<any>).map((item, index) => (
                          <li key={`${item.country}-${index}`} className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50/50 p-3 text-blue-900">
                            <AlertTriangle className="mt-0.5 h-4 w-4" />
                            <span>
                              {item.country}: {item.riskLevel} risk · confidence {item.confidence}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">AI watchlist will populate after the next intelligence refresh.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" /> Export Country Packet
                </Button>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" /> Generate Briefing PDF
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setFeedback({
                      type: "success",
                      title: "Alert scheduled",
                      details: ["Stakeholders will be notified about significant changes."],
                    })
                  }
                >
                  <Zap className="mr-2 h-4 w-4" /> Trigger Alert
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Save Assessment
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No countries found for this assessment. Return to the dashboard to configure scope.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
