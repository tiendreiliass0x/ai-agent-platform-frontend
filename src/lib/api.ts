import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    : undefined;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  // Get token from Zustand store
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to prevent accidental secret exposure in app state
api.interceptors.response.use((response) => {
  try {
    const url = response.config.url || '';
    if (url.startsWith('/api/v1/agents')) {
      const redact = (agent: any) => {
        if (agent && typeof agent === 'object') {
          if ('api_key' in agent) delete agent.api_key;
        }
        return agent;
      };
      if (Array.isArray(response.data)) {
        response.data = response.data.map(redact);
      } else if (response.data && typeof response.data === 'object') {
        if ('agent' in response.data) {
          response.data.agent = redact(response.data.agent);
        } else {
          response.data = redact(response.data);
        }
      }
    }

    // Redact sensitive CRM fields from responses surfaced to the UI
    if (url.includes('/integrations/crm')) {
      const sanitizeCRM = (crm: any) => {
        if (crm && typeof crm === 'object') {
          if ('webhook_secret' in crm) crm.webhook_secret = '[REDACTED]';
          if ('auth' in crm) crm.auth = '[REDACTED]';
        }
        return crm;
      };
      if (response.data && typeof response.data === 'object') {
        if ('crm' in response.data) {
          response.data.crm = sanitizeCRM(response.data.crm);
        } else {
          response.data = sanitizeCRM(response.data);
        }
      }
    }
  } catch {}
  return response;
});

// Agent API calls
export const agentApi = {
  getAll: () => api.get<Agent[]>('/api/v1/agents'),
  getById: (id: number) => api.get<Agent>(`/api/v1/agents/${id}`),
  create: (data: CreateAgentPayload, params?: { organization_id?: number }) =>
    api.post<EnhancedAgentResponse>('/api/v1/agents', data, { params }),
  update: (id: number, data: UpdateAgentPayload) => api.put<Agent>(`/api/v1/agents/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/agents/${id}`),
  getEmbedCode: (id: number) => api.get<{ embed_code: string }>(`/api/v1/agents/${id}/embed-code`),
  getEscalations: (agentId: number, params?: { status?: string; limit?: number }) =>
    api.get<{ items: Escalation[] }>(`/api/v1/agents/${agentId}/escalations`, { params }),
  resolveEscalation: (agentId: number, escalationId: number) =>
    api.post<{ success: boolean }>(`/api/v1/agents/${agentId}/escalations/${escalationId}/resolve`, {}),
  getCRMOverride: (agentId: number) => api.get<{ crm: CRMConfig }>(`/api/v1/agents/${agentId}/integrations/crm`),
  updateCRMOverride: (agentId: number, cfg: CRMConfig) => api.put<{ crm: CRMConfig }>(`/api/v1/agents/${agentId}/integrations/crm`, cfg),
  updateDomainExpertise: (agentId: number, payload: DomainExpertisePayload) =>
    api.patch<Agent>(`/api/v1/agents/${agentId}/domain-expertise`, payload),
};

