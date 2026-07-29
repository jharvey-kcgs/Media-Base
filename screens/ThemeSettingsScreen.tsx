// screens/ThemeSettingsScreen.tsx

import React from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme, THEME_COLOR_OPTIONS } from '../lib/theme';
import { AppSettings } from '../types/models';

const FONT_SIZES: AppSettings['fontSize'][] = ['small', 'default', 'large'];

export default function ThemeSettingsScreen({ navigation }: any) {
  const { theme, settings, setThemeColor, setThemeMode, setFontSize } = useTheme();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="Theme" onBack={() => navigation.goBack()} backLabel="Settings" />

      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="header" style={[styles.label, { color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale }]}>
          Theme color
        </AppText>
        <View style={styles.swatchGrid}>
          {THEME_COLOR_OPTIONS.map((opt) => {
            const selected = settings.themeColor === opt.hex;
            return (
              <TouchableOpacity
                key={opt.hex}
                onPress={() => setThemeColor(opt.hex)}
                style={[
                  styles.swatchItem,
                  {
                    borderColor: selected ? theme.colors.text : theme.colors.border,
                    borderWidth: selected ? 2 : 1,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              >
                <View style={[styles.swatch, { backgroundColor: opt.hex, borderColor: theme.colors.border }]} />
                <AppText style={{ color: theme.colors.text, fontSize: 13 * theme.fontScale, marginTop: 6 }}>
                  {opt.name}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        <AppText variant="header" style={[styles.label, { color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, marginTop: 28 }]}>
          Mode
        </AppText>
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
              <AppText
                style={{
                  color: settings.themeMode === mode ? theme.colors.accentText : theme.colors.text,
                  fontSize: 15 * theme.fontScale,
                  textTransform: 'capitalize',
                }}
              >
                {mode}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>

        <AppText variant="header" style={[styles.label, { color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, marginTop: 28 }]}>
          Text size
        </AppText>
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
              <AppText
                style={{
                  color: settings.fontSize === size ? theme.colors.accentText : theme.colors.text,
                  fontSize: 15 * theme.fontScale,
                  textTransform: 'capitalize',
                }}
              >
                {size}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingTop: 8 },
  label: { marginBottom: 10 },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatchItem: { width: 76, borderRadius: 10, alignItems: 'center', paddingVertical: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1 },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choice: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
});
