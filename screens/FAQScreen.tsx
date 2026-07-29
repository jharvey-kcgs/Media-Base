// screens/FAQScreen.tsx

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.colors.accent, fontSize: 15 * theme.fontScale }}>‹ Settings</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text, fontSize: 20 * theme.fontScale }]}>FAQ</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {FAQS.map((item) => (
          <View key={item.q} style={styles.item}>
            <Text style={[styles.q, { color: theme.colors.text, fontSize: 15 * theme.fontScale }]}>{item.q}</Text>
            <Text style={[styles.a, { color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale }]}>
              {item.a}
            </Text>
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
  content: { padding: 20, paddingTop: 8 },
  item: { marginBottom: 18 },
  q: { fontWeight: '600', marginBottom: 4 },
  a: { lineHeight: 20 },
});
