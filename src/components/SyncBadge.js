import { View, Text, StyleSheet } from 'react-native';
import { colors } from './theme';

const CONFIG = {
  synced: { label: 'Synced', bg: colors.successBg, fg: colors.success },
  pending: { label: 'Pending', bg: colors.warningBg, fg: colors.warning },
  conflict: { label: 'Conflict', bg: colors.dangerBg, fg: colors.danger },
  error: { label: 'Failed', bg: colors.dangerBg, fg: colors.danger },
};

export function SyncBadge({ status }) {
  const cfg = CONFIG[status] || CONFIG.pending;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.text, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '600' },
});
