'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Search,
  Filter,
  BarChart3,
  Settings,
  Play,
  Pause,
  Archive,
  Share2,
  Pencil,
  ExternalLink,
  Copy,
  Trash2,
  Download,
  Sparkles,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QuestionnaireBuilder } from '@/components/questionnaires/questionnaire-builder';
import { QuestionnaireStats } from '@/components/questionnaires/questionnaire-stats';

type QuestionnaireStatus = 'draft' | 'active' | 'paused' | 'closed' | 'archived';
type QuestionnaireType = 'assessment' | 'survey' | 'checklist' | 'evaluation';

interface Questionnaire {
  id: number;
  title: string;
  description: string;
  status: QuestionnaireStatus;
  type: QuestionnaireType;
  created_at: string;
  updated_at: string;
  questions: any[];
  responses?: number;
  completion_rate?: number;
  ai_readiness_score?: number;
}

export default function QuestionnairePage() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'last_modified' | 'name' | 'created_at' | 'responses'>('last_modified');
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<Questionnaire | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setQuestionnaires([
        {
          id: 1,
          title: 'Third-Party Compliance Assessment',
          description: 'Structured assessment to evaluate vendor compliance posture across control domains.',
          status: 'active',
          type: 'assessment',
          created_at: '2024-01-02',
          updated_at: '2024-02-18',
          questions: [
            { id: 1, type: 'rating', text: "Rate the vendor's access management maturity (1-5)" },
            {
              id: 2,
              type: 'multiple_choice',
              text: 'Select evidence types provided',
              options: ['SOC 2', 'ISO 27001', 'Policy Extracts', 'Pen Test'],
            },
            { id: 3, type: 'textarea', text: 'Outline remediation plans for any critical gaps' },
          ],
          responses: 42,
          completion_rate: 92,
          ai_readiness_score: 88,
        },
        {
          id: 2,
          title: 'Employee Awareness Pulse Survey',
          description: 'Quick pulse survey to gauge employee awareness of the new compliance policy roll-out.',
          status: 'draft',
          type: 'survey',
          created_at: '2024-02-05',
          updated_at: '2024-02-12',
          questions: [
            { id: 1, type: 'yes_no', text: 'Have you read the updated compliance handbook?' },
            {
              id: 2,
              type: 'single_choice',
              text: 'How confident do you feel about reporting violations?',
              options: ['Very confident', 'Somewhat confident', 'Not sure', 'Not confident'],
            },
            { id: 3, type: 'text', text: 'What additional support would help you stay compliant?' },
          ],
          responses: 0,
          completion_rate: 0,
          ai_readiness_score: 64,
        },
        {
          id: 3,
          title: 'Branch Audit Checklist',
          description: 'Pre-audit checklist to ensure physical branches have completed mandatory safety tasks.',
          status: 'paused',
          type: 'checklist',
          created_at: '2024-01-18',
          updated_at: '2024-02-01',
          questions: [
            { id: 1, type: 'yes_no', text: 'Access logs reviewed for the past 30 days?' },
            { id: 2, type: 'file_upload', text: 'Upload latest emergency drill attendance sheet.' },
            { id: 3, type: 'signature', text: 'Branch manager approval signature.' },
          ],
          responses: 18,
          completion_rate: 73,
          ai_readiness_score: 71,
        },
      ]);
      setLoading(false);
    }, 600);
  }, []);

  const filteredQuestionnaires = useMemo(() => {
    const filtered = questionnaires.filter((q) => {
      const matchesSearch =
        q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
      const matchesType = typeFilter === 'all' || q.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.title.localeCompare(b.title);
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'responses':
          return (b.responses || 0) - (a.responses || 0);
        case 'last_modified':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return sorted;
  }, [questionnaires, searchTerm, statusFilter, typeFilter, sortBy]);

  const getStatusColor = (status: QuestionnaireStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'closed':
        return 'bg-blue-100 text-blue-800';
      case 'archived':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: QuestionnaireStatus) => {
    switch (status) {
      case 'active':
        return <Play className="h-3 w-3" />;
      case 'paused':
        return <Pause className="h-3 w-3" />;
      case 'archived':
        return <Archive className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const typeLabel: Record<QuestionnaireType, string> = {
    assessment: 'Assessment',
    survey: 'Survey',
    checklist: 'Checklist',
    evaluation: 'Evaluation',
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Questionnaire Builder</h1>
              <p className="text-gray-600">
                Create assessments, automate reviews, and monitor response quality in one workspace.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Import Template
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Import template</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => console.log('Import Compliance Assessment')}>
                    Compliance Assessment
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => console.log('Import Risk Evaluation')}>
                    Risk Evaluation
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => console.log('Import Audit Checklist')}>
                    Audit Checklist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => console.log('Import Vendor Assessment')}>
                    Vendor Assessment
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => console.log('Import Employee Survey')}>
                    Employee Survey
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => console.log('Import Custom Template')}>
                    Custom Template
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setSelectedQuestionnaire(null)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Questionnaire
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedQuestionnaire ? 'Edit Questionnaire' : 'Create New Questionnaire'}
              </DialogTitle>
            </DialogHeader>
            <QuestionnaireBuilder 
              questionnaire={selectedQuestionnaire}
              onSave={() => setIsBuilderOpen(false)}
              onCancel={() => setIsBuilderOpen(false)}
            />
          </DialogContent>
        </Dialog>
            </div>
          </div>

          <Card className="p-4">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div className="flex flex-1 items-center gap-2">
                <Search className="h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search questionnaires"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="assessment">Assessment</SelectItem>
                    <SelectItem value="survey">Survey</SelectItem>
                    <SelectItem value="checklist">Checklist</SelectItem>
                    <SelectItem value="evaluation">Evaluation</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_modified">Last Modified</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="created_at">Created Date</SelectItem>
                    <SelectItem value="responses">Response Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </div>

        <QuestionnaireStats questionnaires={questionnaires} />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredQuestionnaires.map((questionnaire) => (
            <Card key={questionnaire.id} className="p-6 hover:shadow-lg transition-shadow border border-gray-100">
              <div className="flex justify-between items-start gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg line-clamp-1">{questionnaire.title}</h3>
                    {questionnaire.ai_readiness_score && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Sparkles className="h-3 w-3" />
                        AI {questionnaire.ai_readiness_score}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{questionnaire.description}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedQuestionnaire(questionnaire);
                        setIsBuilderOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Questionnaire
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Responses
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download className="h-4 w-4 mr-2" />
                      Export Results
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Link
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {typeLabel[questionnaire.type]}
                </Badge>
                <Badge className={`${getStatusColor(questionnaire.status)} flex items-center gap-1`}>
                  {getStatusIcon(questionnaire.status)}
                  {questionnaire.status.charAt(0).toUpperCase() + questionnaire.status.slice(1)}
                </Badge>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Questions</p>
                  <p className="font-semibold">{questionnaire.questions.length}</p>
                </div>
                <div>
                  <p className="text-gray-500">Responses</p>
                  <p className="font-semibold">{questionnaire.responses || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Last Modified</p>
                  <p className="font-semibold">{new Date(questionnaire.updated_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Completion</p>
                  <p className="font-semibold">{questionnaire.completion_rate ?? 0}%</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Completion Trend</span>
                  <span>{questionnaire.completion_rate ?? 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${questionnaire.completion_rate ?? 0}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-between items-center gap-3 text-xs text-gray-500">
                <span>Created {new Date(questionnaire.created_at).toLocaleDateString()}</span>
                <Link
                  href={`/questionnaires/responses?questionnaireId=${questionnaire.id}`}
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  <BarChart3 className="h-3 w-3" />
                  Open Response Dashboard
                </Link>
              </div>
            </Card>
          ))}
        </div>

        {filteredQuestionnaires.length === 0 && (
          <Card className="p-12 text-center">
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <BarChart3 className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No questionnaires found</h3>
                <p className="text-gray-600">
                  {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                    ? 'Try adjusting your search, type, or status filters'
                    : 'Create your first questionnaire to get started'}
                </p>
              </div>
              {!searchTerm && statusFilter === 'all' && typeFilter === 'all' && (
                <Button onClick={() => setIsBuilderOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Questionnaire
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
