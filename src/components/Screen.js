import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { colors } from './theme';

// Wraps a screen's content so it respects the notch/status bar/home-indicator
// on devices that have them. `edges` controls which sides actually get
// padding — a screen with a native stack header already gets top spacing
// from that header, so it passes edges={['bottom', 'left', 'right']} to
// avoid double-padding; a screen with headerShown:false (like the household
// list, which has its own custom header row) uses the default (all sides).
export function Screen({ children, edges = ['top', 'bottom', 'left', 'right'], style }) {
  return (
    <SafeAreaView edges={edges} style={[styles.flex, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
});
