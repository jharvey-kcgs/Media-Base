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
    body: "Each category screen (Books, Comics/Manga, Movies) lists what you've added, with a search box (below \"Sorted by...\") to quickly find one item by name, plus a dedicated genre filter and an A-Z index for jumping around a longer list. Adding an entry supports typing everything by hand, scanning a barcode, entering the ISBN/UPC directly, or searching by title and picking the right result - whichever you use, you get a chance to review and edit every field before saving, and the same title can't be added twice. The ••• menu (top right) has Add entry / Filter by... / Filter by genre... / Delete entries - Delete switches the screen into a selection mode so you can remove one or many entries at once. Every category is stored completely separately, so nothing added under one can ever end up in another. Marking an item as not-yet-read/watched/listened/played/completed is what makes it eligible to show up as today's random suggestion on Home. Marking it done opens a place to rate and review it, and it stops appearing as a suggestion.",
  },
  {
    title: 'Data',
    body: 'Export everything to a backup file, import a previous backup, or permanently delete all your data. Deletion is all-or-nothing and always asks for confirmation twice.',
  },
  {
    title: 'Permissions',
    body: "Shows whether camera access is currently granted and links straight to Phone Settings to change it - camera access is only ever used for the optional scan shortcut, nothing about adding media requires it. Also has a Daily reminder toggle: one notification at 10:00 AM nudging you to check today's recommendations, with no specific pick named.",
  },
  {
    title: 'Credits',
    body: 'This product uses the TMDb API but is not endorsed or certified by TMDb.',
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