// Document API calls
export const documentApi = {
  getByAgent: (agentId: number) => api.get<Document[]>(`/api/v1/documents/agent/${agentId}`),
  upload: (agentId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/api/v1/documents/agent/${agentId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadUrl: (agentId: number, payload: UploadUrlPayload) =>
    api.post(`/api/v1/documents/agent/${agentId}`, payload),
  delete: (documentId: number) => api.delete(`/api/v1/documents/${documentId}`),
};

// Chat API calls
export const chatApi = {
  getSessionToken: (agentPublicId: string, apiKey: string) =>
    api.post<{ token: string; expires_in: number }>(
      `/api/v1/agents/public/${agentPublicId}/session-token`,
      {},
      { headers: { 'X-Agent-API-Key': apiKey } }
    ),
  sendMessage: (
    agentPublicId: string,
    sessionToken: string,
    message: string,
    visitorId: string,
    conversationId?: string,
    sessionContext?: Record<string, any>
  ) =>
    api.post(
      `/api/v1/chat/${agentPublicId}`,
      {
        message,
        conversation_id: conversationId,
        agent_id: agentPublicId,
        visitor_id: visitorId,
        session_context: sessionContext,
      } as SendMessagePayload,
      { headers: { 'X-Agent-Session': sessionToken } }
    ),
  getHistory: (agentPublicId: string, sessionToken: string, conversationId: string) =>
    api.get<Message[]>(`/api/v1/chat/${agentPublicId}/conversations/${conversationId}`, {
      headers: { 'X-Agent-Session': sessionToken },
    }),
};

// Auth API calls
export const authApi = {
  login: (formData: URLSearchParams) => api.post<Token>('/api/v1/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }),
  getMe: () => api.get<User>('/api/v1/auth/me'),
};

// Organization API calls
export const organizationApi = {
  getAll: () => api.get<Organization[]>('/api/v1/organizations/'),
  getById: (id: number) => api.get<Organization>(`/api/v1/organizations/${id}`),
  update: (id: number, data: UpdateOrganizationPayload) => api.put<Organization>(`/api/v1/organizations/${id}`, data),
  getCRM: (orgId: number) => api.get<{ crm: CRMConfig }>(`/api/v1/organizations/${orgId}/integrations/crm`),
  updateCRM: (orgId: number, cfg: CRMConfig) => api.put<{ crm: CRMConfig }>(`/api/v1/organizations/${orgId}/integrations/crm`, cfg),
  testCRM: (orgId: number, cfg?: CRMConfig) => api.post(`/api/v1/organizations/${orgId}/integrations/crm/test-connection`, cfg || {}),
  syncCRM: (orgId: number) => api.post(`/api/v1/organizations/${orgId}/integrations/crm/sync`, {}),
};

// Analytics API calls
export const analyticsApi = {
  getStats: (agentId: number, timeRange: string) => 
    api.get<AgentStats>(`/api/v1/agents/${agentId}/stats`, { params: { time_range: timeRange } }),
  getInsights: (agentId: number, timeRange: string) => 
    api.get<AgentInsights>(`/api/v1/agents/${agentId}/insights`, { params: { time_range: timeRange } }),
};

// Crawl API calls
export const crawlApi = {
  enqueue: (rootUrl: string, maxPages = 30) => api.post<{ task_id: string; status: string; discovered: number; visited: number; urls: string[] }>(
    `/api/v1/crawl/enqueue`,
    { root_url: rootUrl, max_pages: maxPages }
  ),
  status: (taskId: string) => api.get<{ task_id: string; status: string; discovered: number; visited: number; urls: string[] }>(`/api/v1/crawl/${taskId}`),
};

// Types
export interface Token {
  access_token: string;
  token_type: string;
}

export interface Agent {
  id: number;
  public_id: string;
  name: string;
  description?: string;
  system_prompt?: string;
  is_active: boolean;
  api_key: string;
  config: Record<string, any>;
  widget_config: Record<string, any>;
  tier?: string;
  domain_expertise_type?: string;
  domain_expertise_enabled?: boolean;
  personality_profile?: Record<string, any>;
  expertise_level?: number;
  domain_knowledge_sources?: number[];
  web_search_enabled?: boolean;
  custom_training_data?: Record<string, any>;
  expert_context?: string | null;
  tool_policy?: Record<string, any>;
  grounding_mode?: string;
}

// API Payload Types
export interface CreateAgentPayload {
  name: string;
  description: string;
  system_prompt: string;
  config?: Record<string, any>;
  widget_config?: Record<string, any>;
  agent_type?: string;
  industry?: string;
  auto_optimize?: boolean;
  idempotency_key?: string;
}

export interface UpdateAgentPayload extends Partial<CreateAgentPayload> {
  is_active?: boolean;
  config?: Record<string, any>;
  widget_config?: Record<string, any>;
}

export interface EnhancedAgentResponse {
  agent: Agent;
  embed_code: string;
  setup_guide: Record<string, any>;
  optimization_applied: boolean;
  template_used?: string | null;
  recommendations: Array<Record<string, any>>;
}

export interface UploadUrlPayload {
  filename: string;
  content: string;
  content_type: string;
  doc_metadata?: Record<string, any>;
}

export interface SendMessagePayload {
  message: string;
  conversation_id?: string;
  agent_id: string;
  visitor_id: string;
  session_context?: Record<string, any>;
}

export interface Document {
  id: number;
  filename: string;
  content_type: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  doc_metadata: Record<string, any>;
  agent_id: number;
  created_at: string;
  updated_at?: string;
  content_hash?: string;
  chunk_count?: number;
  url?: string;
  error_message?: string | null;
}

export interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  description?: string;
  website?: string;
  logo_url?: string;
  plan: string;
  subscription_status: string;
  settings: Record<string, any>;
  is_active: boolean;
  max_agents: number;
  max_users: number;
  max_documents_per_agent: number;
  agents_count: number;
  active_users_count: number;
  created_at: string;
  updated_at?: string;
}

// CRM + Escalation types
export interface CRMConfig {
  provider?: 'hubspot' | 'salesforce' | 'custom' | string;
  enabled?: boolean;
  auth?: Record<string, any>;
  field_map?: Record<string, any>;
  stage_map?: Record<string, any>;
  webhook_secret?: string;
  last_sync_at?: string;
}

export interface Escalation {
  id: number;
  status: 'open' | 'in_progress' | 'resolved' | string;
  priority: 'normal' | 'high' | 'critical' | string;
  reason?: string;
  summary?: string;
  conversation_id?: string;
  customer_profile_id?: number;
  details?: Record<string, any>;
  created_at?: string;
}

export interface ConversationMessage {
  id: number;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  created_at?: string;
  metadata?: Record<string, any>;
}

export interface ConversationDetail {
  id: number;
  agent: { id: number; name: string };
  session_id: string;
  created_at?: string;
  messages: ConversationMessage[];
  customer_profile?: {
    id: number;
    name: string;
    visitor_id: string;
    technical_level?: string;
    communication_style?: string;
    engagement_level?: string;
    is_vip?: boolean;
    total_conversations?: number;
    primary_interests: string[];
    pain_points: string[];
    current_journey_stage?: string;
  } | null;
}

export interface ConversationSummary {
  id: number;
  session_id: string;
  created_at?: string;
  updated_at?: string;
  customer_profile?: {
    id: number;
    name: string;
    visitor_id: string;
    is_vip?: boolean;
    primary_interests: string[];
  } | null;
  last_message?: ConversationMessage | null;
  total_messages: number;
}

export interface ChatResponse {
  response: string;
  conversation_id?: string;
  customer_context?: {
    escalation?: {
      created?: boolean;
      id?: number;
      priority?: string;
    };
    sentiment?: Record<string, any> | null;
    entities?: Record<string, any>[] | null;
    insights?: Record<string, any> | null;
    user_intelligence?: Record<string, any> | null;
  };
  model: string;
  usage: Record<string, any>;
}

export interface DomainExpertisePayload {
  enabled?: boolean;
  persona_key?: string;
  persona_overrides?: Record<string, any>;
  custom_persona?: Record<string, any>;
  knowledge_document_ids?: number[];
  web_search_enabled?: boolean;
  site_whitelist?: string[];
  grounding_mode?: 'strict' | 'blended';
  expertise_level?: number;
  additional_context?: string;
}

export type UpdateOrganizationPayload = {
  name?: string;
  description?: string;
  website?: string;
  logo_url?: string;
  settings?: Record<string, any>;
};

export interface AgentStats {
  overview: {
    totalConversations: number;
    totalMessages: number;
    uniqueUsers: number;
    avgResponseTime: number;
    conversationsChange: number;
    messagesChange: number;
    usersChange: number;
    responseTimeChange: number;
  };
  conversations: { date: string; count: number }[];
}

export interface AgentInsights {
  topQuestions: { question: string; count: number; percentage: number }[];
  satisfaction: {
    positive: number;
    neutral: number;
    negative: number;
  };
}
// Conversation API calls
export const conversationApi = {
  listByAgent: (agentId: number, params: { limit?: number; offset?: number }) =>
    api.get<{ items: ConversationSummary[]; limit: number; offset: number }>(`/api/v1/agents/${agentId}/conversations`, { params }),
  getById: (conversationId: number) => api.get<ConversationDetail>(`/api/v1/conversations/${conversationId}`),
};
