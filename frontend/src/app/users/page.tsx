"use client"

import { ChangeEvent, useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth-context"
import {
  authService,
  CreateUserPayload,
  UpdateUserPayload,
  User,
} from "@/lib/auth"
import {
  ROLE_PERMISSION_DEFAULT,
  USER_PERMISSION_OPTIONS,
} from "@/constants/users"
import {
  ClipboardList,
  Download,
  FileSpreadsheet,
  MessageSquare,
  MoreHorizontal,
  Power,
  RefreshCw,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Trash2,
  Upload,
  UserCog,
  UserPlus,
} from "lucide-react"

import {
  UserFormDialog,
  UserFormDialogMode,
  UserFormValues,
  mapFormValuesToCreatePayload,
  mapFormValuesToUpdatePayload,
} from "@/components/users/user-form-dialog"

const ROLE_ALIAS: Record<string, User["role"]> = {
  super_admin: "super_admin",
  "super admin": "super_admin",
  admin: "admin",
  manager: "manager",
  auditor: "auditor",
  reviewer: "auditor",
  employee: "employee",
  viewer: "viewer",
  reader: "viewer",
  editor: "manager",
}

type RoleFilterValue = "all" | "reader" | "editor" | "reviewer" | "admin" | "super_admin"

type StatusFilterValue = "all" | "active" | "inactive" | "pending"

const ROLE_FILTERS: Array<{ label: string; value: RoleFilterValue; roles: User["role"][] }> = [
  { label: "All Roles", value: "all", roles: [] },
  { label: "Reader", value: "reader", roles: ["viewer", "employee"] },
  { label: "Editor", value: "editor", roles: ["manager", "auditor"] },
  { label: "Reviewer", value: "reviewer", roles: ["auditor"] },
  { label: "Admin", value: "admin", roles: ["admin"] },
  { label: "Super Admin", value: "super_admin", roles: ["super_admin"] },
]

const STATUS_FILTERS: Array<{ label: string; value: StatusFilterValue }> = [
  { label: "All Status", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Pending", value: "pending" },
]

const PAGE_SIZE_OPTIONS = [10, 25, 50]

function getUserStatus(user: User): StatusFilterValue {
  if (!user.is_active) {
    return "inactive"
  }

  if (!user.is_verified) {
    return "pending"
  }

  return "active"
}

function getStatusBadgeClasses(status: StatusFilterValue) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "inactive":
      return "border-rose-200 bg-rose-50 text-rose-700"
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700"
    default:
      return "border-slate-200 bg-slate-50 text-slate-600"
  }
}

function formatDate(value?: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date)
}

function getPermissionLabel(value: User["permission_level"]) {
  return (
    USER_PERMISSION_OPTIONS.find((option) => option.value === value)?.label ??
    value.replace(/_/g, " ")
  )
}

function normalizePermissionLabel(value?: string): User["permission_level"] | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_")
  const match = USER_PERMISSION_OPTIONS.find((option) => option.value === normalized)
  if (match) {
    return match.value
  }

  switch (normalized) {
    case "view_only":
      return "view_only"
    case "link_access":
      return "link_access"
    case "edit_access":
    case "editor":
      return "edit_access"
    case "admin_access":
    case "administrator":
      return "admin_access"
    case "super_admin":
      return "super_admin"
    default:
      return "view_only"
  }
}

function normalizeRoleLabel(value?: string): User["role"] {
  if (!value) {
    return "employee"
  }

  const key = value.trim().toLowerCase().replace(/[-]+/g, " ")
  return ROLE_ALIAS[key] ?? "employee"
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function generateTemporaryPassword(seed?: string) {
  const prefix = seed ? seed.replace(/[^a-zA-Z]/g, "").slice(0, 3).toLowerCase() : "comp"
  const random = Math.random().toString(36).slice(-5)
  const suffix = Math.floor(100 + Math.random() * 900)
  return `${prefix}${random}!${suffix}`
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let current = ""
  let inQuotes = false
  const columns: string[] = []

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]

    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      columns.push(current.trim())
      current = ""
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current !== "" || columns.length > 0) {
        columns.push(current.trim())
        rows.push(columns.splice(0))
      }
      current = ""
    } else {
      current += char
    }
  }

  if (current !== "" || columns.length > 0) {
    columns.push(current.trim())
    rows.push(columns.splice(0))
  }

  return rows.filter((row) => row.some((cell) => cell.length > 0))
}

