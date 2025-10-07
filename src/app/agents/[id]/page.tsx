'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  CodeBracketIcon,
  BoltIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { useAgent, useDeleteAgent, useUpdateAgent, useAgentEmbedCode } from '@/hooks/useAgents';
import { useDocuments } from '@/hooks/useDocuments';
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useEscalations, useResolveEscalation } from '@/hooks/useCRM';
import { useAgentConversations } from '@/hooks/useConversations';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function AgentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = parseInt(params.id as string);

  const [copiedEmbedCode, setCopiedEmbedCode] = useState(false);

  const { data: agent, isLoading: agentLoading, error: agentError } = useAgent(agentId);
  const { data: documents = [], isLoading: documentsLoading } = useDocuments(agentId);
  const { data: embedCode } = useAgentEmbedCode(agentId);
  const deleteAgentMutation = useDeleteAgent();
  const updateAgentMutation = useUpdateAgent();
  const [escStatus, setEscStatus] = useState<'open'|'in_progress'|'resolved'|'all'>('open');
  const [showEscDetail, setShowEscDetail] = useState<null | { id: number }>(null);
  const { data: escalations = [] } = useEscalations(agentId, escStatus === 'all' ? undefined : escStatus, 10);
  const resolveEsc = useResolveEscalation(agentId);
  const CONVERSATION_PAGE_SIZE = 10;
  const [conversationPage, setConversationPage] = useState(0);
  const { data: conversationList, isLoading: conversationsLoading } = useAgentConversations(
    agentId,
    CONVERSATION_PAGE_SIZE,
    conversationPage * CONVERSATION_PAGE_SIZE
  );
  const conversations = conversationList?.items ?? [];
  const conversationCountEstimate = conversationList ? (conversationPage * CONVERSATION_PAGE_SIZE) + conversations.length : 0;

  const displayAgent = agent ?? null;
  // Secure embed code: never expose API keys client-side
  const embedCodeSnippet = embedCode?.embed_code || (displayAgent ? `<!-- Client embed snippet -->
<script>
  window.AI_AGENT_CONFIG = {
    agentPublicId: "${displayAgent.public_id}",
    // Obtain a short-lived session token from your server:
    // fetch('/api/agents/${displayAgent.id}/session-token',{method:'POST'})
  };
</script>
<script src="/widget/agent-widget.js"></script>` : '');

  const handleToggleStatus = async () => {
    if (!displayAgent) return;
    try {
      await updateAgentMutation.mutateAsync({
        id: agentId,
        data: { is_active: !displayAgent.is_active }
      });
    } catch (error) {
      console.error('Failed to toggle agent status:', error);
    }
  };

  const handleDeleteAgent = async () => {
    if (window.confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
      try {
        await deleteAgentMutation.mutateAsync(agentId);
        router.push('/agents');
      } catch (error) {
        console.error('Failed to delete agent:', error);
      }
    }
  };

  const copyEmbedCode = async () => {
    if (!embedCodeSnippet) {
      return;
    }
    await navigator.clipboard.writeText(embedCodeSnippet);
    setCopiedEmbedCode(true);
    setTimeout(() => setCopiedEmbedCode(false), 2000);
  };

  const renderContent = () => {
    if (agentLoading) {
      return (
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            </div>
            <div className="space-y-6">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            </div>
          </div>
        </div>
      );
    }

    if (agentError) {
      return (
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="p-10 text-center space-y-3">
              <BoltIcon className="mx-auto h-12 w-12 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">We couldn't load this agent</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {agentError instanceof Error ? agentError.message : 'An unexpected error occurred while fetching the agent details.'}
              </p>
              <Link href="/agents">
                <Button variant="outline">
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back to agents
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (!displayAgent) {
      return (
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <BoltIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Agent not found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The agent you're looking for doesn't exist or has been deleted.
              </p>
              <Link href="/agents">
                <Button variant="outline">
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back to Agents
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/agents">
            <Button variant="outline" size="icon">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center space-x-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              displayAgent.is_active ? 'bg-green-100 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <BoltIcon className={`h-5 w-5 ${
                displayAgent.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
              }`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{displayAgent.name}</h1>
              <div className="flex items-center space-x-2">
                <Badge variant={displayAgent.is_active ? 'success' : 'default'}>
                  {displayAgent.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <span className="text-sm text-gray-500 dark:text-gray-400">ID: {displayAgent.id}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link href={`#embed`}>
            <Button variant="outline">
              <CodeBracketIcon className="h-4 w-4 mr-2" />
              Get Embed Code
            </Button>
          </Link>
          <Link href={`/agents/${displayAgent.id}/chat`}>
            <Button variant="outline">
              <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" />
              Test Chat
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={handleToggleStatus}
            disabled={updateAgentMutation.isPending}
          >
            {displayAgent.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Link href={`/agents/${displayAgent.id}/edit`}>
            <Button variant="outline">
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button
            variant="destructive"
            onClick={handleDeleteAgent}
            disabled={deleteAgentMutation.isPending}
          >
            <TrashIcon className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 dark:text-gray-300">
                {displayAgent.description || 'No description provided for this agent.'}
              </p>
            </CardContent>
          </Card>

          {/* System Prompt */}
          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                  {displayAgent.system_prompt || 'No custom system prompt configured.'}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
                    <p className="text-gray-900 dark:text-gray-100">{displayAgent.config?.model || 'gpt-4o-mini'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Temperature</label>
                    <p className="text-gray-900 dark:text-gray-100">{displayAgent.config?.temperature || 0.7}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Max Tokens</label>
                    <p className="text-gray-900 dark:text-gray-100">{displayAgent.config?.max_tokens || 1000}</p>
                  </div>
                  {/* API key is intentionally not displayed to avoid leakage */}
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Domain Expertise</label>
                    <p className="text-gray-900 dark:text-gray-100">
                      {displayAgent.domain_expertise_enabled
                        ? `Enabled${displayAgent.personality_profile?.name ? ` · ${displayAgent.personality_profile.name}` : ''}`
                        : 'Disabled'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Widget Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Widget Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</label>
                  <p className="text-gray-900 dark:text-gray-100 capitalize">
                    {displayAgent.widget_config?.theme || 'light'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Position</label>
                  <p className="text-gray-900 dark:text-gray-100 capitalize">
                    {displayAgent.widget_config?.position || 'bottom-right'}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Welcome Message</label>
                  <p className="text-gray-900 dark:text-gray-100">
                    {displayAgent.widget_config?.welcome_message || `Hi! I'm ${displayAgent.name}. How can I help you today?`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Documents</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {documentsLoading ? '…' : documents.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Conversations</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {conversationList ? conversationCountEstimate : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <BoltIcon className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                </div>
                <Badge variant={displayAgent.is_active ? 'success' : 'default'}>
                  {displayAgent.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Conversations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {conversationsLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading conversations...</p>
              ) : conversations.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No conversations yet.</p>
              ) : (
                <div className="space-y-3">
                  {conversations.map((conv) => (
                    <div key={conv.id} className="border border-gray-200 dark:border-gray-700 rounded p-3">
                      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                        <span>#{conv.id}</span>
                        <span>{conv.updated_at ? new Date(conv.updated_at).toLocaleString() : '—'}</span>
                      </div>
                      <div className="mt-2 text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                        {conv.last_message?.content || 'No messages yet.'}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        {conv.customer_profile ? (
                          <span>
                            {conv.customer_profile.name}
                            {conv.customer_profile.is_vip ? ' · VIP' : ''}
                          </span>
                        ) : (
                          <span>Unknown visitor</span>
                        )}
                        <Link
                          href={`/agents/${agentId}/conversations/${conv.id}`}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConversationPage((page) => Math.max(page - 1, 0))}
                  disabled={conversationPage === 0 || conversationsLoading}
                >
                  Previous
                </Button>
                <span className="text-xs text-gray-500 dark:text-gray-400">Page {conversationPage + 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConversationPage((page) => page + 1)}
                  disabled={conversations.length < CONVERSATION_PAGE_SIZE || conversationsLoading}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Embed Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CodeBracketIcon className="h-5 w-5" />
                <span>Embed Code</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Copy this code to embed the agent on your website:
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-3">
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {embedCodeSnippet || 'Embed code is not available yet.'}
                </pre>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyEmbedCode}
                className="w-full"
              >
                {copiedEmbedCode ? (
                  <>
                    <CheckIcon className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
                    Copy Code
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href={`/agents/${displayAgent.id}/chat`} className="block">
                <Button variant="outline" className="w-full justify-start">
                  <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" />
                  Test Chat
                </Button>
              </Link>
              <Link href={`/documents?agent=${displayAgent.id}`} className="block">
                <Button variant="outline" className="w-full justify-start">
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Manage Documents
                </Button>
              </Link>
              <Link href={`/analytics?agent=${displayAgent.id}`} className="block">
                <Button variant="outline" className="w-full justify-start">
                  <ChartBarIcon className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Escalations */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Escalations</CardTitle>
                <select
                  value={escStatus}
                  onChange={(e) => setEscStatus(e.target.value as any)}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="all">All</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {escalations.length === 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">No open escalations.</p>
              )}
              {escalations.map((esc) => (
                <div key={esc.id} className="border border-gray-200 dark:border-gray-700 rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">#{esc.id} · {esc.priority.toUpperCase()}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{esc.summary || 'No summary'}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setShowEscDetail({ id: esc.id })}>
                        View
                      </Button>
                      {esc.status !== 'resolved' && (
                        <Button size="sm" variant="outline" onClick={() => resolveEsc.mutate(esc.id)} disabled={resolveEsc.isPending}>
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                  {showEscDetail?.id === esc.id && (
                    <div className="mt-3 text-xs text-gray-700 dark:text-gray-300 space-y-2">
                      <div>Conversation: {esc.conversation_id ?? '—'}</div>
                      <div>Customer Profile: {esc.customer_profile_id ?? '—'}</div>
                      {esc.details && (
                        <pre className="bg-gray-50 dark:bg-gray-900/40 p-2 rounded overflow-auto max-h-48">{JSON.stringify(esc.details, null, 2)}</pre>
                      )}
                      <div className="flex items-center space-x-3 pt-1">
                        <Link href={`/analytics?agent=${agentId}`} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs">View Analytics</Link>
                        {esc.conversation_id && (
                          <Link
                            href={`/agents/${agentId}/conversations/${esc.conversation_id}`}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
                          >
                            View Conversation
                          </Link>
                        )}
                        <button onClick={() => setShowEscDetail(null)} className="text-xs text-gray-500 hover:underline">Close</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    );
  };

  return (
    <ProtectedRoute>
      {renderContent()}
    </ProtectedRoute>
  );
}
