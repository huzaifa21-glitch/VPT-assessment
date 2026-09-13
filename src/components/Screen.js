import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { colors } from './theme';


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
