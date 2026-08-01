// components/TitleSearchInput.tsx
//
// The shared UI for "type a title, get real candidates back, tap one to
// fill in everything it has" - generic over the result type T so Books/
// Comics (lib/titleSearch.ts's BookTitleSearchResult) and Movies
// (UpcMovieLookupResult) can each plug in their own search function and
// result shape without three separate copies of the debounce/dropdown
// logic itself.
//
// Renders as a drop-in replacement for a plain TextInput - the dropdown
// is absolutely positioned below it, so it overlays the rest of the form
// rather than pushing it down. Relies on the screen's ScrollView already
// having keyboardShouldPersistTaps="handled" (every Add/Edit form in
// this app already does) so tapping a result works without first having
// to dismiss the keyboard.

import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import AppText, { FONT_FAMILY } from './AppText';
import { useTheme } from '../lib/theme';

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;
const INPUT_FONT = { fontFamily: FONT_FAMILY.body };

interface TitleSearchInputProps<T> {
  value: string;
  onChangeText: (text: string) => void;
  search: (query: string) => Promise<T[]>;
  getKey: (result: T) => string;
  getLabel: (result: T) => string;
  getSubtitle?: (result: T) => string | undefined;
  onSelect: (result: T) => void;
  placeholder?: string;
}

export default function TitleSearchInput<T>({
  value,
  onChangeText,
  search,
  getKey,
  getLabel,
  getSubtitle,
  onSelect,
  placeholder,
}: TitleSearchInputProps<T>) {
  const { theme } = useTheme();
  const [results, setResults] = useState<T[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow earlier search overwriting a faster later one -
  // only the response matching the most recent query is applied.
  const latestQueryRef = useRef('');

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChangeText = (text: string) => {
    onChangeText(text);
    setDropdownOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = text.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      latestQueryRef.current = trimmed;
      setSearching(true);
      try {
        const found = await search(trimmed);
        if (latestQueryRef.current === trimmed) {
          setResults(found);
        }
      } catch (err) {
        console.warn('Media Base: title search failed', err);
        if (latestQueryRef.current === trimmed) setResults([]);
      } finally {
        if (latestQueryRef.current === trimmed) setSearching(false);
      }
    }, DEBOUNCE_MS);
  };

  const handleSelect = (result: T) => {
    setDropdownOpen(false);
    setResults([]);
    onSelect(result);
  };

  const trimmedValue = value.trim();
  const showDropdown = dropdownOpen && trimmedValue.length >= MIN_QUERY_LENGTH;

  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => setDropdownOpen(true)}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
      />
      {showDropdown && (
        <View
          style={[
            styles.dropdown,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {searching && results.length === 0 && (
            <AppText style={{ color: theme.colors.textMuted, fontSize: 13 * theme.fontScale, padding: 12 }}>
              Searching...
            </AppText>
          )}
          {!searching && results.length === 0 && (
            <AppText style={{ color: theme.colors.textMuted, fontSize: 13 * theme.fontScale, padding: 12 }}>
              No matches for that title yet
            </AppText>
          )}
          {results.length > 0 && (
            <ScrollView style={styles.resultsList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {results.map((result) => (
                <TouchableOpacity
                  key={getKey(result)}
                  onPress={() => handleSelect(result)}
                  style={[styles.resultRow, { borderColor: theme.colors.border }]}
                >
                  <AppText numberOfLines={1} style={{ color: theme.colors.text, fontSize: 14 * theme.fontScale }}>
                    {getLabel(result)}
                  </AppText>
                  {getSubtitle?.(result) && (
                    <AppText
                      numberOfLines={1}
                      style={{ color: theme.colors.textMuted, fontSize: 12 * theme.fontScale, marginTop: 2 }}
                    >
                      {getSubtitle(result)}
                    </AppText>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', zIndex: 10 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  resultsList: { maxHeight: 220 },
  resultRow: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
