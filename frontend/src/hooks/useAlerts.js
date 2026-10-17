import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

const POLL_MS = 15000;

/** Loads alerts for a status plus the active-alert stats, and refreshes every 15 seconds. */
export function useAlerts(status) {
  const [state, setState] = useState({ alerts: [], stats: null, loading: true, error: null, updatedAt: null });
  const latest = useRef(0);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++latest.current;
      if (!silent) setState((s) => ({ ...s, loading: true }));
      try {
        const [list, stats] = await Promise.all([api.getAlerts(status), api.getStats()]);
        if (id !== latest.current) return; // a newer request replaced this one
        setState({ alerts: list.alerts, stats, loading: false, error: null, updatedAt: new Date() });
      } catch (err) {
        if (id !== latest.current) return;
        setState((s) => ({ ...s, loading: false, error: err.message }));
      }
    },
    [status]
  );

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load({ silent: true });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { ...state, refresh: load };
}
