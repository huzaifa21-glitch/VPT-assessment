import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

// Same as before, except: passing secureTextEntry now automatically adds a
// show/hide eye icon — the field itself decides whether to actually mask the
// text (based on the toggle), so callers don't do anything differently.
export function TextField({ label, error, secureTextEntry, style, ...props }) {
  const [visible, setVisible] = useState(false);
  const isPasswordField = !!secureTextEntry;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrapper}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, isPasswordField && styles.inputWithIcon, error && styles.inputError, style]}
          secureTextEntry={isPasswordField && !visible}
          {...props}
        />
        {isPasswordField && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setVisible((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={visible ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  inputWrapper: { justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  inputWithIcon: { paddingRight: 44 },
  inputError: { borderColor: colors.danger },
  iconButton: {
    position: 'absolute',
    right: 10,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  error: { fontSize: 12, color: colors.danger, marginTop: 4 },
});
