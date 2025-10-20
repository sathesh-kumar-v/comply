"use client"

import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts'
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
  BarChart3,
  PieChart as PieChartIcon,
  Target,
  AlertTriangle,
  ExternalLink,
  Plus,
  Settings,
  Download,
  Loader2
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { fetchDashboardData, transformDocumentStatusForChart, calculateDocumentTrends, type DashboardData } from '@/lib/dashboard'

export function EnhancedDashboard() {
  const { user } = useAuth()
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d')
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch dashboard data
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      
      try {
        setLoading(true)
        setError(null)
        
        const data = await fetchDashboardData()
        setDashboardData(data)
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-800 font-medium">Failed to load dashboard data</span>
            </div>
            <p className="text-red-600 mt-2">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4" 
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!dashboardData) return null

  // Calculate trends for dynamic data
  const trends = calculateDocumentTrends(dashboardData.documents)

  // Enhanced stats with dynamic data
  const stats = [
    {
      title: "Documents",
      value: dashboardData.documents.total_documents.toString(),
      change: trends.totalChange,
      trend: trends.totalTrend,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-100",
      description: "Active documents",
      clickable: true,
      href: "/documents"
    },
    {
      title: "Assignments",
      value: dashboardData.assignments?.total_assignments?.toString() || "0",
      change: `${dashboardData.assignments?.pending || 0} pending`,
      trend: "neutral" as const,
      icon: Target,
      color: "text-green-600",
      bg: "bg-green-100",
      description: "Total assignments",
      clickable: true,
      href: "/assignments"
    },
    {
      title: "Compliance",
      value: `${dashboardData.compliance?.overall_score || 0}%`,
      change: "+2%",
      trend: "up" as const,
      icon: Shield,
      color: "text-purple-600",
      bg: "bg-purple-100",
      description: "Overall score",
      clickable: true,
      href: "/compliance"
    },
    {
      title: "Needs Review",
      value: dashboardData.documents.documents_needing_review.toString(),
      change: trends.reviewChange,
      trend: trends.reviewTrend,
      icon: AlertTriangle,
      color: dashboardData.documents.documents_needing_review > 0 ? "text-orange-600" : "text-green-600",
      bg: dashboardData.documents.documents_needing_review > 0 ? "bg-orange-100" : "bg-green-100",
      description: "Documents needing review",
      clickable: true,
      href: "/documents?filter=needs_review"
    }
  ]

  // Document status data for pie chart (dynamic)
  const documentStatusData = transformDocumentStatusForChart(dashboardData.documents.by_status)

  // Compliance trend data for line chart (dynamic based on current data)
  const currentScore = dashboardData.compliance?.overall_score || 0
  const currentIncidents = dashboardData.compliance?.incidents_count || 0
  const currentDocs = dashboardData.documents.total_documents
  
  // Generate trend data based on current values (simulated historical data)
  const complianceTrendData = [
    { month: 'Jan', score: Math.max(0, currentScore - 15), incidents: currentIncidents + 3, documents: Math.max(0, currentDocs - 25) },
    { month: 'Feb', score: Math.max(0, currentScore - 12), incidents: currentIncidents + 2, documents: Math.max(0, currentDocs - 20) },
    { month: 'Mar', score: Math.max(0, currentScore - 8), incidents: currentIncidents + 2, documents: Math.max(0, currentDocs - 15) },
    { month: 'Apr', score: Math.max(0, currentScore - 5), incidents: currentIncidents + 1, documents: Math.max(0, currentDocs - 10) },
    { month: 'May', score: Math.max(0, currentScore - 2), incidents: currentIncidents + 1, documents: Math.max(0, currentDocs - 5) },
    { month: 'Jun', score: currentScore, incidents: currentIncidents, documents: currentDocs }
  ]

  // Assignment progress data for bar chart (based on real department data)
  const hasDepartmentAssignmentData = dashboardData.departmentAssignments && dashboardData.departmentAssignments.length > 0
  
  const assignmentData = hasDepartmentAssignmentData && dashboardData.departmentAssignments ? 
    dashboardData.departmentAssignments.map(dept => ({
      department: dept.department,
      completed: dept.completed,
      pending: dept.pending,
      total: dept.total
    })) : [
    // Show placeholder when no assignment data
    { department: 'No Data', completed: 0, pending: 0, total: 0 }
  ]

  // Activity data for area chart
  const activityData = [
    { time: '00:00', documents: 0, users: 0 },
    { time: '04:00', documents: 2, users: 1 },
    { time: '08:00', documents: 15, users: 8 },
    { time: '12:00', documents: 28, users: 15 },
    { time: '16:00', documents: 22, users: 12 },
    { time: '20:00', documents: 8, users: 4 }
  ]

  const recentActivities = [
    {
      id: 1,
      type: "document",
      title: "Data Privacy Policy v2.1 Published",
      description: "Updated with new GDPR requirements",
      time: "2 hours ago",
      status: "completed",
      user: "Sarah Wilson",
      priority: "high"
    },
    {
      id: 2,
      type: "assignment",
      title: "Q4 Risk Assessment Assigned",
      description: "Assigned to Legal Department",
      time: "4 hours ago",
      status: "pending",
      user: "Mike Johnson",
      priority: "medium"
    },
    {
      id: 3,
      type: "incident",
      title: "Security Incident INC-2024-007 Resolved",
      description: "Phishing attempt successfully mitigated",
      time: "6 hours ago",
      status: "resolved",
      user: "Alex Chen",
      priority: "high"
    },
    {
      id: 4,
      type: "audit",
      title: "ISO 27001 Preliminary Audit Completed",
      description: "94% compliance score achieved",
      time: "1 day ago",
      status: "completed",
      user: "Emma Davis",
      priority: "medium"
    }
  ]

  const upcomingDeadlines = [
    {
      id: 1,
      title: "Annual Security Review",
      dueDate: "Tomorrow",
      priority: "high",
      department: "IT Security",
      progress: 85,
      assignee: "John Smith"
    },
    {
      id: 2,
      title: "GDPR Compliance Assessment",
      dueDate: "In 2 days",
      priority: "high",
      department: "Legal",
      progress: 60,
      assignee: "Sarah Wilson"
    },
    {
      id: 3,
      title: "Employee Training Records Update",
      dueDate: "In 5 days",
      priority: "medium",
      department: "HR",
      progress: 40,
      assignee: "Lisa Brown"
    },
    {
      id: 4,
      title: "Vendor Security Assessment",
      dueDate: "Next week",
      priority: "medium",
      department: "Procurement",
      progress: 25,
      assignee: "David Lee"
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'resolved':
        return 'text-green-600 bg-green-100 border-green-200'
      case 'pending':
        return 'text-amber-600 bg-amber-100 border-amber-200'
      case 'overdue':
        return 'text-red-600 bg-red-100 border-red-200'
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-100 border-red-200'
      case 'medium':
        return 'text-amber-600 bg-amber-100 border-amber-200'
      case 'low':
        return 'text-green-600 bg-green-100 border-green-200'
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200'
    }
  }

  const handleStatClick = (href: string) => {
    // In a real app, this would navigate to the appropriate page
    console.log(`Navigate to: ${href}`)
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Section with Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user.first_name}!
          </h1>
          <p className="text-gray-600 text-lg">
            Here's your compliance dashboard overview
          </p>
        </div>
        {/* <div className="flex items-center space-x-3 mt-4 lg:mt-0">
          <Button variant="outline" size="sm" className="text-gray-600">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" size="sm" className="text-gray-600">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            New Document
          </Button>
        </div> */}
      </div>

      {/* Interactive Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card 
            key={stat.title} 
            className={`border-0 shadow-md hover:shadow-lg transition-all duration-200 ${
              stat.clickable ? 'cursor-pointer hover:scale-105' : ''
            } bg-gradient-to-br from-white to-gray-50`}
            onClick={stat.clickable ? () => handleStatClick(stat.href) : undefined}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-600">
                      {stat.title}
                    </p>
                    {stat.clickable && <ExternalLink className="h-4 w-4 text-gray-400" />}
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mb-1">
                    {stat.value}
                  </p>
                  <p className="text-sm text-gray-500 mb-3">
                    {stat.description}
                  </p>
                  <div className="flex items-center">
                    {stat.trend === 'up' ? (
                      <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                    ) : stat.trend === 'down' ? (
                      <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                    ) : null}
                    <span className={`text-sm font-medium ${
                      stat.trend === 'up' ? 'text-green-600' : 
                      stat.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {stat.change}
                    </span>
                    <span className="text-sm text-gray-400 ml-1">vs last month</span>
                  </div>
                </div>
                <div className={`p-4 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-96 lg:mx-0">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Document Status Distribution */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center text-gray-900">
                  <PieChartIcon className="h-5 w-5 mr-2 text-blue-600" />
                  Document Status Distribution
                </CardTitle>
                <CardDescription>
                  Current status of all documents in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        dataKey="value"
                        data={documentStatusData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {documentStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} documents`, 'Count']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {documentStatusData.map((item) => (
                    <div key={item.name} className="flex items-center text-sm">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{backgroundColor: item.color}}
                      />
                      <span className="text-gray-600">{item.name}: </span>
                      <span className="font-medium ml-1">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Department Workload */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center text-gray-900">
                  <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                  Department Workload
                </CardTitle>
                <CardDescription>
                  Assignment completion rates by department
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hasDepartmentAssignmentData ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={assignmentData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="department" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="completed" stackId="a" fill="#22c55e" name="Completed" />
                        <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">No Assignment Data</p>
                      <p className="text-sm text-gray-400">Assignment tracking will appear here when data is available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center text-gray-900">
                <TrendingUp className="h-5 w-5 mr-2 text-purple-600" />
                Compliance Trend Analysis
              </CardTitle>
              <CardDescription>
                Track compliance scores, incidents, and document growth over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={complianceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="score" 
                      stroke="#8b5cf6" 
                      strokeWidth={3}
                      name="Compliance Score (%)"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="incidents" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      name="Open Incidents"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="documents" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Total Documents"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-gray-900">Assignment Progress</CardTitle>
                  <CardDescription>
                    Track assignment completion across departments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {assignmentData.map((dept) => (
                      <div key={dept.department} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-900">{dept.department}</span>
                          <div className="text-sm text-gray-600">
                            {dept.completed}/{dept.total} completed
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Progress 
                            value={(dept.completed / dept.total) * 100} 
                            className="h-3"
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>{Math.round((dept.completed / dept.total) * 100)}% completed</span>
                            <span>{dept.pending} pending</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-gray-900">Upcoming Deadlines</CardTitle>
                <CardDescription>
                  Critical tasks requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingDeadlines.slice(0, 4).map((task) => (
                    <div key={task.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900 text-sm leading-tight">
                          {task.title}
                        </h4>
                        <Badge className={`text-xs ml-2 ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{task.department}</span>
                          <span>{task.dueDate}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Progress</span>
                            <span className="font-medium">{task.progress}%</span>
                          </div>
                          <Progress value={task.progress} className="h-2" />
                        </div>
                        <div className="text-xs text-gray-500">
                          Assigned to: {task.assignee}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center text-gray-900">
                  <Activity className="h-5 w-5 mr-2 text-indigo-600" />
                  Daily Activity Pattern
                </CardTitle>
                <CardDescription>
                  Document and user activity throughout the day
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="documents" 
                        stackId="1" 
                        stroke="#3b82f6" 
                        fill="#3b82f6" 
                        fillOpacity={0.6}
                        name="Document Activity"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="users" 
                        stackId="1" 
                        stroke="#10b981" 
                        fill="#10b981" 
                        fillOpacity={0.6}
                        name="User Activity"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-gray-900">Recent Activities</CardTitle>
                <CardDescription>Latest updates across all modules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-shrink-0">
                        {activity.type === 'document' && <FileText className="h-5 w-5 text-blue-600" />}
                        {activity.type === 'assignment' && <Target className="h-5 w-5 text-green-600" />}
                        {activity.type === 'incident' && <AlertCircle className="h-5 w-5 text-red-600" />}
                        {activity.type === 'audit' && <Shield className="h-5 w-5 text-purple-600" />}
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
                          <div className="flex items-center space-x-2">
                            <Badge className={`text-xs ${getPriorityColor(activity.priority)}`}>
                              {activity.priority}
                            </Badge>
                            <Badge className={`text-xs ${getStatusColor(activity.status)}`}>
                              {activity.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Button variant="outline" className="w-full">
                    View All Activities
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Actions Enhanced */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-gray-900">Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and shortcuts to boost your productivity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
            <Button 
              variant="outline" 
              className="h-24 flex-col space-y-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50"
              onClick={() => console.log('Navigate to /documents/new')}
            >
              <FileText className="h-6 w-6 text-blue-600" />
              <span className="text-sm">New Document</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex-col space-y-2 border-purple-200 hover:border-purple-300 hover:bg-purple-50"
              onClick={() => console.log('Navigate to /audits/new')}
            >
              <Shield className="h-6 w-6 text-purple-600" />
              <span className="text-sm">Start Audit</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex-col space-y-2 border-red-200 hover:border-red-300 hover:bg-red-50"
              onClick={() => console.log('Navigate to /incidents/new')}
            >
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <span className="text-sm">Report Incident</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex-col space-y-2 border-green-200 hover:border-green-300 hover:bg-green-50"
              onClick={() => console.log('Navigate to /assignments')}
            >
              <Target className="h-6 w-6 text-green-600" />
              <span className="text-sm">View Tasks</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex-col space-y-2 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50"
              onClick={() => console.log('Navigate to /calendar')}
            >
              <Calendar className="h-6 w-6 text-indigo-600" />
              <span className="text-sm">Schedule Event</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex-col space-y-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              onClick={() => console.log('Navigate to /settings')}
            >
              <Settings className="h-6 w-6 text-gray-600" />
              <span className="text-sm">Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}