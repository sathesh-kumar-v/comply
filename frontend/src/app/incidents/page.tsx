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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Upload, Activity, AlertOctagon, Timer } from "lucide-react"

interface IncidentRecord {
  id: string
  title: string
  type: string
  severity: "Low" | "Medium" | "High" | "Critical"
  status: "Open" | "In Progress" | "Resolved"
  department: string
  reportedOn: string
  owner: string
  resolutionTime?: string
}

const INCIDENT_TYPES = [
  "Safety Incident",
  "Security Breach",
  "Compliance Violation",
  "Environmental Incident",
  "Quality Issue",
  "IT System Failure",
  "Process Failure",
  "Customer Complaint",
  "Other"
]

const SEVERITY = ["Low", "Medium", "High", "Critical"] as const

const SAMPLE_INCIDENTS: IncidentRecord[] = [
  {
    id: "INC-2025-004",
    title: "Unauthorized database access",
    type: "Security Breach",
    severity: "Critical",
    status: "In Progress",
    department: "IT Security",
    reportedOn: "2025-03-05",
    owner: "Alex Lee"
  },
  {
    id: "INC-2025-002",
    title: "Safety observation - loading dock",
    type: "Safety Incident",
    severity: "Medium",
    status: "Open",
    department: "Operations",
    reportedOn: "2025-03-02",
    owner: "Jordan Smith"
  },
  {
    id: "INC-2025-001",
    title: "Late regulatory filing",
    type: "Compliance Violation",
    severity: "High",
    status: "Resolved",
    department: "Finance",
    reportedOn: "2025-02-18",
    owner: "Priya Patel",
    resolutionTime: "36 hrs"
  }
]

