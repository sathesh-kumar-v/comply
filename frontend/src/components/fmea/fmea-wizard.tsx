"use client"

import { useEffect, useMemo, useState } from 'react'
import {
  FMEARecord,
  TeamOption,
  FMEAInitialValues,
  TeamAIResponse,
  ScaleAIResponse,
  ScopeAIResponse
} from './types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, UsersRound } from 'lucide-react'
import { api } from '@/lib/api'

const FMEA_TYPES = [
  'Process FMEA (PFMEA)',
  'Design FMEA (DFMEA)',
  'System FMEA (SFMEA)',
  'Service FMEA',
  'Software FMEA'
] as const

interface WizardProps {
  teamOptions: TeamOption[]
  onCreated: (record: FMEARecord) => void
  initialValues?: FMEAInitialValues
}

type FormState = {
  title: string
  fmea_type: (typeof FMEA_TYPES)[number]
  process_or_product_name: string
  description: string
  departments: string[]
  review_date: string
  standard: string
  scope: string
  assumptions: string
  severity_min: number
  severity_max: number
  occurrence_min: number
  occurrence_max: number
  detection_min: number
  detection_max: number
  team_lead_id: string
}

const steps = [
  {
    title: 'Configuration',
    description: 'Set up the FMEA context and metadata.'
  },
  {
    title: 'Scope & Rating Scales',
    description: 'Capture scope and calibrate risk rating scales.'
  },
  {
    title: 'Team & Review Plan',
    description: 'Assign the core team and finalize review cadence.'
  }
]

