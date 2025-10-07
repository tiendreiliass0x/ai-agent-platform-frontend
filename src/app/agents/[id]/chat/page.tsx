'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  PaperAirplaneIcon,
  UserIcon,
  BoltIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { useAgent } from '@/hooks/useAgents';
import { chatApi, ChatResponse, api } from '@/lib/api';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export default function AgentChatPage() {
  const params = useParams();
  const agentId = parseInt(params.id as string);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: agent, isLoading: agentLoading } = useAgent(agentId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionTokenExpiry, setSessionTokenExpiry] = useState<number | null>(null);
  const [escalationToast, setEscalationToast] = useState<{ id: number; priority?: string } | null>(null);

  const visitorId = useMemo(() => `admin-${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, [agentId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setSessionToken(null);
    setSessionTokenExpiry(null);
  }, [agent?.public_id]);

  // Add welcome message when agent loads
  useEffect(() => {
    if (agent && messages.length === 0) {
      const welcomeMessage = agent.widget_config?.welcome_message || `Hi! I'm ${agent.name}. How can I help you today?`;
      setMessages([{
        id: 'welcome',
        content: welcomeMessage,
        role: 'assistant',
        timestamp: new Date()
      }]);
    }
  }, [agent, messages.length]);

  const ensureAgentSessionToken = useCallback(async () => {
    if (!agent) throw new Error('Agent not loaded');

    const now = Date.now();
    const safetyWindow = 5000;

    if (
      sessionToken &&
      sessionTokenExpiry &&
      sessionTokenExpiry - safetyWindow > now
    ) {
      return sessionToken;
    }

    // Request token via server-side proxy to avoid exposing API keys
    const tokenResp = await api.post<{ token: string; expires_in: number }>(`/api/agents/${agentId}/session-token`);
    const tokenResponse = tokenResp.data;
    const newToken = tokenResponse.token;
    const expiresIn = tokenResponse.expires_in;
    setSessionToken(newToken);
    setSessionTokenExpiry(Date.now() + expiresIn * 1000);
    return newToken;
  }, [agent, sessionToken, sessionTokenExpiry, agentId]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !agent) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Call real chat endpoint
    try {
      const sessionContext = {
        page_url: window.location.href,
        referrer: document.referrer,
      };
      const token = await ensureAgentSessionToken();

      const response = await chatApi.sendMessage(
        agent.public_id,
        token,
        userMessage.content,
        visitorId,
        conversationId ?? undefined,
        sessionContext
      );

      const data = response.data as ChatResponse;
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      const assistantMessage: Message = {
        id: `${Date.now() + 1}`,
        content: data.response,
        role: 'assistant',
        timestamp: new Date(),
        metadata: data.customer_context?.user_intelligence,
      };

      setMessages(prev => [...prev, assistantMessage]);

      const escalation = data.customer_context?.escalation;
      if (escalation?.created) {
        setEscalationToast({ id: escalation.id, priority: escalation.priority });
        setTimeout(() => setEscalationToast(null), 6000);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble responding right now. Please try again.",
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (agent) {
      const welcomeMessage = agent.widget_config?.welcome_message || `Hi! I'm ${agent.name}. How can I help you today?`;
      setMessages([{
        id: 'welcome',
        content: welcomeMessage,
        role: 'assistant',
        timestamp: new Date()
      }]);
    } else {
      setMessages([]);
    }
    setConversationId(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderContent = () => {
    if (agentLoading) {
      return (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
        </div>
      );
    }

    if (!agent) {
      return (
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Agent not found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The agent you're trying to chat with doesn't exist or has been deleted.
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
      <div className="max-w-4xl mx-auto space-y-6">
      {escalationToast && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          🚨 Escalation created (#{escalationToast.id}) · Priority: {escalationToast.priority?.toUpperCase() || 'N/A'}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/agents/${agentId}`}>
            <Button variant="outline" size="icon">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900/20 rounded-full flex items-center justify-center">
              <BoltIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Test Chat</h1>
              <p className="text-gray-600 dark:text-gray-400">Chat with {agent.name}</p>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={clearChat}>
          <TrashIcon className="h-4 w-4 mr-2" />
          Clear Chat
        </Button>
      </div>

      {/* Chat Interface */}
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="text-lg">Chat Test Environment</CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This is a test environment for your agent. Messages are simulated and won't be saved.
          </p>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}>
                  <div className="flex items-start space-x-2">
                    {message.role === 'assistant' && (
                      <BoltIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                    )}
                    {message.role === 'user' && (
                      <UserIcon className="h-4 w-4 text-white mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.role === 'user'
                          ? 'text-indigo-200'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  {message.metadata && Object.keys(message.metadata).length > 0 && (
                    <details className={`mt-2 text-xs ${message.role === 'user' ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}>
                      <summary className="cursor-pointer">Intelligence</summary>
                      <pre className="mt-1 bg-black/10 dark:bg-white/10 p-2 rounded whitespace-pre-wrap">
                        {JSON.stringify(message.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                  <div className="flex items-center space-x-2">
                    <BoltIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex space-x-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                rows={1}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                style={{ minHeight: '40px', maxHeight: '120px' }}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                size="icon"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
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