export default function UsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilterValue>("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all")
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0])
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [formMode, setFormMode] = useState<UserFormDialogMode>("create")
  const [formOpen, setFormOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [activeUser, setActiveUser] = useState<User | null>(null)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkImportLoading, setBulkImportLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [bulkSummary, setBulkSummary] = useState<string | null>(null)

  const canManageUsers =
    user?.role === "admin" || user?.role === "manager" || user?.role === "super_admin"

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await authService.getUsers()
        setUsers(data)
      } catch (fetchError: any) {
        setError(fetchError.response?.data?.detail || "Unable to load users")
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  useEffect(() => {
    setSelectedUserIds((previous) =>
      previous.filter((identifier) => users.some((record) => record.id === identifier))
    )
  }, [users])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, roleFilter, departmentFilter, statusFilter, pageSize])

  const departmentOptions = useMemo(() => {
    const departments = new Set<string>()
    users.forEach((record) => {
      if (record.department) {
        departments.add(record.department)
      }
    })
    return Array.from(departments).sort((a, b) => a.localeCompare(b))
  }, [users])

  const filteredUsers = useMemo(() => {
    return users.filter((record) => {
      const matchesSearch = search
        ? `${record.first_name} ${record.last_name} ${record.email}`
            .toLowerCase()
            .includes(search.toLowerCase())
        : true

      const matchesRole =
        roleFilter === "all"
          ? true
          : ROLE_FILTERS.find((option) => option.value === roleFilter)?.roles.includes(record.role) ?? true

      const matchesDepartment =
        departmentFilter === "all" ? true : (record.department ?? "").toLowerCase() === departmentFilter.toLowerCase()

      const matchesStatus = statusFilter === "all" ? true : getUserStatus(record) === statusFilter

      return matchesSearch && matchesRole && matchesDepartment && matchesStatus
    })
  }, [users, search, roleFilter, departmentFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, currentPage, pageSize])

  const isAllOnPageSelected =
    paginatedUsers.length > 0 &&
    paginatedUsers.every((record) => selectedUserIds.includes(record.id))

  const aiInsights = useMemo(() => {
    const misaligned = filteredUsers.filter(
      (record) => ROLE_PERMISSION_DEFAULT[record.role] !== record.permission_level
    )
    const inactive = filteredUsers.filter((record) => !record.is_active)
    const pending = filteredUsers.filter((record) => record.is_active && !record.is_verified)
    const viewOnlyCount = filteredUsers.filter((record) => record.permission_level === "view_only").length
    const ratio = filteredUsers.length ? Math.round((viewOnlyCount / filteredUsers.length) * 100) : 0

    return {
      misaligned,
      inactive,
      pending,
      ratio,
    }
  }, [filteredUsers])

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      const pageIds = paginatedUsers.map((record) => record.id)
      setSelectedUserIds((previous) => Array.from(new Set([...previous, ...pageIds])))
    } else {
      const pageIds = new Set(paginatedUsers.map((record) => record.id))
      setSelectedUserIds((previous) => previous.filter((identifier) => !pageIds.has(identifier)))
    }
  }

  const handleToggleUser = (identifier: number) => {
    setSelectedUserIds((previous) =>
      previous.includes(identifier)
        ? previous.filter((id) => id !== identifier)
        : [...previous, identifier]
    )
  }

  const handleOpenCreate = () => {
    setFormMode("create")
    setActiveUser(null)
    setFormOpen(true)
  }

  const handleOpenEdit = (record: User) => {
    setFormMode("edit")
    setActiveUser(record)
    setFormOpen(true)
  }

  const handleCreateUser = async (values: UserFormValues) => {
    try {
      setFormLoading(true)
      const payload: CreateUserPayload = mapFormValuesToCreatePayload(values)
      const created = await authService.createUser(payload)
      setUsers((previous) => [created, ...previous])
      setFeedback({
        type: "success",
        message: `Created user ${created.first_name} ${created.last_name}.`,
      })
      setFormOpen(false)
    } catch (submitError: any) {
      setFeedback({
        type: "error",
        message: submitError.response?.data?.detail || "Unable to create user.",
      })
    } finally {
      setFormLoading(false)
    }
  }

  const handleUpdateUser = async (values: UserFormValues) => {
    if (!activeUser) return

    try {
      setFormLoading(true)
      const payload: UpdateUserPayload = mapFormValuesToUpdatePayload(values)
      const updated = await authService.updateUser(activeUser.id, payload)
      setUsers((previous) =>
        previous.map((record) => (record.id === updated.id ? { ...record, ...updated } : record))
      )
      setFeedback({
        type: "success",
        message: `Updated permissions for ${updated.first_name} ${updated.last_name}.`,
      })
      setFormOpen(false)
    } catch (submitError: any) {
      setFeedback({
        type: "error",
        message: submitError.response?.data?.detail || "Unable to update user.",
      })
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeactivateUser = async (record: User, isActive: boolean) => {
    try {
      const updated = await authService.updateUser(record.id, { is_active: isActive })
      setUsers((previous) =>
        previous.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
      )
      setFeedback({
        type: "success",
        message: `${updated.first_name} ${updated.last_name} is now ${updated.is_active ? "active" : "inactive"}.`,
      })
    } catch (updateError: any) {
      setFeedback({
        type: "error",
        message: updateError.response?.data?.detail || "Unable to update user status.",
      })
    }
  }

  const handleResetPassword = async (record: User) => {
    const temporaryPassword = generateTemporaryPassword(record.first_name)
    try {
      await authService.updateUser(record.id, { password: temporaryPassword })
      setFeedback({
        type: "success",
        message: `Temporary password for ${record.first_name} ${record.last_name}: ${temporaryPassword}`,
      })
    } catch (resetError: any) {
      setFeedback({
        type: "error",
        message: resetError.response?.data?.detail || "Unable to reset password.",
      })
    }
  }

  const handleBulkStatusChange = async (active: boolean) => {
    if (!selectedUserIds.length) return

    try {
      setBulkActionLoading(true)
      const updates = await Promise.all(
        selectedUserIds.map((identifier) => authService.updateUser(identifier, { is_active: active }))
      )
      const lookup = new Map(updates.map((item) => [item.id, item]))
      setUsers((previous) => previous.map((record) => lookup.get(record.id) ?? record))
      setSelectedUserIds([])
      setFeedback({
        type: "success",
        message: active
          ? "Activated selected users."
          : "Deactivated selected users.",
      })
    } catch (bulkError: any) {
      setFeedback({
        type: "error",
        message: bulkError.response?.data?.detail || "Unable to update selected users.",
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleExportUsers = () => {
    const header = [
      "First Name",
      "Last Name",
      "Email",
      "Username",
      "Role",
      "Permission Level",
      "Status",
      "Last Login",
      "Created Date",
    ]

    const rows = filteredUsers.map((record) => [
      record.first_name,
      record.last_name,
      record.email,
      record.username,
      record.role,
      getPermissionLabel(record.permission_level),
      getUserStatus(record),
      formatDate(record.last_login),
      formatDate(record.created_at),
    ])

    const csv = [header, ...rows]
      .map((columns) => columns.map((column) => escapeCsv(String(column ?? ""))).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `comply-users-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
    setFeedback({ type: "success", message: "Exported filtered user list." })
  }

  const handleBulkFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setBulkFile(file ?? null)
    setBulkSummary(null)
  }

  const handleBulkImport = async () => {
    if (!bulkFile) return

    setBulkImportLoading(true)
    setBulkSummary(null)

    try {
      const content = await bulkFile.text()
      const rows = parseCsv(content)
      if (!rows.length) {
        setBulkSummary("No rows detected in the uploaded file.")
        return
      }

      const [header, ...records] = rows
      if (header.length < 4) {
        setBulkSummary("The template must include at least first name, last name, email, and username columns.")
        return
      }

      const successes: string[] = []
      const failures: string[] = []
      const createdUsers: User[] = []

      for (const row of records) {
        if (!row.length) continue
        const [firstName, lastName, email, username, role, permission, password, status] = row
        if (!email) {
          failures.push(`Skipped row for ${firstName || "Unknown"} ${lastName || "User"} (missing email).`)
          continue
        }

        const normalizedRole = normalizeRoleLabel(role)
        const normalizedPermission = normalizePermissionLabel(permission)
        const derivedPermission = normalizedPermission || ROLE_PERMISSION_DEFAULT[normalizedRole]
        const isActive = status ? status.toLowerCase() !== "inactive" : true
        const payload: CreateUserPayload = {
          email,
          username: username || email,
          first_name: firstName || "New",
          last_name: lastName || "User",
          password: password || generateTemporaryPassword(firstName || "user"),
          role: normalizedRole,
          permission_level: derivedPermission,
          is_active: isActive,
        }

        try {
          const created = await authService.createUser(payload)
          successes.push(`${created.first_name} ${created.last_name}`)
          createdUsers.push(created)
        } catch (creationError: any) {
          failures.push(
            `Failed to import ${firstName || email}: ${creationError.response?.data?.detail || creationError.message}`
          )
        }
      }

      if (createdUsers.length) {
        setUsers((previous) => [...createdUsers, ...previous])
      }

      setBulkSummary(
        `${successes.length} user(s) imported. ${failures.length ? failures.join("\n") : "All records processed successfully."}`
      )
    } catch (fileError: any) {
      setBulkSummary(fileError.message || "Unable to process the uploaded file.")
    } finally {
      setBulkImportLoading(false)
    }
  }

  const handlePageChange = (direction: "next" | "previous") => {
    setCurrentPage((previous) => {
      if (direction === "next") {
        return Math.min(totalPages, previous + 1)
      }
      return Math.max(1, previous - 1)
    })
  }

  const renderStatusBadge = (record: User) => {
    const status = getUserStatus(record)
    return (
      <Badge className={`${getStatusBadgeClasses(status)} border`} variant="outline">
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-600">Administer platform users, roles, and access levels.</p>
        </div>

        {!canManageUsers && (
          <Card className="border-yellow-200 bg-yellow-50 text-yellow-900">
            <CardContent className="flex items-center gap-3 p-4">
              <ShieldCheck className="h-5 w-5" />
              <p className="text-sm">Only administrators and managers can modify user accounts.</p>
            </CardContent>
          </Card>
        )}

        <Card className="border-primary/10 bg-primary/5 shadow-sm">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" /> Intelligent Governance Insights
              </CardTitle>
              <CardDescription>Automated signals to keep access aligned with policy.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-primary/20 bg-white/70 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-primary">Permission Alignment</p>
              <p className="mt-2 text-sm text-gray-600">
                {aiInsights.misaligned.length > 0
                  ? `${aiInsights.misaligned.length} user(s) have permissions that differ from the recommended baseline.`
                  : "All user permissions match recommended defaults."}
              </p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-white/70 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-primary">Account Health</p>
              <p className="mt-2 text-sm text-gray-600">
                {aiInsights.inactive.length}
                {" "}
                inactive and {aiInsights.pending.length} pending verification account(s) detected automatically.
              </p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-white/70 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-primary">View-Only Ratio</p>
              <p className="mt-2 text-sm text-gray-600">
                {aiInsights.ratio}% of filtered users are limited to view-only access.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <UserPlus className="h-5 w-5" /> Directory
            </CardTitle>
            <CardDescription>Search and filter across departments and permission levels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleOpenCreate}
                  disabled={!canManageUsers}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  <UserPlus className="mr-2 h-4 w-4" /> Add User
                </Button>
                <Button
                  onClick={() => setBulkDialogOpen(true)}
                  disabled={!canManageUsers}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Upload className="mr-2 h-4 w-4" /> Bulk Import
                </Button>
                <Button
                  onClick={handleExportUsers}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                >
                  <Download className="mr-2 h-4 w-4" /> Export Users
                </Button>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Input
                  placeholder="Search name, email, or department"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="md:w-64"
                />
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilterValue)}>
                  <SelectTrigger className="w-full md:w-44">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_FILTERS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={(value) => setDepartmentFilter(value)}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departmentOptions.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilterValue)}>
                  <SelectTrigger className="w-full md:w-36">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {feedback && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  feedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {feedback.message}
              </div>
            )}

            {error ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
            ) : null}

            {selectedUserIds.length > 0 && (
              <div className="flex flex-col gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-primary">
                  {selectedUserIds.length} user(s) selected
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulkActionLoading}
                    onClick={() => handleBulkStatusChange(true)}
                  >
                    Activate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulkActionLoading}
                    onClick={() => handleBulkStatusChange(false)}
                  >
                    Deactivate
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUserIds([])}>
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-sm text-gray-500">Loading users...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow className="text-xs uppercase tracking-wide text-gray-600">
                      <TableHead className="w-12 px-4">
                        <input
                          type="checkbox"
                          checked={isAllOnPageSelected}
                          onChange={(event) => handleToggleAll(event.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </TableHead>
                      <TableHead className="px-4">User</TableHead>
                      <TableHead className="px-4">Email</TableHead>
                      <TableHead className="px-4">Department</TableHead>
                      <TableHead className="px-4">Role</TableHead>
                      <TableHead className="px-4">Permission Level</TableHead>
                      <TableHead className="px-4">Status</TableHead>
                      <TableHead className="px-4">Last Login</TableHead>
                      <TableHead className="px-4">Created</TableHead>
                      <TableHead className="px-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((record) => (
                      <TableRow key={record.id} className={!record.is_active ? "bg-slate-50" : undefined}>
                        <TableCell className="px-4">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(record.id)}
                            onChange={() => handleToggleUser(record.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              {record.avatar_url ? (
                                <AvatarImage src={record.avatar_url} alt={`${record.first_name} ${record.last_name}`} />
                              ) : null}
                              <AvatarFallback>
                                {(record.first_name?.[0] || "U").toUpperCase()}
                                {(record.last_name?.[0] || "").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-gray-900">
                                {record.first_name} {record.last_name}
                              </p>
                              <p className="text-xs text-gray-500">{record.position || "—"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 text-sm text-gray-600">{record.email}</TableCell>
                        <TableCell className="px-4 text-sm text-gray-600">{record.department || "—"}</TableCell>
                        <TableCell className="px-4 text-xs font-semibold uppercase text-gray-500">
                          {record.role.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="px-4 text-xs text-gray-600">
                          <Badge
                            variant="outline"
                            className={`border-primary/20 text-primary ${
                              ROLE_PERMISSION_DEFAULT[record.role] !== record.permission_level
                                ? "bg-amber-50"
                                : ""
                            }`}
                          >
                            {getPermissionLabel(record.permission_level)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 text-xs text-gray-500">{renderStatusBadge(record)}</TableCell>
                        <TableCell className="px-4 text-xs text-gray-500">{formatDate(record.last_login)}</TableCell>
                        <TableCell className="px-4 text-xs text-gray-500">{formatDate(record.created_at)}</TableCell>
                        <TableCell className="px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleOpenEdit(record)}>
                                <UserCog className="h-4 w-4" /> Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResetPassword(record)}>
                                <RefreshCw className="h-4 w-4" /> Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenEdit(record)}>
                                <ShieldQuestion className="h-4 w-4" /> Change Role
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled>
                                <ClipboardList className="h-4 w-4" /> View Activity
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled>
                                <MessageSquare className="h-4 w-4" /> Send Message
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDeactivateUser(record, !record.is_active)}>
                                <Power className="h-4 w-4" />
                                {record.is_active ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled>
                                <Trash2 className="h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!paginatedUsers.length && !loading && (
                      <TableRow>
                        <TableCell colSpan={10} className="py-6 text-center text-sm text-gray-500">
                          No users matched your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex flex-col items-center justify-between gap-3 border-t pt-4 text-sm text-gray-600 sm:flex-row">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange("previous")}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange("next")}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <UserFormDialog
        mode={formMode}
        open={formOpen}
        initialUser={activeUser}
        submitting={formLoading}
        onOpenChange={setFormOpen}
        onSubmit={formMode === "create" ? handleCreateUser : handleUpdateUser}
      />

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Import Users</DialogTitle>
            <DialogDescription>
              Upload a CSV export using the provided template. Columns: First Name, Last Name, Email, Username, Role,
              Permission Level, Password, Status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-dashed border-primary/20 p-4">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleBulkFileChange}
                className="w-full text-sm"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Need a template? Export the current list first or download{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => {
                    const header = [
                      "First Name",
                      "Last Name",
                      "Email",
                      "Username",
                      "Role",
                      "Permission Level",
                      "Password",
                      "Status",
                    ]
                    const blob = new Blob([header.join(",") + "\n"], { type: "text/csv;charset=utf-8;" })
                    const link = document.createElement("a")
                    link.href = URL.createObjectURL(blob)
                    link.download = "user-import-template.csv"
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    URL.revokeObjectURL(link.href)
                  }}
                >
                  the starter template
                </button>
                .
              </p>
            </div>
            {bulkSummary && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-line">
                {bulkSummary}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkImport} disabled={!bulkFile || bulkImportLoading}>
              {bulkImportLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Importing
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Users
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
