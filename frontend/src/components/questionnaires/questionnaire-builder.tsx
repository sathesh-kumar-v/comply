'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { QuestionEditor } from './question-editor';
import { api } from '@/lib/api';
import { Plus, Sparkles, Wand2, Eye, Save, Rocket, Target } from 'lucide-react';

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

type QuestionnaireType = 'assessment' | 'survey' | 'checklist' | 'evaluation';

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

interface AISuggestion {
  suggestion: string;
  rationale: string;
  question_type: QuestionType;
  answer_guidance?: string[];
}

interface QuestionnaireBuilderProps {
  questionnaire?: any;
  onSave: () => void;
  onCancel: () => void;
}

const QUESTIONNAIRE_TYPES: { value: QuestionnaireType; label: string }[] = [
  { value: 'assessment', label: 'Assessment' },
  { value: 'survey', label: 'Survey' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'evaluation', label: 'Evaluation' },
];

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'single_choice', label: 'Single Choice' },
  { value: 'rating', label: 'Rating Scale' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'number', label: 'Number Input' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'email', label: 'Email' },
  { value: 'file_upload', label: 'File Upload' },
  { value: 'signature', label: 'Signature' },
  { value: 'matrix', label: 'Matrix / Grid' },
];

const RISK_LEVELS: { value: RiskLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export function QuestionnaireBuilder({ questionnaire, onSave, onCancel }: QuestionnaireBuilderProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questionnaireType, setQuestionnaireType] = useState<QuestionnaireType>('assessment');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState({
    allowAnonymous: false,
    allowMultipleResponses: false,
    showProgress: true,
    randomizeQuestions: false,
    accessLevel: 'internal' as 'public' | 'internal' | 'confidential' | 'restricted',
    startsAt: '',
    endsAt: '',
    targetRoles: [] as string[],
    targetDepartments: [] as number[],
  });
  const [activeTab, setActiveTab] = useState<'design' | 'settings' | 'preview'>('design');
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!questionnaire) return;

    setTitle(questionnaire.title || '');
    setDescription(questionnaire.description || '');
    setQuestionnaireType(questionnaire.questionnaire_type || questionnaire.type || 'assessment');

    setQuestions(
      questionnaire.questions?.map((q: any, index: number) => ({
        id: q.id?.toString() || `q_${Date.now()}_${index}`,
        type: (q.question_type || q.type || 'text') as QuestionType,
        text: q.question_text || q.text || '',
        required: q.is_required ?? q.required ?? false,
        order: q.order_index ?? q.order ?? index,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
        minValue: q.min_value ?? q.minValue,
        maxValue: q.max_value ?? q.maxValue,
        placeholder: q.placeholder,
        helpText: q.help_text ?? q.helpText,
        conditionalQuestionId: q.conditional_question_id ?? q.conditionalQuestionId,
        conditionalOperator: q.conditional_operator ?? q.conditionalOperator,
        conditionalValue: q.conditional_value ?? q.conditionalValue,
        showIfConditionMet: q.show_if_condition_met ?? q.showIfConditionMet ?? true,
        scoringWeight: q.scoring_weight ?? q.scoringWeight,
        riskLevel: q.risk_level ?? q.riskLevel,
        validationRules: typeof q.validation_rules === 'string'
          ? JSON.parse(q.validation_rules)
          : q.validation_rules,
        matrixConfig: typeof q.matrix_config === 'string'
          ? JSON.parse(q.matrix_config)
          : q.matrix_config,
      })) || []
    );

    setSettings({
      allowAnonymous: questionnaire.allow_anonymous || false,
      allowMultipleResponses: questionnaire.allow_multiple_responses || false,
      showProgress: questionnaire.show_progress ?? true,
      randomizeQuestions: questionnaire.randomize_questions || false,
      accessLevel: questionnaire.access_level || 'internal',
      startsAt: questionnaire.starts_at ? new Date(questionnaire.starts_at).toISOString().slice(0, 16) : '',
      endsAt: questionnaire.ends_at ? new Date(questionnaire.ends_at).toISOString().slice(0, 16) : '',
      targetRoles: questionnaire.target_roles || [],
      targetDepartments: questionnaire.target_departments || [],
    });
  }, [questionnaire]);

  const buildQuestion = (type: QuestionType, order: number): Question => ({
    id: `q_${Date.now()}_${order}`,
    type,
    text: '',
    required: false,
    order,
    options:
      type === 'multiple_choice' || type === 'single_choice'
        ? ['Option 1', 'Option 2', 'Option 3']
        : undefined,
    minValue: type === 'rating' ? 1 : type === 'number' ? 0 : undefined,
    maxValue: type === 'rating' ? 5 : type === 'number' ? 100 : undefined,
    matrixConfig:
      type === 'matrix'
        ? {
            rows: ['Row 1', 'Row 2'],
            columns: ['Column 1', 'Column 2'],
          }
        : undefined,
  });

  const addQuestion = (type: QuestionType = 'text') => {
    setQuestions((prev) => [...prev, buildQuestion(type, prev.length)]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const deleteQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id).map((q, index) => ({ ...q, order: index })));
  };

  const duplicateQuestion = (id: string) => {
    setQuestions((prev) => {
      const question = prev.find((q) => q.id === id);
      if (!question) return prev;

      const clone: Question = {
        ...question,
        id: `q_${Date.now()}`,
        text: `${question.text} (Copy)`,
        order: prev.length,
      };

      return [...prev, clone];
    });
  };

  const moveQuestion = (from: number, to: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      return next.map((q, index) => ({ ...q, order: index }));
    });
  };

  const handleFetchAISuggestions = async () => {
    setIsSuggestionLoading(true);
    setSuggestionError(null);
    try {
      const response = await api<{ questionnaire_type: QuestionnaireType; suggestions: AISuggestion[] }>(
        '/questionnaires/ai/suggestions',
        {
          method: 'POST',
          body: JSON.stringify({
            questionnaire_type: questionnaireType,
            existing_questions: questions.map((q) => q.text).filter(Boolean),
          }),
        }
      );
      setAiSuggestions(response.suggestions);
    } catch (error) {
      setSuggestionError(error instanceof Error ? error.message : 'Unable to fetch AI suggestions');
    } finally {
      setIsSuggestionLoading(false);
    }
  };

  const handleApplySuggestion = (suggestion: AISuggestion) => {
    setQuestions((prev) => [
      ...prev,
      {
        ...buildQuestion(suggestion.question_type, prev.length),
        text: suggestion.suggestion,
        options: suggestion.answer_guidance,
      },
    ]);
  };

  const handleRunQualityCheck = async (question: Question) => {
    try {
      const result = await api<{
        clarity_score: number;
        complexity_score: number;
        bias_flags: { phrase: string; reason: string; suggestion: string }[];
        improvements: string[];
      }>(
        '/questionnaires/ai/question-quality',
        {
          method: 'POST',
          body: JSON.stringify({
            question_text: question.text,
            question_type: question.type,
            answer_options: question.options,
            questionnaire_type: questionnaireType,
          }),
        }
      );

      updateQuestion(question.id, {
        aiInsights: {
          clarityScore: result.clarity_score,
          complexityScore: result.complexity_score,
          biasFlags: result.bias_flags.map((flag) => ({ phrase: flag.phrase, reason: flag.reason })),
          improvements: result.improvements,
        },
      });
    } catch (error) {
      console.error('Unable to evaluate question quality', error);
    }
  };

  const handleGenerateOptions = async (question: Question) => {
    try {
      const result = await api<{ options: string[] }>(
        '/questionnaires/ai/answer-options',
        {
          method: 'POST',
          body: JSON.stringify({
            question_text: question.text,
            questionnaire_type: questionnaireType,
            desired_count: 5,
          }),
        }
      );

      updateQuestion(question.id, { options: result.options });
    } catch (error) {
      console.error('Unable to generate options', error);
    }
  };

  const canSave = title.trim() !== '' && questions.length > 0;

  const questionSummary = useMemo(
    () => ({
      required: questions.filter((q) => q.required).length,
      highRisk: questions.filter((q) => q.riskLevel === 'high' || q.riskLevel === 'critical').length,
    }),
    [questions]
  );

  const handleSave = async (status: 'draft' | 'published' = 'draft') => {
    setSaving(true);
    try {
      console.log('Saving questionnaire', { title, description, questions, settings, status, questionnaireType });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Questionnaire Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter questionnaire title"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the purpose of this questionnaire"
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
            <div>
              <Label>Questionnaire Type</Label>
              <Select value={questionnaireType} onValueChange={(value: QuestionnaireType) => setQuestionnaireType(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTIONNAIRE_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-4 space-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Target className="h-3 w-3" />
                    {questionSummary.required} required
                  </Badge>
                  <Badge variant="destructive" className="gap-1">
                    {questionSummary.highRisk} high risk
                  </Badge>
                </div>
                <p>Use AI to accelerate build time and ensure consistent scoring across templates.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-2 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Sparkles className="h-4 w-4 text-blue-500" />
              AI assistance is available for question suggestions, quality scoring, and smart options.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => handleSave('draft')} disabled={!canSave || saving}>
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button variant="outline" onClick={() => setActiveTab('preview')}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button onClick={() => handleSave('published')} disabled={!canSave || saving}>
                <Rocket className="h-4 w-4 mr-2" />
                Publish
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex space-x-4 border-b">
        <button
          className={`pb-2 px-1 border-b-2 ${
            activeTab === 'design' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
          }`}
          onClick={() => setActiveTab('design')}
        >
          Design
        </button>
        <button
          className={`pb-2 px-1 border-b-2 ${
            activeTab === 'settings' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
          }`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
        <button
          className={`pb-2 px-1 border-b-2 ${
            activeTab === 'preview' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
          }`}
          onClick={() => setActiveTab('preview')}
        >
          Preview
        </button>
      </div>

      {activeTab === 'design' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <h3 className="text-lg font-semibold">AI Question Suggestions</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Generate context-aware questions and answer hints tailored to the selected questionnaire type.
                </p>
                {suggestionError && <p className="text-sm text-red-500">{suggestionError}</p>}
              </div>
              <Button variant="outline" onClick={handleFetchAISuggestions} disabled={isSuggestionLoading}>
                <Wand2 className="h-4 w-4 mr-2" />
                {isSuggestionLoading ? 'Generating...' : 'Get AI Suggestions'}
              </Button>
            </div>
            {aiSuggestions.length > 0 && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {aiSuggestions.map((suggestion, index) => (
                  <Card key={`${suggestion.suggestion}-${index}`} className="p-4 border-dashed">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="capitalize">
                        {suggestion.question_type.replace('_', ' ')}
                      </Badge>
                      <Button size="sm" onClick={() => handleApplySuggestion(suggestion)}>
                        Add Question
                      </Button>
                    </div>
                    <p className="mt-3 font-medium">{suggestion.suggestion}</p>
                    <p className="mt-2 text-xs text-gray-500">{suggestion.rationale}</p>
                    {suggestion.answer_guidance && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-semibold text-gray-600">Suggested answer guidance:</p>
                        {suggestion.answer_guidance.map((option) => (
                          <p key={option} className="text-xs text-gray-500">
                            • {option}
                          </p>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Questions ({questions.length})</h3>
              <Select onValueChange={(value) => addQuestion(value as QuestionType)}>
                <SelectTrigger className="w-auto bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {questions.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="space-y-4">
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <Plus className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">No questions yet</h3>
                    <p className="text-gray-600">Use AI suggestions or add your first question to begin.</p>
                  </div>
                  <Button onClick={() => addQuestion('text')}>Add question</Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <QuestionEditor
                    key={question.id}
                    question={question}
                    index={index}
                    questions={questions}
                    questionnaireType={questionnaireType}
                    onUpdate={updateQuestion}
                    onDelete={deleteQuestion}
                    onDuplicate={duplicateQuestion}
                    onMove={moveQuestion}
                    onRunQualityCheck={handleRunQualityCheck}
                    onGenerateOptions={handleGenerateOptions}
                    riskLevels={RISK_LEVELS}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Response Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Anonymous Responses</Label>
                  <p className="text-sm text-gray-600">Users can respond without logging in.</p>
                </div>
                <Switch
                  checked={settings.allowAnonymous}
                  onCheckedChange={(checked) => setSettings({ ...settings, allowAnonymous: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Multiple Responses</Label>
                  <p className="text-sm text-gray-600">Users can submit multiple responses.</p>
                </div>
                <Switch
                  checked={settings.allowMultipleResponses}
                  onCheckedChange={(checked) => setSettings({ ...settings, allowMultipleResponses: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Progress Bar</Label>
                  <p className="text-sm text-gray-600">Display completion progress to users.</p>
                </div>
                <Switch
                  checked={settings.showProgress}
                  onCheckedChange={(checked) => setSettings({ ...settings, showProgress: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Randomize Question Order</Label>
                  <p className="text-sm text-gray-600">Helps reduce response bias.</p>
                </div>
                <Switch
                  checked={settings.randomizeQuestions}
                  onCheckedChange={(checked) => setSettings({ ...settings, randomizeQuestions: checked })}
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Access Control</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="access-level">Access Level</Label>
                <Select
                  value={settings.accessLevel}
                  onValueChange={(value) => setSettings({ ...settings, accessLevel: value as typeof settings.accessLevel })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="confidential">Confidential</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="starts-at">Start Date &amp; Time</Label>
                <Input
                  id="starts-at"
                  type="datetime-local"
                  value={settings.startsAt}
                  onChange={(e) => setSettings({ ...settings, startsAt: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="ends-at">End Date &amp; Time</Label>
                <Input
                  id="ends-at"
                  type="datetime-local"
                  value={settings.endsAt}
                  onChange={(e) => setSettings({ ...settings, endsAt: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold">{title || 'Untitled Questionnaire'}</h2>
                {description && <p className="text-gray-600 mt-2">{description}</p>}
                <p className="text-sm text-gray-500 mt-1 capitalize">Type: {questionnaireType}</p>
              </div>

              {settings.showProgress && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>0 / {questions.length}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '0%' }} />
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-6">
                {questions.map((question, index) => (
                  <div key={question.id} className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <span className="text-sm text-gray-500 mt-1">{index + 1}.</span>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Label className="font-medium">{question.text || 'Question text'}</Label>
                          {question.required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                          {question.riskLevel && (
                            <Badge variant="outline" className="text-xs capitalize">
                              Risk: {question.riskLevel}
                            </Badge>
                          )}
                        </div>
                        {question.helpText && (
                          <p className="text-sm text-gray-600 mt-1">{question.helpText}</p>
                        )}

                        <div className="mt-3 space-y-2">
                          {question.type === 'text' && <Input placeholder={question.placeholder || 'Your answer'} disabled />}
                          {question.type === 'textarea' && (
                            <Textarea placeholder={question.placeholder || 'Your answer'} disabled rows={3} />
                          )}
                          {(question.type === 'multiple_choice' || question.type === 'single_choice') && (
                            <div className="space-y-2">
                              {question.options?.map((option, idx) => (
                                <div key={idx} className="flex items-center space-x-2">
                                  <input
                                    type={question.type === 'multiple_choice' ? 'checkbox' : 'radio'}
                                    disabled
                                    className="rounded"
                                  />
                                  <span className="text-sm">{option}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {question.type === 'rating' && (
                            <div className="flex space-x-2">
                              {Array.from({ length: (question.maxValue || 5) - (question.minValue || 1) + 1 }, (_, i) => (
                                <button key={i} className="w-8 h-8 border rounded text-sm" disabled>
                                  {(question.minValue || 1) + i}
                                </button>
                              ))}
                            </div>
                          )}
                          {question.type === 'yes_no' && (
                            <div className="flex space-x-4">
                              <label className="flex items-center space-x-2">
                                <input type="radio" disabled />
                                <span>Yes</span>
                              </label>
                              <label className="flex items-center space-x-2">
                                <input type="radio" disabled />
                                <span>No</span>
                              </label>
                            </div>
                          )}
                          {question.type === 'number' && (
                            <Input type="number" min={question.minValue} max={question.maxValue} disabled />
                          )}
                          {question.type === 'email' && <Input type="email" disabled />}
                          {question.type === 'date' && <Input type="date" disabled />}
                          {question.type === 'datetime' && <Input type="datetime-local" disabled />}
                          {question.type === 'file_upload' && <Input type="file" disabled />}
                          {question.type === 'signature' && (
                            <div className="h-24 border border-dashed rounded flex items-center justify-center text-sm text-gray-500">
                              Signature field preview
                            </div>
                          )}
                          {question.type === 'matrix' && question.matrixConfig && (
                            <div className="overflow-x-auto">
                              <table className="min-w-full border text-sm">
                                <thead>
                                  <tr>
                                    <th className="border px-3 py-2 text-left">&nbsp;</th>
                                    {question.matrixConfig.columns.map((col) => (
                                      <th key={col} className="border px-3 py-2 text-left">
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {question.matrixConfig.rows.map((row) => (
                                    <tr key={row}>
                                      <td className="border px-3 py-2 font-medium">{row}</td>
                                      {question.matrixConfig?.columns.map((col) => (
                                        <td key={`${row}-${col}`} className="border px-3 py-2">
                                          <input type="radio" disabled />
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="flex justify-between pt-6 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="space-x-2">
          <Button variant="outline" onClick={() => handleSave('draft')} disabled={!canSave || saving}>
            Save as Draft
          </Button>
          <Button onClick={() => handleSave('published')} disabled={!canSave || saving}>
            {questionnaire ? 'Update' : 'Create'} Questionnaire
          </Button>
        </div>
      </div>
    </div>
  );
}
