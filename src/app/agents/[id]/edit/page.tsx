'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeftIcon,
  CheckIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { useAgent, useUpdateAgent, useUpdateAgentDomainExpertise } from '@/hooks/useAgents';
import { DomainExpertisePayload } from '@/lib/api';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useAgentCRM, useUpdateAgentCRM } from '@/hooks/useCRM';
import { useDocuments } from '@/hooks/useDocuments';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const agentSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  description: z.string().optional(),
  system_prompt: z.string().min(1, 'System prompt is required'),
  is_active: z.boolean(),
  config: z.object({
    model: z.string(),
    temperature: z.number().min(0).max(2),
    max_tokens: z.number().min(1).max(8000)
  }),
  widget_config: z.object({
    theme: z.enum(['light', 'dark']),
    position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']),
    welcome_message: z.string()
  })
});

type AgentFormData = z.infer<typeof agentSchema>;

const PERSONA_OPTIONS = [
  { value: 'sales_rep', label: 'Sales Representative', description: 'Qualify prospects, drive value, and land a next step.' },
  { value: 'solution_engineer', label: 'Solutions Engineer', description: 'Map requirements to architecture with practical trade-offs.' },
  { value: 'support_expert', label: 'Support Expert', description: 'Diagnose and resolve issues with step-by-step clarity.' },
  { value: 'domain_specialist', label: 'Domain Specialist', description: 'Deliver expert tips and best practices for your niche.' },
  { value: 'custom', label: 'Custom Persona', description: 'Provide your own persona instructions and tactics.' }
];

const PERSONA_TEMPLATES: Record<string, { prompt: string }> = {
  sales_rep: {
    prompt:
      "You are a senior B2B sales representative. Diagnose the prospect's needs, articulate differentiated value, and recommend the next step. Always ground claims in cited sources."
  },
  solution_engineer: {
    prompt:
      'You are a pragmatic solutions engineer. Map requirements to architecture, outline trade-offs, and provide implementation guidance grounded in cited sources.'
  },
  support_expert: {
    prompt:
      'You are a tier-2 support expert. Diagnose issues methodically, confirm reproduction, and present precise resolutions with cited sources.'
  },
  domain_specialist: {
    prompt:
      'You are a trusted domain mentor. Provide practical insights, tips, and best practices sourced from vetted knowledge.'
  }
};