export default function IncidentsPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "report">("dashboard")
  const [incidents] = useState(SAMPLE_INCIDENTS)
  const [formValues, setFormValues] = useState({
    title: "",
    type: "",
    department: "",
    location: "",
    date: "",
    time: "",
    severity: "Medium" as (typeof SEVERITY)[number],
    impact: "",
    actions: "",
    description: "",
    whatHappened: "",
    rootCause: "",
    contributors: "",
    people: "",
    witnesses: "",
    equipment: "",
    notification: "",
    escalation: "",
    external: "",
    disclosure: "No"
  })

  const openIncidents = useMemo(() => incidents.filter((incident) => incident.status !== "Resolved"), [incidents])

  useEffect(() => {
    if (typeof window === "undefined") return
    const intent = new URLSearchParams(window.location.search).get("intent")
    if (intent === "report") {
      setActiveTab("report")
    }
  }, [])

  const handleSubmit = () => {
    console.log("Incident submitted", formValues)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Incident Reporting</h1>
          <p className="text-sm text-gray-600">
            Capture, triage, and resolve incidents with automated escalation paths.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "dashboard" | "report")}
          className="space-y-6"
        >
          <TabsList className="bg-red-50/70">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="report">Report Incident</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Total Incidents", value: incidents.length, icon: Activity, tone: "text-primary" },
                { label: "Open Incidents", value: openIncidents.length, icon: AlertOctagon, tone: "text-red-600" },
                { label: "Resolved This Month", value: incidents.filter((incident) => incident.status === "Resolved").length, icon: Timer, tone: "text-emerald-600" },
                { label: "Average Resolution", value: "28 hrs", icon: Timer, tone: "text-indigo-600" }
              ].map((card) => (
                <Card key={card.label} className="border-red-100 shadow-sm">
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className={`flex items-center gap-2 text-sm font-medium ${card.tone}`}>
                      <card.icon className="h-4 w-4" />
                      {card.label}
                    </div>
                    <div className="text-2xl font-semibold text-gray-900">{card.value}</div>
                    <p className="text-xs text-gray-500">AI monitors severity spikes and response delays.</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-red-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-red-700">Recent Incidents</CardTitle>
                <CardDescription>Track status across departments and severity levels.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-red-50/70">
                    <TableRow className="uppercase text-xs tracking-wide text-red-700">
                      <TableHead className="px-4">ID</TableHead>
                      <TableHead className="px-4">Title</TableHead>
                      <TableHead className="px-4">Type</TableHead>
                      <TableHead className="px-4">Severity</TableHead>
                      <TableHead className="px-4">Department</TableHead>
                      <TableHead className="px-4">Status</TableHead>
                      <TableHead className="px-4">Owner</TableHead>
                      <TableHead className="px-4">Reported</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidents.map((incident) => (
                      <TableRow key={incident.id}>
                        <TableCell className="font-medium text-gray-900">{incident.id}</TableCell>
                        <TableCell className="text-gray-700">{incident.title}</TableCell>
                        <TableCell className="text-sm text-gray-600">{incident.type}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              incident.severity === "Critical"
                                ? "bg-red-100 text-red-700"
                                : incident.severity === "High"
                                  ? "bg-orange-100 text-orange-700"
                                  : incident.severity === "Medium"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"
                            }
                          >
                            {incident.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{incident.department}</TableCell>
                        <TableCell className="text-sm text-gray-600">{incident.status}</TableCell>
                        <TableCell className="text-sm text-gray-600">{incident.owner}</TableCell>
                        <TableCell className="text-sm text-gray-500">{incident.reportedOn}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="report">
            <Card className="border-red-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-red-700">Report New Incident</CardTitle>
                <CardDescription>Provide detailed context to support investigation workflows.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Incident Details</h3>
                    <p className="text-sm text-gray-500">Capture classification, location, and severity.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="title">Incident Title</Label>
                      <Input
                        id="title"
                        placeholder="Brief, descriptive title"
                        value={formValues.title}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, title: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Incident Type</Label>
                      <Select value={formValues.type} onValueChange={(value) => setFormValues((prev) => ({ ...prev, type: value }))}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {INCIDENT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        placeholder="Impacted department"
                        value={formValues.department}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, department: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        placeholder="Site / facility / region"
                        value={formValues.location}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, location: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formValues.date}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, date: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Time</Label>
                      <Input
                        id="time"
                        type="time"
                        value={formValues.time}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, time: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Severity</Label>
                      <Select
                        value={formValues.severity}
                        onValueChange={(value) => setFormValues((prev) => ({ ...prev, severity: value as (typeof SEVERITY)[number] }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEVERITY.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="impact">Impact Assessment</Label>
                      <Textarea
                        id="impact"
                        rows={3}
                        placeholder="Describe the impact to people, operations, compliance or assets"
                        value={formValues.impact}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, impact: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="actions">Immediate Actions Taken</Label>
                      <Textarea
                        id="actions"
                        rows={3}
                        placeholder="Document containment or mitigation steps"
                        value={formValues.actions}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, actions: event.target.value }))}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Incident Narrative</h3>
                    <p className="text-sm text-gray-500">Provide detailed description, root cause, and contributing factors.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="description">Detailed Description</Label>
                      <Textarea
                        id="description"
                        rows={4}
                        placeholder="Full chronology of events"
                        value={formValues.description}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatHappened">What Happened?</Label>
                      <Textarea
                        id="whatHappened"
                        rows={3}
                        placeholder="Summarise the incident triggers and sequence"
                        value={formValues.whatHappened}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, whatHappened: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rootCause">Root Cause (if known)</Label>
                      <Textarea
                        id="rootCause"
                        rows={3}
                        placeholder="Initial root cause analysis"
                        value={formValues.rootCause}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, rootCause: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contributors">Contributing Factors</Label>
                      <Textarea
                        id="contributors"
                        rows={3}
                        placeholder="Processes, environment, controls that influenced the incident"
                        value={formValues.contributors}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, contributors: event.target.value }))}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">People & Evidence</h3>
                    <p className="text-sm text-gray-500">Record individuals involved and attach artefacts.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="people">People Involved</Label>
                      <Input
                        id="people"
                        placeholder="Search and add users"
                        value={formValues.people}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, people: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="witnesses">Witnesses</Label>
                      <Input
                        id="witnesses"
                        placeholder="Search and add witnesses"
                        value={formValues.witnesses}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, witnesses: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="equipment">Equipment / Systems Involved</Label>
                      <Textarea
                        id="equipment"
                        rows={3}
                        placeholder="List impacted systems or equipment"
                        value={formValues.equipment}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, equipment: event.target.value }))}
                      />
                    </div>
                    <div className="flex h-full flex-col justify-center rounded-lg border border-dashed border-red-200 bg-red-50/60 p-6 text-center text-sm text-red-700">
                      <Upload className="mx-auto h-8 w-8" />
                      <p className="mt-2 font-medium">Upload evidence, photos or documents</p>
                      <p className="text-xs">Supported formats: images, video, documents</p>
                    </div>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Notification & Escalation</h3>
                    <p className="text-sm text-gray-500">Configure communication flows for stakeholders.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="notification">Immediate Notification</Label>
                      <Input
                        id="notification"
                        placeholder="Select users or groups"
                        value={formValues.notification}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, notification: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="escalation">Escalation Path</Label>
                      <Input
                        id="escalation"
                        placeholder="Auto-populated from severity"
                        value={formValues.escalation}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, escalation: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="external">External Notifications</Label>
                      <Textarea
                        id="external"
                        rows={3}
                        placeholder="Regulators, customers, vendors"
                        value={formValues.external}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, external: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Public Disclosure Required</Label>
                      <Select
                        value={formValues.disclosure}
                        onValueChange={(value) => setFormValues((prev) => ({ ...prev, disclosure: value }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>

                <Separator />

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button variant="outline" className="border-red-200">Save as Draft</Button>
                  <Button className="bg-primary text-white" onClick={handleSubmit}>
                    Submit Incident
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
