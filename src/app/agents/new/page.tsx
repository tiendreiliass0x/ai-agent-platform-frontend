'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BoltIcon,
  DocumentArrowUpIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import { useAgent, useCreateAgent, useUpdateAgentDomainExpertise } from '@/hooks/useAgents';
import { useUploadFile, useUploadUrl, useDocuments } from '@/hooks/useDocuments';
import { Input, Button } from '@/components/ui';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useAuthStore } from '@/stores/authStore';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { api, chatApi, type DomainExpertisePayload, crawlApi } from '@/lib/api';

type DomainKey = 'saas' | 'ecommerce' | 'healthcare' | 'fintech' | 'education' | 'custom';

type UploadItemStatus = {
  id: string;
  label: string;
  type: 'file' | 'url';
  status: 'pending' | 'uploading' | 'success' | 'error';
};

const agentSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(50, 'Name must be less than 50 characters'),
  description: z.string().max(200, 'Description must be less than 200 characters').optional(),
  system_prompt: z.string().max(1000, 'System prompt must be less than 1000 characters').optional(),
});

type AgentFormData = z.infer<typeof agentSchema>;

const steps = [
  { id: 1, name: 'Basic Info', icon: BoltIcon },
  { id: 2, name: 'Knowledge Base', icon: DocumentArrowUpIcon },
  { id: 3, name: 'Configuration', icon: GlobeAltIcon },
  { id: 4, name: 'Complete', icon: CheckCircleIcon },
];

const DOMAIN_DEFAULTS: Record<DomainKey, { persona: string; prompt: string }> = {
  saas: {
    persona: 'support_expert',
    prompt: 'You are a helpful SaaS support expert. Diagnose and resolve user issues using the provided docs. Be concise and cite relevant sources.',
  },
  ecommerce: {
    persona: 'sales_rep',
    prompt: 'You are an e-commerce assistant. Help customers with product questions, returns, and orders grounded in the provided policies and catalog.',
  },
  healthcare: {
    persona: 'domain_specialist',
    prompt: 'You are a careful healthcare information assistant. Provide general guidance based on provided materials; avoid medical advice and suggest consulting professionals.',
  },
  fintech: {
    persona: 'solution_engineer',
    prompt: 'You are a fintech solutions assistant. Explain features, compliance constraints, and workflows grounded in provided references. Avoid legal or investment advice.',
  },
  education: {
    persona: 'domain_specialist',
    prompt: 'You are an educational assistant. Provide study guidance, course info, and policies grounded in provided docs. Keep tone supportive and clear.',
  },
  custom: {
    persona: 'custom',
    prompt: 'You are a helpful assistant that answers questions based on the provided knowledge base. Be helpful, accurate, and concise.',
  },
};

