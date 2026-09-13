import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { colors } from './theme';

// Shared keyboard-safe wrapper for every add/edit form. Two things fix the
// "keyboard covers the input" problem:
//   1. keyboardVerticalOffset = the native stack header's actual height on
//      iOS — without this, KeyboardAvoidingView's padding math is off by
//      however tall the header is, so it under-shifts content near the top.
//   2. Android uses 'height' (not 'padding') — 'padding' mode is unreliable
//      on Android, 'height' resizes the view predictably.
export function FormScreen({ children, contentContainerStyle }) {
  const headerHeight = useHeaderHeight();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <ScrollView
        contentContainerStyle={[styles.container, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, paddingBottom: 40 },
});
