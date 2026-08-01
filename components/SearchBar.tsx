// components/SearchBar.tsx
//
// A simple inline search filter for narrowing an already-loaded list by
// text match - not to be confused with components/TitleSearchInput.tsx,
// which searches external catalogs (Google Books/Open Library/TMDb) to
// help fill in a NEW entry. This one only ever filters what's already in
// your own library, entirely offline/local - no network calls at all.
// Added once Books/Comics crossed 50-80 entries and a genre filter alone
// wasn't enough to quickly find one specific item by name.

import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_FAMILY } from './AppText';
import { useTheme } from '../lib/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChangeText, placeholder }: SearchBarProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <Ionicons name="search" size={16} color={theme.colors.textMuted} style={styles.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          { color: theme.colors.text, fontFamily: FONT_FAMILY.body, fontSize: 14 * theme.fontScale },
        ]}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  icon: { marginRight: 6 },
  input: { flex: 1, padding: 0 },
});
