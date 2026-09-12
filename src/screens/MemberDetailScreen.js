import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { membersRepo } from '../db/membersRepo';
import { assessmentsRepo } from '../db/assessmentsRepo';
import { useSyncStatus } from '../sync/SyncStatusContext';
import { Screen } from '../components/Screen';
import { SyncBadge } from '../components/SyncBadge';
import { EmptyState } from '../components/EmptyState';
import { Loader } from '../components/Loader';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../components/theme';

export function MemberDetailScreen({ route, navigation }) {
  const { memberId } = route.params;
  const { triggerSync, refreshCounts } = useSyncStatus();
  const [member, setMember] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [m, a] = await Promise.all([membersRepo.getById(memberId), assessmentsRepo.listByMember(memberId)]);
    setMember(m);
    setAssessments(a);
    setLoading(false);
  }, [memberId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleDelete() {
    Alert.alert('Delete member', 'This will remove the member once it syncs. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await membersRepo.softDelete(memberId);
          triggerSync();
          navigation.goBack();
        },
      },
    ]);
  }

  async function handleResolve(action) {
    if (action === 'server') await membersRepo.resolveUseServer(memberId);
    else await membersRepo.resolveKeepMine(memberId);
    await refreshCounts();
    triggerSync();
    load();
  }

  if (loading || !member) return <Loader fullscreen label="Loading member…" />;

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <FlatList
        data={assessments}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <View style={styles.flexShrink}>
                <Text style={styles.title}>{member.name}</Text>
                <Text style={styles.subtitle}>
                  {member.age} yrs · {member.gender} · {member.relationship}
                </Text>
              </View>
              <SyncBadge status={member.effectiveSyncStatus} />
            </View>

            {member.syncStatus === 'conflict' && (
              <View style={styles.conflictBox}>
                <Text style={styles.conflictTitle}>This member was also changed elsewhere</Text>
                <Text style={styles.conflictBody}>
                  Someone else updated this record while you were offline. Choose which version to keep.
                </Text>
                <View style={styles.conflictActions}>
                  <PrimaryButton title="Use server version" variant="secondary" onPress={() => handleResolve('server')} style={styles.conflictButton} />
                  <PrimaryButton title="Keep my changes" onPress={() => handleResolve('mine')} style={styles.conflictButton} />
                </View>
              </View>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity onPress={() => navigation.navigate('MemberForm', { householdId: member.householdId, memberId })}>
                <Text style={styles.link}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete}>
                <Text style={[styles.link, styles.danger]}>Delete</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Health assessments</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState title="No assessments yet" description="Record a health assessment for this member." />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('AssessmentForm', { memberId, assessmentId: item.id })}
          >
            <View style={styles.cardRow}>
              <Text style={styles.cardTitle}>
                {item.temperatureC != null ? `${item.temperatureC}°C` : 'No temperature recorded'}
              </Text>
              <SyncBadge status={item.syncStatus} />
            </View>
            <Text style={styles.cardSubtitle}>
              {[item.hasFever && 'Fever', item.hasCough && 'Cough', item.hasBreathingDifficulty && 'Breathing difficulty']
                .filter(Boolean)
                .join(' · ') || 'No symptoms flagged'}
            </Text>
            {!!item.isUrgent && <Text style={styles.urgent}>Urgent</Text>}
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AssessmentForm', { memberId })}
      >
        <Text style={styles.fabText}>+ Add assessment</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 8 },
  flexShrink: { flexShrink: 1, paddingRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  conflictBox: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 10, backgroundColor: colors.dangerBg },
  conflictTitle: { fontSize: 14, fontWeight: '700', color: colors.danger },
  conflictBody: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  conflictActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  conflictButton: { flex: 1 },
  actionsRow: { flexDirection: 'row', gap: 20, paddingHorizontal: 16, paddingBottom: 12 },
  link: { fontSize: 13, fontWeight: '600', color: colors.accent },
  danger: { color: colors.danger },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: 16, marginBottom: 8 },
  listContent: { paddingBottom: 100 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, marginHorizontal: 16, marginBottom: 10 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  urgent: { fontSize: 12, fontWeight: '700', color: colors.danger, marginTop: 6 },
  fab: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
