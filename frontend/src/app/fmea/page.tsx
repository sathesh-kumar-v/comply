"use client"

import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FMEADashboardSummaryCards } from '@/components/fmea/dashboard-summary'
import { FMEAList } from '@/components/fmea/fmea-list'
import { FMEACreationWizard } from '@/components/fmea/fmea-wizard'
import { FMEAWorksheet } from '@/components/fmea/fmea-worksheet'
import { TemplateImportDialog } from '@/components/fmea/template-import-dialog'
import { useAuth } from '@/contexts/auth-context'
import {
  FMEARecord,
  FMEADashboardSummary,
  FMEAItemRecord,
  FMEAActionRecord,
  TeamOption,
  TemplateSuggestion,
  FMEAInitialValues,
  FMEAStatus,
  FMEAType
} from '@/components/fmea/types'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import type { User } from '@/lib/auth'

const CREATION_ALLOWED_ROLES: User['role'][] = ['admin', 'manager']

export default function FMEAPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'overview' | 'worksheet' | 'create'>('overview')
  const [summary, setSummary] = useState<FMEADashboardSummary | undefined>()
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [fmeas, setFmeas] = useState<FMEARecord[]>([])
  const [fmeasLoading, setFmeasLoading] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [typeFilter, setTypeFilter] = useState<FMEAType | 'All'>('All')
  const [statusFilter, setStatusFilter] = useState<FMEAStatus | 'All'>('All')
  const [selectedFMEA, setSelectedFMEA] = useState<FMEARecord | null>(null)
  const [worksheetItems, setWorksheetItems] = useState<FMEAItemRecord[]>([])
  const [worksheetActions, setWorksheetActions] = useState<FMEAActionRecord[]>([])
  const [worksheetLoading, setWorksheetLoading] = useState(false)
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([])
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [wizardPrefill, setWizardPrefill] = useState<FMEAInitialValues | undefined>(undefined)
  const canCreateFmea = user ? CREATION_ALLOWED_ROLES.includes(user.role) : false

  const fetchSummary = async () => {
    try {
      setSummaryLoading(true)
      const data = await api<FMEADashboardSummary>('/fmea/dashboard/summary')
      setSummary(data)
    } catch (error) {
      console.error(error)
    } finally {
      setSummaryLoading(false)
    }
  }

  const fetchTeamOptions = async () => {
    try {
      const data = await api<TeamOption[]>('/fmea/team-options')
      setTeamOptions(data)
    } catch (error) {
      console.error(error)
    }
  }

  const fetchFmeas = async () => {
    try {
      setFmeasLoading(true)
      const params = new URLSearchParams()
      if (searchValue) params.set('q', searchValue)
      if (typeFilter !== 'All') params.set('fmea_type', typeFilter)
      if (statusFilter !== 'All') params.set('status_', statusFilter)
      params.set('limit', '50')
      const query = params.toString()
      const data = await api<FMEARecord[]>(`/fmea${query ? `?${query}` : ''}`)
      setFmeas(data)
      if (data.length) {
        if (!selectedFMEA) {
          setSelectedFMEA(data[0])
        } else {
          const updated = data.find((record) => record.id === selectedFMEA.id)
          if (updated) setSelectedFMEA(updated)
        }
      } else {
        setSelectedFMEA(null)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setFmeasLoading(false)
    }
  }

  const fetchWorksheet = async (fmeaId: number) => {
    try {
      setWorksheetLoading(true)
      const [items, actions] = await Promise.all([
        api<FMEAItemRecord[]>(`/fmea/${fmeaId}/items`),
        api<FMEAActionRecord[]>(`/fmea/${fmeaId}/actions`)
      ])
      setWorksheetItems(items)
      setWorksheetActions(actions)
    } catch (error) {
      console.error(error)
    } finally {
      setWorksheetLoading(false)
    }
  }

  useEffect(() => {
    try {
      fetchSummary()
      fetchTeamOptions()
    } catch (error) {
      console.error(error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchFmeas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue, typeFilter, statusFilter])

  useEffect(() => {
    if (selectedFMEA) {
      fetchWorksheet(selectedFMEA.id)
    } else {
      setWorksheetItems([])
      setWorksheetActions([])
    }
  }, [selectedFMEA])

  const handleApplyTemplate = (suggestion: TemplateSuggestion) => {
    if (!canCreateFmea) {
      alert('You do not have permission to create FMEA studies.')
      return
    }
    setWizardPrefill({
      title: suggestion.name,
      fmea_type: suggestion.focus.includes('FMEA') ? (suggestion.focus as FMEAType) : undefined,
      description: suggestion.description,
      scope: suggestion.description,
      assumptions: suggestion.recommended_controls?.join('\n') || undefined
    })
    setActiveTab('create')
  }

  const handleFmeaCreated = (record: FMEARecord) => {
    setFmeas((prev) => [record, ...prev])
    setSelectedFMEA(record)
    setActiveTab('worksheet')
    fetchSummary()
  }

  useEffect(() => {
    if (!canCreateFmea && activeTab === 'create') {
      setActiveTab(selectedFMEA ? 'worksheet' : 'overview')
    }
  }, [canCreateFmea, activeTab, selectedFMEA])

  const teamLeadName = useMemo(() => {
    if (!selectedFMEA) return null
    const lead = teamOptions.find((option) => option.id === selectedFMEA.team_lead_id)
    return lead?.full_name ?? `User ${selectedFMEA.team_lead_id}`
  }, [selectedFMEA, teamOptions])

  const selectedTeamMembers = useMemo(() => {
    if (!selectedFMEA) return []
    return selectedFMEA.team_members
      .filter((member) => member.user_id !== selectedFMEA.team_lead_id)
      .map((member) => teamOptions.find((option) => option.id === member.user_id)?.full_name || `User ${member.user_id}`)
  }, [selectedFMEA, teamOptions])

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Failure Mode Error Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Configure, execute and monitor FMEA studies with AI-guided insights.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-6">
          <TabsList className="w-full justify-start bg-emerald-50/60">
            <TabsTrigger value="overview">Dashboard</TabsTrigger>
            <TabsTrigger value="worksheet" disabled={!selectedFMEA}>
              Worksheet
            </TabsTrigger>
            {canCreateFmea ? <TabsTrigger value="create">Create FMEA</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <FMEADashboardSummaryCards summary={summary} loading={summaryLoading} />
            <FMEAList
              fmeas={fmeas}
              loading={fmeasLoading}
              searchValue={searchValue}
              fmeaTypeFilter={typeFilter}
              statusFilter={statusFilter}
              onSearchChange={setSearchValue}
              onTypeChange={setTypeFilter}
              onStatusChange={setStatusFilter}
              onSelect={(record) => {
                setSelectedFMEA(record)
                setActiveTab('worksheet')
              }}
              onCreateClick={() => {
                if (canCreateFmea) setActiveTab('create')
              }}
              onImportClick={() => {
                if (!canCreateFmea) {
                  alert('You do not have permission to create FMEA studies.')
                  return
                }
                setTemplateDialogOpen(true)
              }}
              canCreate={canCreateFmea}
            />
          </TabsContent>

          <TabsContent value="worksheet" className="space-y-6">
            {selectedFMEA ? (
              <>
                <Card className="border-green-100 bg-emerald-50/40 shadow-sm">
                  <CardContent className="grid gap-4 p-4 md:grid-cols-2">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{selectedFMEA.title}</h2>
                      <p className="text-sm text-muted-foreground">{selectedFMEA.process_or_product_name}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Type: {selectedFMEA.fmea_type}</span>
                        <span>Status: {selectedFMEA.status}</span>
                        <span>Review: {new Date(selectedFMEA.review_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div>
                        <span className="font-semibold text-gray-900">Team Lead:</span> {teamLeadName}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">Team:</span>{' '}
                        {selectedTeamMembers.length > 0 ? selectedTeamMembers.join(', ') : 'Configure members in creation wizard.'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <FMEAWorksheet
                  fmea={selectedFMEA}
                  items={worksheetItems}
                  actions={worksheetActions}
                  teamOptions={teamOptions}
                  loading={worksheetLoading}
                  onRefresh={() => fetchWorksheet(selectedFMEA.id)}
                />
              </>
            ) : (
              <Card>
                <CardContent className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                  <Skeleton className="h-8 w-1/3" />
                  <p className="text-sm text-muted-foreground">Select or create a study from the dashboard to begin analysis.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {canCreateFmea ? (
            <TabsContent value="create" className="space-y-6">
              <FMEACreationWizard
                teamOptions={teamOptions}
                onCreated={handleFmeaCreated}
                initialValues={wizardPrefill}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
      {canCreateFmea ? (
        <TemplateImportDialog
          open={templateDialogOpen}
          onOpenChange={setTemplateDialogOpen}
          onApplyTemplate={handleApplyTemplate}
        />
      ) : null}
    </DashboardLayout>
  )
}
