'use client';

import { useEffect, useState } from 'react';

// Phase 2 PWA: register the service worker and show the
// browser install prompt when it becomes available.
// Renders nothing until the prompt event fires, so there is
// no dead button on browsers that do not support install.
export default function PwaRegister() {
  const [promptEvent, setPromptEvent] = useState<any>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failure must not break the app shell.
      });
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!promptEvent) return null;
  return (
    <button
      type="button"
      style={{ minHeight: '44px', padding: '0.5rem 1rem' }}
      onClick={async () => {
        promptEvent.prompt();
        setPromptEvent(null);
      }}
    >
      Install FieldSync
    </button>
  );
}
