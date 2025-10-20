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
import { Progress } from "@/components/ui/progress"
import { ClipboardList, AlertTriangle, CheckCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DEPARTMENT_OPTIONS, OTHER_DEPARTMENT_VALUE } from "@/constants/departments"

interface ActionRecord {
  id: string
  title: string
  type: string
  source: string
  department: string
  priority: "Low" | "Medium" | "High" | "Critical"
  status: "Open" | "In Progress" | "Completed"
  owner: string
  dueDate: string
  progress: number
}

const ACTION_TYPES = [
  "Immediate Action",
  "Short-term Corrective Action",
  "Long-term Corrective Action",
  "Preventive Action",
  "Improvement Action"
]

const PRIORITIES: ActionRecord["priority"][] = ["Low", "Medium", "High", "Critical"]

const SAMPLE_ACTIONS: ActionRecord[] = [
  {
    id: "CA-2025-011",
    title: "Update access control procedure",
    type: "Short-term Corrective Action",
    source: "Audit Finding",
    department: "IT Security",
    priority: "High",
    status: "In Progress",
    owner: "Jordan Smith",
    dueDate: "2025-03-18",
    progress: 60
  },
  {
    id: "CA-2025-009",
    title: "Implement supplier quality checks",
    type: "Long-term Corrective Action",
    source: "FMEA",
    department: "Operations",
    priority: "Critical",
    status: "Open",
    owner: "Maria Chen",
    dueDate: "2025-04-10",
    progress: 15
  },
  {
    id: "CA-2025-003",
    title: "Refresh compliance training content",
    type: "Improvement Action",
    source: "Management Review",
    department: "Compliance",
    priority: "Medium",
    status: "Completed",
    owner: "Alex Martinez",
    dueDate: "2025-02-28",
    progress: 100
  }
]

const INITIAL_FORM_VALUES = {
  title: "",
  actionType: "",
  source: "",
  reference: "",
  department: "",
  priority: "Medium" as ActionRecord["priority"],
  impact: "",
  urgency: "Medium",
  problem: "",
  rootCause: "",
  factors: "",
  actionPlan: "",
  dueDate: "",
  owner: "",
  reviewTeam: "",
  budget: "",
  approvalRequired: "No",
  approver: ""
}

