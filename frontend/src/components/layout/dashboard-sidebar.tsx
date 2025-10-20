"use client"

import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { 
  FileText, 
  ClipboardCheck, 
  Users, 
  AlertTriangle,
  Calendar,
  Settings,
  LogOut,
  Shield,
  Home,
  BarChart3,
  BookOpen,
  Activity,
  MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface SidebarItem {
  title: string
  icon: any
  href: string
  color: string
  adminOnly?: boolean
  badge?: string
}

interface DashboardSidebarProps {
  className?: string
  isOpen?: boolean
  onClose?: () => void
}

export function DashboardSidebar({ className, isOpen = false, onClose }: DashboardSidebarProps) {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  if (!user) return null

  // Get the active item based on current pathname
  const getActiveItem = () => {
    if (pathname === '/dashboard') return 'dashboard'
    if (pathname === '/documents') return 'documents'
    if (pathname === '/questionnaires') return 'questionnaires'
    if (pathname === '/settings') return 'settings'
    return 'dashboard' // fallback
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'manager': return 'bg-green-100 text-green-800'
      case 'auditor': return 'bg-purple-100 text-purple-800'
      case 'employee': return 'bg-green-100 text-green-800'
      case 'viewer': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const sidebarItems: SidebarItem[] = [
    {
      title: "Dashboard",
      icon: Home,
      href: "/dashboard",
      color: "text-primary"
    },
    {
      title: "Document Management",
      icon: FileText,
      href: "/documents",
      color: "text-primary"
    },
    {
      title: "Questionnaire Builder",
      icon: ClipboardCheck,
      href: "/questionnaires",
      color: "text-green-600"
    },
    {
      title: "Audit Builder",
      icon: Shield,
      href: "/audits",
      color: "text-purple-600"
    },
    {
      title: "Risk Assessment",
      icon: AlertTriangle,
      href: "/risk-assessment",
      color: "text-orange-600"
    },
    {
      title: "FMEA Analysis",
      icon: BarChart3,
      href: "/fmea",
      color: "text-indigo-600"
    },
    {
      title: "Incident Reporting",
      icon: Activity,
      href: "/incidents",
      color: "text-red-600"
    },
    {
      title: "Calendar",
      icon: Calendar,
      href: "/calendar",
      color: "text-indigo-600"
    },
    {
      title: "Corrective Actions",
      icon: BookOpen,
      href: "/corrective-actions",
      color: "text-teal-600"
    },
    {
      title: "User Management",
      icon: Users,
      href: "/users",
      color: "text-cyan-600",
      adminOnly: true
    },
    // {
    //   title: "Settings",
    //   icon: Settings,
    //   href: "/settings",
    //   color: "text-gray-600"
    // }
  ]

  const visibleItems = sidebarItems.filter(item => 
    !item.adminOnly || user.role === 'admin' || user.role === 'manager'
  )

  const handleItemClick = (href: string, title: string) => {
    if (
      href === '/dashboard' ||
      href === '/documents' ||
      href === '/questionnaires' ||
      href === '/settings' ||
      href === '/calendar' ||
      href === '/fmea'
    ) {
      // Navigate to implemented pages
      router.push(href)
    } else {
      alert(`${title} module coming soon!`)
    }
  }

  return (
    <div className={cn(
      "flex h-full flex-col bg-white border-r border-green-200",
      // Mobile: fixed positioning, slide in/out
      "fixed inset-y-0 left-0 z-50 lg:static lg:z-auto",
      // Transitions - separate for mobile and desktop
      "transition-transform duration-300 ease-in-out lg:transition-all lg:duration-200",
      // Width and visibility based on state
      isOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:w-0 lg:translate-x-0",
      // On desktop, when closed, width becomes 0 instead of hiding completely
      !isOpen && "lg:border-r-0 lg:overflow-hidden",
      className
    )}>
      {/* Logo/Brand */}
      <div className="flex h-16 items-center px-6 border-b border-green-100">
        <h1 className="text-xl font-bold text-primary">Comply-X</h1>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-green-100">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatar_url} />
            <AvatarFallback className="bg-green-100 text-primary">
              {user.first_name[0]}{user.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.first_name} {user.last_name}
            </p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Button
              key={item.title}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start px-3 py-2 text-left font-normal",
                isActive 
                  ? "bg-green-100 text-primary border-green-200" 
                  : "text-gray-700 hover:bg-green-50 hover:text-primary"
              )}
              onClick={() => handleItemClick(item.href, item.title)}
            >
              <item.icon className={cn("mr-3 h-4 w-4", item.color)} />
              <span className="truncate">{item.title}</span>
              {item.badge && (
                <span className="ml-auto bg-green-100 text-primary text-xs px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Button>
          )
        })}
      </nav>

      <Separator className="bg-green-200" />

      {/* Bottom Section */}
      <div className="p-3 space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start px-3 py-2 text-gray-700 hover:bg-green-50 hover:text-primary"
          onClick={() => router.push('/settings')}
        >
          <Settings className="mr-3 h-4 w-4 text-gray-500" />
          <span>Settings</span>
        </Button>
        
        <Button
          variant="ghost"
          className="w-full justify-start px-3 py-2 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={logout}
        >
          <LogOut className="mr-3 h-4 w-4" />
          <span>Logout</span>
        </Button>
      </div>
    </div>
  )
}