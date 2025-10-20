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
import { Switch } from "@/components/ui/switch"
import { CalendarDays, Users, Shield, Clock } from "lucide-react"

interface PlannedAudit {
  id: string
  title: string
  type: string
  department: string
  startDate: string
  endDate: string
  status: "Scheduled" | "In Progress" | "Completed"
  leadAuditor: string
  progress: number
}

const auditTypes = [
  "Internal Audit",
  "Compliance Audit",
  "Quality Management System Audit",
  "Financial Audit",
  "IT/Security Audit",
  "Operational Audit",
  "Environmental Audit",
  "Health & Safety Audit"
]

const riskLevels = ["Low", "Medium", "High", "Critical"]

const defaultAudits: PlannedAudit[] = [
  {
    id: "AUD-2025-001",
    title: "ISO 27001 Surveillance Audit",
    type: "Compliance Audit",
    department: "Information Security",
    startDate: "2025-03-10",
    endDate: "2025-03-14",
    status: "Scheduled",
    leadAuditor: "Alex Johnson",
    progress: 35
  },
  {
    id: "AUD-2025-004",
    title: "Supply Chain Resilience Review",
    type: "Operational Audit",
    department: "Operations",
    startDate: "2025-04-02",
    endDate: "2025-04-05",
    status: "In Progress",
    leadAuditor: "Priya Desai",
    progress: 62
  },
  {
    id: "AUD-2024-021",
    title: "GDPR Controls Validation",
    type: "Compliance Audit",
    department: "Legal",
    startDate: "2024-12-01",
    endDate: "2024-12-03",
    status: "Completed",
    leadAuditor: "Maria Rossi",
    progress: 100
  }
]

