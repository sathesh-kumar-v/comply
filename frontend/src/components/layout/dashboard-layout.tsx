"use client"

import { useState, useEffect } from 'react'
import { DashboardSidebar } from './dashboard-sidebar'
import { DashboardHeader } from './dashboard-header'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false) // Start closed by default
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    // Use requestAnimationFrame to prevent layout shifts
    requestAnimationFrame(() => {
      setIsClient(true)
      // Restore sidebar state from localStorage
      const savedState = localStorage.getItem('sidebar-open')
      if (savedState !== null) {
        setSidebarOpen(JSON.parse(savedState))
      } else {
        // Default to true on desktop, false on mobile
        setSidebarOpen(window.innerWidth >= 1024)
      }
    })
  }, [])

  const handleSidebarToggle = (open: boolean) => {
    setSidebarOpen(open)
    localStorage.setItem('sidebar-open', JSON.stringify(open))
  }

  // Prevent hydration mismatch by not rendering until client-side
  if (!isClient) {
    return (
      <div className="flex h-screen bg-green-50">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="h-16 bg-white border-b border-green-200" />
          <main className="flex-1 overflow-y-auto">
            <div className="h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-green-50">
      {/* Sidebar overlay - only on mobile when open */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => handleSidebarToggle(false)}
        />
      )}
      
      {/* Sidebar */}
      <DashboardSidebar 
        isOpen={sidebarOpen}
        onClose={() => handleSidebarToggle(false)}
      />
      
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden transition-all duration-200 ease-in-out">
        {/* Header */}
        <DashboardHeader 
          onMenuClick={() => handleSidebarToggle(!sidebarOpen)}
        />
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}