export default function CorrectiveActionsPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "create">("dashboard")
  const [actions, setActions] = useState<ActionRecord[]>(SAMPLE_ACTIONS)
  const [formValues, setFormValues] = useState({ ...INITIAL_FORM_VALUES })
  const [departmentSelection, setDepartmentSelection] = useState<string>("")
  const [otherDepartment, setOtherDepartment] = useState<string>("")
  const [formError, setFormError] = useState<string | null>(null)

  const highPriorityActions = useMemo(() => actions.filter((action) => action.priority === "High" || action.priority === "Critical"), [actions])

  useEffect(() => {
    if (typeof window === "undefined") return
    const intent = new URLSearchParams(window.location.search).get("intent")
    if (intent === "create") {
      setActiveTab("create")
    }
  }, [])

  const resetForm = () => {
    setFormValues({ ...INITIAL_FORM_VALUES })
    setDepartmentSelection("")
    setOtherDepartment("")
  }

  const handleDepartmentSelect = (value: string) => {
    setDepartmentSelection(value)
    if (value === OTHER_DEPARTMENT_VALUE) {
      setOtherDepartment("")
      setFormValues((prev) => ({ ...prev, department: "" }))
    } else {
      setOtherDepartment("")
      setFormValues((prev) => ({ ...prev, department: value }))
      setFormError(null)
    }
  }

  const handleOtherDepartmentChange = (value: string) => {
    setOtherDepartment(value)
    setFormValues((prev) => ({ ...prev, department: value }))
  }

  const handleSubmit = () => {
    const trimmedTitle = formValues.title.trim()
    const trimmedActionType = formValues.actionType.trim()
    const trimmedDepartment = formValues.department.trim()

    if (!trimmedTitle || !trimmedActionType || !trimmedDepartment) {
      const messages = [
        !trimmedTitle ? "Provide an action title." : null,
        !trimmedActionType ? "Select an action type." : null,
        !trimmedDepartment ? "Choose a department or specify one under Other." : null
      ].filter((entry): entry is string => Boolean(entry))

      setFormError(messages.join(" "))
      setActiveTab("create")
      return
    }

    const now = new Date()
    const sequence = Math.floor(Math.random() * 900 + 100)
      .toString()
      .padStart(3, "0")

    const newAction: ActionRecord = {
      id: `CA-${now.getFullYear()}-${sequence}`,
      title: trimmedTitle,
      type: trimmedActionType,
      source: formValues.source.trim() || "Not specified",
      department: trimmedDepartment,
      priority: formValues.priority,
      status: "Open",
      owner: formValues.owner.trim() || "Unassigned",
      dueDate: formValues.dueDate || "TBD",
      progress: 0
    }

    setActions((prev) => [newAction, ...prev])
    setFormError(null)
    resetForm()
    setActiveTab("dashboard")
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Corrective Actions</h1>
          <p className="text-sm text-gray-600">
            Track remediation progress and effectiveness across the enterprise.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "dashboard" | "create")}
          className="space-y-6"
        >
          <TabsList className="bg-emerald-50/70">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="create">Create Action</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Total Actions", value: actions.length, icon: ClipboardList, tone: "text-primary" },
                { label: "Open Actions", value: actions.filter((action) => action.status !== "Completed").length, icon: AlertTriangle, tone: "text-orange-600" },
                { label: "Overdue Actions", value: actions.filter((action) => action.progress < 100 && new Date(action.dueDate) < new Date()).length, icon: AlertTriangle, tone: "text-red-600" },
                { label: "Completed This Month", value: actions.filter((action) => action.status === "Completed").length, icon: CheckCircle, tone: "text-emerald-600" }
              ].map((card) => (
                <Card key={card.label} className="border-emerald-100 shadow-sm">
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className={`flex items-center gap-2 text-sm font-medium ${card.tone}`}>
                      <card.icon className="h-4 w-4" />
                      {card.label}
                    </div>
                    <div className="text-2xl font-semibold text-gray-900">{card.value}</div>
                    <p className="text-xs text-gray-500">AI identifies stalled actions and effectiveness gaps.</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-emerald-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-primary">Priority Actions</CardTitle>
                <CardDescription>Focus on remediation items with the greatest risk impact.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-emerald-50/70 text-primary">
                    <TableRow className="uppercase text-xs tracking-wide">
                      <TableHead className="px-4">ID</TableHead>
                      <TableHead className="px-4">Title</TableHead>
                      <TableHead className="px-4">Type</TableHead>
                      <TableHead className="px-4">Source</TableHead>
                      <TableHead className="px-4">Priority</TableHead>
                      <TableHead className="px-4">Owner</TableHead>
                      <TableHead className="px-4">Due Date</TableHead>
                      <TableHead className="px-4">Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {highPriorityActions.map((action) => (
                      <TableRow key={action.id}>
                        <TableCell className="font-medium text-gray-900">{action.id}</TableCell>
                        <TableCell className="text-sm text-gray-700">{action.title}</TableCell>
                        <TableCell className="text-xs text-gray-500">{action.type}</TableCell>
                        <TableCell className="text-xs text-gray-500">{action.source}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              action.priority === "Critical"
                                ? "bg-red-100 text-red-700"
                                : action.priority === "High"
                                  ? "bg-orange-100 text-orange-700"
                                  : action.priority === "Medium"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"
                            }
                          >
                            {action.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">{action.owner}</TableCell>
                        <TableCell className="text-xs text-gray-500">{action.dueDate}</TableCell>
                        <TableCell className="w-48">
                          <Progress value={action.progress} className="h-2" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <Card className="border-emerald-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-primary">Create Corrective Action</CardTitle>
                <CardDescription>Document the remediation plan, ownership, and follow-up.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {formError && (
                  <Alert variant="destructive">
                    <AlertTitle>Missing required information</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Action Details</h3>
                    <p className="text-sm text-gray-500">Define the corrective or preventive action.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="title">Action Title</Label>
                      <Input
                        id="title"
                        placeholder="Describe the corrective action"
                        value={formValues.title}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, title: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Action Type</Label>
                      <Select value={formValues.actionType} onValueChange={(value) => setFormValues((prev) => ({ ...prev, actionType: value }))}>
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
                      <Label htmlFor="source">Source Reference</Label>
                      <Input
                        id="source"
                        placeholder="Incident, audit finding, risk assessment..."
                        value={formValues.source}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, source: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reference">Reference ID</Label>
                      <Input
                        id="reference"
                        placeholder="e.g., INC-2025-004"
                        value={formValues.reference}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, reference: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Select
                        value={departmentSelection || undefined}
                        onValueChange={handleDepartmentSelect}
                      >
                        <SelectTrigger id="department" className="w-full">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENT_OPTIONS.map((department) => (
                            <SelectItem key={department} value={department}>
                              {department}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {departmentSelection === OTHER_DEPARTMENT_VALUE && (
                        <Input
                          id="department-other"
                          placeholder="Enter department"
                          value={otherDepartment}
                          onChange={(event) => handleOtherDepartmentChange(event.target.value)}
                          className="mt-2"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={formValues.priority}
                        onValueChange={(value) => setFormValues((prev) => ({ ...prev, priority: value as ActionRecord["priority"] }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {priority}
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
                        onChange={(event) => setFormValues((prev) => ({ ...prev, problem: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="rootCause">Root Cause</Label>
                      <Textarea
                        id="rootCause"
                        rows={3}
                        placeholder="Document confirmed or suspected root cause"
                        value={formValues.rootCause}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, rootCause: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="factors">Contributing Factors</Label>
                      <Textarea
                        id="factors"
                        rows={3}
                        placeholder="Process, environmental or human factors"
                        value={formValues.factors}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, factors: event.target.value }))}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Action Plan</h3>
                    <p className="text-sm text-gray-500">Outline implementation steps and ownership.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="actionPlan">Corrective Action Description</Label>
                      <Textarea
                        id="actionPlan"
                        rows={4}
                        placeholder="Detail the tasks required to address the issue"
                        value={formValues.actionPlan}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, actionPlan: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Overall Due Date</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={formValues.dueDate}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, dueDate: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="owner">Action Owner</Label>
                      <Input
                        id="owner"
                        placeholder="Responsible person"
                        value={formValues.owner}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, owner: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reviewTeam">Review Team</Label>
                      <Input
                        id="reviewTeam"
                        placeholder="Approvers or reviewers"
                        value={formValues.reviewTeam}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, reviewTeam: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budget">Budget Required</Label>
                      <Input
                        id="budget"
                        placeholder="Optional budget estimate"
                        value={formValues.budget}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, budget: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Approval Required</Label>
                      <Select
                        value={formValues.approvalRequired}
                        onValueChange={(value) => setFormValues((prev) => ({ ...prev, approvalRequired: value }))}
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
                    <div className="space-y-2">
                      <Label htmlFor="approver">Approver</Label>
                      <Input
                        id="approver"
                        placeholder="Required if approval is needed"
                        value={formValues.approver}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, approver: event.target.value }))}
                        disabled={formValues.approvalRequired !== "Yes"}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button variant="outline" className="border-emerald-200">Save as Draft</Button>
                  <Button className="bg-primary text-white" onClick={handleSubmit}>
                    Create Action
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
