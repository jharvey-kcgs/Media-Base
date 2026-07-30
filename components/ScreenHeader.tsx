// components/ScreenHeader.tsx
//
// Every screen's header goes through this, so title size/centering and
// safe-area padding stay consistent everywhere instead of being
// hand-rolled per screen. Uses useSafeAreaInsets directly (rather than
// relying solely on the parent SafeAreaView) because SafeAreaView's
// automatic inset can read as stale/zero when a screen is presented
// inside a <Modal> - this was the cause of Cancel/Save being unreachable
// under the status bar on the Add/Edit Book screen.
//
// The title is centered via absolute positioning spanning the full header
// width, with pointerEvents="none" so it never blocks the real left/right
// buttons underneath. Both the button row and the title box share the
// same fixed CONTENT_HEIGHT and both vertically center their text within
// it - without that shared height, the row's box auto-sized to its own
// (shorter) button-text line height while the title box auto-sized to its
// own (taller, Extra Bold) line height, so both blocks of text started at
// the same top edge but landed at different visual centers - the title
// consistently rendered a few pixels lower than the back button. Giving
// them an identical height and centering both within it fixes that.
//
// The side columns are capped at a fixed SIDE_MAX_WIDTH (not a screen-width
// percentage) so a long back label like "Settings" can't grow wide enough
// at larger text sizes to run into the title's box - which is exactly
// what was happening: the title paints on top (later in the tree), so an
// overlap didn't look like visual clipping, it looked like the two labels'
// text running directly into each other with no gap. The title also gets
// adjustsFontSizeToFit so a long title (e.g. "Permissions") shrinks
// gracefully to fit its remaining space instead of overflowing, if a long
// title and a long back label both land on the same screen at once.

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
  /** Escape hatch for anything else (icons, Cancel, •••) - overrides onBack/backLabel if provided. */
  left?: React.ReactNode;
  right?: React.ReactNode;
}

const CONTENT_HEIGHT = 34;
const SIDE_MAX_WIDTH = 120;
const TITLE_INSET = 125;

export default function ScreenHeader({ title, onBack, backLabel, left, right }: ScreenHeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const leftContent =
    left ??
    (onBack ? (
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <AppText
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ color: theme.colors.accentReadable, fontSize: 13 * theme.fontScale }}
        >
          ‹ {backLabel}
        </AppText>
      </TouchableOpacity>
    ) : null);

  return (
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
      <View style={styles.row}>
        <View style={styles.side}>{leftContent}</View>
        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
      <View pointerEvents="none" style={[styles.titleWrap, { top: insets.top + 14 }]}>
        <AppText
          variant="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[styles.title, { color: theme.colors.text, fontSize: 22 * theme.fontScale }]}
        >
          {title}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'relative',
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: CONTENT_HEIGHT,
  },
  side: { maxWidth: SIDE_MAX_WIDTH, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  titleWrap: {
    position: 'absolute',
    left: TITLE_INSET,
    right: TITLE_INSET,
    height: CONTENT_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { textAlign: 'center' },
});
