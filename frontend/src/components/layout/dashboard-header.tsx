"use client"

import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { 
  Bell, 
  Search, 
  HelpCircle,
  ChevronDown,
  Menu
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DashboardHeaderProps {
  onMenuClick?: () => void
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const { user } = useAuth()
  const router = useRouter()

  if (!user) return null

  return (
    <header className="h-16 bg-white border-b border-green-200 flex items-center justify-between px-4 lg:px-6">
      {/* Mobile Menu Button + Search */}
      <div className="flex items-center flex-1 max-w-lg">
        {/* Hamburger Menu - visible on all screen sizes */}
        <Button
          variant="ghost"
          size="sm"
          className="mr-2"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search..."
            className="pl-10 bg-green-50 border-green-200 focus:border-primary sm:placeholder:text-sm md:placeholder:text-base"
          />
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center space-x-2 lg:space-x-4">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5 text-gray-600" />
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 bg-red-500 text-xs">
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="p-3 border-b">
              <h3 className="font-semibold text-sm">Notifications</h3>
            </div>
            <div className="p-3 space-y-3">
              <div className="flex space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Audit Due Tomorrow</p>
                  <p className="text-xs text-gray-500">ISO 27001 compliance audit scheduled</p>
                </div>
              </div>
              <div className="flex space-x-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Document Update Required</p>
                  <p className="text-xs text-gray-500">Security policy needs review</p>
                </div>
              </div>
              <div className="flex space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">New Incident Reported</p>
                  <p className="text-xs text-gray-500">Data breach incident #INC-2024-001</p>
                </div>
              </div>
            </div>
            <div className="p-3 border-t">
              <Button variant="ghost" size="sm" className="w-full">
                View All Notifications
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Help - hidden on small screens */}
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
          <HelpCircle className="h-5 w-5 text-gray-600" />
        </Button>

        {/* Quick Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="border-green-200">
              <span className="hidden sm:inline">Quick Actions</span>
              <span className="sm:hidden">Actions</span>
              <ChevronDown className="ml-1 sm:ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => alert('Create Document coming soon!')}>
              📄 Create Document
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => alert('New Audit coming soon!')}>
              🛡️ Start New Audit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => alert('Report Incident coming soon!')}>
              🚨 Report Incident
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push('/calendar?intent=new-meeting')}
            >
              📅 Schedule Meeting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Current Status Indicator - hidden on small screens */}
        <div className="hidden md:flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600">System Healthy</span>
        </div>
      </div>
    </header>
  )
}