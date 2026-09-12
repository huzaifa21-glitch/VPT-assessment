import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Loader } from './Loader';
import { colors } from './theme';

export function PrimaryButton({ title, onPress, loading, disabled, variant = 'primary', style }) {
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        isDanger && styles.danger,
        isSecondary && styles.secondary,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <Loader size={18} color={isSecondary ? colors.accent : '#fff'} trackColor="rgba(255,255,255,0.4)" />
      ) : (
        <Text style={[styles.text, isSecondary && styles.secondaryText]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  danger: { backgroundColor: colors.danger },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  disabled: { opacity: 0.6 },
  text: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryText: { color: colors.textPrimary },
});
