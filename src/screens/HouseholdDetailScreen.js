import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { householdsRepo } from '../db/householdsRepo';
import { membersRepo } from '../db/membersRepo';
import { useSyncStatus } from '../sync/SyncStatusContext';
import { Screen } from '../components/Screen';
import { SyncBadge } from '../components/SyncBadge';
import { EmptyState } from '../components/EmptyState';
import { Loader } from '../components/Loader';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../components/theme';

export function HouseholdDetailScreen({ route, navigation }) {
  const { householdId } = route.params;
  const { triggerSync, refreshCounts, lastSyncAt } = useSyncStatus();
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [h, m] = await Promise.all([
      householdsRepo.getById(householdId),
      membersRepo.listByHousehold(householdId),
    ]);
    setHousehold(h);
    setMembers(m);
    setLoading(false);
  }, [householdId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

 
  useEffect(() => {
    load();
  }, [lastSyncAt]);

  async function handleDelete() {
    Alert.alert('Delete household', 'This will remove the household once it syncs. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await householdsRepo.softDelete(householdId);
          triggerSync();
          navigation.goBack();
        },
      },
    ]);
  }

  async function handleResolve(action) {
    if (action === 'server') await householdsRepo.resolveUseServer(householdId);
    else await householdsRepo.resolveKeepMine(householdId);
    await refreshCounts();
    triggerSync();
    load();
  }

  if (loading || !household) return <Loader fullscreen label="Loading household…" />;

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <View style={styles.flexShrink}>
                <Text style={styles.title}>{household.householdCode}</Text>
                <Text style={styles.subtitle}>{household.address}</Text>
              </View>
              <SyncBadge status={household.effectiveSyncStatus} />
            </View>

            {household.syncStatus === 'conflict' && (
              <View style={styles.conflictBox}>
                <Text style={styles.conflictTitle}>This household was also changed elsewhere</Text>
                <Text style={styles.conflictBody}>
                  Someone else updated this record while you were offline. Choose which version to keep.
                </Text>
                <View style={styles.conflictActions}>
                  <PrimaryButton
                    title="Use server version"
                    variant="secondary"
                    onPress={() => handleResolve('server')}
                    style={styles.conflictButton}
                  />
                  <PrimaryButton
                    title="Keep my changes"
                    onPress={() => handleResolve('mine')}
                    style={styles.conflictButton}
                  />
                </View>
              </View>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity onPress={() => navigation.navigate('HouseholdForm', { householdId })}>
                <Text style={styles.link}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete}>
                <Text style={[styles.link, styles.danger]}>Delete</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Members</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState title="No members yet" description="Add a household member to get started." />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('MemberDetail', { memberId: item.id, memberName: item.name })}
          >
            <View style={styles.cardRow}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <SyncBadge status={item.effectiveSyncStatus} />
            </View>
            <Text style={styles.cardSubtitle}>
              {item.age} yrs · {item.gender} · {item.relationship}
            </Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('MemberForm', { householdId })}
      >
        <Text style={styles.fabText}>+ Add member</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 8,
  },
  flexShrink: { flexShrink: 1, paddingRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  conflictBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.dangerBg,
  },
  conflictTitle: { fontSize: 14, fontWeight: '700', color: colors.danger },
  conflictBody: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  conflictActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  conflictButton: { flex: 1 },
  actionsRow: { flexDirection: 'row', gap: 20, paddingHorizontal: 16, paddingBottom: 12 },
  link: { fontSize: 13, fontWeight: '600', color: colors.accent },
  danger: { color: colors.danger },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listContent: { paddingBottom: 100 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
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
