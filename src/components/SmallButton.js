import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from './theme';

export function SmallButton({ title, onPress, disabled, variant = 'primary' }) {
  const isSecondary = variant === 'secondary';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[styles.button, isSecondary ? styles.secondary : styles.primary, disabled && styles.disabled]}
    >
      <Text style={[styles.text, isSecondary && styles.secondaryText]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.accent },
  disabled: { opacity: 0.5 },
  text: { color: '#fff', fontSize: 12, fontWeight: '700' },
  secondaryText: { color: colors.accent },
});
