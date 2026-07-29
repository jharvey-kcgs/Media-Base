// screens/ProfileSettingsScreen.tsx

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { getSettings, saveSettings } from '../lib/storage';
import { ALL_CATEGORIES, CATEGORY_LABELS, MediaCategory } from '../types/models';

export default function ProfileSettingsScreen({ navigation }: any) {
  const { theme, settings, refreshSettings } = useTheme();

  const toggle = async (cat: MediaCategory, on: boolean) => {
    // Confirmed behavior: unchecking a category hides its Home widget but
    // keeps its data - it comes back if the category is re-enabled later.
    const current = await getSettings();
    const next = new Set(current.categories);
    if (on) next.add(cat);
    else next.delete(cat);
    await saveSettings({ ...current, categories: ALL_CATEGORIES.filter((c) => next.has(c)) });
    await refreshSettings();
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.colors.accent, fontSize: 15 * theme.fontScale }}>‹ Settings</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text, fontSize: 20 * theme.fontScale }]}>Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      <Text style={[styles.hint, { color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale }]}>
        Turning a category off hides it from Home but keeps its data - turn it back on anytime.
      </Text>

      <ScrollView contentContainerStyle={styles.content}>
        {ALL_CATEGORIES.map((cat) => (
          <View key={cat} style={[styles.row, { borderColor: theme.colors.border }]}>
            <Text style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>{CATEGORY_LABELS[cat]}</Text>
            <Switch
              value={settings.categories.includes(cat)}
              onValueChange={(on) => toggle(cat, on)}
              trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
            />
          </View>
        ))}
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
  hint: { paddingHorizontal: 20, paddingBottom: 8 },
  content: { padding: 20, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
});
