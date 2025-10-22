"use client"

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, XCircle } from 'lucide-react'

import { useAuth } from '@/contexts/auth-context'
import { authService } from '@/lib/auth'
import { Button } from '@/components/ui/button'

export default function GoogleOAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
          <div className="flex flex-col items-center space-y-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <h1 className="text-lg font-semibold">Completing sign-in</h1>
            <p className="text-sm text-muted-foreground">Preparing Google sign-in...</p>
          </div>
        </div>
      }
    >
      <GoogleOAuthCallbackContent />
    </Suspense>
  )
}

function GoogleOAuthCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { refreshUser } = useAuth()

  const [status, setStatus] = useState<'processing' | 'error'>('processing')
  const [message, setMessage] = useState('Completing Google sign-in...')
  const [redirectTarget, setRedirectTarget] = useState('/dashboard')

  useEffect(() => {
    const token = searchParams.get('token')
    const error = searchParams.get('error')
    const redirectParam = searchParams.get('redirect')

    const destination = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/dashboard'
    setRedirectTarget(destination)

    if (error) {
      setStatus('error')
      setMessage(error)
      return
    }

    if (!token) {
      setStatus('error')
      setMessage('Missing sign-in token. Please try again.')
      return
    }

    try {
      authService.saveToken(token)
    } catch (storageError) {
      console.error('Failed to persist OAuth token:', storageError)
      setStatus('error')
      setMessage('We could not store your sign-in token. Please enable cookies/local storage and try again.')
      return
    }

    const finalizeLogin = async () => {
      try {
        await refreshUser()
        router.replace(destination)
      } catch (finalizeError) {
        console.error('Failed to finalize Google OAuth login:', finalizeError)
        setStatus('error')
        setMessage('We could not verify your Google sign-in. Please try again.')
      }
    }

    finalizeLogin()
  }, [searchParams, refreshUser, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        {status === 'processing' ? (
          <div className="flex flex-col items-center space-y-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <h1 className="text-lg font-semibold">Completing sign-in</h1>
            <p className="text-sm text-muted-foreground">
              {message}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4 text-center">
            <XCircle className="h-10 w-10 text-red-500" />
            <h1 className="text-lg font-semibold">Google sign-in unsuccessful</h1>
            <p className="text-sm text-muted-foreground">
              {message}
            </p>
            <div className="flex flex-col space-y-2">
              <Button asChild>
                <Link href="/login">Return to login</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/api/auth/oauth/google/start?redirect_to=${encodeURIComponent(redirectTarget)}`}>
                  Try Google sign-in again
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