export function FMEACreationWizard({ teamOptions, onCreated, initialValues }: WizardProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [departmentInput, setDepartmentInput] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<number[]>([])
  const [memberRoles, setMemberRoles] = useState<Record<number, string>>({})
  const [teamSuggestions, setTeamSuggestions] = useState<TeamAIResponse | null>(null)
  const [scaleRecommendations, setScaleRecommendations] = useState<ScaleAIResponse | null>(null)
  const [scopeSuggestions, setScopeSuggestions] = useState<ScopeAIResponse | null>(null)
  const [aiLoading, setAiLoading] = useState<string | null>(null)

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  const [formData, setFormData] = useState<FormState>({
    title: '',
    fmea_type: 'Process FMEA (PFMEA)',
    process_or_product_name: '',
    description: '',
    departments: [],
    review_date: today,
    standard: 'AIAG-VDA',
    scope: '',
    assumptions: '',
    severity_min: 1,
    severity_max: 10,
    occurrence_min: 1,
    occurrence_max: 10,
    detection_min: 1,
    detection_max: 10,
    team_lead_id: ''
  })

  useEffect(() => {
    if (!initialValues) return
    setFormData((prev) => ({
      ...prev,
      title: initialValues.title ?? prev.title,
      fmea_type: (initialValues.fmea_type as FormState['fmea_type']) ?? prev.fmea_type,
      process_or_product_name: initialValues.process_or_product_name ?? prev.process_or_product_name,
      description: initialValues.description ?? prev.description,
      scope: initialValues.scope ?? prev.scope,
      assumptions: initialValues.assumptions ?? prev.assumptions,
      standard: initialValues.standard ?? prev.standard
    }))
  }, [initialValues])

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const addDepartment = () => {
    const value = departmentInput.trim()
    if (!value || formData.departments.includes(value)) return
    setFormData((prev) => ({ ...prev, departments: [...prev.departments, value] }))
    setDepartmentInput('')
  }

  const removeDepartment = (dept: string) => {
    setFormData((prev) => ({
      ...prev,
      departments: prev.departments.filter((entry) => entry !== dept)
    }))
  }

  const toggleTeamMember = (id: number) => {
    setSelectedMembers((prev) => {
      if (prev.includes(id)) {
        const filtered = prev.filter((memberId) => memberId !== id)
        setMemberRoles((roles) => {
          const newRoles = { ...roles }
          delete newRoles[id]
          return newRoles
        })
        return filtered
      }
      return [...prev, id]
    })
  }

  const changeMemberRole = (id: number, role: string) => {
    setMemberRoles((prev) => ({ ...prev, [id]: role }))
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
      console.error('AI request failed', error)
      if (error instanceof Error) {
        alert(error.message)
      }
      return null
    } finally {
      setAiLoading(null)
    }
  }

  const handleTeamSuggestions = async () => {
    const data = await callAiEndpoint<TeamAIResponse>('/fmea/ai/team-suggestions', {
      departments: formData.departments,
      required_skills: formData.description ? formData.description.split(',').map((entry) => entry.trim()).filter(Boolean) : [],
      existing_team: selectedMembers.map((id) => id.toString())
    })
    if (data) {
      setTeamSuggestions(data)
    }
  }

  const handleScaleRecommendations = async () => {
    const data = await callAiEndpoint<ScaleAIResponse>('/fmea/ai/scale-recommendations', {
      industry: formData.departments[0] || 'General Manufacturing',
      standard: formData.standard,
      risk_focus: formData.scope || formData.description
    })
    if (data) {
      setScaleRecommendations(data)
    }
  }

  const handleScopeAssist = async () => {
    if (!formData.description) {
      alert('Add a short process description to get AI scope support.')
      return
    }
    const data = await callAiEndpoint<ScopeAIResponse>('/fmea/ai/scope-assist', {
      process_description: formData.description,
      objectives: [formData.process_or_product_name],
      assumptions: formData.assumptions ? formData.assumptions.split('\n') : []
    })
    if (data) {
      setScopeSuggestions(data)
      setFormData((prev) => ({
        ...prev,
        scope: data.scope || prev.scope,
        assumptions: data.assumptions?.join('\n') || prev.assumptions
      }))
    }
  }

  const validateStep = () => {
    if (stepIndex === 0) {
      if (!formData.title || !formData.process_or_product_name || !formData.review_date) {
        alert('Title, process name and review date are required.')
        return false
      }
      return true
    }
    if (stepIndex === 1) {
      if (!formData.scope) {
        alert('Scope is required before continuing.')
        return false
      }
      return true
    }
    if (stepIndex === 2) {
      if (!formData.team_lead_id) {
        alert('Select a team lead.')
        return false
      }
      if (selectedMembers.length === 0) {
        alert('Select at least one team member.')
        return false
      }
      return true
    }
    return true
  }

  const handleNext = () => {
    if (!validateStep()) return
    if (stepIndex < steps.length - 1) {
      setStepIndex((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (stepIndex === 0) return
    setStepIndex((prev) => prev - 1)
  }

  const handleSubmit = async () => {
    if (!validateStep()) return
    try {
      setIsSubmitting(true)
      const record = await api<FMEARecord>('/fmea', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title,
          fmea_type: formData.fmea_type,
          process_or_product_name: formData.process_or_product_name,
          description: formData.description || null,
          departments: formData.departments,
          team_lead_id: Number(formData.team_lead_id),
          review_date: formData.review_date,
          standard: formData.standard || null,
          scope: formData.scope,
          assumptions: formData.assumptions || null,
          severity_min: Number(formData.severity_min),
          severity_max: Number(formData.severity_max),
          occurrence_min: Number(formData.occurrence_min),
          occurrence_max: Number(formData.occurrence_max),
          detection_min: Number(formData.detection_min),
          detection_max: Number(formData.detection_max),
          team_members: selectedMembers.map((id) => ({
            user_id: id,
            role: memberRoles[id] || 'Member'
          }))
        })
      })
      onCreated(record)
      setStepIndex(0)
      setFormData((prev) => ({
        ...prev,
        title: '',
        process_or_product_name: '',
        description: '',
        departments: [],
        scope: '',
        assumptions: '',
        team_lead_id: ''
      }))
      setSelectedMembers([])
      setMemberRoles({})
      setTeamSuggestions(null)
      setScaleRecommendations(null)
      setScopeSuggestions(null)
      alert('FMEA study created successfully.')
    } catch (error) {
      console.error('Create FMEA failed', error)
      if (error instanceof Error) {
        alert(error.message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentStep = steps[stepIndex]

  return (
    <Card className="border-green-100 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Create New FMEA</CardTitle>
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>
          </div>
          <Badge variant="outline" className="border-emerald-200 text-emerald-700">
            Step {stepIndex + 1} of {steps.length}: {currentStep.title}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {stepIndex === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fmea-title">FMEA Title *</Label>
              <Input
                id="fmea-title"
                value={formData.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="e.g., Supplier Incoming Inspection FMEA"
                className="border-emerald-100"
              />
            </div>
            <div className="space-y-2">
              <Label>FMEA Type *</Label>
              <Select value={formData.fmea_type} onValueChange={(value) => updateField('fmea_type', value as FormState['fmea_type'])}>
                <SelectTrigger className="border-emerald-100">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {FMEA_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="process-name">Process / Product *</Label>
              <Input
                id="process-name"
                value={formData.process_or_product_name}
                onChange={(event) => updateField('process_or_product_name', event.target.value)}
                placeholder="e.g., Automated filling line"
                className="border-emerald-100"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Process Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Provide background information, known risks or compliance drivers."
                className="min-h-[100px] border-emerald-100"
              />
            </div>
            <div className="space-y-2">
              <Label>Departments *</Label>
              <div className="flex gap-2">
                <Input
                  value={departmentInput}
                  onChange={(event) => setDepartmentInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addDepartment()
                    }
                  }}
                  placeholder="e.g., Quality Assurance"
                  className="border-emerald-100"
                />
                <Button type="button" variant="outline" onClick={addDepartment}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.departments.map((dept) => (
                  <Badge
                    key={dept}
                    variant="secondary"
                    className="cursor-pointer bg-emerald-50 text-emerald-800"
                    onClick={() => removeDepartment(dept)}
                  >
                    {dept}
                  </Badge>
                ))}
                {formData.departments.length === 0 && (
                  <span className="text-xs text-muted-foreground">Click Add to include departments.</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Review Date *</Label>
              <Input
                type="date"
                value={formData.review_date}
                onChange={(event) => updateField('review_date', event.target.value)}
                className="border-emerald-100"
              />
            </div>
            <div className="space-y-2">
              <Label>FMEA Standard</Label>
              <Select value={formData.standard} onValueChange={(value) => updateField('standard', value)}>
                <SelectTrigger className="border-emerald-100">
                  <SelectValue placeholder="Select standard" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AIAG-VDA">AIAG-VDA</SelectItem>
                  <SelectItem value="IEC 60812">IEC 60812</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {stepIndex === 1 && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="flex-1 space-y-2">
                <Label htmlFor="scope">Scope *</Label>
                <Textarea
                  id="scope"
                  value={formData.scope}
                  onChange={(event) => updateField('scope', event.target.value)}
                  placeholder="Define the system boundaries, focus areas and assumptions."
                  className="min-h-[120px] border-emerald-100"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleScopeAssist}
                disabled={aiLoading === '/fmea/ai/scope-assist'}
                className="mt-2 flex h-fit items-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                {aiLoading === '/fmea/ai/scope-assist' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                AI Scope Assist
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assumptions">Assumptions</Label>
              <Textarea
                id="assumptions"
                value={formData.assumptions}
                onChange={(event) => updateField('assumptions', event.target.value)}
                placeholder="List any known constraints or assumptions."
                className="min-h-[100px] border-emerald-100"
              />
            </div>
            {scopeSuggestions && (
              <Alert className="border-emerald-200 bg-emerald-50">
                <AlertTitle>AI Suggested Scope Outline</AlertTitle>
                <AlertDescription>
                  <p className="font-medium">{scopeSuggestions.scope}</p>
                  {scopeSuggestions.objectives?.length ? (
                    <div className="mt-2">
                      <p className="text-sm font-semibold">Objectives</p>
                      <ul className="ml-4 list-disc text-sm text-muted-foreground">
                        {scopeSuggestions.objectives.map((objective) => (
                          <li key={objective}>{objective}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Severity Range</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={formData.severity_max}
                    value={formData.severity_min}
                    onChange={(event) => updateField('severity_min', Number(event.target.value))}
                    className="border-emerald-100"
                  />
                  <Input
                    type="number"
                    min={formData.severity_min}
                    max={10}
                    value={formData.severity_max}
                    onChange={(event) => updateField('severity_max', Number(event.target.value))}
                    className="border-emerald-100"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Occurrence Range</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={formData.occurrence_max}
                    value={formData.occurrence_min}
                    onChange={(event) => updateField('occurrence_min', Number(event.target.value))}
                    className="border-emerald-100"
                  />
                  <Input
                    type="number"
                    min={formData.occurrence_min}
                    max={10}
                    value={formData.occurrence_max}
                    onChange={(event) => updateField('occurrence_max', Number(event.target.value))}
                    className="border-emerald-100"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Detection Range</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={formData.detection_max}
                    value={formData.detection_min}
                    onChange={(event) => updateField('detection_min', Number(event.target.value))}
                    className="border-emerald-100"
                  />
                  <Input
                    type="number"
                    min={formData.detection_min}
                    max={10}
                    value={formData.detection_max}
                    onChange={(event) => updateField('detection_max', Number(event.target.value))}
                    className="border-emerald-100"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground">AI Scale Recommendations</h4>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleScaleRecommendations}
                  disabled={aiLoading === '/fmea/ai/scale-recommendations'}
                  className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  {aiLoading === '/fmea/ai/scale-recommendations' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Calibrate with AI
                </Button>
              </div>
              {scaleRecommendations ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {([
                    ['Severity Scale', scaleRecommendations.severity_scale],
                    ['Occurrence Scale', scaleRecommendations.occurrence_scale],
                    ['Detection Scale', scaleRecommendations.detection_scale]
                  ] as const).map(([title, rows]) => (
                    <Card key={title} className="border-emerald-100">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm font-semibold text-emerald-800">{title}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">Score</TableHead>
                              <TableHead>Label</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row) => (
                              <TableRow key={`${title}-${row.score}`}>
                                <TableCell className="font-semibold text-emerald-700">{row.score}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{row.label}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Request AI calibration to see industry-aligned scale descriptors.</p>
              )}
            </div>
          </div>
        )}

        {stepIndex === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Team Lead *</Label>
              <Select value={formData.team_lead_id} onValueChange={(value) => updateField('team_lead_id', value)}>
                <SelectTrigger className="border-emerald-100">
                  <SelectValue placeholder="Select team lead" />
                </SelectTrigger>
                <SelectContent>
                  {teamOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id.toString()}>
                      {option.full_name} {option.position ? `• ${option.position}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Team Members *</Label>
                <Button
                  type="button"
                  variant="secondary"
                  className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-700"
                  onClick={handleTeamSuggestions}
                  disabled={aiLoading === '/fmea/ai/team-suggestions'}
                >
                  {aiLoading === '/fmea/ai/team-suggestions' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UsersRound className="h-4 w-4" />
                  )}
                  Suggest with AI
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {teamOptions.map((option) => (
                  <div key={option.id} className="flex flex-col gap-1 rounded-md border border-emerald-100 p-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-emerald-200 text-primary focus-visible:outline-primary"
                        checked={selectedMembers.includes(option.id)}
                        onChange={() => toggleTeamMember(option.id)}
                      />
                      {option.full_name}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {option.department || 'No department listed'}
                      {option.position ? ` • ${option.position}` : ''}
                    </p>
                    {selectedMembers.includes(option.id) && (
                      <Input
                        value={memberRoles[option.id] || ''}
                        onChange={(event) => changeMemberRole(option.id, event.target.value)}
                        placeholder="Role for this analysis (optional)"
                        className="h-8 border-emerald-100 text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {teamSuggestions && (
              <Alert className="border-emerald-200 bg-emerald-50">
                <AlertTitle>AI Team Recommendations</AlertTitle>
                <AlertDescription className="space-y-3 text-sm">
                  {teamSuggestions.recommended_leads.length ? (
                    <div>
                      <p className="font-semibold">Suggested Leads</p>
                      <ul className="ml-4 list-disc text-muted-foreground">
                        {teamSuggestions.recommended_leads.map((lead) => (
                          <li key={lead.name}>{lead.name} {lead.reason ? `– ${lead.reason}` : ''}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {teamSuggestions.recommended_members.length ? (
                    <div>
                      <p className="font-semibold">Suggested Members</p>
                      <ul className="ml-4 list-disc text-muted-foreground">
                        {teamSuggestions.recommended_members.map((member) => (
                          <li key={`${member.name}-${member.role}`}>{member.name}{member.role ? ` (${member.role})` : ''}{member.reason ? ` – ${member.reason}` : ''}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {teamSuggestions.notes.length ? (
                    <p className="text-xs text-muted-foreground">{teamSuggestions.notes.join(' • ')}</p>
                  ) : null}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={handlePrev} disabled={stepIndex === 0}>
            Back
          </Button>
          {stepIndex < steps.length - 1 ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting} className="flex items-center gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Finish & Create
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
