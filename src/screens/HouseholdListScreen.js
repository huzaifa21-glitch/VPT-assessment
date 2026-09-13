import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { householdsRepo } from '../db/householdsRepo';
import { resetLocalDatabase } from '../db/database';
import { getPendingCounts, getConflictCount } from '../sync/syncEngine';
import { useSyncStatus } from '../sync/SyncStatusContext';
import { useAuth } from '../auth/AuthContext';
import { Screen } from '../components/Screen';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { SyncBadge } from '../components/SyncBadge';
import { Avatar } from '../components/Avatar';
import { SmallButton } from '../components/SmallButton';
import { EmptyState } from '../components/EmptyState';
import { Loader } from '../components/Loader';
import { colors } from '../components/theme';

export function HouseholdListScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { lastSyncAt } = useSyncStatus();
  const [households, setHouseholds] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const rows = await householdsRepo.listAll(user?.areaId);
    setHouseholds(rows);
    setLoading(false);
  }, [user?.areaId]);

  // Reload every time this screen gains focus — covers returning from the
  // add/edit form.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // ALSO reload whenever a sync finishes — the very first sync after login
  // is what actually pulls households down into local storage, and it runs
  // in the background while this screen is already mounted and focused, so
  // focus-based reloading alone misses it. lastSyncAt changes every time
  // triggerSync() completes (see SyncStatusContext), so this catches that.
  useEffect(() => {
    load();
  }, [lastSyncAt]);

  async function handleLogoutPress() {
    const [pendingCounts, conflictCount] = await Promise.all([getPendingCounts(), getConflictCount()]);
    const outstanding = pendingCounts.pending + pendingCounts.error + conflictCount;

    if (outstanding > 0) {
      Alert.alert(
        'Unsynced changes',
        `You have ${outstanding} change${outstanding > 1 ? 's' : ''} that haven't reached the server yet. ` +
          'Logging out clears this device\u2019s local data for the next sign-in — sync first if you want to keep them.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log out anyway', style: 'destructive', onPress: doLogout },
        ],
      );
    } else {
      doLogout();
    }
  }

  async function doLogout() {
    await logout();
    await resetLocalDatabase();
  }

  const filtered = households.filter((h) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return h.householdCode.toLowerCase().includes(q) || h.address.toLowerCase().includes(q);
  });

  return (
    <Screen>
      <SyncStatusBar onPressConflicts={() => navigation.navigate('SyncStatus')} />

      <View style={styles.header}>
        <View style={styles.identity}>
          <Avatar name={user?.name} />
          <View style={styles.identityText}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name || 'Field worker'}
               {user?.email || 'Field worker'}
            </Text>
            <Text style={styles.areaName} numberOfLines={1}>
              {user?.area?.name || 'Unassigned area'}
            </Text>
          </View>
        </View>
        <SmallButton title="Log out" variant="secondary" onPress={handleLogoutPress} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by code or address"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
        />
      </View>

      {loading ? (
        <Loader fullscreen label="Loading households…" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title="No households yet"
              description="Tap “Add household” below to register your first one."
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('HouseholdDetail', { householdId: item.id })}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{item.householdCode}</Text>
                <SyncBadge status={item.effectiveSyncStatus} />
              </View>
              <Text style={styles.cardSubtitle}>{item.address}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('HouseholdForm', {})}>
        <Text style={styles.fabText}>+ Add household</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  identityText: { flexShrink: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  areaName: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  searchRow: { paddingHorizontal: 16, paddingBottom: 8 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  fab: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
