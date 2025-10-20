"use client"

import { useMemo, useState } from 'react'
import {
  FMEARecord,
  FMEAItemRecord,
  FMEAActionRecord,
  TeamOption,
  FailureModeInsight,
  RPNAlertInsight,
  CauseEffectInsight,
  ControlEffectivenessInsight,
  RPNForecastInsight
} from './types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import {
  ArrowRightCircle,
  BarChart3,
  ClipboardCheck,
  Copy,
  FilePlus,
  Filter,
  Gauge,
  LineChart,
  Loader2,
  ShieldAlert
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts'

interface WorksheetProps {
  fmea?: FMEARecord | null
  items: FMEAItemRecord[]
  actions: FMEAActionRecord[]
  teamOptions: TeamOption[]
  loading?: boolean
  onRefresh: () => void
}

type ItemFormState = {
  item_function: string
  failure_mode: string
  effects: string
  severity: number
  causes: string
  occurrence: number
  current_controls: string
  detection: number
  recommended_actions: string
  responsibility_user_id: string
  target_date: string
  actions_taken: string
  status: 'Open' | 'In Progress' | 'Completed'
  new_severity: string
  new_occurrence: string
  new_detection: string
}

type ActionFormState = {
  title: string
  description: string
  owner_user_id: string
  status: string
  due_date: string
  item_id: string
}

const defaultItemState: ItemFormState = {
  item_function: '',
  failure_mode: '',
  effects: '',
  severity: 5,
  causes: '',
  occurrence: 5,
  current_controls: '',
  detection: 5,
  recommended_actions: '',
  responsibility_user_id: '',
  target_date: '',
  actions_taken: '',
  status: 'Open',
  new_severity: '',
  new_occurrence: '',
  new_detection: ''
}

const defaultActionState: ActionFormState = {
  title: '',
  description: '',
  owner_user_id: '',
  status: 'Open',
  due_date: '',
  item_id: ''
}

