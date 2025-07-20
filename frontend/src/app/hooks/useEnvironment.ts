import { useState, useEffect } from 'react';

export interface Environment {
  isElectron: boolean;
  isMobile: boolean;
  isStandalone: boolean;
}

export function useEnvironment(): Environment {
  const [env, setEnv] = useState<Environment>({
    isElectron: false,
    isMobile: false,
    isStandalone: false
  });

  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
    const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

    setEnv({ isElectron, isMobile, isStandalone });
    
    console.log('🌍 [Environment Detection]', { isElectron, isMobile, isStandalone });
  }, []);

  return env;
} 