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
            <AppText variant="header" style={{ color: theme.colors.text, fontSize: 15 * theme.fontScale, marginBottom: 6 }}>
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
