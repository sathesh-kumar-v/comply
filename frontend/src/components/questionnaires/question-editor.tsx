'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Trash2,
  GripVertical,
  Copy,
  ChevronDown,
  ChevronUp,
  X,
  Wand2,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type QuestionType =
  | 'text'
  | 'textarea'
  | 'multiple_choice'
  | 'single_choice'
  | 'rating'
  | 'yes_no'
  | 'date'
  | 'datetime'
  | 'number'
  | 'email'
  | 'file_upload'
  | 'signature'
  | 'matrix';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  required: boolean;
  order: number;
  options?: string[];
  minValue?: number;
  maxValue?: number;
  placeholder?: string;
  helpText?: string;
  conditionalQuestionId?: string;
  conditionalOperator?: 'equals' | 'not_equals' | 'contains';
  conditionalValue?: string;
  showIfConditionMet?: boolean;
  scoringWeight?: number;
  riskLevel?: RiskLevel;
  validationRules?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  matrixConfig?: {
    rows: string[];
    columns: string[];
  };
  aiInsights?: {
    clarityScore: number;
    complexityScore: number;
    biasFlags: { phrase: string; reason: string }[];
    improvements: string[];
  };
}

interface QuestionEditorProps {
  question: Question;
  index: number;
  questions: Question[];
  questionnaireType: 'assessment' | 'survey' | 'checklist' | 'evaluation';
  riskLevels: { value: RiskLevel; label: string }[];
  onUpdate: (id: string, updates: Partial<Question>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRunQualityCheck: (question: Question) => Promise<void> | void;
  onGenerateOptions: (question: Question) => Promise<void> | void;
}

export function QuestionEditor({
  question,
  index,
  questions,
  questionnaireType,
  riskLevels,
  onUpdate,
  onDelete,
  onDuplicate,
  onMove,
  onRunQualityCheck,
  onGenerateOptions,
}: QuestionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isRunningQuality, setIsRunningQuality] = useState(false);
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);

  const updateQuestion = (updates: Partial<Question>) => {
    onUpdate(question.id, updates);
  };

  const addOption = () => {
    const currentOptions = question.options || [];
    updateQuestion({ options: [...currentOptions, `Option ${currentOptions.length + 1}`] });
  };

  const updateOption = (optionIndex: number, value: string) => {
    const newOptions = [...(question.options || [])];
    newOptions[optionIndex] = value;
    updateQuestion({ options: newOptions });
  };

  const removeOption = (optionIndex: number) => {
    const newOptions = (question.options || []).filter((_, i) => i !== optionIndex);
    updateQuestion({ options: newOptions });
  };

  const updateMatrixRows = (rows: string[]) => {
    updateQuestion({ matrixConfig: { ...(question.matrixConfig || { columns: ['Column 1'] }), rows } });
  };

  const updateMatrixColumns = (columns: string[]) => {
    updateQuestion({ matrixConfig: { ...(question.matrixConfig || { rows: ['Row 1'] }), columns } });
  };

  const runQualityCheck = async () => {
    setIsRunningQuality(true);
    try {
      await onRunQualityCheck(question);
    } finally {
      setIsRunningQuality(false);
    }
  };

  const generateOptions = async () => {
    setIsGeneratingOptions(true);
    try {
      await onGenerateOptions(question);
    } finally {
      setIsGeneratingOptions(false);
    }
  };

  const questionTypeLabel: Record<QuestionType, string> = {
    text: 'Short Text',
    textarea: 'Long Text',
    multiple_choice: 'Multiple Choice',
    single_choice: 'Single Choice',
    rating: 'Rating Scale',
    yes_no: 'Yes / No',
    date: 'Date',
    datetime: 'Date & Time',
    number: 'Number',
    email: 'Email',
    file_upload: 'File Upload',
    signature: 'Signature',
    matrix: 'Matrix/Grid',
  };

  return (
    <Card className="border-2 border-dashed border-gray-200 hover:border-gray-300 transition-colors">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />
              <span className="text-sm font-medium text-gray-500">Q{index + 1}</span>
            </div>
            <Badge variant="secondary" className="text-xs capitalize">
              {questionTypeLabel[question.type]}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {questionnaireType}
            </Badge>
            {question.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
            {question.riskLevel && (
              <Badge variant="outline" className="text-xs capitalize">
                Risk: {question.riskLevel}
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {index > 0 && (
              <Button variant="ghost" size="sm" onClick={() => onMove(index, index - 1)} className="h-8 w-8 p-0">
                <ChevronUp className="h-4 w-4" />
              </Button>
            )}
            {index < questions.length - 1 && (
              <Button variant="ghost" size="sm" onClick={() => onMove(index, index + 1)} className="h-8 w-8 p-0">
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onDuplicate(question.id)} className="h-8 w-8 p-0">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-8 w-8 p-0">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(question.id)}
              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`question-text-${question.id}`}>Question Text *</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={runQualityCheck} disabled={isRunningQuality || !question.text}>
                    <Sparkles className="h-4 w-4 mr-1" />
                    {isRunningQuality ? 'Scoring...' : 'AI Review'}
                  </Button>
                  {(question.type === 'multiple_choice' || question.type === 'single_choice') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateOptions}
                      disabled={isGeneratingOptions || !question.text}
                    >
                      <Wand2 className="h-4 w-4 mr-1" />
                      {isGeneratingOptions ? 'Generating...' : 'Smart Options'}
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                id={`question-text-${question.id}`}
                value={question.text}
                onChange={(e) => updateQuestion({ text: e.target.value })}
                placeholder="Enter your question"
                className="mt-1"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`question-type-${question.id}`}>Question Type</Label>
                <Select
                  value={question.type}
                  onValueChange={(value) =>
                    updateQuestion({
                      type: value as QuestionType,
                      options:
                        value === 'multiple_choice' || value === 'single_choice'
                          ? ['Option 1', 'Option 2', 'Option 3']
                          : undefined,
                      minValue: value === 'rating' ? 1 : value === 'number' ? 0 : undefined,
                      maxValue: value === 'rating' ? 5 : value === 'number' ? 100 : undefined,
                      matrixConfig:
                        value === 'matrix'
                          ? question.matrixConfig || {
                              rows: ['Row 1', 'Row 2'],
                              columns: ['Column 1', 'Column 2'],
                            }
                          : undefined,
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Short Text</SelectItem>
                    <SelectItem value="textarea">Long Text</SelectItem>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="single_choice">Single Choice</SelectItem>
                    <SelectItem value="rating">Rating Scale</SelectItem>
                    <SelectItem value="yes_no">Yes/No</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="datetime">Date & Time</SelectItem>
                    <SelectItem value="file_upload">File Upload</SelectItem>
                    <SelectItem value="signature">Signature</SelectItem>
                    <SelectItem value="matrix">Matrix/Grid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id={`required-${question.id}`}
                  checked={question.required}
                  onCheckedChange={(checked) => updateQuestion({ required: checked })}
                />
                <Label htmlFor={`required-${question.id}`}>Required</Label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor={`scoring-${question.id}`}>Scoring Weight</Label>
                <Input
                  id={`scoring-${question.id}`}
                  type="number"
                  min={0}
                  value={question.scoringWeight ?? ''}
                  onChange={(e) =>
                    updateQuestion({ scoringWeight: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`risk-${question.id}`}>Risk Level</Label>
                <Select
                  value={question.riskLevel || 'low'}
                  onValueChange={(value) => updateQuestion({ riskLevel: value as RiskLevel })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {riskLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Question Order</Label>
                <Input value={question.order + 1} readOnly className="mt-1" />
              </div>
            </div>

            {(question.type === 'multiple_choice' || question.type === 'single_choice') && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Options</Label>
                  <Button variant="outline" size="sm" onClick={addOption}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </Button>
                </div>
                <div className="space-y-2">
                  {question.options?.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center space-x-2">
                      <Input
                        value={option}
                        onChange={(e) => updateOption(optionIndex, e.target.value)}
                        placeholder={`Option ${optionIndex + 1}`}
                      />
                      {question.options!.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(optionIndex)}
                          className="h-10 w-10 p-0 text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(question.type === 'rating' || question.type === 'number') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`min-value-${question.id}`}>
                    {question.type === 'rating' ? 'Minimum Rating' : 'Minimum Value'}
                  </Label>
                  <Input
                    id={`min-value-${question.id}`}
                    type="number"
                    value={question.minValue ?? ''}
                    onChange={(e) =>
                      updateQuestion({ minValue: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`max-value-${question.id}`}>
                    {question.type === 'rating' ? 'Maximum Rating' : 'Maximum Value'}
                  </Label>
                  <Input
                    id={`max-value-${question.id}`}
                    type="number"
                    value={question.maxValue ?? ''}
                    onChange={(e) =>
                      updateQuestion({ maxValue: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {question.type === 'matrix' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Rows</Label>
                  <div className="space-y-2 mt-2">
                    {(question.matrixConfig?.rows || []).map((row, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={row}
                          onChange={(e) => {
                            const rows = [...(question.matrixConfig?.rows || [])];
                            rows[idx] = e.target.value;
                            updateMatrixRows(rows);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateMatrixRows((question.matrixConfig?.rows || []).filter((_, i) => i !== idx))}
                          className="text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMatrixRows([...(question.matrixConfig?.rows || []), `Row ${(question.matrixConfig?.rows || []).length + 1}`])}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Row
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Columns</Label>
                  <div className="space-y-2 mt-2">
                    {(question.matrixConfig?.columns || []).map((column, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={column}
                          onChange={(e) => {
                            const columns = [...(question.matrixConfig?.columns || [])];
                            columns[idx] = e.target.value;
                            updateMatrixColumns(columns);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            updateMatrixColumns((question.matrixConfig?.columns || []).filter((_, i) => i !== idx))
                          }
                          className="text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMatrixColumns([...(question.matrixConfig?.columns || []), `Column ${(question.matrixConfig?.columns || []).length + 1}`])}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Column
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="p-0 h-auto text-sm text-gray-600"
              >
                {isAdvancedOpen ? 'Hide' : 'Show'} Advanced Options
              </Button>

              {isAdvancedOpen && (
                <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label htmlFor={`placeholder-${question.id}`}>Placeholder Text</Label>
                    <Input
                      id={`placeholder-${question.id}`}
                      value={question.placeholder || ''}
                      onChange={(e) => updateQuestion({ placeholder: e.target.value })}
                      placeholder="Enter placeholder text"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`help-text-${question.id}`}>Help Text</Label>
                    <Textarea
                      id={`help-text-${question.id}`}
                      value={question.helpText || ''}
                      onChange={(e) => updateQuestion({ helpText: e.target.value })}
                      placeholder="Provide additional context or instructions"
                      className="mt-1"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor={`min-length-${question.id}`}>Minimum Length</Label>
                      <Input
                        id={`min-length-${question.id}`}
                        type="number"
                        value={question.validationRules?.minLength ?? ''}
                        onChange={(e) =>
                          updateQuestion({
                            validationRules: {
                              ...(question.validationRules || {}),
                              minLength: e.target.value ? Number(e.target.value) : undefined,
                            },
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`max-length-${question.id}`}>Maximum Length</Label>
                      <Input
                        id={`max-length-${question.id}`}
                        type="number"
                        value={question.validationRules?.maxLength ?? ''}
                        onChange={(e) =>
                          updateQuestion({
                            validationRules: {
                              ...(question.validationRules || {}),
                              maxLength: e.target.value ? Number(e.target.value) : undefined,
                            },
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`pattern-${question.id}`}>Pattern (RegExp)</Label>
                      <Input
                        id={`pattern-${question.id}`}
                        value={question.validationRules?.pattern ?? ''}
                        onChange={(e) =>
                          updateQuestion({
                            validationRules: {
                              ...(question.validationRules || {}),
                              pattern: e.target.value || undefined,
                            },
                          })
                        }
                        className="mt-1"
                        placeholder="^\\d{4}$"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Conditional Logic</Label>
                    <p className="text-sm text-gray-600 mb-2">Show this question only when certain conditions are met.</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={question.conditionalQuestionId || 'none'}
                        onValueChange={(value) =>
                          updateQuestion({ conditionalQuestionId: value === 'none' ? undefined : value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select question" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No condition</SelectItem>
                          {questions
                            .filter((q) => q.id !== question.id && q.order < question.order)
                            .map((q) => (
                              <SelectItem key={q.id} value={q.id}>
                                Q{q.order + 1}: {q.text.slice(0, 30)}...
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      {question.conditionalQuestionId && (
                        <>
                          <Select
                            value={question.conditionalOperator || ''}
                            onValueChange={(value) => updateQuestion({ conditionalOperator: value as any })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Operator" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="not_equals">Not equals</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                            </SelectContent>
                          </Select>

                          <Input
                            value={question.conditionalValue || ''}
                            onChange={(e) => updateQuestion({ conditionalValue: e.target.value })}
                            placeholder="Value"
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {question.aiInsights && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm space-y-2">
                <div className="flex items-center gap-2 font-medium text-blue-700">
                  <Sparkles className="h-4 w-4" />
                  AI Review Insights
                </div>
                <div className="flex flex-wrap gap-4">
                  <span>Clarity: {question.aiInsights.clarityScore}/100</span>
                  <span>Complexity: {question.aiInsights.complexityScore}/100</span>
                </div>
                {question.aiInsights.biasFlags.length > 0 && (
                  <div>
                    <p className="font-medium text-blue-700">Potential bias detected:</p>
                    <ul className="list-disc list-inside text-blue-700">
                      {question.aiInsights.biasFlags.map((flag) => (
                        <li key={flag.phrase}>
                          <span className="font-semibold">{flag.phrase}:</span> {flag.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {question.aiInsights.improvements.length > 0 && (
                  <div>
                    <p className="font-medium text-blue-700">Improvements suggested:</p>
                    <ul className="list-disc list-inside text-blue-700">
                      {question.aiInsights.improvements.map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
