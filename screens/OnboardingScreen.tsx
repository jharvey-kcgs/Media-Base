// screens/OnboardingScreen.tsx

import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { useTheme } from '../lib/theme';
import { saveSettings } from '../lib/storage';
import { ALL_CATEGORIES, CATEGORY_LABELS, MediaCategory, DEFAULT_SETTINGS } from '../types/models';

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { theme } = useTheme();
  const [picked, setPicked] = useState<Set<MediaCategory>>(new Set());

  const toggle = (cat: MediaCategory) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const finish = async () => {
    await saveSettings({
      ...DEFAULT_SETTINGS,
      onboarded: true,
      categories: ALL_CATEGORIES.filter((c) => picked.has(c)),
    });
    onDone();
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="header" style={[styles.title, { color: theme.colors.text, fontSize: 24 * theme.fontScale }]}>
          Welcome to Media Base
        </AppText>
        <AppText style={[styles.subtitle, { color: theme.colors.textSecondary, fontSize: 15 * theme.fontScale }]}>
          Pick the kinds of media you want to track. You can change this anytime in Settings.
        </AppText>

        {ALL_CATEGORIES.map((cat) => {
          const selected = picked.has(cat);
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => toggle(cat)}
              style={[
                styles.row,
                {
                  borderColor: selected ? theme.colors.accent : theme.colors.border,
                  backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
                },
              ]}
            >
              <AppText
                style={{
                  color: selected ? theme.colors.accentText : theme.colors.text,
                  fontSize: 16 * theme.fontScale,
                }}
              >
                {CATEGORY_LABELS[cat]}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          disabled={picked.size === 0}
          onPress={finish}
          style={[
            styles.continueButton,
            { backgroundColor: picked.size === 0 ? theme.colors.border : theme.colors.accent },
          ]}
        >
          <AppText
            style={{
              color: picked.size === 0 ? theme.colors.textMuted : theme.colors.accentText,
              fontSize: 16 * theme.fontScale,
            }}
          >
            Continue
          </AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 8 },
  title: { marginBottom: 6 },
  subtitle: { marginBottom: 20 },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  footer: { padding: 20, paddingTop: 8 },
  continueButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
