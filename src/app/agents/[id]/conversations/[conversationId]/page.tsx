'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useConversation } from '@/hooks/useConversations';
import { Card, CardHeader, CardContent, CardTitle, Badge, Button } from '@/components/ui';
import { ArrowLeftIcon, BoltIcon, UserIcon } from '@heroicons/react/24/outline';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function ConversationDetailPage() {
  const params = useParams();
  const agentId = parseInt(params.id as string);
  const conversationId = parseInt(params.conversationId as string);

  const { data: conversation, isLoading, error } = useConversation(conversationId);

  const renderContent = () => {
    if (isLoading) {
      return <div className="max-w-5xl mx-auto">Loading conversation...</div>;
    }

    if (error || !conversation) {
      return (
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Conversation not found</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">This conversation may have been archived or removed.</p>
              <Link href={`/agents/${agentId}`}>
                <Button variant="outline">
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back to Agent
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    const profile = conversation.customer_profile;

    return (
      <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <Link href={`/agents/${agentId}`}>
          <Button variant="outline" size="icon">
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Conversation #{conversation.id}</h1>
          <p className="text-gray-600 dark:text-gray-400">Agent: {conversation.agent.name}</p>
        </div>
      </div>

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{profile.name}</div>
              <div className="text-gray-500 dark:text-gray-400">Visitor ID: {profile.visitor_id}</div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={profile.is_vip ? 'success' : 'default'}>
                {profile.is_vip ? 'VIP' : 'Standard'}
              </Badge>
              <span className="text-gray-500 dark:text-gray-400">Journey: {profile.current_journey_stage}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Communication Style:</span>
              <span className="ml-2 capitalize text-gray-900 dark:text-gray-100">{profile.communication_style}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Technical Level:</span>
              <span className="ml-2 capitalize text-gray-900 dark:text-gray-100">{profile.technical_level}</span>
            </div>
            {profile.primary_interests?.length > 0 && (
              <div className="md:col-span-1">
                <span className="text-gray-500 dark:text-gray-400">Interests:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {profile.primary_interests.map((interest) => (
                    <Badge key={interest} variant="outline">{interest}</Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.pain_points?.length > 0 && (
              <div className="md:col-span-1">
                <span className="text-gray-500 dark:text-gray-400">Pain Points:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {profile.pain_points.map((pain) => (
                    <Badge key={pain} variant="outline">{pain}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {conversation.messages.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No messages recorded for this conversation.</p>
          )}
          {conversation.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xl px-4 py-3 rounded-lg border ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-center space-x-2 mb-1">
                  {msg.role === 'user' ? (
                    <UserIcon className="h-4 w-4" />
                  ) : (
                    <BoltIcon className="h-4 w-4" />
                  )}
                  <span className="text-xs uppercase tracking-wide">
                    {msg.role === 'assistant' ? 'Assistant' : msg.role === 'user' ? 'User' : msg.role}
                  </span>
                  {msg.created_at && (
                    <span className="text-xs opacity-75">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.metadata && Object.keys(msg.metadata).length > 0 && (
                  <details className={`mt-2 text-xs ${msg.role === 'user' ? 'text-indigo-100' : 'text-gray-500 dark:text-gray-400'}`}>
                    <summary className="cursor-pointer">Metadata</summary>
                    <pre className="mt-1 bg-black/10 dark:bg-white/10 p-2 rounded overflow-x-auto">{JSON.stringify(msg.metadata, null, 2)}</pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      </div>
    );
  };

  return (
    <ProtectedRoute>
      {renderContent()}
    </ProtectedRoute>
  );
}
