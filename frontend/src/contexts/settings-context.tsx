"use client"

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'

interface SecuritySettings {
  allowMfaEnrollment: boolean
  requireMfaForAdmins: boolean
  googleOAuthEnabled: boolean
}

interface SettingsContextValue {
  security: SecuritySettings
  updateSecurity: (updates: Partial<SecuritySettings>) => void
  reset: () => void
}

const DEFAULT_SETTINGS: SecuritySettings = {
  allowMfaEnrollment: true,
  requireMfaForAdmins: false,
  googleOAuthEnabled: false,
}

const STORAGE_KEY = 'comply-platform-settings'

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [security, setSecurity] = useState<SecuritySettings>(DEFAULT_SETTINGS)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as { security?: SecuritySettings }
        if (parsed.security) {
          setSecurity({ ...DEFAULT_SETTINGS, ...parsed.security })
        }
      }
    } catch (error) {
      console.warn('Failed to restore settings from storage', error)
    } finally {
      setIsHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return
    try {
      const payload = JSON.stringify({ security })
      window.localStorage.setItem(STORAGE_KEY, payload)
    } catch (error) {
      console.warn('Failed to persist settings', error)
    }
  }, [security, isHydrated])

  const updateSecurity = (updates: Partial<SecuritySettings>) => {
    setSecurity((prev) => ({ ...prev, ...updates }))
  }

  const reset = () => {
    setSecurity(DEFAULT_SETTINGS)
  }

  const value = useMemo<SettingsContextValue>(() => ({ security, updateSecurity, reset }), [security])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
