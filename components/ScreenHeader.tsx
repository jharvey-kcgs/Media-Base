// components/ScreenHeader.tsx
//
// Every screen's header goes through this, so title size/centering and
// safe-area padding stay consistent everywhere instead of being
// hand-rolled per screen. Uses useSafeAreaInsets directly (rather than
// relying solely on the parent SafeAreaView) because SafeAreaView's
// automatic inset can read as stale/zero when a screen is presented
// inside a <Modal> - this was the cause of Cancel/Save being unreachable
// under the status bar on the Add/Edit Book screen.

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from './AppText';
import { useTheme } from '../lib/theme';

interface ScreenHeaderProps {
  title: string;
  /** Simple case: pass these two and a standard '‹ Label' back link renders on the left. */
  onBack?: () => void;
  backLabel?: string;
  /** Escape hatch for anything else (icons, Cancel, +Add) - overrides onBack/backLabel if provided. */
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export default function ScreenHeader({ title, onBack, backLabel, left, right }: ScreenHeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const leftContent =
    left ??
    (onBack ? (
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <AppText style={{ color: theme.colors.accentReadable, fontSize: 14 * theme.fontScale }} numberOfLines={1}>
          ‹ {backLabel}
        </AppText>
      </TouchableOpacity>
    ) : null);

  return (
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
      <View style={styles.side}>{leftContent}</View>
      <AppText
        variant="header"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.title, { color: theme.colors.text, fontSize: 22 * theme.fontScale }]}
      >
        {title}
      </AppText>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  side: { width: 92, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
});
