import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDb } from '../db/database';
import { useSyncStatus } from '../sync/SyncStatusContext';
import { Screen } from '../components/Screen';
import { SyncBadge } from '../components/SyncBadge';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../components/theme';


async function loadOutstanding() {
  const db = await getDb();
  const households = await db.getAllAsync(
    "SELECT id, householdCode AS label, syncStatus, pendingOperation, lastSyncError FROM households WHERE syncStatus != 'synced'",
  );
  const members = await db.getAllAsync(
    "SELECT id, name AS label, householdId, syncStatus, pendingOperation, lastSyncError FROM household_members WHERE syncStatus != 'synced'",
  );
  const assessments = await db.getAllAsync(
    "SELECT id, memberId, syncStatus, pendingOperation, lastSyncError FROM health_assessments WHERE syncStatus != 'synced'",
  );

  return [
    ...households.map((r) => ({ ...r, type: 'Household', screen: 'HouseholdDetail', params: { householdId: r.id } })),
    ...members.map((r) => ({
      ...r,
      type: 'Member',
      screen: 'MemberDetail',
      params: { memberId: r.id, memberName: r.label },
    })),
    ...assessments.map((r) => ({
      ...r,
      label: 'Health assessment',
      type: 'Assessment',
      screen: 'MemberDetail',
      params: { memberId: r.memberId },
    })),
  ];
}

export function SyncStatusScreen({ navigation }) {
  const { triggerSync, syncing, lastSyncMessage } = useSyncStatus();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setItems(await loadOutstanding());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSyncNow() {
    await triggerSync();
    load();
  }

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{items.length === 0 ? 'Everything is synced' : `${items.length} item${items.length > 1 ? 's' : ''} need attention`}</Text>
        {lastSyncMessage ? <Text style={styles.headerNote}>{lastSyncMessage}</Text> : null}
        <PrimaryButton title={syncing ? 'Syncing…' : 'Sync now'} onPress={handleSyncNow} loading={syncing} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading && (
            <EmptyState title="Nothing pending" description="All your changes have reached the server." />
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate(item.screen, item.params)}>
            <View style={styles.cardRow}>
              <Text style={styles.cardTitle}>
                {item.type}: {item.label}
              </Text>
              <SyncBadge status={item.syncStatus} />
            </View>
            <Text style={styles.cardSubtitle}>
              {item.pendingOperation ? `Queued ${item.pendingOperation.toLowerCase()}` : ''}
              {item.lastSyncError ? ` · ${item.lastSyncError}` : ''}
            </Text>
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  headerNote: { fontSize: 13, color: colors.textSecondary },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flexShrink: 1, paddingRight: 8 },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
});
