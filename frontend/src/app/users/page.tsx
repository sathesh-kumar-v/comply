"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { User as UserIcon, ShieldCheck } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { authService, User } from "@/lib/auth"

const ROLE_FILTERS: Array<{ label: string; value: User["role"] | "all" }> = [
  { label: "All Roles", value: "all" },
  { label: "Super Admin", value: "super_admin" },
  { label: "Admin", value: "admin" },
  { label: "Manager", value: "manager" },
  { label: "Auditor", value: "auditor" },
  { label: "Employee", value: "employee" },
  { label: "Viewer", value: "viewer" }
]

export default function UsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<User["role"] | "all">("all")

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

  const filteredUsers = useMemo(() => {
    return users.filter((record) => {
      const matchesSearch = search
        ? `${record.first_name} ${record.last_name} ${record.email}`.toLowerCase().includes(search.toLowerCase())
        : true
      const matchesRole = roleFilter === "all" ? true : record.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  const canManageUsers = user?.role === "admin" || user?.role === "manager" || user?.role === "super_admin"

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

        <Card className="border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-primary">Directory</CardTitle>
            <CardDescription>Search and filter across departments and permission levels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-center gap-3">
                <Input
                  placeholder="Search name or email"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full md:max-w-sm"
                />
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as typeof roleFilter)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_FILTERS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button disabled={!canManageUsers} className="bg-primary text-white">
                Add User
              </Button>
            </div>

            <Separator />

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
            ) : null}

            {loading ? (
              <div className="text-sm text-gray-500">Loading users...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow className="uppercase text-xs tracking-wide text-gray-600">
                      <TableHead className="px-4">Name</TableHead>
                      <TableHead className="px-4">Email</TableHead>
                      <TableHead className="px-4">Department</TableHead>
                      <TableHead className="px-4">Role</TableHead>
                      <TableHead className="px-4">Permission Level</TableHead>
                      <TableHead className="px-4">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="flex items-center gap-2 px-4 py-3">
                          <UserIcon className="h-4 w-4 text-primary" />
                          <span className="font-medium text-gray-900">
                            {record.first_name} {record.last_name}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 text-sm text-gray-600">{record.email}</TableCell>
                        <TableCell className="px-4 text-sm text-gray-600">{record.department || '—'}</TableCell>
                        <TableCell className="px-4 text-xs uppercase text-gray-500">{record.role}</TableCell>
                        <TableCell className="px-4 text-xs text-gray-600">
                          <Badge variant="outline" className="border-primary/20 text-primary">
                            {record.permission_level.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 text-xs text-gray-500">
                          {record.is_active ? 'Active' : 'Inactive'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
