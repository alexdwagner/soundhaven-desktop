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
    const updateEnvironment = () => {
      const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
      
      // Enhanced mobile detection: user agent OR small screen size (removed touch requirement for testing)
      const isMobileUserAgent = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmallScreen = typeof window !== 'undefined' && window.innerWidth <= 768;
      const hasTouchSupport = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
      // For testing: Mobile if user agent OR small screen (don't require both screen + touch)
      const isMobile = isMobileUserAgent || isSmallScreen;
      
      const isStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

      setEnv({ isElectron, isMobile, isStandalone });
      
      // console.log('🌍 [Environment Detection]', { 
      //   isElectron, 
      //   isMobile,
      //   isMobileUserAgent,
      //   isSmallScreen,
      //   hasTouchSupport,
      //   screenWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
      //   isStandalone 
      // });
    };

    // Initial detection
    updateEnvironment();

    // Listen for window resize to handle responsive mobile detection
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateEnvironment);
      return () => window.removeEventListener('resize', updateEnvironment);
    }
  }, []);

  return env;
} 