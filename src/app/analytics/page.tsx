'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useAgents } from '@/hooks/useAgents';
import { useAgentStats, useAgentInsights } from '@/hooks/useAnalytics';
import { useEscalations } from '@/hooks/useCRM';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import {
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

function AnalyticsPageContent() {
  const searchParams = useSearchParams();
  const { currentOrganization } = useAuthStore();
  const preselectedAgent = searchParams.get('agent');

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const { data: agents = [], isLoading: isLoadingAgents } = useAgents();

  useEffect(() => {
    if (preselectedAgent) {
      setSelectedAgentId(preselectedAgent);
    } else if (agents.length > 0) {
      setSelectedAgentId(agents[0].id.toString());
    }
  }, [agents, preselectedAgent]);

  const agentId = selectedAgentId ? parseInt(selectedAgentId) : null;

  const { data: stats, isLoading: isLoadingStats, error: statsError } = useAgentStats(agentId!, timeRange);
  const { data: insights, isLoading: isLoadingInsights, error: insightsError } = useAgentInsights(agentId!, timeRange);
  const { data: openEscalations = [] } = useEscalations(agentId || 0, 'open', 5);

  const isLoading = isLoadingAgents || isLoadingStats || isLoadingInsights;

  const StatCard = ({ title, value, change, icon: Icon, suffix = '' }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {value}{suffix}
            </p>
            {change !== undefined && (
              <div className="flex items-center mt-1">
                {change > 0 ? (
                  <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <ArrowTrendingDownIcon className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span className={`text-sm ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(change)}%
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">vs last period</span>
              </div>
            )}
          </div>
          <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center">
            <Icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor your AI agents' performance and user interactions
          {currentOrganization?.name ? ` for ${currentOrganization.name}` : ''}
        </p>
      </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <select
            value={selectedAgentId || ''}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2"
            disabled={isLoadingAgents}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id.toString()}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {openEscalations.length > 0 && agentId && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          🚨 {openEscalations.length} escalation{openEscalations.length === 1 ? '' : 's'} need attention.{' '}
          {openEscalations[0].conversation_id ? (
            <Link href={`/agents/${agentId}/conversations/${openEscalations[0].conversation_id}`} className="underline">
              View latest
            </Link>
          ) : null}
        </div>
      )}

      {isLoading && <div>Loading analytics...</div>}
      {(statsError || insightsError) && <div className="text-red-500">Error loading analytics data. Please try again.</div>}

      {!isLoading && !statsError && !insightsError && stats && insights && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Conversations" value={stats.overview.totalConversations.toLocaleString()} change={stats.overview.conversationsChange} icon={ChatBubbleLeftRightIcon} />
            <StatCard title="Total Messages" value={stats.overview.totalMessages.toLocaleString()} change={stats.overview.messagesChange} icon={ChartBarIcon} />
            <StatCard title="Unique Users" value={stats.overview.uniqueUsers.toLocaleString()} change={stats.overview.usersChange} icon={UserIcon} />
            <StatCard title="Avg Response Time" value={stats.overview.avgResponseTime} change={stats.overview.responseTimeChange} icon={ClockIcon} suffix="s" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Conversations Over Time</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64 flex items-end justify-between space-x-2 p-4">
                  {stats.conversations.map((day, index) => (
                    <div key={index} className="flex flex-col items-center">
                      <div className="bg-indigo-600 rounded-t w-8 transition-all hover:bg-indigo-700" style={{ height: `${(day.count / Math.max(...stats.conversations.map(d => d.count))) * 200}px` }}></div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-2">{new Date(day.date).getDate()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>User Satisfaction</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Positive</span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">{insights.satisfaction.positive}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: `${insights.satisfaction.positive}%` }}></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Neutral</span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">{insights.satisfaction.neutral}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-yellow-600 h-2 rounded-full" style={{ width: `${insights.satisfaction.neutral}%` }}></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Negative</span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">{insights.satisfaction.negative}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-red-600 h-2 rounded-full" style={{ width: `${insights.satisfaction.negative}%` }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Most Asked Questions</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {insights.topQuestions.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.question}</p>
                      <div className="flex items-center mt-1">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mr-3">
                          <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${item.percentage * 8}%` }}></div>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{item.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsPageContent />
    </ProtectedRoute>
  );
}