export function FMEAWorksheet({
  fmea,
  items,
  actions,
  teamOptions,
  loading,
  onRefresh
}: WorksheetProps) {
  const teamLookup = useMemo(() => {
    const map = new Map<number, string>()
    teamOptions.forEach((option) => map.set(option.id, option.full_name))
    return map
  }, [teamOptions])
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<FMEAItemRecord | null>(null)
  const [itemForm, setItemForm] = useState<ItemFormState>(defaultItemState)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<FMEAActionRecord | null>(null)
  const [actionForm, setActionForm] = useState<ActionFormState>(defaultActionState)
  const [isSavingItem, setIsSavingItem] = useState(false)
  const [isSavingAction, setIsSavingAction] = useState(false)
  const [filters, setFilters] = useState({
    minRpn: '',
    maxRpn: '',
    minSeverity: '',
    maxSeverity: '',
    status: 'All'
  })
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [alertInsight, setAlertInsight] = useState<RPNAlertInsight | null>(null)
  const [failureModeInsights, setFailureModeInsights] = useState<FailureModeInsight[]>([])
  const [causeEffectInsight, setCauseEffectInsight] = useState<CauseEffectInsight | null>(null)
  const [controlEffectiveness, setControlEffectiveness] = useState<ControlEffectivenessInsight[]>([])
  const [forecastInsight, setForecastInsight] = useState<RPNForecastInsight[]>([])

  const openCreateItem = () => {
    setEditingItem(null)
    setItemForm(defaultItemState)
    setItemDialogOpen(true)
  }

  const openEditItem = (record: FMEAItemRecord) => {
    setEditingItem(record)
    setItemForm({
      item_function: record.item_function,
      failure_mode: record.failure_mode,
      effects: record.effects || '',
      severity: record.severity,
      causes: record.causes || '',
      occurrence: record.occurrence,
      current_controls: record.current_controls || '',
      detection: record.detection,
      recommended_actions: record.recommended_actions || '',
      responsibility_user_id: record.responsibility_user_id ? String(record.responsibility_user_id) : '',
      target_date: record.target_date || '',
      actions_taken: record.actions_taken || '',
      status: record.status,
      new_severity: record.new_severity ? String(record.new_severity) : '',
      new_occurrence: record.new_occurrence ? String(record.new_occurrence) : '',
      new_detection: record.new_detection ? String(record.new_detection) : ''
    })
    setItemDialogOpen(true)
  }

  const openCreateAction = () => {
    setEditingAction(null)
    setActionForm(defaultActionState)
    setActionDialogOpen(true)
  }

  const openEditAction = (record: FMEAActionRecord) => {
    setEditingAction(record)
    setActionForm({
      title: record.title,
      description: record.description || '',
      owner_user_id: String(record.owner_user_id),
      status: record.status,
      due_date: record.due_date || '',
      item_id: record.item_id ? String(record.item_id) : ''
    })
    setActionDialogOpen(true)
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const rpnOk = (!filters.minRpn || item.rpn >= Number(filters.minRpn)) && (!filters.maxRpn || item.rpn <= Number(filters.maxRpn))
      const severityOk = (!filters.minSeverity || item.severity >= Number(filters.minSeverity)) && (!filters.maxSeverity || item.severity <= Number(filters.maxSeverity))
      const statusOk = filters.status === 'All' || item.status === filters.status
      return rpnOk && severityOk && statusOk
    })
  }, [items, filters])

  const rpnDistribution = useMemo(() => {
    const buckets = [
      { range: '1-100', min: 1, max: 100, count: 0 },
      { range: '101-200', min: 101, max: 200, count: 0 },
      { range: '201-500', min: 201, max: 500, count: 0 },
      { range: '501+', min: 501, max: 10000, count: 0 }
    ]
    for (const item of items) {
      const bucket = buckets.find((entry) => item.rpn >= entry.min && item.rpn <= entry.max)
      if (bucket) bucket.count += 1
    }
    return buckets
  }, [items])

  const paretoData = useMemo(() => {
    return [...items]
      .sort((a, b) => b.rpn - a.rpn)
      .slice(0, 8)
      .map((item) => ({
        name: item.failure_mode,
        rpn: item.rpn
      }))
  }, [items])

  const riskMatrixData = useMemo(() => {
    return items.map((item) => ({
      x: item.occurrence,
      y: item.severity,
      z: item.rpn,
      label: item.failure_mode
    }))
  }, [items])

  const actionPriority = useMemo(() => {
    return [...items]
      .filter((item) => item.recommended_actions)
      .sort((a, b) => b.rpn - a.rpn)
      .slice(0, 6)
  }, [items])

  const handleDeleteItem = async (record: FMEAItemRecord) => {
    if (!fmea) return
    if (!confirm(`Delete item "${record.failure_mode}"?`)) return
    try {
      await api(`/fmea/${fmea.id}/items/${record.id}`, {
        method: 'DELETE'
      })
      onRefresh()
    } catch (error) {
      console.error(error)
      alert('Unable to delete item. Try again later.')
    }
  }

  const handleDeleteAction = async (record: FMEAActionRecord) => {
    if (!fmea) return
    if (!confirm(`Delete action "${record.title}"?`)) return
    try {
      await api(`/fmea/${fmea.id}/actions/${record.id}`, {
        method: 'DELETE'
      })
      onRefresh()
    } catch (error) {
      console.error(error)
      alert('Unable to delete action. Try again later.')
    }
  }

  const saveItem = async () => {
    if (!fmea) return
    if (!itemForm.item_function || !itemForm.failure_mode) {
      alert('Item/function and failure mode are required.')
      return
    }
    try {
      setIsSavingItem(true)
      const payload = {
        item_function: itemForm.item_function,
        failure_mode: itemForm.failure_mode,
        effects: itemForm.effects || null,
        severity: Number(itemForm.severity),
        causes: itemForm.causes || null,
        occurrence: Number(itemForm.occurrence),
        current_controls: itemForm.current_controls || null,
        detection: Number(itemForm.detection),
        recommended_actions: itemForm.recommended_actions || null,
        responsibility_user_id: itemForm.responsibility_user_id ? Number(itemForm.responsibility_user_id) : null,
        target_date: itemForm.target_date || null,
        actions_taken: itemForm.actions_taken || null,
        status: itemForm.status,
        new_severity: itemForm.new_severity ? Number(itemForm.new_severity) : null,
        new_occurrence: itemForm.new_occurrence ? Number(itemForm.new_occurrence) : null,
        new_detection: itemForm.new_detection ? Number(itemForm.new_detection) : null
      }
      await api(`/fmea/${fmea.id}/items${editingItem ? `/${editingItem.id}` : ''}`, {
        method: editingItem ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      })
      setItemDialogOpen(false)
      setEditingItem(null)
      onRefresh()
    } catch (error) {
      console.error(error)
      if (error instanceof Error) alert(error.message)
    } finally {
      setIsSavingItem(false)
    }
  }

  const saveAction = async () => {
    if (!fmea) return
    if (!actionForm.title || !actionForm.owner_user_id) {
      alert('Title and action owner are required.')
      return
    }
    try {
      setIsSavingAction(true)
      const payload = {
        title: actionForm.title,
        description: actionForm.description || null,
        owner_user_id: Number(actionForm.owner_user_id),
        status: actionForm.status,
        due_date: actionForm.due_date || null,
        item_id: actionForm.item_id ? Number(actionForm.item_id) : null
      }
      await api(`/fmea/${fmea.id}/actions${editingAction ? `/${editingAction.id}` : ''}`, {
        method: editingAction ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      })
      setActionDialogOpen(false)
      setEditingAction(null)
      onRefresh()
    } catch (error) {
      console.error(error)
      if (error instanceof Error) alert(error.message)
    } finally {
      setIsSavingAction(false)
    }
  }

  const callAiEndpoint = async <T,>(path: string, payload: Record<string, unknown>): Promise<T | null> => {
    try {
      setAiLoading(path)
      const data = await api<T>(path, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      return data
    } catch (error) {
      console.error(error)
      if (error instanceof Error) alert(error.message)
      return null
    } finally {
      setAiLoading(null)
    }
  }

  const buildItemPayload = () =>
    items.map((item) => ({
      id: item.id,
      item_function: item.item_function,
      failure_mode: item.failure_mode,
      effects: item.effects,
      severity: item.severity,
      causes: item.causes,
      occurrence: item.occurrence,
      current_controls: item.current_controls,
      detection: item.detection,
      rpn: item.rpn,
      recommended_actions: item.recommended_actions,
      status: item.status,
      new_severity: item.new_severity,
      new_occurrence: item.new_occurrence,
      new_detection: item.new_detection,
      new_rpn: item.new_rpn
    }))

  const requestRpnAlerts = async () => {
    const data = await callAiEndpoint<RPNAlertInsight>('/fmea/ai/rpn-alerts', {
      threshold: fmea?.highest_rpn && fmea.highest_rpn > 0 ? Math.max(200, fmea.highest_rpn) : 200,
      items: buildItemPayload()
    })
    if (data) setAlertInsight(data)
  }

  const requestFailureModes = async () => {
    if (!fmea) return
    const data = await callAiEndpoint<{ failure_modes: FailureModeInsight[] }>('/fmea/ai/failure-mode-predictions', {
      process: {
        title: fmea.title,
        process_or_product_name: fmea.process_or_product_name,
        description: fmea.description,
        scope: fmea.scope,
        departments: fmea.departments
      },
      historical_patterns: buildItemPayload()
    })
    if (data?.failure_modes) setFailureModeInsights(data.failure_modes)
  }

  const requestCauseEffect = async () => {
    const data = await callAiEndpoint<CauseEffectInsight>('/fmea/ai/cause-effect', {
      items: buildItemPayload(),
      focus: fmea?.process_or_product_name
    })
    if (data) setCauseEffectInsight(data)
  }

  const requestControlEffectiveness = async () => {
    const data = await callAiEndpoint<{ evaluations: ControlEffectivenessInsight[] }>('/fmea/ai/control-effectiveness', {
      items: buildItemPayload()
    })
    if (data?.evaluations) setControlEffectiveness(data.evaluations)
  }

  const requestRpnForecast = async () => {
    const data = await callAiEndpoint<{ projections: RPNForecastInsight[] }>('/fmea/ai/rpn-forecast', {
      items: buildItemPayload(),
      proposed_actions: actions.map((action) => ({
        id: action.id,
        title: action.title,
        status: action.status,
        due_date: action.due_date,
        item_id: action.item_id
      }))
    })
    if (data?.projections) setForecastInsight(data.projections)
  }

  return (
    <div className="space-y-6">
      <Card className="border-green-100 shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900">Worksheet</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage failure modes, causes and recommended actions for {fmea?.title || 'the selected study'}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openCreateItem} className="flex items-center gap-2 bg-primary text-white">
              <FilePlus className="h-4 w-4" />
              Add Row
            </Button>
            <Button variant="secondary" onClick={openCreateAction} className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-700">
              <ClipboardCheck className="h-4 w-4" />
              Log Action
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-dashed border-emerald-200 bg-emerald-50/50 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Gauge className="h-4 w-4" />
                Highest RPN: <span className="font-semibold text-emerald-700">{fmea?.highest_rpn ?? 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="h-4 w-4" /> Filters
              </div>
              <Input
                placeholder="Min RPN"
                value={filters.minRpn}
                onChange={(event) => setFilters((prev) => ({ ...prev, minRpn: event.target.value }))}
                className="h-9 w-24 border-emerald-100"
              />
              <Input
                placeholder="Max RPN"
                value={filters.maxRpn}
                onChange={(event) => setFilters((prev) => ({ ...prev, maxRpn: event.target.value }))}
                className="h-9 w-24 border-emerald-100"
              />
              <Input
                placeholder="Min Severity"
                value={filters.minSeverity}
                onChange={(event) => setFilters((prev) => ({ ...prev, minSeverity: event.target.value }))}
                className="h-9 w-28 border-emerald-100"
              />
              <Input
                placeholder="Max Severity"
                value={filters.maxSeverity}
                onChange={(event) => setFilters((prev) => ({ ...prev, maxSeverity: event.target.value }))}
                className="h-9 w-28 border-emerald-100"
              />
              <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger className="h-9 w-36 border-emerald-100">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setFilters({ minRpn: '', maxRpn: '', minSeverity: '', maxSeverity: '', status: 'All' })}>
                Reset
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-emerald-50/40">
                  <TableHead>Item / Function</TableHead>
                  <TableHead>Failure Mode</TableHead>
                  <TableHead>Effects</TableHead>
                  <TableHead className="w-20">S</TableHead>
                  <TableHead>Causes</TableHead>
                  <TableHead className="w-20">O</TableHead>
                  <TableHead>Current Controls</TableHead>
                  <TableHead className="w-20">D</TableHead>
                  <TableHead className="w-24">RPN</TableHead>
                  <TableHead>Recommended Actions</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={13}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="py-8 text-center text-sm text-muted-foreground">
                      No worksheet items match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} className="align-top text-sm">
                      <TableCell>{item.item_function}</TableCell>
                      <TableCell>{item.failure_mode}</TableCell>
                      <TableCell className="whitespace-pre-wrap text-xs text-muted-foreground">{item.effects}</TableCell>
                      <TableCell className="text-center font-semibold text-emerald-700">{item.severity}</TableCell>
                      <TableCell className="whitespace-pre-wrap text-xs text-muted-foreground">{item.causes}</TableCell>
                      <TableCell className="text-center font-semibold text-emerald-700">{item.occurrence}</TableCell>
                      <TableCell className="whitespace-pre-wrap text-xs text-muted-foreground">{item.current_controls}</TableCell>
                      <TableCell className="text-center font-semibold text-emerald-700">{item.detection}</TableCell>
                      <TableCell>
                        <Badge className={`text-white ${item.rpn >= 200 ? 'bg-red-500' : item.rpn >= 100 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                          {item.rpn}
                        </Badge>
                        {item.new_rpn ? (
                          <div className="text-xs text-muted-foreground">→ {item.new_rpn}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap text-xs text-muted-foreground">{item.recommended_actions}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.responsibility_user_id ? teamLookup.get(item.responsibility_user_id) || `User ${item.responsibility_user_id}` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditItem(item)}>Edit Row</DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingItem(null)
                                setItemForm({
                                  ...itemForm,
                                  item_function: item.item_function,
                                  failure_mode: item.failure_mode,
                                  effects: item.effects || '',
                                  severity: item.severity,
                                  causes: item.causes || '',
                                  occurrence: item.occurrence,
                                  current_controls: item.current_controls || '',
                                  detection: item.detection,
                                  recommended_actions: item.recommended_actions || '',
                                  responsibility_user_id: item.responsibility_user_id ? String(item.responsibility_user_id) : '',
                                  target_date: item.target_date || '',
                                  actions_taken: item.actions_taken || '',
                                  status: item.status,
                                  new_severity: item.new_severity ? String(item.new_severity) : '',
                                  new_occurrence: item.new_occurrence ? String(item.new_occurrence) : '',
                                  new_detection: item.new_detection ? String(item.new_detection) : ''
                                })
                                setItemDialogOpen(true)
                              }}
                            >
                              Duplicate Row
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => alert('Risk assessment link coming soon.')}>Link to Risk Assessment</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => alert('Evidence management coming soon.')}>Add Evidence</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteItem(item)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-green-100 shadow-sm">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-emerald-800">Action Tracker</CardTitle>
            <p className="text-xs text-muted-foreground">Monitor mitigation progress and overdue items.</p>
          </div>
          <Badge variant="outline" className="border-emerald-200 text-emerald-700">
            {actions.length} actions logged
          </Badge>
        </CardHeader>
        <CardContent className="rounded-lg border border-emerald-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-emerald-50/40">
                <TableHead>Title</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Linked Item</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ) : actions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    No mitigation actions captured yet.
                  </TableCell>
                </TableRow>
              ) : (
                actions.map((action) => (
                  <TableRow key={action.id} className="text-sm">
                    <TableCell>{action.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {teamLookup.get(action.owner_user_id) || `User ${action.owner_user_id}`}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`border-emerald-200 ${action.status === 'Completed' ? 'text-emerald-700' : action.status === 'Overdue' ? 'text-red-600' : 'text-amber-600'}`}
                      >
                        {action.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{action.due_date ? new Date(action.due_date).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {action.item_id ? items.find((item) => item.id === action.item_id)?.failure_mode || `Item ${action.item_id}` : '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditAction(action)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteAction(action)} className="text-red-600">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-green-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <BarChart3 className="h-4 w-4" /> RPN Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rpnDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#059669" name="Item Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-green-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <LineChart className="h-4 w-4" /> Top Failure Modes (Pareto)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paretoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="rpn" fill="#f97316" name="RPN" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {paretoData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span>{item.name}</span>
                  <span className="font-semibold text-emerald-700">{item.rpn}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-green-100 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <ShieldAlert className="h-4 w-4" /> Risk Matrix (Severity vs Occurrence)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid />
                <XAxis type="number" dataKey="x" name="Occurrence" domain={[1, 10]} />
                <YAxis type="number" dataKey="y" name="Severity" domain={[1, 10]} />
                <ZAxis type="number" dataKey="z" range={[50, 400]} name="RPN" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={riskMatrixData} fill="#2563eb" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-green-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-emerald-800">Action Priority List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actionPriority.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recommended actions recorded yet.</p>
            ) : (
              actionPriority.map((item) => (
                <div key={item.id} className="rounded-md border border-emerald-100 bg-emerald-50/40 p-3">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{item.failure_mode}</span>
                    <Badge className="bg-emerald-600 text-white">RPN {item.rpn}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.recommended_actions || 'Define mitigation plan'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-emerald-100 bg-emerald-50/40 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <SparkleIcon /> AI Insight Center
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Button
              variant="secondary"
              className="flex items-center gap-2 border border-emerald-200 bg-white text-emerald-700"
              onClick={requestRpnAlerts}
              disabled={aiLoading === '/fmea/ai/rpn-alerts'}
            >
              {aiLoading === '/fmea/ai/rpn-alerts' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              RPN Alerts
            </Button>
            <Button
              variant="secondary"
              className="flex items-center gap-2 border border-emerald-200 bg-white text-emerald-700"
              onClick={requestFailureModes}
              disabled={aiLoading === '/fmea/ai/failure-mode-predictions'}
            >
              {aiLoading === '/fmea/ai/failure-mode-predictions' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus className="h-4 w-4" />}
              Failure Mode Ideas
            </Button>
            <Button
              variant="secondary"
              className="flex items-center gap-2 border border-emerald-200 bg-white text-emerald-700"
              onClick={requestCauseEffect}
              disabled={aiLoading === '/fmea/ai/cause-effect'}
            >
              {aiLoading === '/fmea/ai/cause-effect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
              Cause & Effect
            </Button>
            <Button
              variant="secondary"
              className="flex items-center gap-2 border border-emerald-200 bg-white text-emerald-700"
              onClick={requestControlEffectiveness}
              disabled={aiLoading === '/fmea/ai/control-effectiveness'}
            >
              {aiLoading === '/fmea/ai/control-effectiveness' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              Control Assessment
            </Button>
            <Button
              variant="secondary"
              className="flex items-center gap-2 border border-emerald-200 bg-white text-emerald-700"
              onClick={requestRpnForecast}
              disabled={aiLoading === '/fmea/ai/rpn-forecast'}
            >
              {aiLoading === '/fmea/ai/rpn-forecast' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightCircle className="h-4 w-4" />}
              RPN Forecast
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {alertInsight && (
              <Alert className="border-emerald-200 bg-white">
                <AlertTitle>Threshold {alertInsight.threshold}</AlertTitle>
                <AlertDescription className="space-y-2 text-sm text-muted-foreground">
                  <p>{alertInsight.summary}</p>
                  <ul className="ml-4 list-disc">
                    {alertInsight.alerts.map((alert) => (
                      <li key={alert}>{alert}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {failureModeInsights.length > 0 && (
              <Alert className="border-emerald-200 bg-white">
                <AlertTitle>Suggested Failure Modes</AlertTitle>
                <AlertDescription className="space-y-2 text-sm text-muted-foreground">
                  {failureModeInsights.map((insight) => (
                    <div key={`${insight.failure_mode}-${insight.item_function}`}>
                      <p className="font-semibold text-emerald-700">{insight.failure_mode}</p>
                      <p className="text-xs">Function: {insight.item_function}</p>
                      <p className="text-xs">Effects: {insight.effects}</p>
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            )}
            {causeEffectInsight && (
              <Alert className="border-emerald-200 bg-white">
                <AlertTitle>Cause & Effect Insights</AlertTitle>
                <AlertDescription className="space-y-2 text-sm text-muted-foreground">
                  <ul className="ml-4 list-disc">
                    {causeEffectInsight.insights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {controlEffectiveness.length > 0 && (
              <Alert className="border-emerald-200 bg-white">
                <AlertTitle>Control Effectiveness</AlertTitle>
                <AlertDescription className="space-y-2 text-sm text-muted-foreground">
                  {controlEffectiveness.map((item) => (
                    <div key={`${item.item_reference}-${item.effectiveness}`}>
                      <p className="font-semibold text-emerald-700">{item.item_reference}</p>
                      <p className="text-xs">{item.effectiveness}</p>
                      <p className="text-xs">{item.recommendation}</p>
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            )}
            {forecastInsight.length > 0 && (
              <Alert className="border-emerald-200 bg-white">
                <AlertTitle>Projected RPN Impact</AlertTitle>
                <AlertDescription className="space-y-2 text-sm text-muted-foreground">
                  {forecastInsight.map((projection) => (
                    <div key={`${projection.item_reference}-${projection.projected_rpn}`}>
                      <p className="font-semibold text-emerald-700">{projection.item_reference}</p>
                      <p className="text-xs">
                        Current: {projection.current_rpn ?? '—'} → Projected: {projection.projected_rpn ?? '—'}
                      </p>
                      <p className="text-xs">{projection.recommendation}</p>
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Worksheet Row' : 'Add Worksheet Row'}</DialogTitle>
            <DialogDescription>
              Capture the core FMEA line including severity, occurrence and detection ratings.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Item / Function *</Label>
              <Input value={itemForm.item_function} onChange={(event) => setItemForm((prev) => ({ ...prev, item_function: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Failure Mode *</Label>
              <Input value={itemForm.failure_mode} onChange={(event) => setItemForm((prev) => ({ ...prev, failure_mode: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Potential Effects</Label>
              <Textarea value={itemForm.effects} onChange={(event) => setItemForm((prev) => ({ ...prev, effects: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Severity (S)</Label>
              <Input type="number" min={fmea?.severity_min ?? 1} max={fmea?.severity_max ?? 10} value={itemForm.severity} onChange={(event) => setItemForm((prev) => ({ ...prev, severity: Number(event.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>Occurrence (O)</Label>
              <Input type="number" min={fmea?.occurrence_min ?? 1} max={fmea?.occurrence_max ?? 10} value={itemForm.occurrence} onChange={(event) => setItemForm((prev) => ({ ...prev, occurrence: Number(event.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>Detection (D)</Label>
              <Input type="number" min={fmea?.detection_min ?? 1} max={fmea?.detection_max ?? 10} value={itemForm.detection} onChange={(event) => setItemForm((prev) => ({ ...prev, detection: Number(event.target.value) }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Causes</Label>
              <Textarea value={itemForm.causes} onChange={(event) => setItemForm((prev) => ({ ...prev, causes: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Current Controls</Label>
              <Textarea value={itemForm.current_controls} onChange={(event) => setItemForm((prev) => ({ ...prev, current_controls: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Recommended Actions</Label>
              <Textarea value={itemForm.recommended_actions} onChange={(event) => setItemForm((prev) => ({ ...prev, recommended_actions: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Action Owner (User ID)</Label>
              <Input value={itemForm.responsibility_user_id} onChange={(event) => setItemForm((prev) => ({ ...prev, responsibility_user_id: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Target Date</Label>
              <Input type="date" value={itemForm.target_date} onChange={(event) => setItemForm((prev) => ({ ...prev, target_date: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Actions Taken</Label>
              <Textarea value={itemForm.actions_taken} onChange={(event) => setItemForm((prev) => ({ ...prev, actions_taken: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={itemForm.status} onValueChange={(value) => setItemForm((prev) => ({ ...prev, status: value as ItemFormState['status'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>New Severity</Label>
              <Input value={itemForm.new_severity} onChange={(event) => setItemForm((prev) => ({ ...prev, new_severity: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>New Occurrence</Label>
              <Input value={itemForm.new_occurrence} onChange={(event) => setItemForm((prev) => ({ ...prev, new_occurrence: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>New Detection</Label>
              <Input value={itemForm.new_detection} onChange={(event) => setItemForm((prev) => ({ ...prev, new_detection: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveItem} disabled={isSavingItem}>
              {isSavingItem && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Row
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAction ? 'Edit Action' : 'Add Action'}</DialogTitle>
            <DialogDescription>Track mitigation progress and owners.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Action Title *</Label>
              <Input value={actionForm.title} onChange={(event) => setActionForm((prev) => ({ ...prev, title: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={actionForm.description} onChange={(event) => setActionForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Owner (User ID) *</Label>
              <Input value={actionForm.owner_user_id} onChange={(event) => setActionForm((prev) => ({ ...prev, owner_user_id: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={actionForm.status} onValueChange={(value) => setActionForm((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={actionForm.due_date} onChange={(event) => setActionForm((prev) => ({ ...prev, due_date: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Related Item</Label>
              <Select value={actionForm.item_id} onValueChange={(value) => setActionForm((prev) => ({ ...prev, item_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id.toString()}>
                      {item.failure_mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAction} disabled={isSavingAction}>
              {isSavingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SparkleIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 fill-emerald-600" aria-hidden="true"><path d="M12 2.5 13.9 8h5.6l-4.5 3.4L16.9 17 12 13.8 7.1 17l1.9-5.6L4.5 8h5.6z" /></svg>
}
