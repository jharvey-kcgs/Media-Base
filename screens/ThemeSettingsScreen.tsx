// screens/ThemeSettingsScreen.tsx

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, THEME_COLOR_OPTIONS } from '../lib/theme';
import { AppSettings } from '../types/models';

const FONT_SIZES: AppSettings['fontSize'][] = ['small', 'default', 'large'];

export default function ThemeSettingsScreen({ navigation }: any) {
  const { theme, settings, setThemeColor, setThemeMode, setFontSize } = useTheme();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.colors.accent, fontSize: 15 * theme.fontScale }}>‹ Settings</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text, fontSize: 20 * theme.fontScale }]}>Theme</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.label, { color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale }]}>
          Theme color
        </Text>
        <View style={styles.swatchRow}>
          {THEME_COLOR_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.hex}
              onPress={() => setThemeColor(opt.hex)}
              style={[
                styles.swatch,
                {
                  backgroundColor: opt.hex,
                  borderColor: settings.themeColor === opt.hex ? theme.colors.text : theme.colors.border,
                  borderWidth: settings.themeColor === opt.hex ? 3 : 1,
                },
              ]}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, marginTop: 24 }]}>
          Mode
        </Text>
        <View style={styles.choiceRow}>
          {(['light', 'dark'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setThemeMode(mode)}
              style={[
                styles.choice,
                {
                  backgroundColor: settings.themeMode === mode ? theme.colors.accent : theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: settings.themeMode === mode ? theme.colors.accentText : theme.colors.text,
                  fontSize: 15 * theme.fontScale,
                  textTransform: 'capitalize',
                }}
              >
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, marginTop: 24 }]}>
          Text size
        </Text>
        <View style={styles.choiceRow}>
          {FONT_SIZES.map((size) => (
            <TouchableOpacity
              key={size}
              onPress={() => setFontSize(size)}
              style={[
                styles.choice,
                {
                  backgroundColor: settings.fontSize === size ? theme.colors.accent : theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: settings.fontSize === size ? theme.colors.accentText : theme.colors.text,
                  fontSize: 15 * theme.fontScale,
                  textTransform: 'capitalize',
                }}
              >
                {size}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontWeight: '700' },
  content: { padding: 20, paddingTop: 8 },
  label: { marginBottom: 10 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 40, height: 40, borderRadius: 20 },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choice: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
});
