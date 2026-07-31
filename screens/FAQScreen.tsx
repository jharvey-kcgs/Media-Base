// screens/FAQScreen.tsx

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../lib/theme';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Do I have to scan a barcode to add something?',
    a: 'No - scanning is always optional. Every entry form lets you type everything in by hand instead.',
  },
  {
    q: "Why isn't a category showing on my Home screen?",
    a: 'Check Settings → Profile - it may have been turned off. Turning it back on brings its widget and data back.',
  },
  {
    q: 'What happens to my rating after I mark something as done?',
    a: 'It opens a place to rate (1-5 stars) and leave a written review, and the item stops showing up as a suggestion.',
  },
  {
    q: 'Can an entry have more than one genre?',
    a: "Yes - up to 4. They're matched against a built-in list of real genre terms so results stay clean rather than picking up stray keywords. Filter by any of them from the ••• menu → Filter by genre...",
  },
  {
    q: 'Can I delete more than one entry at a time?',
    a: 'Yes - tap ••• → Delete entries to switch into a selection mode, tap as many entries as you want, then Delete.',
  },
  {
    q: 'Can a Comic/Manga end up under Books, or a Book under Comics/Manga?',
    a: "No - they're stored completely separately, so nothing added under one screen can ever show up in the other. If you scan or enter an ISBN that's clearly classified as the wrong type, the app won't auto-fill it and tells you which screen to use instead.",
  },
];

export default function FAQScreen({ navigation }: any) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="FAQ" onBack={() => navigation.goBack()} backLabel="Settings" />

      <ScrollView contentContainerStyle={styles.content}>
        {FAQS.map((item, i) => (
          <View
            key={item.q}
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              i === FAQS.length - 1 && { marginBottom: 0 },
            ]}
          >
            <AppText variant="header" style={{ color: theme.colors.accentReadable, fontSize: 15 * theme.fontScale, marginBottom: 6 }}>
              {item.q}
            </AppText>
            <AppText style={{ color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, lineHeight: 20 }}>
              {item.a}
            </AppText>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingTop: 8 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
});
