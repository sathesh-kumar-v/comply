"use client"

import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Sparkles } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  ROLE_PERMISSION_DEFAULT,
  TIMEZONE_OPTIONS,
  USER_PERMISSION_OPTIONS,
  USER_ROLE_OPTIONS,
} from "@/constants/users"
import { CreateUserPayload, UpdateUserPayload, User } from "@/lib/auth"

const ROLE_VALUES = USER_ROLE_OPTIONS.map((option) => option.value) as [User["role"], ...User["role"][]]
const PERMISSION_VALUES = USER_PERMISSION_OPTIONS.map((option) => option.value) as [
  User["permission_level"],
  ...User["permission_level"][],
]

/** Single, stable form schema (password optional in the base type) */
const baseSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(50, "Max length is 50 characters"),
  last_name: z.string().min(1, "Last name is required").max(50, "Max length is 50 characters"),
  email: z.string().email("Enter a valid email address"),
  username: z.string().min(3, "Username must have at least 3 characters"),
  phone: z.string().optional(),
  position: z.string().optional(),
  role: z.enum(ROLE_VALUES),
  permission_level: z.enum(PERMISSION_VALUES),
  timezone: z.string().min(1, "Timezone is required"),
  // defaults ensure parsed output is boolean (never undefined)
  notifications_email: z.boolean().default(true),
  notifications_sms: z.boolean().default(false),
  is_active: z.boolean().default(true),
  password: z.string().optional(),
})

/** Create-mode validation: same output type as base, but enforces password rule */
const createModeSchema = baseSchema.superRefine((val, ctx) => {
  const pwd = val.password ?? ""
  if (pwd.length < 8) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["password"],
      message: "Password must contain at least 8 characters",
    })
  }
})

export type UserFormValues = z.infer<typeof baseSchema>

export type UserFormDialogMode = "create" | "edit"

interface UserFormDialogProps {
  mode: UserFormDialogMode
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: UserFormValues) => Promise<void>
  initialUser?: User | null
  submitting?: boolean
}

export function UserFormDialog({
  mode,
  open,
  onOpenChange,
  onSubmit,
  initialUser,
  submitting = false,
}: UserFormDialogProps) {
  // Pick the schema by mode, but keep a single stable output type
  const schema = useMemo(() => (mode === "create" ? createModeSchema : baseSchema), [mode])

  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      username: "",
      phone: "",
      position: "",
      role: "employee",
      permission_level: ROLE_PERMISSION_DEFAULT.employee,
      timezone: "UTC",
      notifications_email: true,
      notifications_sms: false,
      is_active: true,
      password: "",
    },
  })

  const { watch, reset, formState, handleSubmit } = form

  const selectedRole = watch("role")
  const recommendedPermission = ROLE_PERMISSION_DEFAULT[selectedRole]

  useEffect(() => {
    if (!open) return

    if (mode === "edit" && initialUser) {
      reset({
        first_name: initialUser.first_name,
        last_name: initialUser.last_name,
        email: initialUser.email,
        username: initialUser.username,
        phone: initialUser.phone ?? "",
        position: initialUser.position ?? "",
        role: initialUser.role,
        permission_level: initialUser.permission_level,
        timezone: initialUser.timezone ?? "UTC",
        notifications_email: initialUser.notifications_email ?? true,
        notifications_sms: initialUser.notifications_sms ?? false,
        is_active: initialUser.is_active,
        password: "",
      })
    } else {
      reset({
        first_name: "",
        last_name: "",
        email: "",
        username: "",
        phone: "",
        position: "",
        role: "employee",
        permission_level: ROLE_PERMISSION_DEFAULT.employee,
        timezone: "UTC",
        notifications_email: true,
        notifications_sms: false,
        is_active: true,
        password: "",
      })
    }
  }, [initialUser, mode, open, reset])

  const permissionDirty = formState.dirtyFields.permission_level

  useEffect(() => {
    if (!permissionDirty) {
      form.setValue("permission_level", recommendedPermission, { shouldValidate: true })
    }
  }, [recommendedPermission, permissionDirty, form])

  const permissionLabel = useMemo(() => {
    const option = USER_PERMISSION_OPTIONS.find((item) => item.value === recommendedPermission)
    return option?.label ?? recommendedPermission
  }, [recommendedPermission])

  const handleFormSubmit = async (values: UserFormValues) => {
    await onSubmit(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add User" : "Edit User"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new account, assign the right role, and configure secure defaults."
              : "Update profile information, adjust permissions, and keep access aligned with responsibilities."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="jane.doe@company.com" disabled={mode === "edit"} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="janedoe" disabled={mode === "edit"} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 555 123 4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Compliance Manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4 rounded-lg border border-primary/10 bg-primary/5 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-primary">AI-Driven Recommendation</p>
                    <p className="text-xs text-primary/80">
                      Based on the selected role we recommend {permissionLabel} permissions to balance productivity and risk.
                    </p>
                  </div>
                </div>
                <Badge className="bg-primary/90 text-white" variant="secondary">
                  Recommended: {permissionLabel}
                </Badge>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {USER_ROLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex flex-col">
                              <span className="font-medium">{option.label}</span>
                              <span className="text-xs text-muted-foreground">{option.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Select the role that defines the user's responsibilities.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="permission_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permission Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select access level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {USER_PERMISSION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex flex-col">
                              <span className="font-medium">{option.label}</span>
                              <span className="text-xs text-muted-foreground">{option.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Override the recommended access level when required.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Account Status</FormLabel>
                      <FormDescription>Disable to revoke access without deleting the account.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notifications_email"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Email Notifications</FormLabel>
                      <FormDescription>Send alerts and workflow updates by email.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notifications_sms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>SMS Notifications</FormLabel>
                      <FormDescription>Send high-priority alerts via SMS.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {mode === "create" && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temporary Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Generate a secure password" {...field} />
                      </FormControl>
                      <FormDescription>
                        Share the temporary password securely. The user will be prompted to update it on first login.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {mode === "edit" && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reset Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Leave blank to keep current password" {...field} />
                      </FormControl>
                      <FormDescription>Provide a new password to force a credential reset.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </section>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary text-white" disabled={submitting || formState.isSubmitting}>
                {submitting || formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : mode === "create" ? (
                  "Create User"
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function mapFormValuesToCreatePayload(values: UserFormValues): CreateUserPayload {
  return {
    email: values.email,
    username: values.username,
    first_name: values.first_name,
    last_name: values.last_name,
    password: values.password ?? "",
    role: values.role,
    permission_level: values.permission_level,
    phone: values.phone || undefined,
    position: values.position || undefined,
    timezone: values.timezone,
    notifications_email: values.notifications_email,
    notifications_sms: values.notifications_sms,
    is_active: values.is_active,
  }
}

export function mapFormValuesToUpdatePayload(values: UserFormValues): UpdateUserPayload {
  const payload: UpdateUserPayload = {
    first_name: values.first_name,
    last_name: values.last_name,
    phone: values.phone || undefined,
    position: values.position || undefined,
    role: values.role,
    permission_level: values.permission_level,
    timezone: values.timezone,
    notifications_email: values.notifications_email,
    notifications_sms: values.notifications_sms,
    is_active: values.is_active,
  }

  if (values.password) {
    payload.password = values.password
  }

  return payload
}
