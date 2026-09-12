import { View, Text, StyleSheet } from 'react-native';
import { colors } from './theme';

export function EmptyState({ title, description }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  title: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  description: { fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
});
