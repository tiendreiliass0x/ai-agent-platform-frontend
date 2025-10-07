'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initializeApp = useAuthStore((state) => state.initializeApp);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      initializeApp();
      setInitialized(true);
    }
  }, [initializeApp, initialized]);

  return <>{children}</>;
}
