'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  BoltIcon,
  PlusIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
  HomeIcon
} from '@heroicons/react/24/outline';

type Role = 'owner' | 'admin' | 'editor' | 'viewer';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, currentOrganization } = useAuthStore();

  // Role is not provided by the current API; fall back to 'owner' if missing.
  const role: Role = ((currentOrganization as any)?.role as Role) || 'owner';
  const plan = (user?.plan || 'free').toLowerCase();

  const hasAnyRole = (...allowed: Role[]) => allowed.includes(role);
  const can = {
    viewAgents: hasAnyRole('owner', 'admin', 'editor', 'viewer'),
    manageAgents: hasAnyRole('owner', 'admin', 'editor'),
    viewDocuments: hasAnyRole('owner', 'admin', 'editor'), // viewers often read-only; hide upload-centric page
    viewAnalytics: hasAnyRole('owner', 'admin') && plan !== 'free',
    manageSettings: hasAnyRole('owner', 'admin'),
  } as const;

  const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon, visible: true },
    { name: 'Agents', href: '/agents', icon: BoltIcon, visible: can.viewAgents },
    { name: 'Create Agent', href: '/agents/new', icon: PlusIcon, visible: can.manageAgents },
    { name: 'Documents', href: '/documents', icon: DocumentTextIcon, visible: can.viewDocuments },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon, visible: can.viewAnalytics },
    { name: 'Settings', href: '/settings', icon: CogIcon, visible: can.manageSettings },
  ].filter(item => item.visible);

  return (
    <div className="flex h-full flex-col bg-gray-900 dark:bg-gray-950">
      {/* Logo */}
      <div className="flex h-16 flex-shrink-0 items-center px-4">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <BoltIcon className="h-5 w-5 text-white" />
          </div>
          <div className="text-white font-bold text-lg">AI Agents</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <item.icon
                  className={`mr-3 h-5 w-5 flex-shrink-0 ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
                  }`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User section */}
      <div className="flex flex-shrink-0 p-4">
        <div className="group block w-full flex-shrink-0">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">U</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{user?.name || 'User'}</p>
              <p className="text-xs font-medium text-gray-400">{plan.charAt(0).toUpperCase() + plan.slice(1)} Plan · {role.toUpperCase()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
