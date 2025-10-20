"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Globe2, AlertTriangle, Upload } from "lucide-react"

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

export default function CountryRiskPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "create">("dashboard")
  const [countries] = useState(SAMPLE_COUNTRIES)
  const [formValues, setFormValues] = useState({
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
  })
  const [weights, setWeights] = useState({
    political: 20,
    economic: 20,
    regulatory: 15,
    corruption: 10,
    infrastructure: 10,
    currency: 10,
    trade: 10,
    security: 5
  })

  const highRiskCountries = useMemo(() => countries.filter((item) => item.level === "High" || item.level === "Critical"), [countries])

  useEffect(() => {
    if (typeof window === "undefined") return
    const intent = new URLSearchParams(window.location.search).get("intent")
    if (intent === "create") {
      setActiveTab("create")
    }
  }, [])

  const handleWeightChange = (key: keyof typeof weights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = () => {
    console.log("Risk assessment saved", { formValues, weights })
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
                    <tr>
                      <td className="px-4 py-3">LATAM Regulatory Pulse</td>
                      <td className="px-4 py-3">South America</td>
                      <td className="px-4 py-3">D. Alvarez</td>
                      <td className="px-4 py-3">In Progress</td>
                      <td className="px-4 py-3">Mar 4</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">EMEA Political Review</td>
                      <td className="px-4 py-3">Europe</td>
                      <td className="px-4 py-3">S. Ibrahim</td>
                      <td className="px-4 py-3">Draft</td>
                      <td className="px-4 py-3">Mar 1</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Asia Pacific Compliance Update</td>
                      <td className="px-4 py-3">Asia Pacific</td>
                      <td className="px-4 py-3">L. Chen</td>
                      <td className="px-4 py-3">Published</td>
                      <td className="px-4 py-3">Feb 26</td>
                    </tr>
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
                        onChange={(event) => setFormValues((prev) => ({ ...prev, title: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Assessment Type</Label>
                      <Select
                        value={formValues.assessmentType}
                        onValueChange={(value) => setFormValues((prev) => ({ ...prev, assessmentType: value }))}
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
                        onChange={(event) => setFormValues((prev) => ({ ...prev, selectedCountries: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="framework">Assessment Framework</Label>
                      <Input
                        id="framework"
                        placeholder="ISO 31000, COSO ERM"
                        value={formValues.framework}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, framework: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="updateFrequency">Update Frequency</Label>
                      <Select
                        value={formValues.updateFrequency}
                        onValueChange={(value) => setFormValues((prev) => ({ ...prev, updateFrequency: value }))}
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
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assessor">Assigned Assessor</Label>
                      <Input
                        id="assessor"
                        placeholder="Primary owner"
                        value={formValues.assessor}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, assessor: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reviewTeam">Review Team</Label>
                      <Input
                        id="reviewTeam"
                        placeholder="Review committee or peers"
                        value={formValues.reviewTeam}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, reviewTeam: event.target.value }))}
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
                        onChange={(event) => setFormValues((prev) => ({ ...prev, notes: event.target.value }))}
                      />
                    </div>
                    <div className="flex h-full flex-col justify-center rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-6 text-center text-sm text-blue-700">
                      <Upload className="mx-auto h-8 w-8" />
                      <p className="mt-2 font-medium">Upload briefing decks or intelligence reports</p>
                      <p className="text-xs">Drag & drop files or browse</p>
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
