'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCcw,
  Search,
  Sparkles,
  Mail,
  Eye,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

type ResponseStatus = 'complete' | 'incomplete' | 'in_progress';

interface ResponseRecord {
  id: number;
  respondent: string;
  department: string;
  startDate: string;
  completionDate?: string;
  status: ResponseStatus;
  score?: number;
}

interface AIInsight {
  quality_score: number;
  predicted_completion_time?: number;
  anomalies: string[];
  follow_up_recommendations: string[];
  highlights: { label: string; value: string; status: 'info' | 'warning' | 'success' | 'danger' }[];
}

export default function ResponseManagementPage() {
  const params = useSearchParams();
  const questionnaireId = params.get('questionnaireId') || '1';

  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ResponseStatus>('all');
  const [departmentFilter, setDepartmentFilter] = useState<'all' | string>('all');
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    setResponses([
      {
        id: 1,
        respondent: 'Alicia Singh',
        department: 'Compliance',
        startDate: '2024-02-10T09:00:00Z',
        completionDate: '2024-02-10T09:32:00Z',
        status: 'complete',
        score: 88,
      },
      {
        id: 2,
        respondent: 'Carlos Mendes',
        department: 'Procurement',
        startDate: '2024-02-11T10:15:00Z',
        completionDate: undefined,
        status: 'in_progress',
        score: undefined,
      },
      {
        id: 3,
        respondent: 'Sofia Chen',
        department: 'IT',
        startDate: '2024-02-09T08:45:00Z',
        completionDate: '2024-02-09T09:05:00Z',
        status: 'complete',
        score: 95,
      },
      {
        id: 4,
        respondent: 'Liam Patel',
        department: 'Finance',
        startDate: '2024-02-08T13:20:00Z',
        completionDate: '2024-02-08T13:27:00Z',
        status: 'complete',
        score: 72,
      },
    ]);
  }, []);

  const fetchInsights = async () => {
    setLoadingInsights(true);
    try {
      const response = await api<{
        quality_score: number;
        predicted_completion_time?: number;
        anomalies: string[];
        follow_up_recommendations: string[];
        highlights: { label: string; value: string; status: 'info' | 'warning' | 'success' | 'danger' }[];
      }>(`/questionnaires/${questionnaireId}/ai/response-insights`);
      setAiInsight(response);
    } catch (error) {
      console.error('Unable to load AI response insights', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [questionnaireId]);

  const filteredResponses = useMemo(() => {
    return responses.filter((response) => {
      const matchesSearch =
        response.respondent.toLowerCase().includes(searchTerm.toLowerCase()) ||
        response.department.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || response.status === statusFilter;
      const matchesDepartment = departmentFilter === 'all' || response.department === departmentFilter;
      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [responses, searchTerm, statusFilter, departmentFilter]);

  const stats = useMemo(() => {
    const total = responses.length;
    const completed = responses.filter((r) => r.status === 'complete').length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const scored = responses.filter((r) => typeof r.score === 'number');
    const avgScore = scored.length
      ? Math.round(scored.reduce((sum, r) => sum + (r.score || 0), 0) / scored.length)
      : 0;
    const durations = responses
      .filter((r) => r.completionDate)
      .map((r) =>
        Math.round(
          (new Date(r.completionDate as string).getTime() - new Date(r.startDate).getTime()) / 1000
        )
      );
    const avgDuration = durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : 0;

    return {
      total,
      completed,
      completionRate,
      avgScore,
      avgDuration: Math.round(avgDuration),
    };
  }, [responses]);

  const departmentOptions = useMemo(() => {
    const uniqueDepartments = Array.from(new Set(responses.map((r) => r.department)));
    return uniqueDepartments;
  }, [responses]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Questionnaire Responses</h1>
            <p className="text-gray-600">
              Monitor completion performance, export response data, and trigger AI-powered quality checks.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Export to Excel
            </Button>
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" /> Export to PDF
            </Button>
            <Button className="gap-2">
              <BarChart3 className="h-4 w-4" /> Generate Report
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-6">
            <p className="text-sm text-gray-600">Total Responses</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-2xl font-bold">{stats.completed}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600">Completion Rate</p>
            <p className="text-2xl font-bold">{stats.completionRate}%</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600">Average Score</p>
            <p className="text-2xl font-bold">{stats.avgScore}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600">Average Completion Time</p>
            <p className="text-2xl font-bold">{stats.avgDuration}s</p>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search respondent or department"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Input type="date" aria-label="Start date" />
                <span className="text-gray-400 text-sm">to</span>
                <Input type="date" aria-label="End date" />
              </div>
              <Select value={departmentFilter} onValueChange={(value) => setDepartmentFilter(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departmentOptions.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="incomplete">Incomplete</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Respondent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                  {filteredResponses.map((response) => (
                    <tr key={response.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{response.respondent}</td>
                      <td className="px-4 py-3 text-gray-600">{response.department}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(response.startDate).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {response.completionDate ? new Date(response.completionDate).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            response.status === 'complete'
                              ? 'border-green-200 text-green-700'
                              : response.status === 'in_progress'
                              ? 'border-yellow-200 text-yellow-700'
                              : 'border-red-200 text-red-700'
                          }
                        >
                          {response.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{response.score ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">AI Response Insights</h3>
                  <p className="text-sm text-gray-600">Automated quality checks across submissions</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchInsights} disabled={loadingInsights}>
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
              {aiInsight ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Sparkles className="h-4 w-4" />
                    Quality score: <span className="font-semibold">{aiInsight.quality_score}/100</span>
                  </div>
                  {aiInsight.predicted_completion_time && (
                    <p className="text-gray-600">
                      Predicted completion time: ~{aiInsight.predicted_completion_time} seconds
                    </p>
                  )}
                  {aiInsight.anomalies.length > 0 && (
                    <div>
                      <p className="font-medium text-red-600">Anomalies detected:</p>
                      <ul className="list-disc list-inside text-red-600">
                        {aiInsight.anomalies.map((anomaly, idx) => (
                          <li key={idx}>{anomaly}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiInsight.follow_up_recommendations.length > 0 && (
                    <div>
                      <p className="font-medium text-gray-700">Follow-up recommendations:</p>
                      <ul className="list-disc list-inside text-gray-600">
                        {aiInsight.follow_up_recommendations.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiInsight.highlights.length > 0 && (
                    <div className="space-y-2">
                      {aiInsight.highlights.map((highlight) => (
                        <Card key={highlight.label} className="p-3 border border-dashed">
                          <p className="text-xs uppercase text-gray-500">{highlight.label}</p>
                          <p className="text-base font-semibold text-gray-800">{highlight.value}</p>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Requesting AI analysis… ensure the questionnaire has at least one response.
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
