'use client';

import { useEffect } from 'react';
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/Button';

const themes = [
  { key: 'light', label: 'Light', icon: SunIcon },
  { key: 'dark', label: 'Dark', icon: MoonIcon },
  { key: 'system', label: 'System', icon: ComputerDesktopIcon },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useUIStore();

  useEffect(() => {
    // Initialize theme on mount
    setTheme(theme);

    // Listen for system theme changes
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => setTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, setTheme]);

  const currentTheme = themes.find(t => t.key === theme) || themes[0];
  const CurrentIcon = currentTheme.icon;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          const currentIndex = themes.findIndex(t => t.key === theme);
          const nextIndex = (currentIndex + 1) % themes.length;
          setTheme(themes[nextIndex].key);
        }}
        title={`Switch to ${themes[(themes.findIndex(t => t.key === theme) + 1) % themes.length].label} theme`}
      >
        <CurrentIcon className="h-5 w-5" />
      </Button>
    </div>
  );
}