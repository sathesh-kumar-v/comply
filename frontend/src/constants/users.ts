import { User } from "@/lib/auth"

export const USER_ROLE_OPTIONS: Array<{
  value: User["role"]
  label: string
  description: string
}> = [
  { value: "super_admin", label: "Super Admin", description: "Full platform access including security controls." },
  { value: "admin", label: "Admin", description: "Manage teams, permissions, and configuration." },
  { value: "manager", label: "Manager", description: "Coordinate reviews and edit operational data." },
  { value: "auditor", label: "Auditor", description: "Review compliance records and audits." },
  { value: "employee", label: "Employee", description: "Collaborate on documents and tasks." },
  { value: "viewer", label: "Viewer", description: "Read-only access to assigned content." },
]

export const USER_PERMISSION_OPTIONS: Array<{
  value: User["permission_level"]
  label: string
  description: string
}> = [
  { value: "view_only", label: "View Only", description: "Read access to assigned areas." },
  { value: "link_access", label: "Link Access", description: "Share secure links with external users." },
  { value: "edit_access", label: "Edit Access", description: "Create and update content within departments." },
  { value: "admin_access", label: "Admin Access", description: "Manage workflows, approvals, and assignments." },
  { value: "super_admin", label: "Super Admin", description: "Full system configuration and security controls." },
]

export const ROLE_PERMISSION_DEFAULT: Record<User["role"], User["permission_level"]> = {
  super_admin: "super_admin",
  admin: "admin_access",
  manager: "edit_access",
  auditor: "edit_access",
  employee: "view_only",
  viewer: "view_only",
}

export const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern (US/Eastern)" },
  { value: "America/Chicago", label: "Central (US/Central)" },
  { value: "America/Denver", label: "Mountain (US/Mountain)" },
  { value: "America/Los_Angeles", label: "Pacific (US/Pacific)" },
  { value: "Europe/London", label: "GMT (Europe/London)" },
  { value: "Europe/Berlin", label: "CET (Europe/Berlin)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Kolkata", label: "India (IST)" },
]

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
]
