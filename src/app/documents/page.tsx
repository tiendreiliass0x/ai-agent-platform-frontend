'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  DocumentArrowUpIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useAgents } from '@/hooks/useAgents';
import { useDocuments, useUploadFile, useUploadUrl, useDeleteDocument } from '@/hooks/useDocuments';
import { Button, Input, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function DocumentsPageContent() {
  const searchParams = useSearchParams();
  const preselectedAgent = searchParams.get('agent');

  const [selectedAgent, setSelectedAgent] = useState<string>(preselectedAgent || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'url' | null>(null);
  const [urlInput, setUrlInput] = useState('');

  const { data: agents = [] } = useAgents();
  const agentId = selectedAgent !== 'all' ? Number(selectedAgent) : undefined;
  const {
    data: agentDocuments = [],
    isLoading: isDocumentsLoading,
    error: documentsError,
  } = useDocuments(agentId ?? 0);
  const documents = agentId ? agentDocuments : [];
  const documentsErrorMessage = documentsError instanceof Error ? documentsError.message : 'Please try again later.';
  const uploadFileMutation = useUploadFile();
  const uploadUrlMutation = useUploadUrl();
  const deleteDocumentMutation = useDeleteDocument();

  const filteredDocuments = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !agentId) return;

    for (const file of files) {
      try {
        await uploadFileMutation.mutateAsync({ agentId, file });
      } catch (error) {
        console.error('Failed to upload file:', error);
      }
    }
    setUploadMode(null);
  };

  const handleUrlUpload = async () => {
    if (!urlInput.trim() || !agentId) return;

    try {
      await uploadUrlMutation.mutateAsync({ agentId, url: urlInput.trim() });
      setUrlInput('');
      setUploadMode(null);
    } catch (error) {
      console.error('Failed to upload URL:', error);
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (!agentId) return;

    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await deleteDocumentMutation.mutateAsync({ agentId, documentId });
      } catch (error) {
        console.error('Failed to delete document:', error);
      }
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '—';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getStatusVariant = (status: string): 'default' | 'success' | 'destructive' | 'warning' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'warning';
      case 'failed':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.includes('pdf')) {
      return <DocumentTextIcon className="h-5 w-5 text-red-600" />;
    }
    return <DocumentTextIcon className="h-5 w-5" />;
  };

  const totalDocuments = documents.length;
  const completedDocuments = documents.filter((d) => d.status === 'completed').length;
  const processingDocuments = documents.filter((d) => d.status === 'processing').length;
  const failedDocuments = documents.filter((d) => d.status === 'failed').length;
  const showSelectionPrompt = !agentId;
  const isEmptyState = agentId && !isDocumentsLoading && !documentsError && filteredDocuments.length === 0 && !searchQuery;
  const isSearchEmpty = agentId && !isDocumentsLoading && filteredDocuments.length === 0 && !!searchQuery;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Documents</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage knowledge base documents for your AI agents
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => setUploadMode('file')}
            disabled={selectedAgent === 'all'}
          >
            <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
            Upload File
          </Button>
          <Button
            variant="outline"
            onClick={() => setUploadMode('url')}
            disabled={selectedAgent === 'all'}
          >
            <GlobeAltIcon className="h-4 w-4 mr-2" />
            Add URL
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2"
        >
          <option value="all">All Agents</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id.toString()}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>

      {/* Upload Modals */}
      {uploadMode === 'file' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
                <div className="text-center">
                  <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <div className="flex text-sm text-gray-600 dark:text-gray-400">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
                      <span>Upload files</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        multiple
                        accept=".pdf,.txt,.html,.md,.docx"
                        onChange={handleFileUpload}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PDF, TXT, HTML, MD, DOCX up to 10MB each</p>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setUploadMode(null)}>Cancel</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadMode === 'url' && (
        <Card>
          <CardHeader>
            <CardTitle>Add URL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Website URL
                </label>
                <Input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/help"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setUploadMode(null)}>Cancel</Button>
                <Button
                  onClick={handleUrlUpload}
                  disabled={!urlInput.trim() || uploadUrlMutation.isPending}
                  loading={uploadUrlMutation.isPending}
                >
                  Add URL
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {agentId && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DocumentTextIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalDocuments}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Documents</p>
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
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{completedDocuments}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Processed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                  <div className="h-3 w-3 bg-yellow-600 rounded-full"></div>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{processingDocuments}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Processing</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <div className="h-3 w-3 bg-red-600 rounded-full"></div>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{failedDocuments}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showSelectionPrompt ? (
        <Card>
          <CardContent className="p-12 text-center">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Select an agent</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Choose an agent from the dropdown to view and manage its documents.
            </p>
          </CardContent>
        </Card>
      ) : documentsError ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">Failed to load documents</p>
            <p className="text-gray-600 dark:text-gray-400">{documentsErrorMessage}</p>
          </CardContent>
        </Card>
      ) : isDocumentsLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">Loading documents...</p>
          </CardContent>
        </Card>
      ) : isSearchEmpty ? (
        <Card>
          <CardContent className="p-12 text-center">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No documents match your search</h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting your search terms.</p>
          </CardContent>
        </Card>
      ) : isEmptyState ? (
        <Card>
          <CardContent className="p-12 text-center">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No documents found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Upload your first document to get started.
            </p>
            <div className="flex justify-center space-x-3">
              <Button onClick={() => setUploadMode('file')}>
                <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
                Upload File
              </Button>
              <Button variant="outline" onClick={() => setUploadMode('url')}>
                <GlobeAltIcon className="h-4 w-4 mr-2" />
                Add URL
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDocuments.map((document) => {
                  const sourceUrl = document.url || document.doc_metadata?.source_url;
                  const createdAt = document.created_at ? new Date(document.created_at).toLocaleString() : '—';
                  return (
                    <tr key={document.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                              {getFileIcon(document.content_type)}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {document.filename}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {document.content_type || 'Unknown type'}
                              {sourceUrl && ' • From URL'}
                            </div>
                            {document.doc_metadata?.preview && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                {document.doc_metadata.preview}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getStatusVariant(document.status)}>
                          {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatFileSize(document.size)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {createdAt}
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
                              {sourceUrl && (
                                <Menu.Item>
                                  <a
                                    href={sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    <GlobeAltIcon className="h-4 w-4 mr-2" />
                                    View Source
                                  </a>
                                </Menu.Item>
                              )}
                              <Menu.Item>
                                <button
                                  onClick={() => handleDeleteDocument(document.id)}
                                  className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <TrashIcon className="h-4 w-4 mr-2" />
                                  Delete
                                </button>
                              </Menu.Item>
                            </Menu.Items>
                          </Transition>
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <ProtectedRoute>
      <DocumentsPageContent />
    </ProtectedRoute>
  );
}
