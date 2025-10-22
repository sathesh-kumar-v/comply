"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
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
  register: (userData: RegisterData) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  updateProfile: (updates: UpdateCurrentUserPayload) => Promise<User>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  refreshUser: () => Promise<void>
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

  const refreshUser = useCallback(async () => {
    if (typeof window === 'undefined' || !authService.isAuthenticated()) {
      setUser(null)
      return
    }

    try {
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error('Failed to refresh authenticated user:', error)
      if (typeof authService.clearStoredToken === 'function') {
        authService.clearStoredToken()
      }
      setUser(null)
      throw error
    }
  }, [])

  useEffect(() => {
    const initAuth = async () => {
      if (typeof window !== 'undefined' && authService.isAuthenticated()) {
        try {
          await refreshUser()
        } catch (error) {
          console.error('Failed to initialize session from stored token:', error)
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [refreshUser])

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

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await authService.changePassword(currentPassword, newPassword)
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    updateProfile,
    changePassword,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}