const DOMAIN_GUIDANCE: Record<DomainKey, {
  elevatorPitch: string;
  starterQuestions: string[];
  starterPack: {
    urls: string[];
    additionalContext: string;
    personaTips: string;
  };
  bestPractices: string[];
  knowledgeSuggestions: string[];
}> = {
  saas: {
    elevatorPitch: 'Calibrate for fast troubleshooting with clear feature explanations and upgrade nudges.',
    starterQuestions: [
      'What does onboarding look like for a new workspace?',
      'How do I compare the Professional and Enterprise tiers?',
    ],
    starterPack: {
      urls: [
        'https://example.com/docs/getting-started',
        'https://example.com/docs/pricing',
      ],
      additionalContext: 'Emphasize quick triage, link to status page for incidents, and surface upgrade pathways after resolving an issue.',
      personaTips: 'Warm, confident, and proactive. Recommend relevant playbooks when the customer is blocked.',
    },
    bestPractices: [
      'Highlight key integrations or workflow automations in replies.',
      'Offer links to changelog entries when referencing new features.',
      'Suggest escalation only after exhausting documented workarounds.',
    ],
    knowledgeSuggestions: [
      'Product documentation and FAQ content',
      'Pricing and plan comparison pages',
      'Support policies (SLA, refunds, escalation paths)',
      'Release notes, onboarding, and troubleshooting guides',
    ],
  },
  ecommerce: {
    elevatorPitch: 'Drive confident purchase decisions with empathetic tone and policy clarity.',
    starterQuestions: [
      'Can you help me find the holiday shipping deadlines?',
      'What is the extended warranty process?',
    ],
    starterPack: {
      urls: [
        'https://example.com/help/shipping',
        'https://example.com/help/returns',
      ],
      additionalContext: 'Always confirm inventory status before upselling accessories. Flag potential VIP or high-risk orders for review.',
      personaTips: 'Friendly retail concierge with focus on reassurance. Mention loyalty benefits when relevant.',
    },
    bestPractices: [
      'Surface cross-sell bundles when cart value is high.',
      'Quote return policy snippets verbatim to avoid ambiguity.',
      'Offer size guides or comparison charts for apparel queries.',
    ],
    knowledgeSuggestions: [
      'Return, exchange, and shipping policy pages',
      'High-intent product and category pages',
      'Size guides or fit finders for apparel',
      'Warranty and post-purchase support information',
    ],
  },
  healthcare: {
    elevatorPitch: 'Respect compliance guardrails while guiding patients to accurate resources and next steps.',
    starterQuestions: [
      'What should patients know before their first telehealth visit?',
      'How do I update my insurance information securely?',
    ],
    starterPack: {
      urls: [
        'https://example.com/patients/hipaa-overview',
        'https://example.com/patients/prep-checklist',
      ],
      additionalContext: 'Remind users the assistant cannot provide diagnoses. Direct urgent symptoms to emergency contacts immediately.',
      personaTips: 'Calm, professional, and compliance-first. Confirm understanding before offering next steps.',
    },
    bestPractices: [
      'Display disclaimers when sharing clinical information.',
      'Provide multilingual resources where available.',
      'Log any escalation-worthy symptoms for clinical review.',
    ],
    knowledgeSuggestions: [
      'Patient FAQs and intake instructions',
      'Compliance, privacy, and HIPAA guidance',
      'Service descriptions, departments, and hours of operation',
      'Insurance, billing, and contact escalation details',
    ],
  },
  fintech: {
    elevatorPitch: 'Blend regulatory precision with architectural guidance for financial teams.',
    starterQuestions: [
      'What is the PCI scope for our microservices upgrade?',
      'How do I enable multi-entity accounting in the dashboard?',
    ],
    starterPack: {
      urls: [
        'https://example.com/compliance/pci-guide',
        'https://example.com/product/architecture',
      ],
      additionalContext: 'Call out regulatory references (PCI, SOC2) and tie recommendations back to risk mitigation. Document audit trails on critical flows.',
      personaTips: 'Pragmatic solutions engineer. Provides diagrams or step lists where possible.',
    },
    bestPractices: [
      'Reference specific control IDs when discussing compliance.',
      'Highlight sandbox vs. production limitations.',
      'Offer migration checklists for major platform changes.',
    ],
    knowledgeSuggestions: [
      'Product and feature implementation guides',
      'Compliance frameworks (PCI, SOC2) and audit docs',
      'Pricing, fee schedules, and usage limits',
      'Integration playbooks and architecture diagrams',
    ],
  },
  education: {
    elevatorPitch: 'Guide learners and guardians through curriculum, admissions, and schedules with enthusiasm.',
    starterQuestions: [
      'How do I register for the spring semester online?',
      'What tutoring resources are available for calculus?',
    ],
    starterPack: {
      urls: [
        'https://example.com/academics/calendar',
        'https://example.com/academics/advising',
      ],
      additionalContext: 'Cheer students on, reference specific departments, and surface support hours proactively.',
      personaTips: 'Encouraging academic advisor tone. Uses inclusive language and celebrates milestones.',
    },
    bestPractices: [
      'Link to syllabi or office hours when discussing classes.',
      'Flag scholarship deadlines as reminders.',
      'Suggest follow-up with advisors for personalized plans.',
    ],
    knowledgeSuggestions: [
      'Course catalogs, syllabi, and program guides',
      'Admissions requirements, tuition, and financial aid pages',
      'Academic calendars and scheduling policies',
      'Student services, tutoring, and advising resources',
    ],
  },
  custom: {
    elevatorPitch: 'Design a bespoke concierge by mixing your brand voice with curated resources.',
    starterQuestions: [
      'What tone should the assistant use for premium clients?',
      'Which knowledge bases are most critical to include first?',
    ],
    starterPack: {
      urls: [],
      additionalContext: 'Document the top five conversation intents and include escalation expectations. Calibrate tone with brand guidelines.',
      personaTips: 'Flexible but brand-aligned. Provide examples of voice do/don’t to steer the LLM.',
    },
    bestPractices: [
      'Start with a small curated corpus before adding broad documentation.',
      'Define clear escalation policies for edge cases.',
      'Regularly review analytics to refine intents and prompts.',
    ],
    knowledgeSuggestions: [
      'High-signal FAQs, playbooks, and support macros',
      'Brand tone and voice guidelines',
      'Policies and escalation procedures',
      'Reference decks or onboarding material for new teammates',
    ],
  },
};

