// components/CoverPicker.tsx
//
// Larger cover display for the Add/Edit form, tapping it is how you
// change it. Purely presentational - what actually happens on tap (the
// Take Photo / Choose from Library / Remove Photo action sheet, and the
// actual file operations behind each) lives in each screen itself, same
// as AlphabetBar - this component just shows the current state and
// forwards the tap.

import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppText from './AppText';
import { useTheme } from '../lib/theme';

interface CoverPickerProps {
  uri: string | null;
  onPress: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
}

export default function CoverPicker({ uri, onPress, iconName = 'book-outline' }: CoverPickerProps) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const showPlaceholder = !uri || failed;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.container, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
    >
      {showPlaceholder ? (
        <>
          <Ionicons name={iconName} size={36} color={theme.colors.textMuted} />
          <AppText style={{ color: theme.colors.textMuted, fontSize: 12 * theme.fontScale, marginTop: 6 }}>
            Add cover photo
          </AppText>
        </>
      ) : (
        <Image source={{ uri }} style={styles.image} onError={() => setFailed(true)} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 120,
    height: 168,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 20,
  },
  image: { width: '100%', height: '100%' },
});
