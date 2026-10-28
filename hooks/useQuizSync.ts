'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { QuizState } from '@/lib/types';
import { INITIAL_QUIZ_STATE } from '@/lib/defaultData';

export function useQuizSync() {
  const [state, setState] = useState<QuizState>(INITIAL_QUIZ_STATE);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Apply state update if newer version
  const updateStateIfNewer = useCallback((newState: QuizState) => {
    setState((prev) => {
      if (newState.version >= prev.version || newState.updatedAt > prev.updatedAt) {
        return newState;
      }
      return prev;
    });
  }, []);

  // Fetch state manually
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/quiz', { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        if (text && !text.trim().startsWith('<')) {
          try {
            const json = JSON.parse(text);
            if (json.success && json.state) {
              updateStateIfNewer(json.state);
              setIsConnected(true);
            }
          } catch (jsonErr) {
            console.warn('Invalid JSON in fetchState:', jsonErr);
          }
        }
      }
    } catch (e) {
      console.warn('Fetch quiz state failed:', e);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [updateStateIfNewer]);

  // Execute action on server
  const executeAction = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      try {
        const res = await fetch('/api/quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, payload }),
        });
        const text = await res.text();
        if (!text || text.trim().startsWith('<')) {
          console.warn(`Server returned non-JSON/HTML (${res.status}) for action ${action}`);
          return { success: false, error: `Server returned non-JSON (${res.status})` };
        }
        try {
          const json = JSON.parse(text);
          if (json.success && json.state) {
            updateStateIfNewer(json.state);
            // Also notify local BroadcastChannel
            if (broadcastChannelRef.current) {
              broadcastChannelRef.current.postMessage({ type: 'STATE_UPDATE', state: json.state });
            }
          }
          return json;
        } catch (jsonErr) {
          console.warn('Execute action non-JSON payload:', jsonErr);
          return { success: false, error: 'Malformed JSON response' };
        }
      } catch (err) {
        console.error('Execute action network error:', err);
      }
      return { success: false };
    },
    [updateStateIfNewer]
  );

  useEffect(() => {
    // 1. Initial fetch asynchronously
    const initialTimer = setTimeout(() => {
      void fetchState();
    }, 0);

    // 2. Setup BroadcastChannel for multi-tab zero-latency sync on same machine
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('viplava_quiz_sync');
        broadcastChannelRef.current = bc;
        bc.onmessage = (event) => {
          if (event.data?.type === 'STATE_UPDATE' && event.data.state) {
            updateStateIfNewer(event.data.state);
          }
        };
      }
    } catch {
      // BroadcastChannel might fail in private windows
    }

    // 3. Setup Server-Sent Events (SSE)
    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource('/api/quiz/events');

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          updateStateIfNewer(parsed);
          setIsConnected(true);
        } catch (err) {
          console.error('Error parsing SSE data', err);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        // Will auto-retry
      };
    } catch (e) {
      console.warn('SSE not supported or failed to init', e);
    }

    // 4. Polling fallback every 1200ms
    fallbackInterval = setInterval(() => {
      fetchState();
    }, 1200);

    return () => {
      clearTimeout(initialTimer);
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [fetchState, updateStateIfNewer]);

  return {
    state,
    isConnected,
    isLoading,
    executeAction,
    refresh: fetchState,
  };
}
