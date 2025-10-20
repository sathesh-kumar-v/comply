"use client"

import { useState } from 'react'
import { TemplateSuggestion } from './types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'

interface TemplateImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplyTemplate: (suggestion: TemplateSuggestion) => void
}

export function TemplateImportDialog({ open, onOpenChange, onApplyTemplate }: TemplateImportDialogProps) {
  const [industry, setIndustry] = useState('Manufacturing')
  const [processType, setProcessType] = useState('Process FMEA (PFMEA)')
  const [description, setDescription] = useState('')
  const [keywords, setKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<TemplateSuggestion[]>([])
  const [notes, setNotes] = useState<string[]>([])

  const fetchSuggestions = async () => {
    try {
      setLoading(true)
      const data = await api<{ templates?: TemplateSuggestion[]; notes?: string[] }>('/fmea/ai/template-suggestions', {
        method: 'POST',
        body: JSON.stringify({
          industry,
          process_type: processType,
          description,
          keywords: keywords
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        })
      })
      setSuggestions(data.templates || [])
      setNotes(data.notes || [])
    } catch (error) {
      console.error(error)
      if (error instanceof Error) alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import FMEA Template</DialogTitle>
          <DialogDescription>
            Use the AI assistant to suggest starter templates tailored to your industry and process focus.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-industry">Industry *</Label>
              <Input
                id="template-industry"
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                placeholder="e.g., Pharmaceutical Manufacturing"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-type">Process Type *</Label>
              <Input
                id="template-type"
                value={processType}
                onChange={(event) => setProcessType(event.target.value)}
                placeholder="Process FMEA (PFMEA)"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="template-description">Process Overview</Label>
              <Textarea
                id="template-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Share context such as equipment, regulations or customer requirements."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="template-keywords">Keywords</Label>
              <Input
                id="template-keywords"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="Comma separated e.g., ISO 13485, aseptic, cleanroom"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={fetchSuggestions}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Suggestions
          </Button>

          {notes.length > 0 && (
            <Alert className="border-emerald-200 bg-emerald-50">
              <AlertTitle>Assistant Notes</AlertTitle>
              <AlertDescription className="text-sm text-muted-foreground">
                {notes.join(' • ')}
              </AlertDescription>
            </Alert>
          )}

          {suggestions.length > 0 ? (
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <div key={suggestion.name} className="rounded-lg border border-emerald-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{suggestion.name}</h3>
                      <p className="text-xs text-muted-foreground">{suggestion.focus}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="border border-emerald-200 bg-emerald-50 text-emerald-700"
                      onClick={() => {
                        onApplyTemplate(suggestion)
                        onOpenChange(false)
                      }}
                    >
                      Use Template
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{suggestion.description}</p>
                  {suggestion.recommended_controls?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {suggestion.recommended_controls.map((control) => (
                        <Badge key={control} variant="outline" className="border-emerald-200 text-xs text-emerald-700">
                          {control}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Run the assistant to view recommended templates.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