export default function AuditsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "create">("overview")
  const [audits] = useState(defaultAudits)
  const [notifyTeam, setNotifyTeam] = useState({ announcement: true, updates: true, reminders: false, completion: true })
  const [formValues, setFormValues] = useState({
    title: "",
    type: "",
    departments: "",
    scope: "",
    objective: "",
    framework: "",
    riskLevel: "Medium",
    startDate: "",
    endDate: "",
    leadAuditor: "",
    team: "",
    auditees: "",
    room: "",
    requirements: "",
    announcement: "",
    reminder: "",
    completion: ""
  })

  const activeAudits = useMemo(() => audits.filter((audit) => audit.status !== "Completed"), [audits])

  useEffect(() => {
    if (typeof window === "undefined") return
    const intent = new URLSearchParams(window.location.search).get("intent")
    if (intent === "create") {
      setActiveTab("create")
    }
  }, [])

  const handleChange = (key: keyof typeof formValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = () => {
    console.log("Audit plan saved", { formValues, notifyTeam })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Audit Builder</h1>
          <p className="text-sm text-gray-600">
            Plan, schedule, and orchestrate audits with AI-assisted recommendations.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "overview" | "create")}
          className="space-y-6"
        >
          <TabsList className="bg-emerald-50/60">
            <TabsTrigger value="overview">Planning Dashboard</TabsTrigger>
            <TabsTrigger value="create">Create Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-green-100 shadow-sm lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <CalendarDays className="h-5 w-5" /> Upcoming Audits
                  </CardTitle>
                  <CardDescription>Timeline view of scheduled engagements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeAudits.map((audit) => (
                    <div key={audit.id} className="rounded-lg border border-green-100 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">{audit.title}</h3>
                            <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                              {audit.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">{audit.department}</p>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                            <span><strong>Start:</strong> {audit.startDate}</span>
                            <span><strong>End:</strong> {audit.endDate}</span>
                            <span className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-emerald-500" /> {audit.leadAuditor}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <Badge className="bg-emerald-500/10 text-emerald-700">{audit.status}</Badge>
                          <div className="text-gray-500">Progress: {audit.progress}%</div>
                          <Button size="sm" variant="outline" className="w-full border-emerald-200">
                            View Plan
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-purple-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-700">
                    <Shield className="h-5 w-5" /> AI Recommendations
                  </CardTitle>
                  <CardDescription>Suggested focus areas generated from recent findings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-dashed border-purple-200 bg-purple-50/50 p-4 text-sm text-purple-900">
                    Prioritize a follow-up GDPR compliance audit for the European operations hub. Incident INC-2025-003 identified
                    data retention control gaps affecting Article 32 requirements.
                  </div>
                  <div className="rounded-lg border border-dashed border-purple-200 bg-purple-50/50 p-4 text-sm text-purple-900">
                    Manufacturing quality KPIs dropped 8% quarter over quarter. Schedule a process capability assessment for the
                    Austin facility.
                  </div>
                  <Button variant="secondary" className="w-full border-purple-200 bg-white text-purple-700">
                    Generate More Insights
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-green-100 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Clock className="h-5 w-5" /> Resource Snapshot
                </CardTitle>
                <CardDescription>Active engagements by department</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Compliance", active: 3, next: "Mar 12" },
                  { label: "Operations", active: 2, next: "Apr 4" },
                  { label: "IT Security", active: 1, next: "Mar 28" },
                  { label: "Finance", active: 2, next: "May 2" }
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-green-100 bg-white p-4 shadow-sm">
                    <p className="text-sm font-medium text-gray-500">{item.label}</p>
                    <p className="text-2xl font-semibold text-primary">{item.active}</p>
                    <p className="text-xs text-gray-500">Next audit: {item.next}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <Card className="border-green-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-primary">Audit Planning Wizard</CardTitle>
                <CardDescription>Define audit parameters and communication workflows</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Step 1 · Basic Information</h3>
                    <p className="text-sm text-gray-500">Provide the foundational details for the audit engagement.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="auditTitle">Audit Title</Label>
                      <Input
                        id="auditTitle"
                        placeholder="Q2 Regulatory Compliance Review"
                        value={formValues.title}
                        onChange={(event) => handleChange("title", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Audit Type</Label>
                      <Select value={formValues.type} onValueChange={(value) => handleChange("type", value)}>
                        <SelectTrigger className="w-full">
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
                      <Label htmlFor="departments">Department(s)</Label>
                      <Input
                        id="departments"
                        placeholder="Compliance, IT Security"
                        value={formValues.departments}
                        onChange={(event) => handleChange("departments", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="framework">Compliance Frameworks</Label>
                      <Input
                        id="framework"
                        placeholder="ISO 27001, SOC 2"
                        value={formValues.framework}
                        onChange={(event) => handleChange("framework", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Risk Level</Label>
                      <Select value={formValues.riskLevel} onValueChange={(value) => handleChange("riskLevel", value)}>
                        <SelectTrigger className="w-full">
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
                      <Label htmlFor="scope">Audit Scope</Label>
                      <Textarea
                        id="scope"
                        rows={3}
                        placeholder="Describe processes, locations and systems in scope"
                        value={formValues.scope}
                        onChange={(event) => handleChange("scope", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="objective">Audit Objective</Label>
                      <Textarea
                        id="objective"
                        rows={3}
                        placeholder="Summarise objectives, control focus and regulatory drivers"
                        value={formValues.objective}
                        onChange={(event) => handleChange("objective", event.target.value)}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Step 2 · Scheduling & Resources</h3>
                    <p className="text-sm text-gray-500">Coordinate team members and timing.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Planned Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formValues.startDate}
                        onChange={(event) => handleChange("startDate", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">Planned End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formValues.endDate}
                        onChange={(event) => handleChange("endDate", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="leadAuditor">Lead Auditor</Label>
                      <Input
                        id="leadAuditor"
                        placeholder="Select team lead"
                        value={formValues.leadAuditor}
                        onChange={(event) => handleChange("leadAuditor", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="team">Audit Team</Label>
                      <Input
                        id="team"
                        placeholder="Add team members"
                        value={formValues.team}
                        onChange={(event) => handleChange("team", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="auditees">Auditee Contacts</Label>
                      <Input
                        id="auditees"
                        placeholder="Primary stakeholders"
                        value={formValues.auditees}
                        onChange={(event) => handleChange("auditees", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="room">Meeting Room</Label>
                      <Input
                        id="room"
                        placeholder="Teams - Compliance HQ"
                        value={formValues.room}
                        onChange={(event) => handleChange("room", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="requirements">Special Requirements</Label>
                      <Textarea
                        id="requirements"
                        rows={3}
                        placeholder="Travel, security clearances, tooling"
                        value={formValues.requirements}
                        onChange={(event) => handleChange("requirements", event.target.value)}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Step 3 · Communication & Notifications</h3>
                    <p className="text-sm text-gray-500">Automate stakeholder updates throughout the audit lifecycle.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-green-100 bg-green-50/70 p-4">
                      <div>
                        <p className="font-medium text-gray-700">Audit Announcement</p>
                        <p className="text-sm text-gray-500">Send an initial message to auditees and sponsors.</p>
                      </div>
                      <Switch
                        checked={notifyTeam.announcement}
                        onCheckedChange={(checked) => setNotifyTeam((prev) => ({ ...prev, announcement: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-green-100 bg-white p-4">
                      <div>
                        <p className="font-medium text-gray-700">Daily Progress Updates</p>
                        <p className="text-sm text-gray-500">Share status summaries with the audit team.</p>
                      </div>
                      <Switch
                        checked={notifyTeam.updates}
                        onCheckedChange={(checked) => setNotifyTeam((prev) => ({ ...prev, updates: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-green-100 bg-white p-4">
                      <div>
                        <p className="font-medium text-gray-700">Daily Reminders</p>
                        <p className="text-sm text-gray-500">Remind auditees of evidence collection tasks.</p>
                      </div>
                      <Switch
                        checked={notifyTeam.reminders}
                        onCheckedChange={(checked) => setNotifyTeam((prev) => ({ ...prev, reminders: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-green-100 bg-white p-4">
                      <div>
                        <p className="font-medium text-gray-700">Completion Notice</p>
                        <p className="text-sm text-gray-500">Distribute final reports and outcomes.</p>
                      </div>
                      <Switch
                        checked={notifyTeam.completion}
                        onCheckedChange={(checked) => setNotifyTeam((prev) => ({ ...prev, completion: checked }))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="announcement">Announcement Email</Label>
                      <Textarea
                        id="announcement"
                        rows={4}
                        placeholder="Compose the introductory announcement"
                        value={formValues.announcement}
                        onChange={(event) => handleChange("announcement", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reminder">Daily Reminder Template</Label>
                      <Textarea
                        id="reminder"
                        rows={4}
                        placeholder="Outline daily reminder content"
                        value={formValues.reminder}
                        onChange={(event) => handleChange("reminder", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="completion">Completion Summary</Label>
                      <Textarea
                        id="completion"
                        rows={4}
                        placeholder="Summarise deliverables and follow-up actions"
                        value={formValues.completion}
                        onChange={(event) => handleChange("completion", event.target.value)}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Step 4 · Review & Launch</h3>
                    <p className="text-sm text-gray-500">Confirm schedule, stakeholders, and activation preference.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-dashed border-green-200 bg-green-50/70 p-4 text-sm text-gray-700">
                      <p className="font-medium">AI Review</p>
                      <p>Timeline looks balanced. Consider extending the fieldwork phase by one day to accommodate evidence delays.</p>
                    </div>
                    <div className="rounded-lg border border-green-100 bg-white p-4 text-sm text-gray-600">
                      <p className="font-medium text-gray-700">Resource Allocation</p>
                      <p>Lead auditor: {formValues.leadAuditor || 'Not assigned'}</p>
                      <p>Team members: {formValues.team || 'Pending selection'}</p>
                    </div>
                    <div className="rounded-lg border border-green-100 bg-white p-4 text-sm text-gray-600">
                      <p className="font-medium text-gray-700">Launch Options</p>
                      <ul className="list-disc pl-4">
                        <li>Save as draft</li>
                        <li>Schedule for later</li>
                        <li>Launch immediately</li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button variant="outline" className="border-green-200">Save as Draft</Button>
                    <Button className="bg-primary text-white" onClick={handleSubmit}>
                      Create Audit
                    </Button>
                  </div>
                </section>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
