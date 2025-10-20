'use client';

import { Card } from '@/components/ui/card';
import { BarChart3, Users, CheckCircle, Clock, Sparkles, ClipboardList } from 'lucide-react';

interface Questionnaire {
  id: number;
  title: string;
  status: 'draft' | 'active' | 'paused' | 'closed' | 'archived';
  type?: 'assessment' | 'survey' | 'checklist' | 'evaluation';
  responses?: number;
  completion_rate?: number;
  ai_readiness_score?: number;
}

interface QuestionnaireStatsProps {
  questionnaires: Questionnaire[];
}

export function QuestionnaireStats({ questionnaires }: QuestionnaireStatsProps) {
  const totalQuestionnaires = questionnaires.length;
  const activeQuestionnaires = questionnaires.filter(q => q.status === 'active').length;
  const totalResponses = questionnaires.reduce((sum, q) => sum + (q.responses || 0), 0);
  const averageCompletionRate = questionnaires.length > 0
    ? questionnaires.reduce((sum, q) => sum + (q.completion_rate || 0), 0) / questionnaires.length
    : 0;
  const averageAIReadiness = questionnaires.length > 0
    ? Math.round(
        questionnaires.reduce((sum, q) => sum + (q.ai_readiness_score || 0), 0) /
          questionnaires.length
      )
    : 0;
  const checklistCount = questionnaires.filter(q => q.type === 'checklist').length;

  const stats = [
    {
      label: 'Total Questionnaires',
      value: totalQuestionnaires,
      icon: BarChart3,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Active Questionnaires',
      value: activeQuestionnaires,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      label: 'Total Responses',
      value: totalResponses,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      label: 'Avg. Completion Rate',
      value: `${Math.round(averageCompletionRate)}%`,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    {
      label: 'Avg. AI Readiness',
      value: `${averageAIReadiness}%`,
      icon: Sparkles,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100'
    },
    {
      label: 'Checklists in Library',
      value: checklistCount,
      icon: ClipboardList,
      color: 'text-teal-600',
      bgColor: 'bg-teal-100'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {stats.map((stat, index) => {
        const IconComponent = stat.icon;
        return (
          <Card key={index} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.bgColor} ${stat.color} p-3 rounded-full`}>
                <IconComponent className="h-6 w-6" />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}