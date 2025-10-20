"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Eye, EyeOff, Loader2, ChevronRight, ChevronLeft, Check, User, Lock, Building, Shield, Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'

const registerSchema = z.object({
  // Step 1: Personal Information
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  
  // Step 2: Account Credentials
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
  
  // Step 3: Professional Information
  company: z.string().min(1, 'Company/Organization is required'),
  department: z.string().min(1, 'Department is required'),
  position: z.string().min(1, 'Position is required'),
  employee_id: z.string().optional(),
  
  // Step 4: Compliance Role & Permissions
  role: z.enum(['admin', 'manager', 'auditor', 'employee', 'viewer']),
  areas_of_responsibility: z.array(z.string()).min(1, 'Select at least one area'),
  reporting_manager: z.string().optional(),
  
  // Step 5: Additional Settings
  timezone: z.string().min(1, 'Timezone is required'),
  notifications_email: z.boolean(),
  notifications_sms: z.boolean(),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
})

type RegisterFormData = z.infer<typeof registerSchema>

interface RegisterFormProps {
  onToggle?: () => void
  onSuccess?: () => void
}

const WIZARD_STEPS = [
  { id: 1, title: 'Personal Information', icon: User, description: 'Basic personal details' },
  { id: 2, title: 'Account Credentials', icon: Lock, description: 'Username and password' },
  { id: 3, title: 'Professional Information', icon: Building, description: 'Company and role details' },
  { id: 4, title: 'Compliance Role', icon: Shield, description: 'Permissions and responsibilities' },
  { id: 5, title: 'Preferences', icon: Settings, description: 'Notifications and settings' },
]

const COMPLIANCE_AREAS = [
  'Document Management',
  'Risk Assessment',
  'Audit Management',
  'Incident Management',
  'Policy Management',
  'Training & Certification',
  'Regulatory Compliance',
  'Quality Management'
]

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'GMT' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
]

