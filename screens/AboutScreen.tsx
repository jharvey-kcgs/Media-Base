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
    body: "Each category screen (Books, Comics/Manga, Movies) lists what you've added, with a cover photo next to each item, a search box (below \"Sorted by...\") to quickly find one by name, a dedicated genre filter, and an A-Z index for jumping around a longer list. Adding an entry supports typing everything by hand, scanning a barcode, entering the ISBN/UPC directly, or searching by title and picking the right result - whichever you use, cover photos fill in automatically where one's available, and you get a chance to review and edit every field before saving. The same title can't be added twice. Tap an item's cover in Add/Edit to take a new photo, choose one from your library, or remove it - your own photo is never added to your device's Photos app, it stays inside Media Base only. The ••• menu (top right) has Add entry / Filter by... / Filter by genre... / Delete entries - Delete switches the screen into a selection mode so you can remove one or many entries at once. Every category is stored completely separately, so nothing added under one can ever end up in another. Marking an item as not-yet-read/watched/listened/played/completed is what makes it eligible to show up as today's random suggestion on Home. Marking it done opens a place to rate and review it, and it stops appearing as a suggestion.",
  },
  {
    title: 'Data',
    body: 'Save everything - your entries and their cover photos - to one backup file, restore from a previous backup file, or permanently delete all your data. Deletion is all-or-nothing and always asks for confirmation twice.',
  },
  {
    title: 'Permissions',
    body: "Shows whether Camera and Photo Library access are currently granted, always kept in sync with your actual Phone Settings, and links straight there to change either. Camera is only used for the optional scan shortcut; Photo Library is only used when you choose \"Choose from Library\" for a cover photo - taking a new photo with the camera doesn't need it. Also has a Daily reminder toggle: one notification at 10:00 AM nudging you to check today's recommendations, with no specific pick named.",
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
