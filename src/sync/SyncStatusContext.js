import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { runSync, getPendingCounts, getConflictCount } from './syncEngine';

const SyncStatusContext = createContext(null);

export function SyncStatusProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, error: 0, conflict: 0 });
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [lastSyncMessage, setLastSyncMessage] = useState(null);
  const syncingRef = useRef(false);

  const refreshCounts = useCallback(async () => {
    const [pendingCounts, conflict] = await Promise.all([getPendingCounts(), getConflictCount()]);
    setCounts({ ...pendingCounts, conflict });
  }, []);

  // The single entry point every screen/button calls. Guarded so overlapping
  // triggers (e.g. a manual tap right as connectivity comes back) collapse
  // into one run instead of racing.
  const triggerSync = useCallback(async () => {
    if (syncingRef.current) return { ok: true, skipped: true };
    syncingRef.current = true;
    setSyncing(true);
    const result = await runSync();
    setSyncing(false);
    syncingRef.current = false;
    setLastSyncAt(new Date());
    setLastSyncMessage(
      result.ok ? null : result.offline ? "You're offline — changes will sync once you're back online." : result.error || 'Sync failed.',
    );
    await refreshCounts();
    return result;
  }, [refreshCounts]);

  useEffect(() => {
    refreshCounts();
    triggerSync();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online) triggerSync();
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = { isOnline, syncing, counts, lastSyncAt, lastSyncMessage, triggerSync, refreshCounts };
  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus() {
  const ctx = useContext(SyncStatusContext);
  if (!ctx) throw new Error('useSyncStatus must be used within a SyncStatusProvider');
  return ctx;
}
