import { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';
import { colors } from './theme';

// A small rotating-ring spinner built on RN's core Animated API — no extra
// dependency needed. Use inline (small, e.g. inside a button) or fullscreen
// (centered, with an optional label) for a whole-screen loading state.
export function Loader({ label, size = 36, color = colors.accent, trackColor = '#e0e7ff', fullscreen = false }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const ring = (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(2, size / 9),
        borderColor: trackColor,
        borderTopColor: color,
        transform: [{ rotate }],
      }}
    />
  );

  if (fullscreen) {
    return (
      <View style={styles.fullscreen}>
        {ring}
        {label ? <Text style={styles.label}>{label}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.inline}>
      {ring}
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  inline: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 13, color: colors.textSecondary },
});
