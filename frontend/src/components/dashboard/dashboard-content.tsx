"use client"

import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Users,
  Shield,
  Activity,
  BarChart3
} from 'lucide-react'

export function DashboardContent() {
  const { user } = useAuth()

  if (!user) return null

  // Mock data - in real app this would come from API
  const stats = [
    {
      title: "Active Documents",
      value: "24",
      change: "+3",
      trend: "up",
      icon: FileText,
      color: "text-primary",
      bg: "bg-green-100"
    },
    {
      title: "Pending Audits",
      value: "3",
      change: "-1",
      trend: "down",
      icon: Shield,
      color: "text-purple-600",
      bg: "bg-purple-100"
    },
    {
      title: "Open Incidents",
      value: "1",
      change: "0",
      trend: "neutral",
      icon: AlertCircle,
      color: "text-orange-600",
      bg: "bg-orange-100"
    },
    {
      title: "Compliance Score",
      value: "92%",
      change: "+2%",
      trend: "up",
      icon: BarChart3,
      color: "text-green-600",
      bg: "bg-green-100"
    }
  ]

  const recentActivities = [
    {
      id: 1,
      type: "document",
      title: "Privacy Policy Updated",
      description: "Document version 2.1 published",
      time: "2 hours ago",
      status: "completed",
      user: "John Smith"
    },
    {
      id: 2,
      type: "audit",
      title: "ISO 27001 Audit Scheduled",
      description: "Annual compliance audit scheduled for next week",
      time: "4 hours ago",
      status: "pending",
      user: "Sarah Wilson"
    },
    {
      id: 3,
      type: "incident",
      title: "Security Incident Resolved",
      description: "INC-2024-001 successfully resolved",
      time: "1 day ago",
      status: "resolved",
      user: "Mike Johnson"
    },
    {
      id: 4,
      type: "user",
      title: "New User Registered",
      description: "Jane Doe joined as Auditor",
      time: "2 days ago",
      status: "completed",
      user: "System"
    }
  ]

  const upcomingTasks = [
    {
      id: 1,
      title: "ISO 27001 Audit Preparation",
      dueDate: "Tomorrow",
      priority: "high",
      module: "Audit",
      progress: 75
    },
    {
      id: 2,
      title: "Quarterly Risk Assessment",
      dueDate: "In 3 days",
      priority: "medium",
      module: "Risk Assessment",
      progress: 45
    },
    {
      id: 3,
      title: "Employee Training Records Update",
      dueDate: "Next week",
      priority: "low",
      module: "Document Management",
      progress: 20
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'resolved':
        return 'text-green-600 bg-green-100'
      case 'pending':
        return 'text-orange-600 bg-orange-100'
      case 'overdue':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-100'
      case 'medium':
        return 'text-orange-600 bg-orange-100'
      case 'low':
        return 'text-green-600 bg-green-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Welcome Section */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-primary mb-2">
          Welcome back, {user.first_name}!
        </h1>
        <p className="text-primary text-sm lg:text-base">
          Here's an overview of your compliance management activities.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-green-200">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary mb-1">
                    {stat.title}
                  </p>
                  <p className="text-2xl lg:text-3xl font-bold text-primary">
                    {stat.value}
                  </p>
                  <div className="flex items-center mt-2">
                    {stat.trend === 'up' ? (
                      <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                    ) : stat.trend === 'down' ? (
                      <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                    ) : null}
                    <span className={`text-sm ${
                      stat.trend === 'up' ? 'text-green-600' : 
                      stat.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {stat.change}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">vs last month</span>
                  </div>
                </div>
                <div className={`p-3 rounded-full ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        {/* Recent Activities */}
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-primary">Recent Activities</CardTitle>
            <CardDescription>Latest updates across all modules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-2 lg:p-3 rounded-lg hover:bg-green-50">
                  <div className="flex-shrink-0">
                    {activity.type === 'document' && <FileText className="h-5 w-5 text-primary" />}
                    {activity.type === 'audit' && <Shield className="h-5 w-5 text-purple-600" />}
                    {activity.type === 'incident' && <AlertCircle className="h-5 w-5 text-orange-600" />}
                    {activity.type === 'user' && <Users className="h-5 w-5 text-green-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.title}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {activity.description}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">{activity.time} • {activity.user}</span>
                      <Badge className={`text-xs ${getStatusColor(activity.status)}`}>
                        {activity.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button variant="outline" className="w-full border-green-200">
                View All Activities
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-primary">Upcoming Tasks</CardTitle>
            <CardDescription>Tasks that need your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="p-3 lg:p-4 border border-green-100 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">{task.title}</h4>
                    <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {task.dueDate}
                    </div>
                    <div className="flex items-center">
                      <Activity className="h-4 w-4 mr-1" />
                      {task.module}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="text-primary font-medium">{task.progress}%</span>
                    </div>
                    <Progress value={task.progress} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button variant="outline" className="w-full border-green-200">
                View All Tasks
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="text-primary">Quick Actions</CardTitle>
          <CardDescription>Common tasks to get you started</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <Button 
              variant="outline" 
              className="h-20 lg:h-24 flex-col space-y-1 lg:space-y-2 border-green-200 text-xs lg:text-sm"
              onClick={() => alert('Create Document coming soon!')}
            >
              <FileText className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
              <span className="text-center">New Document</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 lg:h-24 flex-col space-y-1 lg:space-y-2 border-green-200 text-xs lg:text-sm"
              onClick={() => alert('Start Audit coming soon!')}
            >
              <Shield className="h-5 w-5 lg:h-6 lg:w-6 text-purple-600" />
              <span className="text-center">Start Audit</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 lg:h-24 flex-col space-y-1 lg:space-y-2 border-green-200 text-xs lg:text-sm"
              onClick={() => alert('Report Incident coming soon!')}
            >
              <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-orange-600" />
              <span className="text-center">Report Incident</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 lg:h-24 flex-col space-y-1 lg:space-y-2 border-green-200 text-xs lg:text-sm"
              onClick={() => alert('Schedule Event coming soon!')}
            >
              <Calendar className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
              <span className="text-center">Schedule Event</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}