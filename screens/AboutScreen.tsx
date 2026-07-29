// screens/AboutScreen.tsx

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../lib/theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Profile',
    body: "Lets you pick which media categories show up as widgets on your Home screen. Turning a category off hides its widget but keeps everything you've already added, in case you turn it back on.",
  },
  {
    title: 'Category screens',
    body: "Each one lists what you've added, with sorting and filtering options specific to that category. Marking an item as not-yet-read/watched/listened/played/completed is what makes it eligible to show up as today's random suggestion on Home. Marking it done opens a place to rate and review it, and it stops appearing as a suggestion.",
  },
  {
    title: 'Data',
    body: 'Export everything to a backup file, import a previous backup, or permanently delete all your data. Deletion is all-or-nothing and always asks for confirmation twice.',
  },
  {
    title: 'Permissions',
    body: 'Shows whether camera access is currently granted and links straight to Phone Settings to change it. Camera access is only ever used for the optional scan shortcut - nothing about adding media requires it.',
  },
];

export default function AboutScreen({ navigation }: any) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="About" onBack={() => navigation.goBack()} backLabel="Settings" />

      <ScrollView contentContainerStyle={styles.content}>
        {SECTIONS.map((section, i) => (
          <View
            key={section.title}
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              i === SECTIONS.length - 1 && { marginBottom: 0 },
            ]}
          >
            <AppText variant="header" style={{ color: theme.colors.accentReadable, fontSize: 16 * theme.fontScale, marginBottom: 6 }}>
              {section.title}
            </AppText>
            <AppText style={{ color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, lineHeight: 21 }}>
              {section.body}
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