export default function EditAgentPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = parseInt(params.id as string);

  const { data: agent, isLoading: agentLoading } = useAgent(agentId);
  const updateAgentMutation = useUpdateAgent();
  const { data: crm = {} } = useAgentCRM(agentId);
  const updateCRM = useUpdateAgentCRM(agentId);
  const updateDomainExpertise = useUpdateAgentDomainExpertise(agentId);
  const { data: documents = [] } = useDocuments(agentId);

  const [domainEnabled, setDomainEnabled] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string>('custom');
  const [personaOverrides, setPersonaOverrides] = useState('');
  const [customPersonaPrompt, setCustomPersonaPrompt] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [siteWhitelist, setSiteWhitelist] = useState('');
  const [groundingMode, setGroundingMode] = useState<'strict' | 'blended'>('blended');
  const [expertiseLevel, setExpertiseLevel] = useState(0.7);
  const [additionalContext, setAdditionalContext] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: '',
      description: '',
      system_prompt: '',
      is_active: true,
      config: {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 1000
      },
      widget_config: {
        theme: 'light',
        position: 'bottom-right',
        welcome_message: ''
      }
    }
  });

  // Normalize CRM object to avoid sending redacted strings back to API
  const crmSafe = useMemo(() => {
    const c: any = { ...(crm as any) };
    if (!c || typeof c !== 'object') return {};
    if (typeof c.auth !== 'object') delete c.auth; // drop redacted placeholders
    return c;
  }, [crm]);

  // Populate form when agent data loads
  useEffect(() => {
    if (agent) {
      setValue('name', agent.name);
      setValue('description', agent.description || '');
      setValue('system_prompt', agent.system_prompt || '');
      setValue('is_active', agent.is_active);
      setValue('config.model', agent.config?.model || 'gpt-4o-mini');
      setValue('config.temperature', agent.config?.temperature || 0.7);
      setValue('config.max_tokens', agent.config?.max_tokens || 1000);
      setValue('widget_config.theme', agent.widget_config?.theme || 'light');
      setValue('widget_config.position', agent.widget_config?.position || 'bottom-right');
      setValue('widget_config.welcome_message', agent.widget_config?.welcome_message || `Hi! I'm ${agent.name}. How can I help you today?`);

      setDomainEnabled(agent.domain_expertise_enabled ?? false);
      const personaTypeRaw = (agent.domain_expertise_type as string | undefined) || 'custom';
      const personaKey = personaTypeRaw ? personaTypeRaw.toLowerCase() : 'custom';
      const normalizedPersona = PERSONA_OPTIONS.some((option) => option.value === personaKey)
        ? personaKey
        : 'custom';
      setSelectedPersona(normalizedPersona);

      const personaPrompt = (agent.personality_profile?.system_prompt as string | undefined)
        || (normalizedPersona !== 'custom' ? PERSONA_TEMPLATES[normalizedPersona]?.prompt : '')
        || '';
      setCustomPersonaPrompt(personaPrompt);

      const overridesText = (agent.custom_training_data?.persona_overrides?.additional_instructions as string | undefined)
        || (agent.custom_training_data?.persona_overrides_text as string | undefined)
        || '';
      setPersonaOverrides(overridesText);

      const knowledgeSources = Array.isArray(agent.domain_knowledge_sources)
        ? (agent.domain_knowledge_sources as any[]).map((id) => Number(id))
        : [];
      setSelectedDocs(knowledgeSources);

      const toolPolicy = (agent.tool_policy || {}) as Record<string, any>;
      const whitelist = Array.isArray(toolPolicy.site_whitelist) ? toolPolicy.site_whitelist : [];
      setWebSearchEnabled(Boolean(toolPolicy.web_search ?? agent.web_search_enabled));
      setSiteWhitelist(whitelist.join(', '));
      setGroundingMode(((agent.grounding_mode as string | undefined) || 'blended') as 'strict' | 'blended');
      setExpertiseLevel(typeof agent.expertise_level === 'number' ? agent.expertise_level : 0.7);
      setAdditionalContext(agent.expert_context || '');
    }
  }, [agent, setValue]);

  const onSubmit = async (data: AgentFormData) => {
    try {
      await updateAgentMutation.mutateAsync({
        id: agentId,
        data
      });
      router.push(`/agents/${agentId}`);
    } catch (error) {
      console.error('Failed to update agent:', error);
    }
  };

  const handlePersonaChange = (value: string) => {
    setSelectedPersona(value);
    if (value !== 'custom') {
      const template = PERSONA_TEMPLATES[value];
      if (template) {
        setCustomPersonaPrompt(template.prompt);
      }
    }
  };

  const toggleDocument = (docId: number) => {
    setSelectedDocs((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleDomainSave = () => {
    if (domainEnabled && selectedPersona === 'custom' && !customPersonaPrompt.trim()) {
      window.alert('Please provide a system prompt for the custom persona.');
      return;
    }

    const whitelistArray = siteWhitelist
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    const payload: DomainExpertisePayload = {
      enabled: domainEnabled,
      knowledge_document_ids: domainEnabled ? selectedDocs : [],
      web_search_enabled: domainEnabled ? webSearchEnabled : false,
      site_whitelist: domainEnabled ? whitelistArray : [],
      grounding_mode: domainEnabled ? groundingMode : 'blended',
      expertise_level: domainEnabled ? expertiseLevel : undefined,
      additional_context: domainEnabled ? additionalContext : undefined,
    };

    if (domainEnabled) {
      if (selectedPersona === 'custom') {
        payload.custom_persona = {
          name: 'Custom Persona',
          system_prompt: customPersonaPrompt,
          tactics: personaOverrides ? { additional_instructions: personaOverrides } : {}
        };
      } else {
        payload.persona_key = selectedPersona;
        if (personaOverrides.trim()) {
          payload.persona_overrides = {
            additional_instructions: personaOverrides.trim()
          };
        }
      }
    }

    updateDomainExpertise.mutate(payload);
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
                The agent you're trying to edit doesn't exist or has been deleted.
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/agents/${agentId}`}>
            <Button variant="outline" size="icon">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Agent</h1>
            <p className="text-gray-600 dark:text-gray-400">Update your agent's configuration and settings</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Link href={`/agents/${agentId}/chat`}>
            <Button variant="outline">
              <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" />
              Test Chat
            </Button>
          </Link>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Agent Name *
              </label>
              <input
                {...register('name')}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter agent name"
              />
              {errors.name && (
                <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Describe what this agent does"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                {...register('is_active')}
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Agent is active
              </label>
            </div>
          </CardContent>
        </Card>

        {/* System Prompt */}
        <Card>
          <CardHeader>
            <CardTitle>System Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                System Prompt *
              </label>
              <textarea
                {...register('system_prompt')}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                placeholder="You are a helpful assistant that..."
              />
              {errors.system_prompt && (
                <p className="text-red-600 text-sm mt-1">{errors.system_prompt.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

      {/* Model Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Model Configuration</CardTitle>
        </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Model
                </label>
                <select
                  {...register('config.model')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Temperature ({watch('config.temperature')})
                </label>
                <input
                  {...register('config.temperature', { valueAsNumber: true })}
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Tokens
                </label>
                <input
                  {...register('config.max_tokens', { valueAsNumber: true })}
                  type="number"
                  min="1"
                  max="8000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </CardContent>
      </Card>

      {/* CRM Override (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle>CRM Integration (Agent Override)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Override the organization CRM settings for this agent only.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Provider</label>
              <select
                value={(crm as any)?.provider || ''}
                onChange={(e) => updateCRM.mutate({ ...crmSafe, provider: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Inherit from organization</option>
                <option value="hubspot">HubSpot</option>
                <option value="salesforce">Salesforce</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Enabled</label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={!!(crm as any)?.enabled}
                  onChange={(e) => updateCRM.mutate({ ...crmSafe, enabled: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable override</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API Key</label>
              <input
                type="password"
                value={''}
                onChange={(e) => updateCRM.mutate({ ...crmSafe, auth: { api_key: e.target.value } })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="••••••••"
              />
            </div>
          </div>
        </CardContent>
      </Card>

        {/* Widget Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Widget Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Theme
                </label>
                <select
                  {...register('widget_config.theme')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Position
                </label>
                <select
                  {...register('widget_config.position')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Welcome Message
              </label>
              <textarea
                {...register('widget_config.welcome_message')}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Hi! How can I help you today?"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Link href={`/agents/${agentId}`}>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting || updateAgentMutation.isPending}>
            {isSubmitting || updateAgentMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Domain Expertise Upgrade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 md:max-w-2xl">
              Unlock persona-driven, knowledge-grounded responses. Attach curated documents, tune persona behaviour, and optionally allow controlled web search.
            </p>
            <label className="inline-flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={domainEnabled}
                onChange={(e) => setDomainEnabled(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
              />
              <span>Enable Domain Expertise</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Persona</label>
              <select
                value={selectedPersona}
                onChange={(e) => handlePersonaChange(e.target.value)}
                disabled={!domainEnabled}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                {PERSONA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {PERSONA_OPTIONS.find((option) => option.value === selectedPersona)?.description}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Expertise Level ({expertiseLevel.toFixed(2)})
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={expertiseLevel}
                onChange={(e) => setExpertiseLevel(parseFloat(e.target.value))}
                disabled={!domainEnabled}
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Higher values encourage deeper, expert-level answers.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Grounding Mode</label>
              <div className="flex space-x-4 text-sm text-gray-700 dark:text-gray-300">
                <label className="inline-flex items-center space-x-2">
                  <input
                    type="radio"
                    value="strict"
                    checked={groundingMode === 'strict'}
                    onChange={() => setGroundingMode('strict')}
                    disabled={!domainEnabled}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600"
                  />
                  <span>Strict (must cite)</span>
                </label>
                <label className="inline-flex items-center space-x-2">
                  <input
                    type="radio"
                    value="blended"
                    checked={groundingMode === 'blended'}
                    onChange={() => setGroundingMode('blended')}
                    disabled={!domainEnabled}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600"
                  />
                  <span>Blended</span>
                </label>
              </div>
            </div>
          </div>

          {selectedPersona !== 'custom' ? (
            <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-md p-3 text-sm text-gray-700 dark:text-gray-300">
              <p className="font-medium mb-1">Persona Prompt Preview</p>
              <p className="whitespace-pre-wrap text-xs leading-5">
                {PERSONA_TEMPLATES[selectedPersona]?.prompt || 'Persona prompt preview unavailable.'}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Custom Persona Prompt
              </label>
              <textarea
                value={customPersonaPrompt}
                onChange={(e) => setCustomPersonaPrompt(e.target.value)}
                rows={4}
                disabled={!domainEnabled}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Describe the role, responsibilities, and tone for this custom persona."
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Additional Persona Instructions
            </label>
            <textarea
              value={personaOverrides}
              onChange={(e) => setPersonaOverrides(e.target.value)}
              rows={3}
              disabled={!domainEnabled}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Optional: add supplemental instructions, objection handling playbooks, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Knowledge Sources</label>
            {documents.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No documents uploaded yet. Add documents to build a knowledge pack.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-3">
                {documents.map((doc) => (
                  <label key={doc.id} className={`flex items-start space-x-2 text-sm ${!domainEnabled ? 'opacity-60' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedDocs.includes(doc.id)}
                      onChange={() => toggleDocument(doc.id)}
                      disabled={!domainEnabled}
                      className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                    />
                    <span>{doc.filename}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={webSearchEnabled}
                onChange={(e) => setWebSearchEnabled(e.target.checked)}
                disabled={!domainEnabled}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
              />
              <span>Allow web search when context is insufficient</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Site Whitelist (comma separated)
              </label>
              <input
                type="text"
                value={siteWhitelist}
                onChange={(e) => setSiteWhitelist(e.target.value)}
                disabled={!domainEnabled || !webSearchEnabled}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="docs.example.com, community.example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Domain Notes / Playbook</label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={4}
              disabled={!domainEnabled}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Optional notes, caveats, or escalation policies to include in responses."
            />
          </div>

          <div className="flex items-center space-x-4">
            <Button
              type="button"
              onClick={handleDomainSave}
              disabled={updateDomainExpertise.isPending}
            >
              {updateDomainExpertise.isPending ? 'Saving...' : 'Save Domain Expertise'}
            </Button>
            {updateDomainExpertise.isSuccess && (
              <span className="text-xs text-green-600 dark:text-green-400">Saved!</span>
            )}
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
