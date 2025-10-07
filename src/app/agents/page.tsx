'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  PlusIcon,
  BoltIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useAgents, useDeleteAgent, useUpdateAgent } from '@/hooks/useAgents';
import { Button, Input, Badge, Card, CardContent } from '@/components/ui';
import { AgentGridSkeleton } from '@/components/skeletons/AgentCardSkeleton';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function AgentsPageContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: agents = [], isLoading, error } = useAgents();
  const deleteAgentMutation = useDeleteAgent();
  const updateAgentMutation = useUpdateAgent();

  const displayAgents = agents;

  // Filter agents based on search and status
  const filteredAgents = displayAgents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'active' && agent.is_active) ||
                         (statusFilter === 'inactive' && !agent.is_active);
    return matchesSearch && matchesStatus;
  });

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      await updateAgentMutation.mutateAsync({
        id,
        data: { is_active: !currentStatus }
      });
    } catch (error) {
      console.error('Failed to toggle agent status:', error);
    }
  };

  const handleDeleteAgent = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
      try {
        await deleteAgentMutation.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete agent:', error);
      }
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
          <AgentGridSkeleton count={6} />
        </div>
      );
    }

    if (error) {
      return (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <BoltIcon className="mx-auto h-12 w-12 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Unable to load agents</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {error instanceof Error ? error.message : 'An unexpected error occurred while fetching your agents.'}
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Agents</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your AI agents and monitor their performance
          </p>
        </div>
        <Link href="/agents/new">
          <Button>
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </Link>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md ${viewMode === 'grid'
              ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md ${viewMode === 'list'
              ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BoltIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{filteredAgents.length}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <div className="h-3 w-3 bg-green-600 rounded-full"></div>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {filteredAgents.filter(a => a.is_active).length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DocumentTextIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">24</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agents Grid/List */}
      {filteredAgents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BoltIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {searchQuery || statusFilter !== 'all' ? 'No agents found' : 'No agents yet'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by creating your first AI agent.'
              }
            </p>
            {(!searchQuery && statusFilter === 'all') && (
              <Link href="/agents/new">
                <Button>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Your First Agent
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      agent.is_active ? 'bg-green-100 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      <BoltIcon className={`h-5 w-5 ${
                        agent.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                      }`} />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{agent.name}</h3>
                      <Badge variant={agent.is_active ? 'success' : 'default'}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>

                  <Menu as="div" className="relative">
                    <Menu.Button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <EllipsisVerticalIcon className="h-5 w-5" />
                    </Menu.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        <Menu.Item>
                          <Link
                            href={`/agents/${agent.id}`}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <EyeIcon className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </Menu.Item>
                        <Menu.Item>
                          <Link
                            href={`/agents/${agent.id}/edit`}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <PencilIcon className="h-4 w-4 mr-2" />
                            Edit Agent
                          </Link>
                        </Menu.Item>
                        <Menu.Item>
                          <button
                            onClick={() => handleToggleStatus(agent.id, agent.is_active)}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <div className={`h-4 w-4 mr-2 rounded-full ${agent.is_active ? 'bg-gray-400' : 'bg-green-500'}`} />
                            {agent.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </Menu.Item>
                        <Menu.Item>
                          <button
                            onClick={() => handleDeleteAgent(agent.id)}
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Delete Agent
                          </button>
                        </Menu.Item>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {agent.description || 'No description provided'}
                </p>

                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>Model: {agent.config?.model || 'gpt-4o-mini'}</span>
                  <span>ID: {agent.id}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    CRM: {agent.config?.integrations?.crm?.provider ? agent.config.integrations.crm.provider : 'inherit'}
                  </span>
                  {agent.config?.integrations?.crm?.enabled ? (
                    <Badge variant="success">CRM On</Badge>
                  ) : (
                    <Badge variant="default">CRM Off</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Model</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CRM</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAgents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          agent.is_active ? 'bg-green-100 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          <BoltIcon className={`h-5 w-5 ${
                            agent.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                          }`} />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{agent.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {agent.description || 'No description'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={agent.is_active ? 'success' : 'default'}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{agent.config?.model || 'gpt-4o-mini'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-2">
                        <span>{agent.config?.integrations?.crm?.provider || 'inherit'}</span>
                        <span className={`h-2 w-2 rounded-full ${agent.config?.integrations?.crm?.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <Link href={`/agents/${agent.id}/edit`} className="text-indigo-600 dark:text-indigo-400 hover:underline">Configure</Link>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                          <EllipsisVerticalIcon className="h-5 w-5" />
                        </Menu.Button>
                        <Transition
                          as={Fragment}
                          enter="transition ease-out duration-100"
                          enterFrom="transform opacity-0 scale-95"
                          enterTo="transform opacity-100 scale-100"
                          leave="transition ease-in duration-75"
                          leaveFrom="transform opacity-100 scale-100"
                          leaveTo="transform opacity-0 scale-95"
                        >
                          <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                            <Menu.Item>
                              <Link
                                href={`/agents/${agent.id}`}
                                className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <EyeIcon className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </Menu.Item>
                            <Menu.Item>
                              <Link
                                href={`/agents/${agent.id}/edit`}
                                className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <PencilIcon className="h-4 w-4 mr-2" />
                                Edit Agent
                              </Link>
                            </Menu.Item>
                            <Menu.Item>
                              <button
                                onClick={() => handleToggleStatus(agent.id, agent.is_active)}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <div className={`h-4 w-4 mr-2 rounded-full ${agent.is_active ? 'bg-gray-400' : 'bg-green-500'}`} />
                                {agent.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </Menu.Item>
                            <Menu.Item>
                              <button
                                onClick={() => handleDeleteAgent(agent.id)}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <TrashIcon className="h-4 w-4 mr-2" />
                                Delete Agent
                              </button>
                            </Menu.Item>
                          </Menu.Items>
                        </Transition>
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </div>
    );
  };

  return (
    <ProtectedRoute>
      {renderContent()}
    </ProtectedRoute>
  );
}

export default function AgentsPage() {
  return (
    <ProtectedRoute>
      <AgentsPageContent />
    </ProtectedRoute>
  );
}
