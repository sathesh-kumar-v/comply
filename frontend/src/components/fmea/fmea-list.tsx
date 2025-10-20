"use client"

import { FMEARecord, FMEAType, FMEAStatus } from './types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Filter, MoreHorizontal, Users, CalendarDays } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

interface FMEAListProps {
  fmeas: FMEARecord[]
  loading?: boolean
  searchValue: string
  fmeaTypeFilter?: FMEAType | 'All'
  statusFilter?: FMEAStatus | 'All'
  onSearchChange: (value: string) => void
  onTypeChange: (value: FMEAType | 'All') => void
  onStatusChange: (value: FMEAStatus | 'All') => void
  onSelect: (record: FMEARecord) => void
  onCreateClick: () => void
  onImportClick: () => void
  canCreate?: boolean
}

const typeOptions: (FMEAType | 'All')[] = [
  'All',
  'Process FMEA (PFMEA)',
  'Design FMEA (DFMEA)',
  'System FMEA (SFMEA)',
  'Service FMEA',
  'Software FMEA'
]

const statusOptions: (FMEAStatus | 'All')[] = ['All', 'Active', 'Completed', 'On Hold']

export function FMEAList({
  fmeas,
  loading,
  searchValue,
  fmeaTypeFilter,
  statusFilter,
  onSearchChange,
  onTypeChange,
  onStatusChange,
  onSelect,
  onCreateClick,
  onImportClick,
  canCreate = true
}: FMEAListProps) {
  return (
    <Card className="border-green-100 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">FMEA Library</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage analysis libraries with AI-assisted prioritisation.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {canCreate ? (
              <>
                <Button onClick={onCreateClick} className="bg-primary text-white">
                  Create FMEA
                </Button>
                <Button
                  variant="secondary"
                  onClick={onImportClick}
                  className="border border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  Import Template
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1">
            <Input
              placeholder="Search by title, process, scope, team lead..."
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              className="border-emerald-100"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <Select value={fmeaTypeFilter || 'All'} onValueChange={(value) => onTypeChange(value as FMEAType | 'All')}>
            <SelectTrigger className="w-[180px] border-emerald-100">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter || 'All'} onValueChange={(value) => onStatusChange(value as FMEAStatus | 'All')}>
            <SelectTrigger className="w-[160px] border-emerald-100">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
        ) : fmeas.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 text-center">
            <p className="text-sm font-medium text-emerald-900">No FMEA studies match the current filters.</p>
            <p className="text-xs text-muted-foreground">Use AI template suggestions to start faster.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {fmeas.map((record) => (
              <Card key={record.id} className="border border-emerald-100 shadow-sm transition hover:shadow-md">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{record.title}</h3>
                      <p className="text-sm text-muted-foreground">{record.process_or_product_name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className="bg-emerald-100 text-emerald-800">{record.fmea_type}</Badge>
                      <Badge variant="outline" className="border-amber-200 text-xs text-amber-600">
                        {record.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-500" />
                      <span>
                        Team Lead ID: <span className="font-medium text-gray-900">{record.team_lead_id}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-emerald-500" />
                      <span>
                        Review Date: <span className="font-medium text-gray-900">{new Date(record.review_date).toLocaleDateString()}</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className="border-emerald-200">
                        Highest RPN: {record.highest_rpn || 'N/A'}
                      </Badge>
                      <Badge variant="outline" className="border-emerald-200">
                        Actions: {record.actions_count}
                      </Badge>
                      {record.departments?.length ? (
                        <Badge variant="outline" className="border-emerald-200">
                          Departments: {record.departments.join(', ')}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Button size="sm" className="bg-primary text-white" onClick={() => onSelect(record)}>
                      Open Worksheet
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onSelect(record)}>View Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(record.scope)}>
                          Copy Scope
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>Edit (coming soon)</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
