"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/auth-context'
import { useSettings } from '@/contexts/settings-context'
import { authService } from '@/lib/auth'

// Updated schema to accept either username or email
const loginSchema = z.object({
  identifier: z.string()
    .min(1, 'Username or email is required')
    .refine((value) => {
      // Allow either email format or username (no @ symbol)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const usernameRegex = /^[a-zA-Z0-9_.-]+$/
      return emailRegex.test(value) || usernameRegex.test(value)
    }, 'Please enter a valid username or email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

interface LoginFormProps {}

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const { security } = useSettings()
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // Watch the identifier field to determine if it's an email or username
  const identifierValue = watch('identifier')
  const isEmail = identifierValue && identifierValue.includes('@')

  const [socialError, setSocialError] = useState('')
  const [isSocialLoading, setIsSocialLoading] = useState(false)

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError('') // Clear any previous errors
      
      // Transform the data to match your API's expected format
      const loginData = {
        username: data.identifier, // Always use identifier as username
        password: data.password
      }
      
      await login(loginData)
      router.push('/dashboard')
    } catch (err: any) {
      console.log('Login error:', err) // Add debugging
      const errorMessage = err.response?.data?.detail || err.message || 'Login failed. Please try again.'
      setError(errorMessage)
      // Don't clear the error automatically - let user see it
    }
  }

  const handleGoogleLogin = () => {
    if (!security.googleOAuthEnabled) return
    setSocialError('')
    setError('')
    setIsSocialLoading(true)
    try {
      if (typeof window === 'undefined') {
        throw new Error('Google sign-in is only available in the browser')
      }
      const redirectTarget = '/dashboard'
      const startUrl = authService.getOAuthStartUrl('google', redirectTarget)
      window.location.href = startUrl
    } catch (err: any) {
      console.error('Failed to initiate Google OAuth flow:', err)
      const errorMessage = err.response?.data?.detail || err.message || 'Unable to connect to Google right now.'
      setSocialError(errorMessage)
      setIsSocialLoading(false)
    }
  }

  return (
    <div className="w-full">
      {security.googleOAuthEnabled && (
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full border border-gray-200"
            onClick={handleGoogleLogin}
            disabled={isSocialLoading}
          >
            {isSocialLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting to Google...
              </>
            ) : (
              'Continue with Google'
            )}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled>
            Continue with Microsoft
          </Button>
          {socialError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {socialError}
            </div>
          )}
          <div className="flex items-center space-x-3 py-1">
            <Separator className="flex-1" />
            <span className="text-xs uppercase text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label htmlFor="identifier">Username or Email</Label>
          <Input
            id="identifier"
            type="text"
            placeholder="admin@acmecorp.com or username"
            {...register('identifier')}
            className={errors.identifier ? 'border-red-500' : ''}
          />
          {errors.identifier && (
            <p className="text-sm text-red-500">{errors.identifier.message}</p>
          )}
          {/* Optional: Show a hint about what type of input is detected */}
          {/* {identifierValue && (
            <p className="text-xs text-muted-foreground">
              {isEmail ? '📧 Email detected' : '👤 Username detected'}
            </p>
          )} */}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
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

        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/10 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>

          <div className="text-center">
            <a 
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
            >
              Forgot your password?
            </a>
          </div>
        </div>
      </form>
    </div>
  )
}