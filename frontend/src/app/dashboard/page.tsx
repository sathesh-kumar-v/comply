"use client"

import { useAuth } from '@/contexts/auth-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { EnhancedDashboard } from '@/components/dashboard/enhanced-dashboard'

export default function DashboardPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-primary">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <DashboardLayout>
      <EnhancedDashboard />
    </DashboardLayout>
  )
}