// Generate a unique idempotency key for this agent creation session
function generateIdempotencyKey(): string {
  // Use crypto.randomUUID if available (modern browsers), otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: Generate a simple UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function CreateAgent() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Generate idempotency key once per component mount
  const idempotencyKey = useMemo(() => generateIdempotencyKey(), []);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [rootUrl, setRootUrl] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [selectedDiscovered, setSelectedDiscovered] = useState<string[]>([]);
  const [domain, setDomain] = useState<DomainKey>('saas');
  const [selectedPersona, setSelectedPersona] = useState<string>(DOMAIN_DEFAULTS['saas'].persona);
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [siteWhitelist, setSiteWhitelist] = useState('');
  const [groundingMode, setGroundingMode] = useState<'strict' | 'blended'>('blended');
  const [expertiseLevel, setExpertiseLevel] = useState(0.7);
  const [additionalContext, setAdditionalContext] = useState('');
  const [customPersonaPrompt, setCustomPersonaPrompt] = useState('');
  const [personaOverrides, setPersonaOverrides] = useState('');
  const [domainEnabled, setDomainEnabled] = useState(true);
  const [starterPackApplied, setStarterPackApplied] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<UploadItemStatus[]>([]);
  const [isPersistingDomain, setIsPersistingDomain] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  // test chat
  interface Message { id: string; role: 'user' | 'assistant'; content: string }
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionTokenExpiry, setSessionTokenExpiry] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const previewController = useRef<{ timeout: NodeJS.Timeout | null; hash: string }>({ timeout: null, hash: '' });

  const createAgentMutation = useCreateAgent();
  const uploadFileMutation = useUploadFile();
  const uploadUrlMutation = useUploadUrl();
  const updateDomainExpertise = useUpdateAgentDomainExpertise(agentId || 0);
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const { handleError, handleInfo } = useErrorHandler();
  const { data: createdAgent } = useAgent(agentId || 0);
  const { data: docs = [], isLoading: docsLoading } = useDocuments(agentId || 0);
  const domainGuidance = DOMAIN_GUIDANCE[domain];
  const uploadProgress = useMemo(() => {
    if (!uploadStatuses.length) {
      return { total: 0, completed: 0, failed: 0, inFlight: 0, percentage: 0 };
    }
    const total = uploadStatuses.length;
    const completed = uploadStatuses.filter((item) => item.status === 'success').length;
    const failed = uploadStatuses.filter((item) => item.status === 'error').length;
    const inFlight = uploadStatuses.filter((item) => item.status === 'uploading').length;
    const percentage = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, failed, inFlight, percentage };
  }, [uploadStatuses]);

  const documentDiagnostics = useMemo(() => {
    if (!docs.length) {
      return { totalDocs: 0, readyDocs: 0, pendingDocs: 0, failedDocs: 0, totalSize: 0, coverage: 0 };
    }
    let readyDocs = 0;
    let pendingDocs = 0;
    let failedDocs = 0;
    let totalSize = 0;

    docs.forEach((doc) => {
      totalSize += doc.size || 0;
      const status = (doc.status || '').toLowerCase();
      if (status === 'failed') {
        failedDocs += 1;
      } else if (status === 'processing' || status === 'pending') {
        pendingDocs += 1;
      } else {
        readyDocs += 1;
      }
    });

    const coverage = docs.length ? readyDocs / docs.length : 0;
    return { totalDocs: docs.length, readyDocs, pendingDocs, failedDocs, totalSize, coverage };
  }, [docs]);

  const uploadStatusLabels: Record<UploadItemStatus['status'], string> = {
    pending: 'Queued',
    uploading: 'Uploading…',
    success: 'Uploaded',
    error: 'Failed',
  };

  const uploadStatusClasses: Record<UploadItemStatus['status'], string> = {
    pending: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    uploading: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-200',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200',
  };

  const isUploading = uploadFileMutation.isPending || uploadUrlMutation.isPending || uploadProgress.inFlight > 0;

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    getValues,
    watch
  } = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    mode: 'onChange',
  });

  const watchedName = watch('name');

  useEffect(() => {
    // Adjust persona and default prompt when domain changes
    setSelectedPersona(DOMAIN_DEFAULTS[domain].persona);
    if (!getValues('system_prompt')) {
      // only prefill if user hasn't typed
      // We won't programmatically set the form field here to avoid overriding user input.
    }
    setStarterPackApplied(false);
  }, [domain, getValues]);

  useEffect(() => {
    if (docs.length > 0) setSelectedDocs(docs.map((d: any) => d.id));
  }, [docs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (messages.some((message) => message.role === 'user' && !message.id.startsWith('preview-'))) {
      if (previewController.current.timeout) {
        clearTimeout(previewController.current.timeout);
        previewController.current.timeout = null;
      }
    }
  }, [messages]);

  const onSubmitBasicInfo = async (data: AgentFormData) => {
    try {
      if (!currentOrganization?.id) {
        handleError(new Error('Organization context is missing. Please refresh and try again.'));
        return;
      }

      const response = await createAgentMutation.mutateAsync({
        name: data.name,
        description: data.description || '',
        system_prompt:
          data.system_prompt || DOMAIN_DEFAULTS[domain].prompt,
        config: {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          max_tokens: 1000,
        },
        widget_config: {
          theme: 'light',
          position: 'bottom-right',
          welcome_message: `Hi! I'm ${data.name}. How can I help you today?`,
        },
        idempotency_key: idempotencyKey,
        organization_id: currentOrganization.id,
      });

      setAgentId(response.agent.id);
      setCurrentStep(2);
    } catch (error) {
      // Error is handled by the mutation's onError callback
      console.error('Failed to create agent:', error);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const handleUrlAdd = () => {
    if (urlInput.trim() && !uploadedUrls.includes(urlInput.trim())) {
      setUploadedUrls(prev => [...prev, urlInput.trim()]);
      setUrlInput('');
    }
  };

  const applyStarterPack = () => {
    if (!domainGuidance) return;
    const uniqueUrls = Array.from(new Set([...uploadedUrls, ...domainGuidance.starterPack.urls]));
    if (uniqueUrls.length !== uploadedUrls.length) {
      setUploadedUrls(uniqueUrls);
    }
    setAdditionalContext((prev) =>
      prev?.trim()
        ? `${prev}\n\n${domainGuidance.starterPack.additionalContext}`
        : domainGuidance.starterPack.additionalContext
    );
    setPersonaOverrides((prev) =>
      prev?.trim()
        ? `${prev}\n\n${domainGuidance.starterPack.personaTips}`
        : domainGuidance.starterPack.personaTips
    );
    setStarterPackApplied(true);
    handleInfo(
      `Starter guidance loaded for ${domain.toUpperCase()}. Adjust the text or remove any URLs you don't need before publishing.`
    );
  };

  const updateUploadStatus = useCallback((id: string, status: UploadItemStatus['status']) => {
    setUploadStatuses((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  }, []);

  const buildDomainExpertisePayload = useCallback((): DomainExpertisePayload => {
    if (!domainEnabled) {
      return {
        enabled: false,
        knowledge_document_ids: [],
        web_search_enabled: false,
        site_whitelist: [],
        grounding_mode: 'blended',
      };
    }

    const whitelistArray = siteWhitelist
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const trimmedContext = additionalContext.trim();
    const trimmedOverrides = personaOverrides.trim();

    const payload: DomainExpertisePayload = {
      enabled: true,
      knowledge_document_ids: selectedDocs,
      web_search_enabled: webSearchEnabled,
      site_whitelist: whitelistArray,
      grounding_mode: groundingMode,
      expertise_level: expertiseLevel,
    };

    if (trimmedContext) {
      payload.additional_context = trimmedContext;
    }

    if (selectedPersona === 'custom') {
      payload.custom_persona = {
        name: 'Custom Persona',
        system_prompt: customPersonaPrompt,
      };
    } else {
      payload.persona_key = selectedPersona;
    }

    if (trimmedOverrides) {
      payload.persona_overrides = { additional_instructions: trimmedOverrides };
    }

    return payload;
  }, [additionalContext, customPersonaPrompt, domainEnabled, expertiseLevel, groundingMode, personaOverrides, selectedDocs, selectedPersona, siteWhitelist, webSearchEnabled]);

  const persistDomainExpertise = useCallback(async () => {
    if (!agentId) {
      return false;
    }

    try {
      setIsPersistingDomain(true);
      const payload = buildDomainExpertisePayload();
      await updateDomainExpertise.mutateAsync(payload);
      return true;
    } catch (error) {
      console.error('Failed to persist domain expertise configuration', error);
      return false;
    } finally {
      setIsPersistingDomain(false);
    }
  }, [agentId, buildDomainExpertisePayload, updateDomainExpertise]);

  const [crawlTaskId, setCrawlTaskId] = useState<string | null>(null);
  const discoverByDomain = async () => {
    if (!rootUrl.trim()) return;
    try {
      setDiscovering(true);
      setDiscoveredUrls([]);
      setSelectedDiscovered([]);
      const resp = await crawlApi.enqueue(rootUrl, 30);
      const taskId = (resp.data as any).task_id;
      setCrawlTaskId(taskId);
    } catch (e) {
      console.error('Discovery enqueue error', e);
      setDiscovering(false);
    }
  };

  useEffect(() => {
    if (!crawlTaskId) return;
    let timer: any;
    const poll = async () => {
      try {
        const st = await crawlApi.status(crawlTaskId);
        const data = st.data as any;
        setDiscoveredUrls(data.urls || []);
        if (data.status === 'completed' || data.status === 'failed') {
          setDiscovering(false);
          setCrawlTaskId(null);
          if (data.status === 'failed') console.error('Discovery failed', data.error);
          return;
        }
      } catch (e) {
        console.error('Discovery status error', e);
        setDiscovering(false);
        setCrawlTaskId(null);
        return;
      }
      timer = setTimeout(poll, 1500);
    };
    poll();
    return () => timer && clearTimeout(timer);
  }, [crawlTaskId]);

  const addSelectedDiscovered = async () => {
    if (!agentId) return;
    for (const u of selectedDiscovered) {
      try { await uploadUrlMutation.mutateAsync({ agentId, url: u }); } catch (e) { console.error('Failed to add URL', u, e); }
    }
    setSelectedDiscovered([]);
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveUrl = (index: number) => {
    setUploadedUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadDocuments = async () => {
    if (!agentId) return;

    const queue = [
      ...uploadedFiles.map((file) => ({
        id: `file-${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        label: file.name,
        type: 'file' as const,
        file,
      })),
      ...uploadedUrls.map((url) => ({
        id: `url-${url}-${Math.random().toString(36).slice(2, 6)}`,
        label: url,
        type: 'url' as const,
        url,
      })),
    ];

    if (!queue.length) {
      setUploadStatuses([]);
      setCurrentStep(3);
      return;
    }

    setUploadStatuses(queue.map((item) => ({ id: item.id, label: item.label, type: item.type, status: 'pending' })));

    for (const item of queue) {
      updateUploadStatus(item.id, 'uploading');
      try {
        if (item.type === 'file') {
          await uploadFileMutation.mutateAsync({ agentId, file: item.file });
        } else {
          await uploadUrlMutation.mutateAsync({ agentId, url: item.url });
        }
        updateUploadStatus(item.id, 'success');
      } catch (error) {
        updateUploadStatus(item.id, 'error');
        console.error('Failed to upload item', item.label, error);
      }
    }

    setUploadedFiles([]);
    setUploadedUrls([]);
    setCurrentStep(3);
  };

  const handleComplete = useCallback(async () => {
    if (isCompleting) {
      return;
    }

    setIsCompleting(true);
    try {
      if (agentId) {
        const saved = await persistDomainExpertise();
        if (!saved) {
          return;
        }
      }

      setCurrentStep(4);
      setTimeout(() => {
        router.push('/agents');
      }, 2000);
    } finally {
      setIsCompleting(false);
    }
  }, [agentId, isCompleting, persistDomainExpertise, router]);

  const ensureAgentSessionToken = useCallback(async () => {
    if (!agentId || !createdAgent) throw new Error('Agent not ready');
    const now = Date.now();
    const safetyWindow = 5000;
    if (sessionToken && sessionTokenExpiry && sessionTokenExpiry - safetyWindow > now) return sessionToken;
    const tokenResp = await api.post<{ token: string; expires_in: number }>(`/api/agents/${agentId}/session-token`);
    const tokenResponse = tokenResp.data;
    const newToken = tokenResponse.token;
    const expiresIn = tokenResponse.expires_in;
    setSessionToken(newToken);
    setSessionTokenExpiry(Date.now() + expiresIn * 1000);
    return newToken;
  }, [agentId, createdAgent, sessionToken, sessionTokenExpiry]);

  const runAutoPreview = useCallback(async () => {
    if (!createdAgent) return;
    if (messagesRef.current.some((message) => message.role === 'user' && !message.id.startsWith('preview-'))) {
      // Respect manual conversations – don't override them.
      return;
    }

    const docCount = selectedDocs.length;
    const previewPrompt = domainEnabled
      ? `We just set you up as a ${domain.toUpperCase()} concierge with persona "${selectedPersona}". In two sentences, explain how you'll help customers${docCount ? ` using ${docCount} curated source${docCount > 1 ? 's' : ''}` : ''}.`
      : 'Introduce yourself and explain the types of help you provide in two concise sentences.';

    const previewUserMessage: Message = { id: `preview-user-${Date.now()}`, role: 'user', content: previewPrompt };
    setMessages([previewUserMessage]);

    try {
      const token = await ensureAgentSessionToken();
      const resp = await chatApi.sendMessage(
        createdAgent.public_id,
        token,
        previewPrompt,
        `builder-preview-${createdAgent.id}`,
        undefined,
        {
          preview: true,
          domain,
          persona: selectedPersona,
          knowledge_docs_selected: docCount,
          web_search_enabled: domainEnabled ? webSearchEnabled : false,
        }
      );
      const data = resp.data as any;
      if (messagesRef.current.some((message) => message.role === 'user' && !message.id.startsWith('preview-'))) {
        return;
      }
      const assistantMsg: Message = {
        id: `preview-assistant-${Date.now() + 1}`,
        role: 'assistant',
        content: data.response || '(no response)',
      };
      setMessages([previewUserMessage, assistantMsg]);
    } catch {
      if (messagesRef.current.some((message) => message.role === 'user' && !message.id.startsWith('preview-'))) {
        return;
      }
      const errMsg: Message = {
        id: `preview-error-${Date.now() + 1}`,
        role: 'assistant',
        content: 'Preview unavailable right now. Try again after a moment.',
      };
      setMessages([previewUserMessage, errMsg]);
    }
  }, [createdAgent, domain, domainEnabled, ensureAgentSessionToken, selectedDocs, selectedPersona, webSearchEnabled]);

  const sendTestMessage = async () => {
    if (!input.trim() || !createdAgent) return;
    const userMsg: Message = { id: String(Date.now()), role: 'user', content: input.trim() };
    setMessages((p) => [...p, userMsg]);
    setInput('');
    try {
      const token = await ensureAgentSessionToken();
      const resp = await chatApi.sendMessage(
        createdAgent.public_id,
        token,
        userMsg.content,
        `builder-${createdAgent.id}-${Math.random().toString(36).slice(2, 8)}`,
      );
      const data = resp.data as any;
      const assistantMsg: Message = { id: String(Date.now() + 1), role: 'assistant', content: data.response || '(no response)' };
      setMessages((p) => [...p, assistantMsg]);
    } catch {
      const errMsg: Message = { id: String(Date.now() + 1), role: 'assistant', content: 'Error sending message. Try again.' };
      setMessages((p) => [...p, errMsg]);
    }
  };

  useEffect(() => {
    const controller = previewController.current;
    if (currentStep !== 3 || !createdAgent || !agentId) {
      if (controller.timeout) {
        clearTimeout(controller.timeout);
        controller.timeout = null;
      }
      controller.hash = '';
      return;
    }

    if (messagesRef.current.some((message) => message.role === 'user' && !message.id.startsWith('preview-'))) {
      // User is actively testing; skip auto previews.
      controller.hash = '';
      return;
    }

    const docHash = selectedDocs.slice().sort((a, b) => a - b).join(',');
    const hash = JSON.stringify({
      domainEnabled,
      selectedPersona,
      docHash,
      webSearchEnabled,
      siteWhitelist,
      groundingMode,
      expertiseLevel,
      additionalContext,
      personaOverrides,
      domain,
    });

    if (controller.hash === hash) {
      return;
    }

    if (controller.timeout) {
      clearTimeout(controller.timeout);
    }

    controller.timeout = setTimeout(() => {
      controller.hash = hash;
      runAutoPreview();
    }, 800);

    return () => {
      if (controller.timeout) {
        clearTimeout(controller.timeout);
        controller.timeout = null;
      }
    };
  }, [additionalContext, agentId, createdAgent, currentStep, domain, domainEnabled, expertiseLevel, groundingMode, personaOverrides, runAutoPreview, selectedDocs, selectedPersona, siteWhitelist, webSearchEnabled]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Progress Steps */}
        <div className="mb-8">
          <nav aria-label="Progress">
            <ol className="flex items-center">
              {steps.map((step, stepIdx) => (
                <li key={step.name} className={`${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''} relative`}>
                  <div className="flex items-center">
                    <div
                      className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
                        step.id < currentStep
                          ? 'bg-indigo-600'
                          : step.id === currentStep
                          ? 'border-2 border-indigo-600 bg-white dark:bg-gray-800'
                          : 'border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                      }`}
                    >
                      {step.id < currentStep ? (
                        <CheckCircleIcon className="h-5 w-5 text-white" />
                      ) : (
                        <step.icon
                          className={`h-5 w-5 ${
                            step.id === currentStep ? 'text-indigo-600' : 'text-gray-400'
                          }`}
                        />
                      )}
                    </div>
                    <span
                      className={`ml-3 text-sm font-medium ${
                        step.id <= currentStep ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {step.name}
                    </span>
                  </div>
                  {stepIdx !== steps.length - 1 && (
                    <div
                      className={`absolute top-4 left-4 -ml-px mt-0.5 h-full w-0.5 ${
                        step.id < currentStep ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          {currentStep === 1 && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Create Your AI Agent</h2>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <form onSubmit={handleSubmit(onSubmitBasicInfo)} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Agent Name *
                    </label>
                    <Input
                      type="text"
                      id="name"
                      {...register('name')}
                      className="mt-1"
                      placeholder="Customer Support Bot"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Domain</label>
                    <select
                      value={domain}
                      onChange={(e) => setDomain(e.target.value as DomainKey)}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="saas">SaaS Support</option>
                      <option value="ecommerce">E‑commerce</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="fintech">Fintech</option>
                      <option value="education">Education</option>
                      <option value="custom">Custom</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Used to preselect persona and defaults.</p>
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      {...register('description')}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm placeholder:text-gray-500 dark:placeholder:text-gray-400"
                      placeholder="Helps customers with product questions and support issues"
                    />
                    {errors.description && (
                      <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="system_prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      System Prompt (Advanced)
                    </label>
                    <textarea
                      id="system_prompt"
                      rows={4}
                      {...register('system_prompt')}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm placeholder:text-gray-500 dark:placeholder:text-gray-400"
                      placeholder="You are a helpful assistant that answers questions based on the provided knowledge base..."
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      This controls how your agent behaves. Leave blank for default behavior.
                    </p>
                    {errors.system_prompt && (
                      <p className="mt-1 text-sm text-red-600">{errors.system_prompt.message}</p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={!isValid || createAgentMutation.isPending}
                      loading={createAgentMutation.isPending}
                    >
                      Next Step
                    </Button>
                  </div>
                </form>

                <aside className="hidden lg:block">
                  <div className="sticky top-8 rounded-lg border border-indigo-100 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-900/20 p-5 shadow-sm">
                    <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                      {domain.toUpperCase()} insights
                    </span>
                    <p className="mt-3 text-sm text-indigo-900 dark:text-indigo-50 font-medium">
                      {domainGuidance.elevatorPitch}
                    </p>
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">Starter questions</h3>
                      <ul className="mt-2 space-y-1 text-sm text-indigo-900 dark:text-indigo-100">
                        {domainGuidance.starterQuestions.map((q) => (
                          <li key={q} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">Best practices</h3>
                      <ul className="mt-2 space-y-1 text-sm text-indigo-900 dark:text-indigo-100">
                        {domainGuidance.bestPractices.map((tip) => (
                          <li key={tip} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-6 space-y-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-center"
                        onClick={applyStarterPack}
                        disabled={starterPackApplied}
                      >
                        {starterPackApplied ? 'Starter Pack Applied' : 'Apply Starter Pack'}
                      </Button>
                      {domainGuidance.starterPack.urls.length > 0 && (
                        <p className="text-xs text-indigo-800/80 dark:text-indigo-200/80">
                          Adds curated URLs and persona notes tailored for this domain. You can edit or remove them later.
                        </p>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Upload Knowledge Base</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Upload documents or add URLs to train your agent. The more relevant information you provide,
                the better your agent will perform.
              </p>

              {/* Suggestions */}
              <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-white dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Suggested content for {domain.toUpperCase()}:</p>
                <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  {domainGuidance.knowledgeSuggestions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="mt-4 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyStarterPack}
                    disabled={starterPackApplied}
                  >
                    {starterPackApplied ? 'Starter Pack Applied' : 'Load Starter Pack Content'}
                  </Button>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Adds curated URLs and persona notes tailored for this domain. Everything is editable before launch.
                  </p>
                </div>
              </div>

              {uploadStatuses.length > 0 && (
                <div className="mb-6 border border-blue-200 dark:border-blue-900 rounded-md p-4 bg-blue-50/70 dark:bg-blue-900/20">
                  <div className="flex items-center justify-between text-sm text-blue-900 dark:text-blue-100">
                    <span className="font-medium">Knowledge ingestion progress</span>
                    <span>{uploadProgress.percentage}% complete</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/40">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${uploadProgress.percentage}%` }}
                    />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-blue-800 dark:text-blue-200">
                    <div>
                      <dt className="uppercase tracking-wide">Completed</dt>
                      <dd className="mt-0.5 font-medium">{uploadProgress.completed}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide">In flight</dt>
                      <dd className="mt-0.5 font-medium">{uploadProgress.inFlight}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide">Queued</dt>
                      <dd className="mt-0.5 font-medium">{uploadStatuses.length - uploadProgress.completed - uploadProgress.failed - uploadProgress.inFlight}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide">Failed</dt>
                      <dd className="mt-0.5 font-medium">{uploadProgress.failed}</dd>
                    </div>
                  </dl>
                  <ul className="mt-4 space-y-2 text-xs">
                    {uploadStatuses.map((item) => (
                      <li key={item.id} className="flex items-center justify-between rounded border border-white/30 bg-white/70 dark:bg-white/10 px-3 py-2 shadow-sm">
                        <span className="truncate text-blue-900 dark:text-blue-100 max-w-[70%]">{item.label}</span>
                        <span className={`ml-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${uploadStatusClasses[item.status]}`}>
                          {uploadStatusLabels[item.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* File Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload Documents
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600 dark:text-gray-400">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                      >
                        <span>Upload files</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          multiple
                          accept=".pdf,.txt,.html,.md"
                          onChange={handleFileUpload}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">PDF, TXT, HTML, MD up to 10MB each</p>
                  </div>
                </div>
              </div>

              {/* URL Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Add Website URLs
                </label>
                <div className="flex">
                  <Input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/help"
                    className="rounded-r-none"
                  />
                  <Button
                    type="button"
                    onClick={handleUrlAdd}
                    disabled={!urlInput.trim()}
                    variant="outline"
                    className="rounded-l-none border-l-0"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Discover by Domain */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Seed by Domain (discover URLs)
                </label>
                <div className="flex mb-2 items-center">
                  <Input
                    type="url"
                    value={rootUrl}
                    onChange={(e) => setRootUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="rounded-r-none"
                  />
                  <Button type="button" onClick={discoverByDomain} disabled={!rootUrl.trim() || discovering} variant="outline" className="rounded-l-none border-l-0">
                    {discovering ? 'Discovering...' : 'Discover'}
                  </Button>
                </div>
                {discovering && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Running
                  </span>
                )}
                {!discovering && discoveredUrls.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    Completed
                  </span>
                )}
                {discoveredUrls.length > 0 && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded p-3 max-h-48 overflow-y-auto">
                    <p className="text-xs text-gray-500 mb-2">Select pages to add:</p>
                    {discoveredUrls.map((u) => (
                      <label key={u} className="flex items-center space-x-2 text-sm mb-1">
                        <input
                          type="checkbox"
                          checked={selectedDiscovered.includes(u)}
                          onChange={(e) => setSelectedDiscovered((prev) => e.target.checked ? [...prev, u] : prev.filter((x) => x !== u))}
                        />
                        <span className="truncate">{u}</span>
                      </label>
                    ))}
                    <div className="mt-2">
                      <Button type="button" onClick={addSelectedDiscovered} disabled={!agentId || selectedDiscovered.length === 0}>
                        Add Selected URLs
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files</h4>
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <div className="flex items-center">
                          <DocumentArrowUpIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">{file.name}</span>
                          <span className="text-sm text-gray-500 ml-2">({formatFileSize(file.size)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Uploaded URLs List */}
              {uploadedUrls.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Added URLs</h4>
                  <div className="space-y-2">
                    {uploadedUrls.map((url, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <div className="flex items-center">
                          <GlobeAltIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">{url}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveUrl(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6 border border-emerald-200 dark:border-emerald-900 rounded-md p-4 bg-emerald-50/70 dark:bg-emerald-900/20">
                <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2 flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4" /> Context readiness snapshot
                </h3>
                {documentDiagnostics.totalDocs === 0 ? (
                  <p className="text-xs text-emerald-800 dark:text-emerald-200">
                    Upload documents or URLs to unlock automatic personalization and smarter responses.
                  </p>
                ) : (
                  <>
                    <dl className="grid grid-cols-2 gap-3 text-xs text-emerald-900 dark:text-emerald-100">
                      <div>
                        <dt className="uppercase tracking-wide">Knowledge assets</dt>
                        <dd className="mt-0.5 text-base font-semibold">{documentDiagnostics.totalDocs}</dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide">Ready for grounding</dt>
                        <dd className="mt-0.5 text-base font-semibold">{documentDiagnostics.readyDocs}</dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide">Processing</dt>
                        <dd className="mt-0.5 text-base font-semibold">{documentDiagnostics.pendingDocs}</dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide">Coverage score</dt>
                        <dd className="mt-0.5 text-base font-semibold">{Math.round(documentDiagnostics.coverage * 100)}%</dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-200">
                      Indexed size: {formatFileSize(documentDiagnostics.totalSize)}
                    </p>
                    {documentDiagnostics.failedDocs > 0 && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-300">
                        {documentDiagnostics.failedDocs} document(s) failed. Retry upload or review the file format.
                      </p>
                    )}
                    {documentDiagnostics.pendingDocs > 0 && (
                      <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
                        We’re still processing a few items. You can continue configuring your agent in the meantime.
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-between">
                <Button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  variant="outline"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleUploadDocuments}
                  loading={isUploading}
                  disabled={isUploading}
                >
                  {uploadedFiles.length === 0 && uploadedUrls.length === 0 ? 'Skip for Now' : 'Upload & Continue'}
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Configuration</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your agent is almost ready. Preview live responses below—when you click Save &amp; Finish we’ll sync these persona and knowledge settings to the backend.
              </p>

              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Test Your Agent</h3>
                <p className="-mt-2 mb-4 text-xs text-gray-500 dark:text-gray-400">
                  This preview auto-refreshes as you adjust personas, documents, or web search settings. Send your own message to take control.
                </p>
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <div className="h-8 w-8 bg-indigo-600 rounded-full flex items-center justify-center">
                      <BoltIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{watchedName || 'Your Agent'}</p>
                      <p className="text-xs text-gray-500">Online</p>
                    </div>
                  </div>
                  <div className="h-64 overflow-y-auto border border-gray-200 rounded p-3 bg-gray-50">
                    {messages.length === 0 && (
                      <p className="text-xs text-gray-500">Type a message below to test your agent.</p>
                    )}
                    {messages.map((m) => (
                      <div key={m.id} className={`mb-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <span className={`inline-block px-3 py-2 rounded-md text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>
                          {m.content}
                        </span>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="mt-2 flex">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 text-sm"
                      disabled={!createdAgent}
                    />
                    <button
                      type="button"
                      onClick={sendTestMessage}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-r-md text-sm disabled:opacity-50"
                      disabled={!createdAgent || !input.trim()}
                    >
                      <PaperAirplaneIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4 mb-6">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                  <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" /> Domain Expertise
                </h3>
                <div className="space-y-4">
                  <label className="inline-flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" className="h-4 w-4" checked={domainEnabled} onChange={(e) => setDomainEnabled(e.target.checked)} />
                    <span>Enable domain expertise (use documents and persona)</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Persona</label>
                      <select
                        value={selectedPersona}
                        onChange={(e) => setSelectedPersona(e.target.value)}
                        disabled={!domainEnabled}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="support_expert">Support</option>
                        <option value="sales_rep">Sales</option>
                        <option value="solution_engineer">Solutions</option>
                        <option value="domain_specialist">Domain Specialist</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Expertise Level ({expertiseLevel.toFixed(1)})</label>
                      <input type="range" min={0} max={1} step={0.1} value={expertiseLevel} onChange={(e) => setExpertiseLevel(parseFloat(e.target.value))} disabled={!domainEnabled} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Grounding</label>
                      <div className="flex space-x-3 text-sm">
                        <label className="inline-flex items-center space-x-2"><input type="radio" checked={groundingMode==='strict'} onChange={() => setGroundingMode('strict')} disabled={!domainEnabled} /> <span>Strict</span></label>
                        <label className="inline-flex items-center space-x-2"><input type="radio" checked={groundingMode==='blended'} onChange={() => setGroundingMode('blended')} disabled={!domainEnabled} /> <span>Blended</span></label>
                      </div>
                    </div>
                  </div>
                  {selectedPersona === 'custom' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Persona Prompt</label>
                      <textarea rows={3} value={customPersonaPrompt} onChange={(e) => setCustomPersonaPrompt(e.target.value)} disabled={!domainEnabled} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded p-3 text-xs text-gray-600 dark:text-gray-300">{DOMAIN_DEFAULTS[domain].prompt}</div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Additional Persona Instructions</label>
                    <textarea rows={2} value={personaOverrides} onChange={(e) => setPersonaOverrides(e.target.value)} disabled={!domainEnabled} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Knowledge Sources</label>
                    {docs.length === 0 ? (
                      <p className="text-xs text-gray-500">No documents uploaded yet. Go back to add some.</p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded p-2">
                        {docs.map((d: any) => (
                          <label key={d.id} className={`flex items-center space-x-2 text-sm ${!domainEnabled ? 'opacity-60' : ''}`}>
                            <input type="checkbox" checked={selectedDocs.includes(d.id)} onChange={() => setSelectedDocs((prev)=> prev.includes(d.id)? prev.filter(id=>id!==d.id):[...prev,d.id])} disabled={!domainEnabled} />
                            <span className="flex-1 truncate">{d.filename}</span>
                            <span className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              d.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200'
                                : d.status === 'failed'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200'
                            }`}>
                              {(d.status || 'ready').replace(/_/g, ' ')}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {docsLoading && (
                    <p className="text-xs text-blue-600 dark:text-blue-300">
                      Refreshing your latest documents…
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="inline-flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={webSearchEnabled} onChange={(e) => setWebSearchEnabled(e.target.checked)} disabled={!domainEnabled} />
                      <span>Allow web search when context is insufficient</span>
                    </label>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Site Whitelist (comma separated)</label>
                      <input type="text" value={siteWhitelist} onChange={(e) => setSiteWhitelist(e.target.value)} disabled={!domainEnabled || !webSearchEnabled} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500" placeholder="docs.example.com, help.example.com" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes / Playbook</label>
                    <textarea rows={3} value={additionalContext} onChange={(e) => setAdditionalContext(e.target.value)} disabled={!domainEnabled} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { void persistDomainExpertise(); }}
                      disabled={!agentId || isPersistingDomain || updateDomainExpertise.isPending || docsLoading}
                      loading={isPersistingDomain || updateDomainExpertise.isPending}
                    >
                      Save settings now
                    </Button>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      We’ll also sync these settings automatically when you create the agent.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">Next Steps</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Get your embed code to add this agent to your website</li>
                        <li>Test the agent with your uploaded documents</li>
                        <li>Customize the appearance and behavior</li>
                        <li>Monitor conversations and improve responses</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  variant="outline"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => { void handleComplete(); }}
                  loading={isCompleting || isPersistingDomain || updateDomainExpertise.isPending}
                  disabled={isCompleting || isPersistingDomain || updateDomainExpertise.isPending || docsLoading}
                >
                  Save &amp; Finish
                </Button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="p-6 text-center">
              <CheckCircleIcon className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Agent Created Successfully!</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your AI agent is now ready to help your customers. You'll be redirected to the agents page shortly.
              </p>
              <EmbedSnippet agentId={agentId} />
              <div className="mt-10 space-y-3 text-left">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Launch checklist</h3>
                <Link
                  href={agentId ? `/agents/${agentId}` : '/agents'}
                  className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-800 dark:text-gray-200 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                >
                  <span>Review agent settings &amp; persona</span>
                  <span className="text-xs uppercase tracking-wide">Open agent</span>
                </Link>
                <Link
                  href={agentId ? `/agents/${agentId}/chat` : '/agents'}
                  className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-800 dark:text-gray-200 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                >
                  <span>Run a live end-to-end conversation</span>
                  <span className="text-xs uppercase tracking-wide">Test chat</span>
                </Link>
                <Link
                  href={agentId ? `/analytics?agent=${agentId}` : '/analytics'}
                  className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-800 dark:text-gray-200 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                >
                  <span>Monitor performance &amp; escalations</span>
                  <span className="text-xs uppercase tracking-wide">View analytics</span>
                </Link>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

// Embed snippet helper
import { useAgentEmbedCode } from '@/hooks/useAgents';
import Link from 'next/link';

function EmbedSnippet({ agentId }: { agentId: number | null }) {
  const { data: embed } = useAgentEmbedCode(agentId || 0);
  const { data: agent } = useAgent(agentId || 0);
  const safeSnippet = agent ? `<!-- Recommended: safe client embed -->\n<script>\n  window.AI_AGENT_CONFIG = {\n    agentPublicId: "${agent.public_id}",\n    // Server-mint a short-lived session token when embedding\n    // Example: fetch('/api/agents/${agent.id}/session-token',{method:'POST'})\n  };\n</script>\n<script src="/widget/agent-widget.js"></script>` : '';

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-left">
      <div className="border rounded-md p-4 bg-white dark:bg-gray-800">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Recommended Embed</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Uses public_id and short-lived session tokens via your server.</p>
        <pre className="text-xs bg-gray-50 dark:bg-gray-900/40 p-3 rounded overflow-auto max-h-60 whitespace-pre-wrap">{safeSnippet}</pre>
        {safeSnippet && (
          <button onClick={() => copy(safeSnippet)} className="mt-2 text-sm text-indigo-600">Copy</button>
        )}
      </div>
      <div className="border rounded-md p-4 bg-white dark:bg-gray-800">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Backend Embed (if provided)</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Shown as returned by the API, ensure it contains no secrets.</p>
        <pre className="text-xs bg-gray-50 dark:bg-gray-900/40 p-3 rounded overflow-auto max-h-60 whitespace-pre-wrap">{embed?.embed_code || '(no embed code provided)'}</pre>
        {embed?.embed_code && (
          <button onClick={() => copy(embed.embed_code)} className="mt-2 text-sm text-indigo-600">Copy</button>
        )}
      </div>
      {agentId && (
        <div className="lg:col-span-2 text-sm text-gray-600 dark:text-gray-400">
          <Link className="text-indigo-600" href={`/agents/${agentId}`}>View Agent</Link>
        </div>
      )}
    </div>
  );
}
