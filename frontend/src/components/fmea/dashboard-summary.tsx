"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, AlertTriangle, CheckCircle2, Timer } from 'lucide-react'
import { FMEADashboardSummary } from './types'

interface DashboardSummaryProps {
  summary?: FMEADashboardSummary
  loading?: boolean
}

const summaryConfig = [
  {
    key: 'total_fmeas' as const,
    title: 'Total FMEA Studies',
    icon: TrendingUp,
    color: 'text-primary',
    badge: 'Active tracking'
  },
  {
    key: 'high_rpn_items' as const,
    title: 'High RPN Items',
    icon: AlertTriangle,
    color: 'text-red-500',
    badge: 'AI threshold alert'
  },
  {
    key: 'completed_actions' as const,
    title: 'Completed Actions',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    badge: 'Closure rate'
  },
  {
    key: 'overdue_actions' as const,
    title: 'Overdue Actions',
    icon: Timer,
    color: 'text-amber-500',
    badge: 'Escalation needed'
  }
]

export function FMEADashboardSummaryCards({ summary, loading }: DashboardSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {summaryConfig.map(({ key, title, icon: Icon, color, badge }) => (
        <Card key={key} className="border-green-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <Icon className={`h-5 w-5 ${color}`} />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-3xl font-semibold">
                  {summary ? summary[key].toLocaleString() : '--'}
                </span>
                <Badge variant="secondary" className="bg-green-100 text-xs text-primary">
                  {badge}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
