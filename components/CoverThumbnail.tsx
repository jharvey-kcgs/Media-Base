// components/CoverThumbnail.tsx
//
// Small, FIXED-SIZE cover image for list rows - deliberately the same
// dimensions whether a real cover is loaded, still loading, or doesn't
// exist at all. That fixed size matters a lot more than it might look:
// this app went through several real rounds of scroll-performance bugs
// earlier (documented in lib/useAlphabetScroll.ts) that all traced back
// to row height not being perfectly uniform. A cover thumbnail whose
// size changed based on load state would reintroduce exactly that
// problem - so this never lets that happen, on purpose.
//
// Falls back to a simple icon placeholder - on a load error (nothing
// saved at this uri) or when there's no uri at all (item has no cover).

import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';

interface CoverThumbnailProps {
  uri: string | null;
  iconName?: keyof typeof Ionicons.glyphMap;
}

export default function CoverThumbnail({ uri, iconName = 'book-outline' }: CoverThumbnailProps) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);

  // Resets on every uri change, not just on mount - VirtualizedList
  // recycles row components for different items as you scroll rather
  // than always mounting fresh ones, so without this a load failure
  // recorded for one item could incorrectly stick around and show a
  // placeholder for a completely different item that got recycled into
  // the same row slot.
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const showPlaceholder = !uri || failed;

  return (
    <View style={[styles.container, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      {showPlaceholder ? (
        <Ionicons name={iconName} size={20} color={theme.colors.textMuted} />
      ) : (
        <Image source={{ uri }} style={styles.image} onError={() => setFailed(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 42,
    height: 58,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  image: { width: '100%', height: '100%' },
});