export function RegisterForm({ onToggle, onSuccess }: RegisterFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const { register: registerUser } = useAuth()

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'employee',
      areas_of_responsibility: [],
      notifications_email: true as boolean,
      notifications_sms: false as boolean,
      timezone: 'America/New_York',
    },
  })

  const totalSteps = WIZARD_STEPS.length
  const progressPercentage = (currentStep / totalSteps) * 100

  const nextStep = async () => {
    const fieldsToValidate = getStepFields(currentStep)
    const isValid = await trigger(fieldsToValidate)
    if (isValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const getStepFields = (step: number) => {
    switch (step) {
      case 1:
        return ['first_name', 'last_name', 'email', 'phone'] as (keyof RegisterFormData)[]
      case 2:
        return ['username', 'password', 'confirm_password'] as (keyof RegisterFormData)[]
      case 3:
        return ['company', 'department', 'position'] as (keyof RegisterFormData)[]
      case 4:
        return ['role', 'areas_of_responsibility'] as (keyof RegisterFormData)[]
      case 5:
        return ['timezone'] as (keyof RegisterFormData)[]
      default:
        return []
    }
  }

  const handleAreaToggle = (area: string) => {
    const newAreas = selectedAreas.includes(area)
      ? selectedAreas.filter(a => a !== area)
      : [...selectedAreas, area]
    
    setSelectedAreas(newAreas)
    setValue('areas_of_responsibility', newAreas)
  }

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setError('')
      const { confirm_password, ...userData } = data
      await registerUser(userData)
      setSuccess(true)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-primary">Registration Successful!</h3>
              <p className="text-gray-600 mt-2">Your account has been created and is pending approval.</p>
            </div>
            {onToggle && (
              <Button onClick={onToggle} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Sign In
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  type="text"
                  // placeholder="John"
                  {...register('first_name')}
                  className={errors.first_name ? 'border-red-500' : ''}
                />
                {errors.first_name && (
                  <p className="text-sm text-red-500">{errors.first_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  type="text"
                  // placeholder="Doe"
                  {...register('last_name')}
                  className={errors.last_name ? 'border-red-500' : ''}
                />
                {errors.last_name && (
                  <p className="text-sm text-red-500">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                // placeholder="john.doe@example.com"
                {...register('email')}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                // placeholder="+1 (555) 123-4567"
                {...register('phone')}
                className={errors.phone ? 'border-red-500' : ''}
              />
              {errors.phone && (
                <p className="text-sm text-red-500">{errors.phone.message}</p>
              )}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                type="text"
                // placeholder="johndoe"
                {...register('username')}
                className={errors.username ? 'border-red-500' : ''}
              />
              {errors.username && (
                <p className="text-sm text-red-500">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  {...register('password')}
                  className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password *</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  {...register('confirm_password')}
                  className={errors.confirm_password ? 'border-red-500 pr-10' : 'pr-10'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.confirm_password && (
                <p className="text-sm text-red-500">{errors.confirm_password.message}</p>
              )}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company/Organization *</Label>
              <Input
                id="company"
                type="text"
                placeholder="Acme Corporation"
                {...register('company')}
                className={errors.company ? 'border-red-500' : ''}
              />
              {errors.company && (
                <p className="text-sm text-red-500">{errors.company.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Input
                  id="department"
                  type="text"
                  placeholder="IT"
                  {...register('department')}
                  className={errors.department ? 'border-red-500' : ''}
                />
                {errors.department && (
                  <p className="text-sm text-red-500">{errors.department.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Position *</Label>
                <Input
                  id="position"
                  type="text"
                  placeholder="Software Engineer"
                  {...register('position')}
                  className={errors.position ? 'border-red-500' : ''}
                />
                {errors.position && (
                  <p className="text-sm text-red-500">{errors.position.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_id">Employee ID (Optional)</Label>
              <Input
                id="employee_id"
                type="text"
                placeholder="EMP001"
                {...register('employee_id')}
              />
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">Primary Role *</Label>
              <Select
                onValueChange={(value) => setValue('role', value as any)}
                defaultValue="employee"
              >
                <SelectTrigger className={errors.role ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select your primary role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="auditor">Auditor</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-red-500">{errors.role.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Areas of Responsibility *</Label>
              <div className="grid grid-cols-2 gap-2">
                {COMPLIANCE_AREAS.map((area) => (
                  <Button
                    key={area}
                    type="button"
                    variant={selectedAreas.includes(area) ? "default" : "outline"}
                    size="sm"
                    className="justify-start text-left"
                    onClick={() => handleAreaToggle(area)}
                  >
                    {area}
                  </Button>
                ))}
              </div>
              {errors.areas_of_responsibility && (
                <p className="text-sm text-red-500">{errors.areas_of_responsibility.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reporting_manager">Reporting Manager (Optional)</Label>
              <Input
                id="reporting_manager"
                type="text"
                placeholder="jane.smith@example.com"
                {...register('reporting_manager')}
              />
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Time Zone *</Label>
              <Select
                onValueChange={(value) => setValue('timezone', value)}
                defaultValue="America/New_York"
              >
                <SelectTrigger className={errors.timezone ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select your timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.timezone && (
                <p className="text-sm text-red-500">{errors.timezone.message}</p>
              )}
            </div>

            <div className="space-y-3">
              <Label>Notification Preferences</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="notifications_email"
                    {...register('notifications_email')}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="notifications_email" className="text-sm">
                    Receive email notifications
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="notifications_sms"
                    {...register('notifications_sms')}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="notifications_sms" className="text-sm">
                    Receive SMS notifications
                  </Label>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle className="text-2xl">Create Your Account</CardTitle>
            <p className="text-gray-600 mt-1">
              Step {currentStep} of {totalSteps}: {WIZARD_STEPS[currentStep - 1].description}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {WIZARD_STEPS.map((step) => {
              const StepIcon = step.icon
              return (
                <div
                  key={step.id}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    step.id === currentStep
                      ? 'bg-primary text-primary-foreground'
                      : step.id < currentStep
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step.id < currentStep ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <StepIcon className="w-4 h-4" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <Progress value={progressPercentage} className="w-full" />
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {renderStep()}

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/10 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={previousStep}
              disabled={currentStep === 1}
              className="flex items-center"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            {currentStep === totalSteps ? (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={nextStep}
                className="flex items-center bg-primary hover:bg-primary/90"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </form>

        {onToggle && (
          <div className="text-center mt-6 pt-6 border-t">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Button variant="link" onClick={onToggle} className="p-0 h-auto font-semibold">
                Sign In
              </Button>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}