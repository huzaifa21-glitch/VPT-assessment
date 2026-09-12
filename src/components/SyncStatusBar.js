import { View, Text, StyleSheet } from 'react-native';
import { useSyncStatus } from '../sync/SyncStatusContext';
import { Loader } from './Loader';
import { SmallButton } from './SmallButton';
import { colors } from './theme';

export function SyncStatusBar({ onPressConflicts }) {
  const { isOnline, syncing, counts, triggerSync } = useSyncStatus();
  const hasWork = counts.pending > 0 || counts.error > 0 || counts.conflict > 0;

  let statusText;
  if (!isOnline) statusText = 'Offline';
  else if (syncing) statusText = 'Syncing…';
  else if (hasWork) {
    const outstanding = counts.pending + counts.error;
    statusText = outstanding > 0 ? `${outstanding} pending` : 'Synced';
    if (counts.conflict > 0) {
      statusText += `, ${counts.conflict} conflict${counts.conflict > 1 ? 's' : ''}`;
    }
  } else {
    statusText = 'All synced';
  }

  return (
    <View style={[styles.bar, !isOnline && styles.offlineBar]}>
      <View style={styles.left}>
        {syncing ? (
          <Loader size={16} />
        ) : (
          <View
            style={[styles.dot, { backgroundColor: isOnline ? (hasWork ? colors.warning : colors.success) : colors.textMuted }]}
          />
        )}
        <Text style={styles.text} numberOfLines={1}>
          {statusText}
        </Text>
      </View>
      <View style={styles.right}>
        {counts.conflict > 0 && (
          <SmallButton title="Review" variant="secondary" onPress={onPressConflicts} />
        )}
        <SmallButton title="Sync now" onPress={triggerSync} disabled={syncing || !isOnline} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  offlineBar: { backgroundColor: '#fff7ed' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
});
