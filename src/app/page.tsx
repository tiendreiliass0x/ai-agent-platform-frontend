'use client';

import Link from 'next/link';
import { PlusIcon, BoltIcon, DocumentTextIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useAgents } from '@/hooks/useAgents';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function DashboardContent() {
  const { data: agents = [], isLoading: loading, error } = useAgents();

  const displayAgents = agents;

  const stats = [
    { name: 'Total Agents', value: displayAgents.length, icon: BoltIcon },
    { name: 'Active Agents', value: displayAgents.filter(a => a.is_active).length, icon: ChatBubbleLeftRightIcon },
    { name: 'Documents', value: '12', icon: DocumentTextIcon },
    { name: 'Conversations', value: '1,234', icon: ChatBubbleLeftRightIcon },
  ];

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
        <BoltIcon className="mx-auto h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">We couldn't load your agents</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {error instanceof Error ? error.message : 'An unexpected error occurred while loading the dashboard.'}
        </p>
        <button
          type="button"
          className="mt-6 inline-flex items-center px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome to AI Agents</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Create intelligent AI agents for your website in minutes. Upload your documents and let AI handle customer support.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/agents/new"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <PlusIcon className="mr-2 h-5 w-5" />
            Create Your First Agent
          </Link>
          <Link
            href="/documents"
            className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <DocumentTextIcon className="mr-2 h-5 w-5" />
            Upload Documents
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div key={item.name} className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <item.icon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{item.name}</dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">{item.value}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Agents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Your Agents</h2>
          <Link
            href="/agents"
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            View all
          </Link>
        </div>

        {loading ? (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        ) : displayAgents.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <BoltIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No agents yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first AI agent.</p>
            <div className="mt-6">
              <Link
                href="/agents/new"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                Create Agent
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {displayAgents.slice(0, 3).map((agent) => (
                <li key={agent.id}>
                  <Link href={`/agents/${agent.id}`} className="block hover:bg-gray-50">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                              agent.is_active ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                              <BoltIcon className={`h-5 w-5 ${
                                agent.is_active ? 'text-green-600' : 'text-gray-400'
                              }`} />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-indigo-600">{agent.name}</p>
                              <div className={`ml-2 flex-shrink-0 flex`}>
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  agent.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {agent.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-500">{agent.description}</p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-400">
                          →
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
