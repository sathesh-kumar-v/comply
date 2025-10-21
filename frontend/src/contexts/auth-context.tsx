"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  authService,
  User,
  LoginCredentials,
  RegisterData,
  UpdateCurrentUserPayload
} from '@/lib/auth'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  loginWithOAuth: (provider: 'google' | 'microsoft', payload?: Record<string, unknown>) => Promise<void>
  register: (userData: RegisterData) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  updateProfile: (updates: UpdateCurrentUserPayload) => Promise<User>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      if (typeof window !== 'undefined' && authService.isAuthenticated()) {
        try {
          const currentUser = await authService.getCurrentUser()
          setUser(currentUser)
        } catch (error) {
          console.error('Failed to get current user:', error)
          authService.logout()
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  const login = async (credentials: LoginCredentials) => {
    setLoading(true)
    try {
      const authResponse = await authService.login(credentials)
      setUser(authResponse.user)
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const loginWithOAuth = async (
    provider: 'google' | 'microsoft',
    payload: Record<string, unknown> = {}
  ) => {
    setLoading(true)
    try {
      const authResponse = await authService.loginWithOAuth(provider, payload)
      setUser(authResponse.user)
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const register = async (userData: RegisterData) => {
    setLoading(true)
    try {
      const newUser = await authService.register(userData)
      // Auto-login after registration is optional
      // For now, we'll just return and let user login manually
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    authService.logout()
  }

  const updateProfile = async (updates: UpdateCurrentUserPayload) => {
    const updatedUser = await authService.updateCurrentUser(updates)
    setUser(updatedUser)
    return updatedUser
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    loginWithOAuth,
    register,
    logout,
    isAuthenticated: !!user,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}