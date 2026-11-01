'use client';

import { useEffect, useState } from 'react';
import Button from './ui/Button';

// Phase 2 PWA: register the service worker and show the
// browser install prompt when it becomes available.
// Renders nothing until the prompt event fires, so there is
// no dead button on browsers that do not support install.
//
// Redesign (docs/17 slice (e)): the install button uses the
// shared Button component (token styles, 44px target, focus
// ring) instead of an inline style prop. Service-worker
// registration, the install-prompt handling, and the
// render condition are exactly as before.
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
    <Button
      onClick={async () => {
        promptEvent.prompt();
        setPromptEvent(null);
      }}
    >
      Install FieldSync
    </Button>
  );
}
